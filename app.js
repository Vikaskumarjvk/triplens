/* LoungeLens app controller — DOM glue over LL_ENGINE. Simple + Advanced modes. */
(function () {
  "use strict";
  const E = window.LL_ENGINE, CARDS = window.LL_CARDS, LOUNGES = window.LL_LOUNGES, META = window.LL_META, SELF = window.LL_SELF;
  const BRAND = window.LL_BRAND;
  const FE = window.LL_FLIGHT_ENGINE, FLIGHTS = window.LL_FLIGHTS;
  const TE = window.LL_TRIP_ENGINE, HOTELS = window.LL_HOTELS, DEALS = window.LL_DEALS;
  const IT = window.LL_ITINERARY, BUD = window.LL_BUDGET;
  const GEO = window.LL_GEO, LD = window.LL_LIVE;
  const PROFILE = window.LL_PROFILE, SOURCES = window.LL_SOURCES, SLINKS = window.LL_SOURCE_LINKS, AUTH = window.LL_AUTH, SUGGEST = window.LL_SUGGEST;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const NOW = new Date();

  // ---- state (persisted) -------------------------------------------------
  const KEY = "loungelens.v2";
  let state = load();
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      return s && s.wallet ? s : blank();
    } catch (e) { return blank(); }
  }
  function blank() { return { wallet: [], visitLog: [], spend: {}, mode: "simple", trip: ["Hyderabad", ""], experiences: [], onboarded: false, profileName: "", suggestions: [], flight: { from: "", to: "", date: "" }, plan: { from: "", to: "", depart: "", nights: 3, adults: 2 }, hotel: { city: "", checkin: "", checkout: "", adults: 2 }, ontrip: { city: "" }, trips: [], openTripId: null, tripSeq: 1, fx: { from: "INR", to: "USD", amount: 1000 } }; }

  // account store (login): { username: { pinHash, data } } + the active username
  const ACCT_KEY = "loungelens.accounts";
  const SESSION_KEY = "loungelens.session";
  function loadAccounts() { try { return JSON.parse(localStorage.getItem(ACCT_KEY)) || {}; } catch (e) { return {}; } }
  function saveAccounts(s) { localStorage.setItem(ACCT_KEY, JSON.stringify(s)); }
  let accounts = loadAccounts();
  let activeUser = localStorage.getItem(SESSION_KEY) || null;

  // if a user is logged in, prefer their saved data as the live state
  if (activeUser && accounts[activeUser] && accounts[activeUser].data) {
    state = accounts[activeUser].data;
  }

  function save() {
    localStorage.setItem(KEY, JSON.stringify(state)); // device fallback copy
    if (activeUser && accounts[activeUser]) {
      accounts = AUTH.saveAccountData(accounts, activeUser, state);
      saveAccounts(accounts);
      cloudSync(); // no-op unless cloud mode is configured
    }
  }

  // ---- helpers -----------------------------------------------------------
  // escape any value that came from outside our own dataset (external API
  // responses, user-typed input) before it goes into innerHTML — prevents XSS.
  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const card = (id) => CARDS.find((c) => c.id === id);
  const fmtRs = (n) => "₹" + Number(n).toLocaleString("en-IN");
  const visitsLabel = (c) =>
    c.domesticVisits === "unlimited" ? "Unlimited visits" :
    (Number(c.domesticVisits) || 0) === 0 ? "No lounge" :
    (Number(c.domesticVisits)) + " / " + c.period;
  // confidence badge now reflects AGE DECAY: if a fact has gone stale, the badge
  // drops a level and shows a clock, so the app visibly doubts its own old data.
  function confBadge(stated) {
    const d = SELF.ageConfidence(stated, META.lastReviewed, NOW);
    if (!d.decayed) return `<span class="conf ${d.effective}" title="how sure we are">${d.effective}</span>`;
    return `<span class="conf ${d.effective}" title="${d.reason}">${d.effective} ⏱</span>`;
  }
  const easeWord = (e) => ["", "Invite only", "Hard to get", "Moderate", "Easy to get", "Very easy"][e] || "—";
  const speedWord = (s) => ({ instant: "⚡ instant", fast: "🟢 arrives fast", normal: "🟡 normal wait", slow: "🔴 slow approval" }[s] || s || "");
  const railWord = (r) => (META.railWords && META.railWords[r]) || r;
  const isSimple = () => state.mode === "simple";
  const cardType = (c) => (c.type === "debit" ? "debit" : "credit"); // default credit
  const typeBadge = (c) => cardType(c) === "debit"
    ? `<span class="chip type-debit">DEBIT</span>`
    : `<span class="chip type-credit">CREDIT</span>`;

  // ---- card-art: render a real mini credit-card visual (gradient + issuer
  // badge + network mark + chip) instead of a plain text row. Pure string. ----
  function cardArt(c, opts) {
    opts = opts || {};
    const ib = BRAND.issuerBrand(c.issuer);
    const nb = BRAND.networkBrand(c.network);
    const tier = BRAND.tierClass(c);
    const lounge = c.domesticVisits === "unlimited" ? "∞" :
      (Number(c.domesticVisits) || 0) > 0 ? (c.domesticVisits + "") : "";
    const loungeTag = lounge
      ? `<span class="ca-lounge">🛋 ${lounge}${c.domesticVisits === "unlimited" ? "" : "/" + (c.period || "yr").slice(0, 2)}</span>`
      : "";
    // tiny variant: a compact badge-only thumbnail for inline use (trip lines)
    if (opts.tiny) {
      return `<span class="cardart-tiny ${tier}" style="--ca1:${ib.c1};--ca2:${ib.c2};" title="${c.name} · ${c.issuer}">
        <span class="cat-badge">${ib.short || BRAND.initials(c.issuer)}</span>
        <span class="cat-net" style="background:${nb.grad};color:${nb.color};">${nb.label}</span>
      </span>`;
    }
    return `<div class="cardart ${tier} ${opts.small ? "ca-sm" : ""}" style="--ca1:${ib.c1};--ca2:${ib.c2};">
      <div class="ca-sheen"></div>
      <div class="ca-top">
        <span class="ca-badge">${ib.short || BRAND.initials(c.issuer)}</span>
        ${loungeTag}
      </div>
      <div class="ca-chip"></div>
      <div class="ca-name">${c.name}</div>
      <div class="ca-foot">
        <span class="ca-issuer">${c.issuer}</span>
        <span class="ca-net" style="background:${nb.grad};color:${nb.color};">${nb.label}</span>
      </div>
    </div>`;
  }
  // ---- card detail modal: full card profile + the lounges IT opens --------
  function openCardDetail(cardId) {
    const c = card(cardId);
    if (!c) return;
    // which lounges does THIS card's rails open?
    const myRails = new Set(c.programs || []);
    const opens = LOUNGES.filter((l) => (l.programs || []).some((p) => myRails.has(p)));
    const airports = opens.filter((l) => l.type !== "railway");
    const railways = opens.filter((l) => l.type === "railway");
    const inWallet = state.wallet.includes(c.id);
    const stat = (n, l) => `<div class="dstat"><div class="dstat-n">${n}</div><div class="dstat-l">${l}</div></div>`;
    const loungeLine = (l) => {
      const loc = l.type === "railway" ? `🚆 ${l.station || ""}` : `✈️ ${l.airport || ""} ${l.terminal || ""}`.trim();
      return `<div class="dlounge"><span class="dl-name">${l.name}</span><span class="dl-loc">${loc} · ${l.city}</span></div>`;
    };
    const links = (SLINKS && SLINKS.forCard) ? sourceLinksHtml(SLINKS.forCard(c), "card") : "";
    $("#card-modal-body").innerHTML = `
      <div class="detail-hero">${cardArt(c)}
        <div class="detail-head">
          <div class="card-title" style="font-size:19px;">${c.name} ${confBadge(c.confidence)}</div>
          <div class="card-sub">${c.issuer} · ${BRAND.networkBrand(c.network).label || c.network} · ${typeBadge(c)}</div>
          <div class="row" style="margin-top:10px;">
            ${inWallet ? `<span class="chip good">✓ in your wallet</span>` : `<button class="act mini" data-detail-add="${c.id}">+ Add to wallet</button>`}
          </div>
        </div>
      </div>
      <div class="dstat-row">
        ${stat(c.domesticVisits === "unlimited" ? "∞" : (Number(c.domesticVisits) || 0), "Lounge visits / " + (c.period || "yr"))}
        ${stat(easeWord(c.ease).split(" ")[0], "Ease")}
        ${stat(c.ltf ? "Yes" : "No", "Lifetime free")}
        ${stat(c.spendGate ? "Yes" : "No", "Spend gate")}
      </div>
      ${c.spendGate ? `<div class="gate-warn" style="margin-top:12px;">⚠️ Spend gate: ${c.spendGate.note || ("spend ₹" + c.spendGate.amount + " per " + c.spendGate.per)}</div>` : ""}
      <div class="section-h">Fee &amp; eligibility</div>
      <p class="card-sub">${c.feeNote || ""}${c.eligibility ? "<br>" + c.eligibility : ""}</p>
      <div class="section-h">Lounges this card can open (${opens.length})</div>
      <p class="card-sub" style="margin-bottom:8px;">By access rail — actual entry still depends on visits left + any spend gate.</p>
      ${airports.length ? `<div class="dlounge-group"><b>✈️ Airports (${airports.length})</b>${airports.map(loungeLine).join("")}</div>` : ""}
      ${railways.length ? `<div class="dlounge-group"><b>🚆 Railway (${railways.length})</b>${railways.map(loungeLine).join("")}</div>` : ""}
      ${opens.length === 0 ? `<div class="empty" style="padding:20px;">This card has no lounge access rails.</div>` : ""}
      ${c.verify ? `<div class="verify" style="margin-top:12px;">✔ verify: ${c.verify}</div>` : ""}
      ${links}
    `;
    $("#card-modal").hidden = false;
    const addBtn = $("[data-detail-add]");
    if (addBtn) addBtn.onclick = () => {
      if (!state.wallet.includes(c.id)) state.wallet.push(c.id);
      save(); render(); openCardDetail(c.id); // refresh modal to show "in wallet"
      toast("Added to your wallet.");
    };
  }
  // global wiring for any [data-detail] button (works across re-renders)
  document.addEventListener("click", (e) => {
    const t = e.target.closest && e.target.closest("[data-detail]");
    if (t) { e.stopPropagation(); openCardDetail(t.dataset.detail); }
  });
  if ($("#card-modal-close")) $("#card-modal-close").onclick = () => { $("#card-modal").hidden = true; };

  // render a row of external source links (official access apps + research bases).
  // Honest: these LINK OUT — the app can't grant access itself.
  const relDots = (n) => "●".repeat(n) + "○".repeat(5 - n);
  // compact "confirm in the official app" link for a lounge in the trip planner.
  // picks the highest-reliability access service whose rail matches the lounge.
  function tripConfirmLink(lounge) {
    const access = (SLINKS.forLounge(lounge) || []).filter((x) => x.kind === "access");
    if (!access.length) return "";
    const best = access.sort((a, b) => (b.reliability || 0) - (a.reliability || 0))[0];
    return `<a class="confirm-link" href="${best.url}" target="_blank" rel="noopener noreferrer">✔ confirm in ${best.label.replace(/^Open /, "")} →</a>`;
  }
  function sourceLinksHtml(links, ctx) {
    if (!links || !links.length) return "";
    const access = links.filter((l) => l.kind === "access");
    const info = links.filter((l) => l.kind !== "access");
    const btn = (l) => `<a class="src-link ${l.kind}" href="${l.url}" target="_blank" rel="noopener noreferrer" title="${(l.what || "").replace(/"/g, "'")}">${l.label}${l.reliability ? ` <span class="rel">${relDots(l.reliability)}</span>` : ""}</a>`;
    return `<div class="src-block">
      ${access.length ? `<div class="src-row"><span class="src-lbl">Use / confirm access:</span>${access.map(btn).join("")}</div>` : ""}
      <div class="src-row"><span class="src-lbl">Cross-check:</span>${info.map(btn).join("")}</div>
    </div>`;
  }

  // ---- view mode (Simple/Advanced toggle removed 2026-06-22) -------------
  // One clean smart view: friendly plain-language labels (what Simple did well)
  // PLUS the useful detail Advanced used to hide (rails, eligibility, notes) —
  // shown cleanly, always. `isSimple()` stays true so labels/layout stay friendly;
  // the body no longer carries simple-mode, so `.adv-only` content is visible.
  function applyMode() {
    document.body.classList.remove("simple-mode");
    document.body.classList.add("advanced-mode");
  }

  // ---- collapsible nav (mobile: folds away so it never covers content) ----
  const NAV_KEY = "loungelens.navCollapsed";
  const isMobileNav = () => window.matchMedia("(max-width: 959px)").matches;
  function setNavCollapsed(collapsed) {
    document.body.classList.toggle("nav-collapsed", collapsed);
    const t = $("#nav-toggle");
    if (t) t.setAttribute("aria-expanded", String(!collapsed));
    try { localStorage.setItem(NAV_KEY, collapsed ? "1" : "0"); } catch (e) {}
  }
  function updateNavToggleLabel(view) {
    const btn = $$("nav button").find((b) => b.dataset.view === view);
    const lbl = $("#nav-toggle-label");
    if (lbl && btn) lbl.textContent = btn.textContent.trim();
  }
  if ($("#nav-toggle")) $("#nav-toggle").onclick = () => setNavCollapsed(!document.body.classList.contains("nav-collapsed"));

  // ---- routing (hash-based: deep-linkable + back button works) -----------
  const VIEWS = $$("nav button").map((b) => b.dataset.view).filter(Boolean);
  function showView(view, push) {
    if (!VIEWS.includes(view)) view = "flights";
    $$("nav button").forEach((x) => x.classList.toggle("active", x.dataset.view === view));
    $$(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + view));
    updateNavToggleLabel(view);
    // on mobile, fold the menu away after a pick so it stops covering the page
    if (isMobileNav()) setNavCollapsed(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (push && location.hash !== "#" + view) history.replaceState(null, "", "#" + view);
  }
  $$("nav button").forEach((b) =>
    b.addEventListener("click", () => b.dataset.view && showView(b.dataset.view, true))
  );
  // initial collapsed state: respect saved pref; default collapsed on mobile
  (function initNav() {
    let saved = null;
    try { saved = localStorage.getItem(NAV_KEY); } catch (e) {}
    const collapsed = saved != null ? saved === "1" : isMobileNav();
    setNavCollapsed(collapsed);
    const active = $$("nav button").find((b) => b.classList.contains("active"));
    updateNavToggleLabel(active ? active.dataset.view : "flights");
  })();
  // respond to back/forward + deep links
  window.addEventListener("hashchange", () => showView((location.hash || "").replace("#", ""), false));
  // on load, honor a deep-link hash if present
  const initialHash = (location.hash || "").replace("#", "");
  if (initialHash && VIEWS.includes(initialHash)) showView(initialHash, false);

  // ======================== TRIP PLANNER (the heart) ======================
  function cityDatalist() {
    const cs = E.cities(LOUNGES);
    $("#city-list").innerHTML = cs.map((c) => `<option value="${c.city}">`).join("");
  }

  function renderTripInputs() {
    $("#leg-from").value = state.trip[0] || "";
    const extra = state.trip.slice(1);
    $("#leg-extra").innerHTML = extra.map((v, i) => `
      <div class="leg-row">
        <span class="leg-pin">📍</span>
        <input class="leg-input" id="leg-${i + 1}" name="leg-${i + 1}" aria-label="Destination city ${i + 1}" data-leg="${i + 1}" placeholder="Destination city" list="city-list" value="${v || ""}" />
        ${extra.length > 1 || i > 0 ? `<button class="act ghost mini" data-delleg="${i + 1}">✕</button>` : ""}
      </div>`).join("");
    $("#leg-from").oninput = (e) => { state.trip[0] = e.target.value; save(); };
    $$("[data-leg]").forEach((inp) => inp.oninput = (e) => { state.trip[Number(inp.dataset.leg)] = e.target.value; save(); });
    $$("[data-delleg]").forEach((b) => b.onclick = () => { state.trip.splice(Number(b.dataset.delleg), 1); save(); renderTripInputs(); });
  }
  $("#add-leg").onclick = () => { state.trip.push(""); save(); renderTripInputs(); };
  $("#plan-btn").onclick = () => { renderTripResult(); $("#trip-result").scrollIntoView({ behavior: "smooth", block: "start" }); };

  function renderTripResult() {
    const legs = state.trip.map((c) => (c || "").trim()).filter(Boolean);
    if (legs.length === 0) { $("#trip-result").innerHTML = `<div class="empty">Add at least one city above.</div>`; return; }
    if (state.wallet.length === 0) {
      $("#trip-result").innerHTML = `<div class="nudge">👋 You haven't added your cards yet. <b class="link" data-goto="addcard">Add the cards you hold</b> and I'll tell you exactly which lounges open on this trip — or <b class="link" data-goto="recommend">see which card to get</b> before you fly.</div>`;
      wireGoto();
      return;
    }
    const trip = E.planTrip(legs, state.wallet, CARDS, LOUNGES, state.visitLog, state.spend, NOW);
    const head = `
      <div class="trip-summary">
        <div class="big-verdict ${trip.covered === trip.total ? "good" : trip.covered > 0 ? "warn" : "bad"}">
          ${trip.covered === trip.total
            ? `🎉 You're covered in all ${trip.total} cities`
            : trip.covered > 0
              ? `✅ Covered in ${trip.covered} of ${trip.total} cities`
              : `⚠️ No lounge access yet on this trip`}
        </div>
        ${trip.gaps.length ? `<div class="gap-line">Gaps: ${trip.gaps.map((g) => g.city).join(", ")}. <b class="link" data-goto="recommend">Fix with a card →</b></div>` : ""}
      </div>`;

    const legCards = trip.plan.map((leg) => {
      if (leg.status === "no-lounge") {
        return `<div class="leg-card muted">
          <div class="leg-head"><span class="leg-city">${leg.city}</span><span class="chip">no lounge data</span></div>
          <div class="card-sub">No lounge on file for ${leg.city}. Might still have one — check at the airport.</div>
        </div>`;
      }
      const statusChip = leg.status === "covered" ? `<span class="chip good">you're in 👍</span>`
        : leg.status === "blocked" ? `<span class="chip warn">blocked</span>`
        : `<span class="chip bad">no card opens it</span>`;

      // SIMPLE mode: just the verdict + best card per lounge. ADVANCED: full matches.
      const lounges = leg.loungeRows.map((row) => {
        const l = row.lounge;
        const loc = l.type === "railway" ? `🚆 ${l.station}` : `✈️ ${l.airport} ${l.terminal || ""}`.trim();
        // "confirm in the official app" link for the primary access rail of this lounge
        const confirmLink = tripConfirmLink(l);
        if (isSimple()) {
          if (row.open) {
            return `<div class="lounge-line ok"><span class="ll-name">${l.name}</span> <span class="ll-loc">${loc}</span>
              <div class="use-card">${cardArt(row.best.card, { tiny: true })} use <b>${row.best.card.name}</b>${row.best.quota.unlimited ? "" : ` · ${row.best.quota.left} left`}</div>
              ${confirmLink}</div>`;
          }
          const why = row.matches.length === 0 ? "none of your cards" :
            (row.best && !row.best.spend.met) ? `${row.best.card.name} is spend-locked` : `${row.best ? row.best.card.name : "your card"} has 0 visits left`;
          return `<div class="lounge-line no"><span class="ll-name">${l.name}</span> <span class="ll-loc">${loc}</span>
            <div class="use-card bad">can't enter — ${why}</div></div>`;
        }
        // advanced
        const openers = row.matches.length ? row.matches.map((m) => `
          <div class="opener ${m.usable ? "usable" : "unusable"}">
            ${cardArt(m.card, { tiny: true })} <span class="who">${m.card.name}</span> via ${m.sharedRails.map(railWord).join(", ")}
            ${m.usable ? `<span class="chip good">${m.quota.unlimited ? "unlimited" : m.quota.left + " left"}</span>`
              : (!m.spend.met ? `<span class="chip warn">spend-locked</span>` : `<span class="chip bad">0 left</span>`)}
          </div>`).join("") : `<div class="card-sub">No card of yours opens this.</div>`;
        return `<div class="lounge-block">
          <div class="card-head"><div><b>${l.name}</b> ${confBadge(l.confidence)}<div class="card-sub">${loc}</div></div></div>
          ${openers}
          ${l.verify ? `<span class="verify">✔ ${l.verify}</span>` : ""}
          ${confirmLink}
        </div>`;
      }).join("");

      return `<div class="leg-card ${leg.status}">
        <div class="leg-head"><span class="leg-city">${leg.city}</span>${statusChip}</div>
        ${lounges}
      </div>`;
    }).join("");

    $("#trip-result").innerHTML = head + legCards;
    wireGoto();
  }

  function wireGoto() {
    $$("[data-goto]").forEach((el) => el.onclick = () => showView(el.dataset.goto, true));
  }

  // ============================ WALLET ====================================
  // circular SVG gauge for the wallet-strength score
  function scoreGauge() {
    const ws = E.walletScore(state.wallet, CARDS, LOUNGES, state.visitLog, state.spend, NOW);
    const el = $("#wallet-score");
    if (!el) return;
    if (!ws.score) { el.innerHTML = ""; return; }
    const R = 52, C = 2 * Math.PI * R, off = C * (1 - ws.score / 100);
    const gradeLabel = { elite: "Elite setup", strong: "Strong", decent: "Decent", basic: "Basic", none: "" }[ws.grade];
    const bars = ws.factors.map((f) =>
      `<div class="ws-factor"><span>${f.label}</span><div class="ws-bar"><div class="ws-bar-fill" style="width:${f.pct}%"></div></div><b>${f.pct}%</b></div>`).join("");
    el.innerHTML = `
      <div class="ws-card grade-${ws.grade}">
        <div class="ws-gauge">
          <svg viewBox="0 0 120 120" width="120" height="120">
            <circle cx="60" cy="60" r="${R}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="10"/>
            <circle cx="60" cy="60" r="${R}" fill="none" stroke="url(#wsgrad)" stroke-width="10" stroke-linecap="round"
              stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 60 60)" class="ws-arc"/>
            <defs><linearGradient id="wsgrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#9b7bff"/><stop offset="100%" stop-color="#5b8cff"/></linearGradient></defs>
            <text x="60" y="58" text-anchor="middle" class="ws-num">${ws.score}</text>
            <text x="60" y="76" text-anchor="middle" class="ws-of">/ 100</text>
          </svg>
        </div>
        <div class="ws-body">
          <div class="ws-grade">${gradeLabel} wallet ${ws.hasUnlimited ? "👑" : ""}</div>
          <div class="ws-factors">${bars}</div>
          <div class="row"><button class="act mini" data-goto="recommend">Improve it — get a card →</button></div>
        </div>
      </div>`;
    wireGoto();
  }

  function renderWallet() {
    scoreGauge();
    const summary = E.walletSummary(state.wallet, CARDS, state.visitLog, state.spend, NOW);
    $("#wallet-stats").innerHTML = `
      <div class="stat"><div class="num">${summary.cardCount}</div><div class="lbl">Cards</div></div>
      <div class="stat good"><div class="num">${summary.hasUnlimited ? "∞" : summary.totalLeft}</div><div class="lbl">Visits left now</div></div>
      <div class="stat ${summary.gatedBlocked ? "warn" : ""}"><div class="num">${summary.gatedBlocked}</div><div class="lbl">Spend-locked</div></div>`;

    $("#gate-warnings").innerHTML = summary.gatedAtRisk.map((g) => `
      <div class="gate-warn">⚠️ <b>${g.card.name}</b> is locked. Spend ${fmtRs(g.spend.needed)} this period to unlock lounges; you've logged ${fmtRs(g.spend.spent)} — short by <b>${fmtRs(g.spend.shortfall)}</b>.<div class="adv-only card-sub" style="margin-top:4px;">${g.spend.note || ""}</div></div>`).join("");

    if (summary.cardCount === 0) {
      $("#wallet-cards").innerHTML = `<div class="empty">No cards yet. Go to <b class="link" data-goto="addcard">Add Cards</b> and tap the ones you hold.</div>`;
      wireGoto(); return;
    }

    $("#wallet-cards").innerHTML = summary.perCard.map(({ card: c, quota, spend }) => {
      const left = quota.unlimited ? "∞" : quota.left;
      const allowance = quota.unlimited ? "∞" : quota.allowance;
      const pct = quota.unlimited ? 100 : (quota.allowance ? (quota.left / quota.allowance) * 100 : 0);
      const fill = quota.unlimited ? "" : (quota.left === 0 ? "empty" : quota.left <= 1 ? "low" : "");
      const rails = (c.programs || []).map((p) => `<span class="chip">${isSimple() ? railWord(p) : p}</span>`).join("");
      const spendBox = c.spendGate ? `
        <div class="row">
          <span class="card-sub">Spent this period:</span>
          <input class="spend-input" id="spend-${c.id}" name="spend-${c.id}" aria-label="Spend this period for ${c.name}" type="number" min="0" value="${state.spend[c.id] || 0}" data-spend="${c.id}" />
          <span class="chip ${spend.met ? "good" : "warn"}">${spend.met ? "unlocked" : "locked"}</span>
        </div>` : "";
      return `
      <div class="card cardrow">
        ${cardArt(c)}
        <div class="cardrow-body">
          <div class="card-head">
            <div>
              <div class="card-title">${c.name} ${confBadge(c.confidence)}</div>
              <div class="card-sub">${c.issuer} · ${visitsLabel(c)}${c.railway ? " · 🚆 railway" : ""}</div>
            </div>
            <button class="act ghost mini" data-remove="${c.id}">Remove</button>
          </div>
          <div class="card-sub" style="margin-top:8px;">Visits left: <b>${left}</b> / ${allowance}</div>
          <div class="quota-bar"><div class="quota-fill ${fill}" style="width:${pct}%"></div></div>
          ${spendBox}
          <div class="row">${rails || '<span class="chip bad">no lounge access</span>'}</div>
          <div class="row">
            <button class="act mini" data-logvisit="${c.id}" ${(!quota.unlimited && quota.left === 0) || !spend.met ? "disabled" : ""}>I used this (-1)</button>
            ${state.visitLog.some((v) => v.cardId === c.id) ? `<button class="act ghost mini" data-undovisit="${c.id}">undo</button>` : ""}
            <button class="act ghost mini" data-detail="${c.id}">Details →</button>
          </div>
        </div>
      </div>`;
    }).join("");

    $$("[data-spend]").forEach((inp) => inp.onchange = () => { state.spend[inp.dataset.spend] = Number(inp.value) || 0; save(); render(); });
    $$("[data-remove]").forEach((b) => b.onclick = () => { state.wallet = state.wallet.filter((id) => id !== b.dataset.remove); save(); render(); });
    $$("[data-logvisit]").forEach((b) => b.onclick = () => { state.visitLog.push({ cardId: b.dataset.logvisit, ts: new Date().toISOString() }); save(); render(); });
    $$("[data-undovisit]").forEach((b) => b.onclick = () => {
      const id = b.dataset.undovisit;
      for (let i = state.visitLog.length - 1; i >= 0; i--) if (state.visitLog[i].cardId === id) { state.visitLog.splice(i, 1); break; }
      save(); render();
    });
    wireGoto();
  }

  // ============================ LOUNGES ===================================
  let loungeCityFilled = false;
  function fillLoungeCities() {
    const sel = $("#lounge-city");
    if (!sel || loungeCityFilled) return;
    const cities = [...new Set(LOUNGES.map((l) => l.city).filter(Boolean))].sort();
    sel.innerHTML = '<option value="">All cities</option>' + cities.map((c) => `<option value="${c}">${c}</option>`).join("");
    loungeCityFilled = true;
  }

  function renderLounges() {
    fillLoungeCities();
    const q = ($("#lounge-search").value || "").toLowerCase();
    const type = $("#lounge-type").value;
    const city = ($("#lounge-city") && $("#lounge-city").value) || "";
    const onlyOpen = $("#lounge-filter").value === "open";
    const sort = ($("#lounge-sort") && $("#lounge-sort").value) || "default";
    const cov = E.coverage(state.wallet, CARDS, LOUNGES, state.visitLog, state.spend, NOW, type ? { type } : null);

    $("#coverage-stats").innerHTML = `
      <div class="stat good"><div class="num">${cov.openCount}</div><div class="lbl">You can enter</div></div>
      <div class="stat"><div class="num">${cov.total}</div><div class="lbl">Lounges listed</div></div>
      <div class="stat"><div class="num">${cov.total ? Math.round((cov.openCount / cov.total) * 100) : 0}%</div><div class="lbl">Coverage</div></div>`;

    let rows = cov.list.filter(({ lounge: l }) =>
      `${l.name} ${l.city} ${l.airport || ""} ${l.station || ""} ${l.terminal || ""}`.toLowerCase().includes(q));
    if (city) rows = rows.filter((r) => r.lounge.city === city);
    if (onlyOpen) rows = rows.filter((r) => r.open);
    if (sort === "open") rows = rows.slice().sort((a, b) => (b.open ? 1 : 0) - (a.open ? 1 : 0));
    else if (sort === "city") rows = rows.slice().sort((a, b) => (a.lounge.city || "").localeCompare(b.lounge.city || ""));
    if (rows.length === 0) { $("#lounge-list").innerHTML = `<div class="empty">No lounges match these filters.</div>`; return; }

    $("#lounge-list").innerHTML = rows.map(({ lounge: l, matches, open, blockedOnly }) => {
      const cls = open ? "open" : blockedOnly ? "blocked" : "closed";
      const loc = l.type === "railway" ? `🚆 ${l.station} · ${l.city}` : `✈️ ${l.airport} ${l.terminal || ""} · ${l.city}`;
      const rails = (l.programs || []).map((p) => `<span class="chip ${p === "railway" || p === "rupay" || p === "payperuse" ? "rail" : ""}">${isSimple() ? railWord(p) : p}</span>`).join("");
      const openers = matches.length
        ? matches.map((m) => `
            <div class="opener ${m.usable ? "usable" : "unusable"}">
              ${cardArt(m.card, { tiny: true })} <span class="who">${m.card.name}</span>${isSimple() ? "" : ` via ${m.sharedRails.map(railWord).join(", ")}`}
              ${m.usable ? `<span class="chip good">${m.quota.unlimited ? "unlimited" : m.quota.left + " left"}</span>`
                : (!m.spend.met ? `<span class="chip warn">spend-locked</span>` : `<span class="chip bad">0 left</span>`)}
            </div>`).join("")
        : `<div class="card-sub" style="margin-top:8px;">None of your cards open this one.</div>`;
      return `
      <div class="lounge ${cls}">
        <div class="card-head">
          <div><div class="card-title">${l.name} ${confBadge(l.confidence)}</div><div class="card-sub">${loc}</div></div>
          ${open ? '<span class="chip good">ENTER 👍</span>' : blockedOnly ? '<span class="chip warn">BLOCKED</span>' : '<span class="chip">no card</span>'}
        </div>
        <div class="row adv-only">${rails}</div>
        ${openers}
        ${matches.length ? `<div class="row exp-row"><span class="card-sub">Been here?</span>
          <button class="act ghost mini" data-exp-in="${l.id}|${(matches[0] || {}).card ? matches[0].card.id : ""}">✅ got in</button>
          <button class="act ghost mini" data-exp-no="${l.id}|${(matches[0] || {}).card ? matches[0].card.id : ""}">❌ refused</button>
          ${expNote(l.id)}
        </div>` : ""}
        ${l.notes ? `<div class="notes adv-only">${l.notes}</div>` : ""}
        ${l.verify ? `<span class="verify">✔ ${l.verify}</span>` : ""}
        ${sourceLinksHtml(SLINKS.forLounge(l), "lounge")}
      </div>`;
    }).join("");

    // wire experience logging — this is the self-learning input
    $$("[data-exp-in]").forEach((b) => b.onclick = () => logExp(b.dataset.expIn, "in"));
    $$("[data-exp-no]").forEach((b) => b.onclick = () => logExp(b.dataset.expNo, "refused"));
  }

  function expNote(loungeId) {
    const sig = SELF.experienceSignals(state.experiences);
    const s = sig[loungeId];
    if (!s) return "";
    const cls = s.nudge === "reinforced" ? "good" : s.nudge === "contradicted" ? "bad" : "warn";
    return `<span class="chip ${cls}" title="${s.note}">you: ${s.in}✅ ${s.refused}❌</span>`;
  }
  function logExp(payload, outcome) {
    const [loungeId, cardId] = payload.split("|");
    state.experiences.push({ loungeId, cardId, outcome, ts: new Date().toISOString() });
    save(); render();
  }
  ["#lounge-search", "#lounge-type", "#lounge-city", "#lounge-filter", "#lounge-sort"].forEach((sel) => {
    const el = $(sel); if (el) { el.oninput = renderLounges; el.onchange = renderLounges; }
  });

  // ============================ RECOMMEND =================================
  function renderRecommend() {
    const easyOnly = $("#rec-easy").checked;
    const type = $("#rec-type").value;
    // trip-aware: if a trip with gaps exists, bias the recommender toward gap cities
    const legs = state.trip.map((c) => (c || "").trim()).filter(Boolean);
    let recs;
    if (legs.length) {
      const tripRecs = E.recommendForTrip(legs, state.wallet, CARDS, LOUNGES, { easyOnly, type: type || null });
      recs = tripRecs.length ? tripRecs : E.recommend(state.wallet, CARDS, LOUNGES, { easyOnly, type: type || null });
    } else {
      recs = E.recommend(state.wallet, CARDS, LOUNGES, { easyOnly, type: type || null });
    }
    if (recs.length === 0) { $("#rec-list").innerHTML = `<div class="empty">No new cards to suggest with these filters. Loosen the "fast only" toggle, or your wallet may already cover these rails.</div>`; return; }

    $("#rec-list").innerHTML = recs.map((r, i) => {
      const c = r.card;
      const tags = [
        `<span class="chip ${c.ease >= 4 ? "good" : c.ease >= 3 ? "" : "warn"}">${easeWord(c.ease)}</span>`,
        c.approvalSpeed ? `<span class="chip ${c.approvalSpeed === "instant" || c.approvalSpeed === "fast" ? "good" : c.approvalSpeed === "slow" ? "bad" : ""}">${speedWord(c.approvalSpeed)}</span>` : "",
        c.ltf ? `<span class="chip good">lifetime free</span>` : "",
        c.spendGate ? `<span class="chip warn">spend gate</span>` : `<span class="chip good">no spend gate</span>`,
        c.railway ? `<span class="chip rail">🚆 railway</span>` : "",
        `<span class="chip">${visitsLabel(c)}</span>`,
      ].filter(Boolean).join("");
      return `
      <div class="card cardrow">
        <div class="rec-rank">#${i + 1}</div>
        ${cardArt(c, { small: true })}
        <div class="cardrow-body">
          <div class="card-head">
            <div><div class="card-title">${c.name} ${confBadge(c.confidence)}</div>
            <div class="card-sub">${c.issuer} · ${c.feeNote}</div></div>
            <button class="act mini" data-add="${c.id}">Add</button>
          </div>
          <div class="row">${tags}</div>
          <div class="row"><span class="rec-score">Opens <b>${r.marginalCoverage}</b> new lounge(s) for you · score ${r.score}</span></div>
          <div class="row"><button class="act ghost mini" data-detail="${c.id}">Details →</button></div>
        </div>
      </div>`;
    }).join("");
    $$("[data-add]").forEach((b) => b.onclick = () => { if (!state.wallet.includes(b.dataset.add)) state.wallet.push(b.dataset.add); save(); render(); });
  }
  $("#rec-easy").onchange = renderRecommend;
  $("#rec-type").onchange = renderRecommend;

  // ============================ ADD CARDS =================================
  // full filter state (kept in JS so re-renders never lose a selection)
  const addF = { type: "all", issuer: "", network: "", hideNoLounge: false, lifetimeFree: false, sort: "relevance" };
  const hasLounge = (c) => c.domesticVisits === "unlimited" || (Number(c.domesticVisits) || 0) > 0;
  const netWord = (n) => ({ visa: "Visa", mastercard: "Mastercard", rupay: "RuPay", amex: "Amex", diners: "Diners" }[n] || n);

  function renderAddCard() {
    const q = ($("#addcard-search") && $("#addcard-search").value || "").toLowerCase();

    // apply all filters
    let list = CARDS
      .filter((c) => addF.type === "all" || cardType(c) === addF.type)
      .filter((c) => !addF.issuer || c.issuer === addF.issuer)
      .filter((c) => !addF.network || c.network === addF.network)
      .filter((c) => !addF.hideNoLounge || hasLounge(c))
      .filter((c) => !addF.lifetimeFree || c.ltf)
      .filter((c) => `${c.name} ${c.issuer}`.toLowerCase().includes(q));

    // sort
    const visitNum = (c) => c.domesticVisits === "unlimited" ? 9999 : (Number(c.domesticVisits) || 0);
    const feeNum = (c) => { const m = (c.feeNote || "").match(/₹\s?([\d,]+)/); return m ? Number(m[1].replace(/,/g, "")) : 0; };
    if (addF.sort === "visits") list = list.slice().sort((a, b) => visitNum(b) - visitNum(a));
    else if (addF.sort === "ease") list = list.slice().sort((a, b) => (b.ease || 0) - (a.ease || 0));
    else if (addF.sort === "fee") list = list.slice().sort((a, b) => feeNum(a) - feeNum(b));
    else if (addF.sort === "name") list = list.slice().sort((a, b) => a.name.localeCompare(b.name));

    // counts for the type chips
    const nCredit = CARDS.filter((c) => cardType(c) === "credit").length;
    const nDebit = CARDS.filter((c) => cardType(c) === "debit").length;
    // issuer options (sorted, with counts)
    const issuerCounts = {};
    CARDS.forEach((c) => { issuerCounts[c.issuer] = (issuerCounts[c.issuer] || 0) + 1; });
    const issuerOpts = ['<option value="">All banks</option>']
      .concat(Object.keys(issuerCounts).sort().map((i) =>
        `<option value="${i}" ${addF.issuer === i ? "selected" : ""}>${i} (${issuerCounts[i]})</option>`)).join("");
    const networks = ["visa", "mastercard", "rupay", "amex", "diners"];
    const netOpts = ['<option value="">All networks</option>']
      .concat(networks.map((n) => `<option value="${n}" ${addF.network === n ? "selected" : ""}>${netWord(n)}</option>`)).join("");
    const sorts = [["relevance", "Sort: default"], ["visits", "Most visits"], ["ease", "Easiest to get"], ["fee", "Lowest fee"], ["name", "Name A-Z"]];
    const sortOpts = sorts.map(([v, l]) => `<option value="${v}" ${addF.sort === v ? "selected" : ""}>${l}</option>`).join("");

    const controls = `
      <div class="filterbar">
        <div class="seg">
          <button class="seg-btn ${addF.type === "all" ? "on" : ""}" data-addtype="all">All ${CARDS.length}</button>
          <button class="seg-btn ${addF.type === "credit" ? "on" : ""}" data-addtype="credit">💳 Credit ${nCredit}</button>
          <button class="seg-btn ${addF.type === "debit" ? "on" : ""}" data-addtype="debit">🏧 Debit ${nDebit}</button>
        </div>
        <div class="filter-controls">
          <select class="cmp-select" id="add-issuer">${issuerOpts}</select>
          <select class="cmp-select" id="add-network">${netOpts}</select>
          <select class="cmp-select" id="add-sort">${sortOpts}</select>
          <label class="chip toggle"><input type="checkbox" id="add-hidenolounge" ${addF.hideNoLounge ? "checked" : ""} /> Lounge cards only</label>
          <label class="chip toggle"><input type="checkbox" id="add-ltf" ${addF.lifetimeFree ? "checked" : ""} /> Lifetime-free</label>
        </div>
        <div class="result-count">${list.length} card${list.length === 1 ? "" : "s"}</div>
      </div>`;

    const cards = list.map((c) => {
      const picked = state.wallet.includes(c.id);
      const tags = [
        hasLounge(c) ? `<span class="chip good">${visitsLabel(c)}</span>` : `<span class="chip">no lounge</span>`,
        c.ltf ? `<span class="chip good">LTF</span>` : "",
        c.spendGate ? `<span class="chip warn">spend gate</span>` : "",
        c.railway ? `<span class="chip rail">🚆 railway</span>` : "",
        `<span class="chip">${easeWord(c.ease)}</span>`,
        c.approvalSpeed ? `<span class="chip">${speedWord(c.approvalSpeed)}</span>` : "",
        c.discontinued ? `<span class="chip bad">discontinued</span>` : "",
      ].filter(Boolean).join("");
      return `
      <div class="card cardrow selectable ${picked ? "picked" : ""}" data-toggle="${c.id}">
        ${cardArt(c, { small: true })}
        <div class="cardrow-body">
          <div class="card-head">
            <div><div class="card-title">${typeBadge(c)} ${c.name} ${confBadge(c.confidence)}</div>
            <div class="card-sub">${c.issuer} · ${netWord(c.network)} · ${c.feeNote}</div></div>
            <span class="chip ${picked ? "good" : ""}">${picked ? "✓ added" : "tap to add"}</span>
          </div>
          <div class="row">${tags}</div>
          <div class="row"><button class="act ghost mini" data-detail="${c.id}">Details →</button></div>
        </div>
      </div>`;
    }).join("") || `<div class="empty">No cards match these filters. <span class="link" id="add-clearfilters">Clear filters</span></div>`;

    $("#addcard-list").innerHTML = controls + cards;

    // wire controls
    $$("[data-addtype]").forEach((b) => b.onclick = () => { addF.type = b.dataset.addtype; renderAddCard(); });
    const wireSel = (id, key) => { const el = $("#" + id); if (el) el.onchange = () => { addF[key] = el.value; renderAddCard(); }; };
    wireSel("add-issuer", "issuer"); wireSel("add-network", "network"); wireSel("add-sort", "sort");
    const wireChk = (id, key) => { const el = $("#" + id); if (el) el.onchange = () => { addF[key] = el.checked; renderAddCard(); }; };
    wireChk("add-hidenolounge", "hideNoLounge"); wireChk("add-ltf", "lifetimeFree");
    const clr = $("#add-clearfilters");
    if (clr) clr.onclick = () => { addF.type = "all"; addF.issuer = ""; addF.network = ""; addF.hideNoLounge = false; addF.lifetimeFree = false; addF.sort = "relevance"; renderAddCard(); };
    $$("[data-toggle]").forEach((el) => el.onclick = () => {
      const id = el.dataset.toggle;
      if (state.wallet.includes(id)) state.wallet = state.wallet.filter((x) => x !== id);
      else state.wallet.push(id);
      save(); render();
    });
  }
  if ($("#addcard-search")) $("#addcard-search").oninput = renderAddCard;

  // ============================ DATA HEALTH ===============================
  function renderHealth() {
    const lint = SELF.lintDataset(CARDS, LOUNGES);
    const tripCities = state.trip.map((c) => (c || "").trim()).filter(Boolean);
    const queue = SELF.verifyQueue(CARDS, LOUNGES, META, state.experiences, NOW, tripCities);
    const ageInfo = SELF.ageConfidence("high", META.lastReviewed, NOW);

    $("#health-stats").innerHTML = `
      <div class="stat ${lint.counts.error ? "warn" : "good"}"><div class="num">${lint.counts.error}</div><div class="lbl">Data errors</div></div>
      <div class="stat"><div class="num">${ageInfo.ageDays}d</div><div class="lbl">Data age</div></div>
      <div class="stat ${ageInfo.decayed ? "warn" : "good"}"><div class="num">${ageInfo.decayed ? "↓" : "✓"}</div><div class="lbl">${ageInfo.decayed ? "Trust lowered" : "Still fresh"}</div></div>
      <div class="stat"><div class="num">${(state.experiences || []).length}</div><div class="lbl">Your logged visits</div></div>`;

    // verify queue — top 12
    const sig = SELF.experienceSignals(state.experiences);
    $("#verify-queue").innerHTML = queue.slice(0, 12).map((r) => {
      const tags = [
        r.contradicted ? `<span class="chip bad">your experience disagrees</span>` : "",
        r.onTrip ? `<span class="chip warn">on your trip</span>` : "",
        `<span class="conf ${r.effConfidence}">${r.effConfidence}</span>`,
      ].filter(Boolean).join(" ");
      return `<div class="vq-row">
        <div><b>${r.label}</b> <span class="chip">${r.type}</span> ${tags}</div>
        <div class="verify">✔ ${r.verify}</div>
      </div>`;
    }).join("") || `<div class="empty">Nothing urgent.</div>`;

    // lint report
    if (lint.clean) {
      $("#lint-report").innerHTML = `<div class="lint-ok">✅ Self-audit passed: no errors, no warnings, no contradictions in the current dataset.</div>`;
    } else {
      $("#lint-report").innerHTML = lint.issues.map((i) =>
        `<div class="lint-row ${i.sev}"><span class="chip ${i.sev === "error" ? "bad" : i.sev === "warn" ? "warn" : ""}">${i.sev}</span> ${i.msg}</div>`
      ).join("");
    }

    // roadmap (the honest ladder)
    $("#roadmap").innerHTML = `
      <div class="rung"><span class="chip good">live now · free</span> <b>Rung 1 — self-aware.</b> Ages its own confidence, audits its data, learns from your logged visits, queues what to verify. All in your browser. <i>(this page)</i></div>
      <div class="rung"><span class="chip">free · manual cadence</span> <b>Rung 2 — self-researching loop.</b> A repeatable research+cross-verify pass regenerates the data files (run by you or me every quarter), gated by the self-audit above so bad data can't slip in.</div>
      <div class="rung"><span class="chip warn">needs backend · paid</span> <b>Rung 3 — fully autonomous.</b> Scheduled scrapers, shared crowd database, moderation, true real-time cross-verify. Requires a server (not free). Scope it when the user base justifies it.</div>`;
  }

  // import / export community data
  $("#export-data").onclick = () => {
    const payload = { kind: "loungelens-export", v: 2, exportedFor: META.lastReviewed, experiences: state.experiences || [], wallet: state.wallet };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "loungelens-data.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  $("#import-data").onclick = () => $("#import-file").click();
  $("#import-file").onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (data.kind !== "loungelens-export") { alert("That doesn't look like a LoungeLens export file."); return; }
        const incoming = Array.isArray(data.experiences) ? data.experiences : [];
        // merge experiences (dedupe by loungeId+cardId+ts), do NOT blindly trust — they feed the same contradiction signals
        const seen = new Set((state.experiences || []).map((x) => x.loungeId + x.cardId + x.ts));
        let added = 0;
        incoming.forEach((x) => { const k = x.loungeId + x.cardId + x.ts; if (!seen.has(k)) { state.experiences.push(x); seen.add(k); added++; } });
        save(); render();
        toast(`Imported ${added} new record(s) into your verify signals.`);
      } catch (err) { toast("Couldn't read that file."); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ============================ AIRPORTS VIEW =============================
  function renderAirports() {
    if (!$("#airport-list")) return;
    const q = ($("#airport-search").value || "").toLowerCase();
    const type = $("#airport-type").value;
    let groups = E.airports(LOUNGES, state.wallet, CARDS, state.visitLog, state.spend, NOW);
    if (type) groups = groups.filter((g) => g.type === type);
    groups = groups.filter((g) => `${g.code} ${g.city}`.toLowerCase().includes(q));
    if (!groups.length) { $("#airport-list").innerHTML = `<div class="empty">No airports/stations match.</div>`; return; }

    $("#airport-list").innerHTML = groups.map((g) => {
      const icon = g.type === "railway" ? "🚆" : "🛫";
      const lounges = g.lounges.map((row) => {
        const l = row.lounge;
        const order = E.bestCardOrder(row.matches);
        const verdict = row.open
          ? `<span class="ap-verdict">${cardArt(order[0].card, { tiny: true })}<span class="chip good">enter with ${order[0].card.name}${order[0].quota.unlimited ? "" : ` · ${order[0].quota.left} left`}</span></span>`
          : row.matches.length
            ? `<span class="chip warn">blocked</span>`
            : `<span class="chip">no card</span>`;
        return `<div class="ap-lounge">
          <div><b>${l.name}</b> ${confBadge(l.confidence)} <span class="card-sub">${l.terminal || ""}</span></div>
          ${verdict}
        </div>`;
      }).join("");
      return `<div class="ap-group ${g.openCount ? "has-open" : ""}">
        <div class="ap-head">
          <div><span class="ap-code">${icon} ${g.code}</span> <span class="card-sub">${g.city}</span></div>
          <span class="chip ${g.openCount ? "good" : ""}">${g.openCount}/${g.lounges.length} open to you</span>
        </div>
        ${lounges}
      </div>`;
    }).join("");
  }
  ["#airport-search", "#airport-type"].forEach((s) => { const el = $(s); if (el) { el.oninput = renderAirports; el.onchange = renderAirports; } });

  // ============================ COVERAGE MAP ==============================
  // India as a tile-grid (statebin) map. Each tile is placed at the state's
  // approximate real grid position and colored by how much of that state's
  // lounge access YOUR wallet unlocks. Click a tile to drill into its lounges.
  // GRID: [col,row] on a 12-wide board, north-west to south-east like the map.
  const MAP_GRID = {
    JK: [3, 0], CH: [3, 1], PB: [2, 1], UK: [4, 1], DL: [3, 2], RJ: [2, 3], UP: [4, 2],
    BR: [6, 2], AS: [8, 1], TR: [8, 2], MN: [9, 2], GJ: [1, 4], MP: [3, 4], JH: [6, 3],
    WB: [7, 3], OD: [6, 4], CG: [5, 4], MH: [2, 5], TG: [3, 5], AP: [4, 6], GA: [2, 6],
    KA: [2, 7], TN: [3, 8], KL: [2, 8], AN: [9, 7],
  };
  function renderMap() {
    const grid = $("#map-grid");
    if (!grid) return;
    const map = E.coverageMap(LOUNGES, state.wallet, CARDS, state.visitLog, state.spend, NOW);

    // summary banner
    const sum = $("#map-summary");
    if (sum) {
      const verdict = state.wallet.length === 0
        ? `Add your cards to light up the map. Right now nothing's unlocked.`
        : map.nationalPct >= 90 ? `🌍 You're covered almost everywhere — ${map.statesCovered} of ${map.statesWithData} states open to you.`
        : map.nationalPct >= 50 ? `Good spread. ${map.statesCovered} of ${map.statesWithData} states have a lounge you can enter.`
        : map.statesCovered > 0 ? `Patchy. Only ${map.statesCovered} of ${map.statesWithData} states open to you so far.`
        : `No states unlocked yet with the cards you hold.`;
      sum.innerHTML = `<div class="map-verdict ${map.nationalPct >= 90 ? "good" : map.nationalPct >= 50 ? "warn" : "bad"}">
        <div class="mv-pct">${map.nationalPct}%</div>
        <div class="mv-text"><b>${verdict}</b><div class="card-sub">${map.totalOpen} of ${map.totalLounges} mapped lounges open to your wallet, across ${map.statesWithData} states &amp; UTs.</div></div>
      </div>`;
    }

    // tile grid
    const tiles = Object.keys(MAP_GRID).map((code) => {
      const s = map.byState[code];
      const [col, row] = MAP_GRID[code];
      const tier = s ? s.tier : "none";
      const label = s ? `${s.open}/${s.total}` : "—";
      const aria = s ? `${s.name}: ${s.open} of ${s.total} lounges open to you` : `${code}: no lounge data`;
      return `<button class="map-tile tier-${tier}" data-state="${code}"
        style="grid-column:${col + 1};grid-row:${row + 1};" title="${s ? s.name : code}" aria-label="${aria}">
        <span class="mt-code">${code}</span>
        <span class="mt-count">${label}</span>
      </button>`;
    }).join("");
    grid.innerHTML = tiles;

    // legend
    const leg = $("#map-legend");
    if (leg) {
      leg.innerHTML = [
        ["full", "All open"], ["most", "Most open"], ["some", "Some open"], ["none", "None / no data"],
      ].map(([t, l]) => `<span class="leg-item"><span class="leg-swatch tier-${t}"></span>${l}</span>`).join("");
    }

    // click -> drill into a state
    $$("#map-grid .map-tile").forEach((btn) => btn.onclick = () => showStateDetail(btn.dataset.state, map));
  }

  function showStateDetail(code, map) {
    const box = $("#map-detail");
    if (!box) return;
    const s = map.byState[code];
    const stateName = (s && s.name) || code;
    if (!s) {
      box.innerHTML = `<div class="md-head"><b>${stateName}</b></div><div class="card-sub">No lounge on file for this state yet. If you know one, the data's open to grow.</div>`;
      box.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return;
    }
    // pull this state's lounges (by city -> state code), with which card opens each
    const stateLounges = LOUNGES.filter((l) => E.stateForCity(l.city) === code);
    const rows = stateLounges.map((l) => {
      const matches = E.cardsForLounge(l, state.wallet, CARDS, state.visitLog, state.spend, NOW);
      const order = E.bestCardOrder(matches);
      const loc = l.type === "railway" ? `🚆 ${l.station}` : `🛫 ${l.airport} ${l.terminal || ""}`.trim();
      const verdict = order.length
        ? `<span class="chip good">enter with ${order[0].card.name}${order[0].quota.unlimited ? "" : ` · ${order[0].quota.left} left`}</span>`
        : matches.length ? `<span class="chip warn">blocked</span>` : `<span class="chip">no card opens it</span>`;
      return `<div class="md-lounge">
        <div><b>${l.name}</b> ${confBadge(l.confidence)}<div class="card-sub">${loc} · ${l.city}</div></div>
        ${verdict}
      </div>`;
    }).join("");
    box.innerHTML = `<div class="md-head">
        <b>${stateName}</b>
        <span class="chip ${s.open ? "good" : ""}">${s.open}/${s.total} open to you</span>
      </div>
      <div class="card-sub" style="margin-bottom:8px;">${s.cityCount} ${s.cityCount === 1 ? "city" : "cities"} · ${s.airport} airport · ${s.railway} railway</div>
      ${rows}`;
    box.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // ============================ COMPARE VIEW ==============================
  function fillCompareSelects() {
    const opts = CARDS.filter((c) => (c.programs || []).length)
      .map((c) => `<option value="${c.id}">${c.name} (${c.issuer})</option>`).join("");
    const a = $("#compare-a"), b = $("#compare-b");
    if (a && !a.innerHTML) { a.innerHTML = opts; a.value = "hdfc-infinia"; }
    if (b && !b.innerHTML) { b.innerHTML = opts; b.value = "axis-myzone"; }
  }
  function renderCompare() {
    if (!$("#compare-result")) return;
    fillCompareSelects();
    const cmp = E.compareCards($("#compare-a").value, $("#compare-b").value, CARDS, LOUNGES);
    if (!cmp) { $("#compare-result").innerHTML = `<div class="empty">Pick two cards.</div>`; return; }
    const label = { coverage: "Lounges reachable", visits: "Free visits", ease: "Easy to get", spendgate: "No spend gate", railway: "Railway lounges" };
    const cell = (won, mine) => `<td class="${won ? "win" : ""}">${won ? "✓ " : ""}${mine}</td>`;
    const valOf = (c, key) => {
      const cov = c === cmp.a ? cmp.covA : cmp.covB;
      switch (key) {
        case "coverage": return cov.total + " lounges";
        case "visits": return c.domesticVisits === "unlimited" ? "Unlimited" : ((Number(c.domesticVisits) || 0) === 0 ? "None" : (c.domesticVisits + "/" + c.period));
        case "ease": return easeWord(c.ease);
        case "spendgate": return c.spendGate ? "Has gate" : "No gate";
        case "railway": return c.railway ? "Yes" : "No";
      }
    };
    const rows = cmp.rows.map((r) => `<tr>
      <td class="cmp-label">${label[r.key]}</td>
      ${cell(r.winner === "A", valOf(cmp.a, r.key))}
      ${cell(r.winner === "B", valOf(cmp.b, r.key))}
    </tr>`).join("");
    const banner = cmp.overall === "tie"
      ? `<div class="big-verdict warn">It's a tie (${cmp.aWins}-${cmp.bWins}) — pick on fee or rewards</div>`
      : `<div class="big-verdict good">🏆 ${(cmp.overall === "A" ? cmp.a : cmp.b).name} wins ${Math.max(cmp.aWins, cmp.bWins)}-${Math.min(cmp.aWins, cmp.bWins)}</div>`;
    $("#compare-result").innerHTML = `${banner}
      <div class="cmp-arts">
        <div class="cmp-art-cell">${cardArt(cmp.a)}<button class="act ghost mini" data-detail="${cmp.a.id}">Details →</button></div>
        <span class="vs">vs</span>
        <div class="cmp-art-cell">${cardArt(cmp.b)}<button class="act ghost mini" data-detail="${cmp.b.id}">Details →</button></div>
      </div>
      <table class="cmp-table">
        <thead><tr><th></th><th>${cmp.a.name}</th><th>${cmp.b.name}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="card-sub" style="margin-top:8px;">${cmp.a.feeNote} · vs · ${cmp.b.feeNote}</div>
      ${sourceLinksHtml([...SLINKS.forCard(cmp.a).slice(0,1), ...SLINKS.forCard(cmp.b).slice(0,1)], "compare")}`;
  }
  ["#compare-a", "#compare-b"].forEach((s) => { const el = $(s); if (el) el.onchange = renderCompare; });

  // ============================ VALUE VIEW ================================
  function renderValue() {
    if (!$("#value-list")) return;
    const trips = Number($("#val-trips").value) || 0;
    const worth = Number($("#val-worth").value) || 0;
    const scored = CARDS.filter((c) => (c.programs || []).length)
      .map((c) => {
        const feeMatch = (c.feeNote || "").match(/₹\s?([\d,]+)/);
        const fee = feeMatch ? Number(feeMatch[1].replace(/,/g, "")) : 0;
        return { c, v: E.valueCalc(c, trips, worth, fee), fee };
      })
      .sort((a, b) => (b.v.net === Infinity ? 1 : b.v.net) - (a.v.net === Infinity ? 1 : a.v.net));
    $("#value-list").innerHTML = scored.map(({ c, v, fee }) => {
      const cls = v.worthIt ? "good" : "bad";
      const netStr = v.net >= 0 ? "+" + fmtRs(v.net) : "-" + fmtRs(Math.abs(v.net));
      return `<div class="val-row ${cls}">
        <div class="val-main">
          <div>${cardArt(c, { tiny: true })} <b>${c.name}</b> ${typeBadge(c)} ${confBadge(c.confidence)}</div>
          <div class="card-sub">${c.issuer} · fee ${fee ? fmtRs(fee) : "free/varies"} · ${v.allowance === "unlimited" ? "unlimited visits" : v.visitsUsed + " visits/yr you'd use"}</div>
          ${v.spendGateWarning ? `<div class="notes adv-only">⚠️ ${v.spendGateWarning}</div>` : ""}
        </div>
        <div class="val-verdict ${cls}">
          <div class="val-net">${netStr}/yr</div>
          <div class="val-tag">${v.worthIt ? "worth it" : "not worth it"}</div>
        </div>
      </div>`;
    }).join("");
  }
  ["#val-trips", "#val-worth"].forEach((s) => { const el = $(s); if (el) el.oninput = renderValue; });

  // ============================ LOGIN / LOGOUT ============================
  // CLOUD adapter: active only if window.LL_FIREBASE config is present AND the
  // firebase SDK loaded (window.LL_CLOUD.available). Until then we run DEVICE mode.
  const CLOUD = window.LL_CLOUD || null;
  const cloudConfigured = !!(window.LL_FIREBASE && window.LL_FIREBASE.apiKey);
  let cloudUser = null; // Firebase user object when signed into cloud
  function cloudActive() { return CLOUD && CLOUD.available && cloudUser; }
  // push current state to the cloud for the signed-in user (fire-and-forget).
  function cloudSync() {
    if (cloudActive()) {
      try { CLOUD.save(cloudUser.uid, state).catch(() => {}); } catch (e) { /* ignore */ }
    }
  }
  // if cloud is configured, restore an existing cloud session on load
  if (CLOUD && cloudConfigured) {
    CLOUD.onUser(async (u) => {
      if (u) {
        cloudUser = u;
        const remote = await CLOUD.load(u.uid).catch(() => null);
        if (remote) { state = remote; }
        activeUser = u.email || "cloud";
        render(); renderAuthBar();
      }
    }).catch(() => {});
  }

  let signupMode = false;
  function renderAuthBar() {
    const who = $("#auth-who"), openBtn = $("#login-open"), nameEl = $("#auth-name");
    if (activeUser) {
      const display = (accounts[activeUser] && accounts[activeUser].data && accounts[activeUser].data.profileName) || activeUser;
      if (nameEl) nameEl.textContent = "👤 " + display;
      if (who) who.hidden = false;
      if (openBtn) openBtn.hidden = true;
    } else {
      if (who) who.hidden = true;
      if (openBtn) openBtn.hidden = false;
    }
  }
  function openLogin(signup) {
    signupMode = !!signup;
    $("#login-title").textContent = signupMode ? "Create your profile" : "Log in";
    $("#login-sub").textContent = signupMode
      ? "Pick a username + PIN. Saves your cards on this device. Free, no email."
      : "Welcome back. Your cards and preferences come right back.";
    $("#login-submit").textContent = signupMode ? "Create profile" : "Log in";
    $("#login-switch").innerHTML = signupMode
      ? `Already have a profile? <span class="link" id="to-login">Log in</span>`
      : `New here? <span class="link" id="to-signup">Create a profile</span>`;
    const cloudOn = !!(CLOUD && CLOUD.available);
    $("#login-cloud-note").textContent = cloudOn
      ? "☁️ Cloud sync is on — your profile follows you across all your devices."
      : "Saved on this device. To sync across devices, use Profile → sync code, or the owner can enable free cloud login (see SETUP-LOGIN.md).";
    // when cloud is on, fields become email + password; otherwise username + PIN
    if (cloudOn) {
      $("#login-user").placeholder = "Email";
      $("#login-user").type = "email";
      $("#login-pin").placeholder = "Password (6+ chars)";
    } else {
      $("#login-user").placeholder = "Username";
      $("#login-user").type = "text";
      $("#login-pin").placeholder = "PIN (4+ digits)";
    }
    $("#login-error").hidden = true;
    $("#login-user").value = ""; $("#login-pin").value = "";
    $("#login-modal").hidden = false;
    rewireLoginSwitch();
    setTimeout(() => $("#login-user").focus(), 50);
  }
  function rewireLoginSwitch() {
    const s = $("#to-signup"); if (s) s.onclick = () => openLogin(true);
    const l = $("#to-login"); if (l) l.onclick = () => openLogin(false);
  }
  function loginError(msg) { const e = $("#login-error"); e.textContent = msg; e.hidden = false; }

  if ($("#login-open")) $("#login-open").onclick = () => openLogin(false);
  if ($("#login-cancel")) $("#login-cancel").onclick = () => { $("#login-modal").hidden = true; };
  if ($("#login-submit")) $("#login-submit").onclick = () => {
    const u = $("#login-user").value.trim();
    const pin = $("#login-pin").value.trim();
    if (!u) { loginError("Enter a username."); return; }
    // ---- CLOUD path (Firebase email/password) when configured ----
    if (CLOUD && CLOUD.available) {
      const email = u, pwd = pin;
      const after = async (userPromise) => {
        try {
          const user = await userPromise;
          cloudUser = user;
          activeUser = user.email || "cloud";
          if (signupMode) {
            // new cloud account: seed + push
            const seed = blank(); seed.profileName = email.split("@")[0]; seed.onboarded = true;
            state = seed;
            await CLOUD.save(user.uid, state);
          } else {
            const remote = await CLOUD.load(user.uid);
            state = remote || blank();
          }
          $("#login-modal").hidden = true;
          render(); renderAuthBar();
          toast(signupMode ? "Cloud account created. Synced." : "Logged in. Synced from cloud.");
        } catch (e) {
          loginError((e && e.message ? e.message : "Cloud login failed.").replace(/Firebase:\s*/i, ""));
        }
      };
      after(signupMode ? CLOUD.signUp(email, pwd) : CLOUD.signIn(email, pwd));
      return;
    }
    // ---- DEVICE path (local username + PIN) ----
    if (signupMode) {
      try {
        // new profile starts from a fresh blank state (or current device state if empty)
        const seed = blank(); seed.profileName = u; seed.onboarded = true;
        accounts = AUTH.createAccount(accounts, u, pin, seed);
        saveAccounts(accounts);
        activeUser = AUTH.normUser(u);
        localStorage.setItem(SESSION_KEY, activeUser);
        state = accounts[activeUser].data;
        $("#login-modal").hidden = true;
        render(); renderAuthBar();
        toast("Profile created. You're logged in.");
      } catch (e) { loginError(e.message); }
    } else {
      const v = AUTH.verifyLogin(accounts, u, pin);
      if (!v.ok) { loginError(v.reason === "wrong PIN" ? "Wrong PIN, try again." : "No profile with that username on this device. Create one?"); return; }
      activeUser = AUTH.normUser(u);
      localStorage.setItem(SESSION_KEY, activeUser);
      state = v.data || blank();
      $("#login-modal").hidden = true;
      render(); renderAuthBar();
      toast("Logged in. Welcome back.");
    }
  };
  if ($("#logout-btn")) $("#logout-btn").onclick = () => {
    save(); // persist current state to the account before leaving
    if (cloudActive()) { try { CLOUD.signOut(); } catch (e) { /* ignore */ } cloudUser = null; }
    activeUser = null;
    localStorage.removeItem(SESSION_KEY);
    state = blank(); // logged-out view starts clean (data is safe in the account)
    render(); renderAuthBar();
    toast("Logged out. Log back in any time to restore your data.");
  };
  // allow Enter key to submit
  ["login-user", "login-pin"].forEach((id) => {
    const el = $("#" + id);
    if (el) el.addEventListener("keydown", (e) => { if (e.key === "Enter") $("#login-submit").click(); });
  });

  // ============================ PROFILE / SYNC ============================
  function renderProfile() {
    const nameInput = $("#profile-name");
    if (nameInput && document.activeElement !== nameInput) nameInput.value = state.profileName || "";
  }
  if ($("#profile-name")) $("#profile-name").oninput = (e) => { state.profileName = e.target.value; save(); };
  if ($("#gen-code")) $("#gen-code").onclick = () => {
    const code = PROFILE.encodeState(state);
    $("#sync-code-out").value = code;
    toast("Sync code generated. Copy it to your other device.");
  };
  if ($("#copy-code")) $("#copy-code").onclick = async () => {
    const v = $("#sync-code-out").value;
    if (!v) { toast("Generate a code first."); return; }
    try { await navigator.clipboard.writeText(v); toast("Copied to clipboard."); }
    catch (e) { $("#sync-code-out").select(); toast("Select-all done — press Cmd/Ctrl+C."); }
  };
  if ($("#apply-code")) $("#apply-code").onclick = () => {
    const code = ($("#sync-code-in").value || "").trim();
    if (!code) { toast("Paste a sync code first."); return; }
    try {
      const payload = PROFILE.decodeState(code);
      PROFILE.mergeInto(state, payload);
      save(); render();
      toast("Restored and merged. Your cards and trip are here now.");
      $("#sync-code-in").value = "";
    } catch (e) { toast("That doesn't look like a valid sync code."); }
  };
  if ($("#profile-export-file")) $("#profile-export-file").onclick = () => {
    const code = PROFILE.encodeState(state);
    const blob = new Blob([code], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "loungelens-profile.txt";
    a.click(); URL.revokeObjectURL(a.href);
  };
  if ($("#profile-import-file")) $("#profile-import-file").onclick = () => $("#profile-file").click();
  if ($("#profile-file")) $("#profile-file").onchange = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        let txt = r.result.trim();
        // file may be a raw code OR our older JSON export — handle both
        let payload;
        try { payload = PROFILE.decodeState(txt); }
        catch (_) { const j = JSON.parse(txt); payload = { t: "LL1", wallet: j.wallet || [], experiences: j.experiences || [], visitLog: [], spend: {}, trip: [] }; }
        PROFILE.mergeInto(state, payload);
        save(); render(); toast("Imported and merged.");
      } catch (err) { toast("Couldn't read that file."); }
    };
    r.readAsText(file); e.target.value = "";
  };

  // ============================ FLIGHTS ===================================
  // Honest fare comparison: deep-link to every airline + OTA's LIVE search, and
  // compute the best way to pay (card offer / app / coupon) from the user's
  // wallet. No fabricated prices — real fares live on the real sites.
  const kindIcon = (k) => ({ card: "💳", app: "📱", coupon: "🎟️", price: "🏷️" }[k] || "🏷️");

  function flAirportLabel(codeOrCity) {
    const v = (codeOrCity || "").trim();
    if (!v) return null;
    const up = v.toUpperCase();
    const byCode = (FLIGHTS.airports || []).find((a) => a.code === up);
    if (byCode) return byCode;
    const byCity = (FLIGHTS.airports || []).find((a) => a.city.toLowerCase() === v.toLowerCase());
    if (byCity) return byCity;
    // partial city match (e.g. "Goa" -> "Goa (Dabolim)" GOI, "Bengal" -> BLR).
    // Prefer the first match so a real IATA code is always used in deep links.
    const byPartial = (FLIGHTS.airports || []).find((a) => a.city.toLowerCase().includes(v.toLowerCase()));
    if (byPartial) return byPartial;
    // accept a raw 3-letter code the user typed even if not in our list
    if (/^[A-Za-z]{3}$/.test(v)) return { code: up, city: up };
    return null;
  }

  // make EVERY date input open its native picker on a tap anywhere in the field
  // (not just the tiny calendar icon) — fixes the "can't select the date" feel.
  // showPicker() is supported in modern browsers; guarded so it never throws.
  function wireDatePickers() {
    document.addEventListener("click", (e) => {
      const t = e.target;
      if (t && t.tagName === "INPUT" && t.type === "date" && typeof t.showPicker === "function") {
        try { t.showPicker(); } catch (err) { /* user-gesture / unsupported: native click still works */ }
      }
    });
  }

  // prevent past-date flight searches (Amadeus rejects them with a vague error)
  function setFlightDateFloor() {
    const d = $("#fl-date");
    if (!d) return;
    const now = new Date();
    const min = now.getFullYear() + "-" + ("0" + (now.getMonth() + 1)).slice(-2) + "-" + ("0" + now.getDate()).slice(-2);
    d.setAttribute("min", min);
  }

  function fillAirportList() {
    const dl = $("#fl-airport-list");
    if (!dl) return;
    dl.innerHTML = FE.airports(FLIGHTS)
      .map((a) => `<option value="${a.city}">${a.code} — ${a.city}</option>`).join("");
  }

  // ======================= PLAN A TRIP (optimizer) =======================
  // persisted plan inputs live on state.plan
  function planState() {
    if (!state.plan) state.plan = { from: "", to: "", depart: "", nights: 3, adults: 2 };
    return state.plan;
  }
  function renderPlanStats() {
    const el = $("#plan-stats"); if (!el) return;
    const sites = (FLIGHTS.providers || []).length + (HOTELS.providers || []).length + (DEALS.services || []).length;
    const pill = (n, l) => `<div class="lh-stat"><b>${n}</b><span>${l}</span></div>`;
    el.innerHTML = pill(CARDS.length, "cards") + pill(LOUNGES.length, "lounges") + pill(sites, "booking sites") + pill("0", "fake prices");
  }
  function wirePlan() {
    const p = planState();
    if ($("#tp-from")) $("#tp-from").value = p.from || "";
    if ($("#tp-to")) $("#tp-to").value = p.to || "";
    if ($("#tp-depart")) { $("#tp-depart").value = p.depart || ""; const f = todayISO(); $("#tp-depart").setAttribute("min", f); }
    if ($("#tp-nights")) $("#tp-nights").value = p.nights || 3;
    if ($("#tp-adults")) $("#tp-adults").value = p.adults || 2;
    const persist = () => {
      state.plan = {
        from: ($("#tp-from") && $("#tp-from").value) || "",
        to: ($("#tp-to") && $("#tp-to").value) || "",
        depart: ($("#tp-depart") && $("#tp-depart").value) || "",
        nights: ($("#tp-nights") && +$("#tp-nights").value) || 3,
        adults: ($("#tp-adults") && +$("#tp-adults").value) || 2,
      };
      save();
    };
    ["#tp-from", "#tp-to", "#tp-depart", "#tp-nights", "#tp-adults"].forEach((s) => { const el = $(s); if (el) el.oninput = persist; });
    if ($("#tp-swap")) $("#tp-swap").onclick = () => { const a = $("#tp-from"), b = $("#tp-to"); if (a && b) { const t = a.value; a.value = b.value; b.value = t; persist(); } };
    if ($("#tp-plan")) $("#tp-plan").onclick = () => { persist(); renderPlanResult(); const r = $("#plan-result"); if (r) r.scrollIntoView({ behavior: "smooth", block: "start" }); };
  }
  function todayISO() { const n = new Date(); return n.getFullYear() + "-" + ("0" + (n.getMonth() + 1)).slice(-2) + "-" + ("0" + n.getDate()).slice(-2); }

  function renderPlanResult() {
    const out = $("#plan-result"); if (!out || !TE) return;
    const p = planState();
    if (!p.from || !p.to) { out.innerHTML = `<div class="empty">Tell me where you're going from and to, then build the plan.</div>`; return; }
    const plan = TE.planTrip(
      { from: p.from, to: p.to, depart: p.depart, nights: p.nights, adults: p.adults },
      { wallet: state.wallet, visitLog: state.visitLog, spend: state.spend, now: NOW }
    );
    const r = plan.route, d = plan.dates;
    // live route geometry: real great-circle distance + honest flight-time estimate
    let geoLine = "";
    if (GEO && r.from && r.to) {
      const km = GEO.distanceKm(r.from, r.to);
      if (km != null) {
        const ft = GEO.fmtDuration(GEO.flightTimeMin(r.from, r.to));
        const tvf = GEO.trainVsFly(r.from, r.to);
        const leanChip = tvf ? `<span class="chip ${tvf.lean === "fly" ? "" : "rail"}">${tvf.lean === "train" ? "🚆 train often wins" : tvf.lean === "either" ? "🚆/✈️ compare both" : "✈️ fly"}</span>` : "";
        geoLine = `<div class="pr-geo">📏 ${km.toLocaleString("en-IN")} km · ~${ft} in the air <span class="card-sub">(estimate)</span> ${leanChip}</div>`;
      }
    }
    const routeHead = `<div class="plan-route">
      <div class="pr-cities"><b>${esc(r.origin ? r.origin.city : p.from)}</b> <span class="fl-arrow">→</span> <b>${esc(r.dest ? r.dest.city : p.to)}</b></div>
      <div class="card-sub">${esc(r.from || "?")} → ${esc(r.to || "?")} · ${d.depart ? esc(d.depart) : "pick a date"}${d.nights ? ` · ${d.nights} night${d.nights > 1 ? "s" : ""}` : ""} · ${d.adults} traveller${d.adults > 1 ? "s" : ""}</div>
      ${geoLine}
      <div id="plan-weather" class="pr-weather"></div>
    </div>`;

    // best card banner
    let bestCardHtml = "";
    if (!state.wallet.length) {
      bestCardHtml = `<div class="nudge">👋 Add the cards you hold and I'll pick the single best card to pay on this whole trip. <b class="link" data-goto="addcard">Add my cards →</b></div>`;
    } else if (plan.bestCard.length) {
      const bc = plan.bestCard[0];
      bestCardHtml = `<div class="bestpay plan-bestcard">
        <div class="bp-head">💳 Best card for this trip</div>
        <div class="bp-card">${cardArt(bc.card, { tiny: true })} <b>${esc(bc.card.name)}</b> — has offers on ${bc.places.length} of this trip's booking site${bc.places.length > 1 ? "s" : ""}</div>
        <div class="card-sub">Offers rotate. Confirm today's exact discount + cap on each site before you pay.</div>
      </div>`;
    } else {
      bestCardHtml = `<div class="card-sub" style="margin:8px 0;">None of your cards match a tracked offer on this trip's sites yet — the sites may still run a generic discount.</div>`;
    }

    // the optimizer step cards
    const step = (icon, title, bodyHtml) => `<div class="plan-step"><div class="ps-head">${icon} <b>${title}</b></div>${bodyHtml}</div>`;

    // flights step
    const topFlights = plan.flights.slice(0, 4);
    const flightBody = topFlights.length ? `<div class="ps-links">${topFlights.map((f) => {
      const hit = f.walletHits ? `<span class="chip good">card offer</span>` : "";
      return `<a class="plan-link" href="${f.link}" target="_blank" rel="noopener"><span>${esc(f.provider.name)} ${hit}</span><span class="pl-go">${f.prefilled ? "live fares ↗" : "open ↗"}</span></a>`;
    }).join("")}</div><div class="card-sub">Start with the compare site — it sees every airline at once. <b class="link" data-goto="flights">Full flight view + live fares →</b></div>` : `<div class="card-sub">Enter a date for flight links.</div>`;

    // stay step
    const topStay = plan.stay.slice(0, 4);
    const stayBody = `<div class="ps-links">${topStay.map((s) => {
      const hit = s.walletHits ? `<span class="chip good">card offer</span>` : "";
      return `<a class="plan-link" href="${s.link}" target="_blank" rel="noopener"><span>${esc(s.provider.name)} ${hit}</span><span class="pl-go">${s.prefilled ? "live rates ↗" : "open ↗"}</span></a>`;
    }).join("")}</div><div class="card-sub"><b class="link" data-goto="hotels">Full hotel view →</b></div>`;

    // lounges step
    const loungeLine = (lab, lg) => {
      if (!lg || !lg.total) return `<div class="card-sub">${lab}: no lounge data for this city.</div>`;
      if (!state.wallet.length) return `<div class="card-sub">${lab}: ${lg.total} lounge${lg.total > 1 ? "s" : ""} here — add your cards to see which you can enter.</div>`;
      return `<div class="card-sub">${lab}: <b class="${lg.openCount ? "good-txt" : ""}">${lg.openCount}/${lg.total}</b> lounge${lg.total > 1 ? "s" : ""} your cards open.</div>`;
    };
    const loungeBody = `${loungeLine("At " + (r.origin ? r.origin.city : p.from), plan.lounges.origin)}${loungeLine("At " + (r.dest ? r.dest.city : p.to), plan.lounges.dest)}<div class="card-sub"><b class="link" data-goto="trip">Full lounge trip view →</b></div>`;

    // on-trip step
    const ontripBody = `<div class="card-sub">Cabs, eSIM, forex, dining and things to do at ${esc(r.dest ? r.dest.city : p.to)}. <b class="link" data-goto="ontrip">Open on-trip deals →</b></div>`;

    // savings checklist
    const savingsBody = `<ul class="plan-savings">${plan.savings.map((s) => `<li><span class="psv-ic">${s.icon}</span> ${esc(s.text)}</li>`).join("")}</ul>`;

    const saveBtn = `<div class="plan-save"><button class="act big" id="plan-save-trip">🗂️ Save this trip + build a day-by-day itinerary →</button></div>`;
    out.innerHTML = routeHead + bestCardHtml + saveBtn +
      step("✈️", "Flights", flightBody) +
      step("🏨", "Stay", stayBody) +
      step("🛋️", "Lounges on the way", loungeBody) +
      step("🧳", "While you're there", ontripBody) +
      step("✅", "Your money-saving checklist", savingsBody) +
      `<div class="honesty-note">Every link opens the <b>real</b> live search on the real site — that's where the true price is. I never invent a fare or a total. Offers are recurring India card/app/coupon mechanisms, confidence-tagged; confirm today's exact terms before you pay.</div>`;
    if ($("#plan-save-trip")) $("#plan-save-trip").onclick = saveCurrentPlanAsTrip;
    wireGoto();
    // live weather for the destination over the travel dates (real Open-Meteo)
    loadPlanWeather(r.dest ? r.dest.code : null, r.dest ? r.dest.city : p.to, d.depart);
  }

  function loadPlanWeather(destCode, destCity, depart) {
    const el = $("#plan-weather"); if (!el || !LD || !GEO) return;
    const coords = destCode && GEO.AIRPORT_COORDS[destCode];
    if (!coords) { el.innerHTML = ""; return; }
    el.innerHTML = `<span class="card-sub">⛅ loading live forecast for ${esc(destCity)}…</span>`;
    LD.getWeather(coords[0], coords[1], 14).then((wx) => {
      const w = wx.parsed; if (!w) { el.innerHTML = ""; return; }
      const flagBits = [];
      if (w.suggest.cold) flagBits.push("🧥 pack warm");
      if (w.suggest.monsoon) flagBits.push("🌧️ rain likely");
      if (w.suggest.hot) flagBits.push("☀️ hot");
      const range = (w.lowMin != null && w.avgMax != null) ? `${w.lowMin}–${w.avgMax}°C` : "";
      el.innerHTML = `<span class="pr-wx">⛅ ${esc(destCity)} next 2 weeks: <b>${range}</b>${w.peakRain != null ? ` · up to ${w.peakRain}% rain` : ""}${flagBits.length ? ` · <span class="chip">${flagBits.join(" · ")}</span>` : ""}</span>
        <span class="card-sub">${wx.fromCache ? "cached forecast" : "live forecast"}</span>`;
    }).catch(() => { el.innerHTML = ""; });
  }

  // =============================== HOTELS =================================
  function hotelState() {
    if (!state.hotel) state.hotel = { city: "", checkin: "", checkout: "", adults: 2 };
    return state.hotel;
  }
  function fillHotelCityList() {
    const dl = $("#hotel-city-list"); if (!dl) return;
    dl.innerHTML = (HOTELS.cities || []).map((c) => `<option value="${c}"></option>`).join("");
  }
  function wireHotels() {
    const h = hotelState();
    if ($("#ho-city")) $("#ho-city").value = h.city || "";
    if ($("#ho-checkin")) { $("#ho-checkin").value = h.checkin || ""; $("#ho-checkin").setAttribute("min", todayISO()); }
    if ($("#ho-checkout")) { $("#ho-checkout").value = h.checkout || ""; $("#ho-checkout").setAttribute("min", todayISO()); }
    if ($("#ho-adults")) $("#ho-adults").value = h.adults || 2;
    const persist = () => {
      state.hotel = {
        city: ($("#ho-city") && $("#ho-city").value) || "",
        checkin: ($("#ho-checkin") && $("#ho-checkin").value) || "",
        checkout: ($("#ho-checkout") && $("#ho-checkout").value) || "",
        adults: ($("#ho-adults") && +$("#ho-adults").value) || 2,
      };
      save();
    };
    ["#ho-city", "#ho-checkin", "#ho-checkout", "#ho-adults"].forEach((s) => { const el = $(s); if (el) el.oninput = persist; });
    if ($("#ho-go")) $("#ho-go").onclick = () => { persist(); renderHotels(); const r = $("#hotel-result"); if (r) r.scrollIntoView({ behavior: "smooth", block: "start" }); };
  }
  function renderHotels() {
    if (!$("#hotel-result") || !TE) return;
    const h = hotelState();
    const wallet = state.wallet.map((id) => card(id)).filter(Boolean);

    // hotel coupons (recurring mechanisms)
    const cp = $("#hotel-coupons");
    if (cp) cp.innerHTML = (HOTELS.coupons || []).map((o) => `<div class="coupon-row">
      <div class="cp-main"><div class="cp-title">🏨 <b>${esc(o.title)}</b> ${confBadge(o.confidence)}</div>
      <div class="card-sub">${esc(o.note)} · ${esc(o.who)}</div></div>
      <div class="cp-side"><span class="card-sub">checked ${esc(o.lastChecked)}</span> ${o.verify ? `<a class="fl-verify" href="https://${esc(String(o.verify).replace(/^https?:\/\//, ""))}" target="_blank" rel="noopener">verify ↗</a>` : ""}</div>
    </div>`).join("");

    const honesty = $("#hotel-honesty");
    if (honesty) honesty.innerHTML = `<b>How this works:</b> a free app can't pull live room rates, so I open the <b>real</b> live search on each site where the true price is. Offers are recurring India bank/app/coupon mechanisms, tagged how sure I am and when last checked. Confirm today's exact terms before you pay.`;

    // best card for hotels (across providers)
    const bp = $("#hotel-bestpay");
    if (bp) {
      const ranked = TE.bestCardForTrip({ stayCompare: (HOTELS.providers || []).map((p) => ({ provider: p, offers: TE.offersForWallet(p, wallet) })) }, wallet);
      if (!wallet.length) bp.innerHTML = `<div class="nudge">👋 Add your cards and I'll mark which hotel sites give you an instant discount. <b class="link" data-goto="addcard">Add my cards →</b></div>`;
      else if (ranked.length) bp.innerHTML = `<div class="bestpay"><div class="bp-head">💡 Best card for hotels (your wallet)</div><div class="bp-card">${cardArt(ranked[0].card, { tiny: true })} <b>${esc(ranked[0].card.name)}</b> has offers on ${ranked[0].places.length} hotel site${ranked[0].places.length > 1 ? "s" : ""}</div></div>`;
      else bp.innerHTML = `<div class="card-sub" style="margin:6px 0 12px;">No tracked hotel offer matches your cards yet — sites may still run a generic discount.</div>`;
      wireGoto();
    }

    if (!h.city) { $("#hotel-result").innerHTML = `<div class="empty">Enter a city (and your dates) — I'll line up every hotel site with the best discount for your wallet.</div>`; return; }

    const rows = (HOTELS.providers || []).map((p) => ({
      provider: p,
      link: TE.buildStayLink(p, h.city, h.checkin, h.checkout, h.adults),
      prefilled: p.linkType === "prefilled" && !!(TE.parseISO(h.checkin) && TE.parseISO(h.checkout)),
      offers: TE.offersForWallet(p, wallet),
      walletHits: TE.offersForWallet(p, wallet).filter((o) => o.inWallet).length,
    }));
    const ranked = TE.rankProviders(HOTELS.providers); // for grouping order
    const ordered = ranked.map((p) => rows.find((r) => r.provider.id === p.id)).filter(Boolean);

    const groupLabel = { meta: "Compare everything", chain: "Book direct (member rates + points)", ota: "Travel sites (most card offers)" };
    let lastType = null;
    const nights = TE.nightsBetween(h.checkin, h.checkout);
    const head = `<div class="fl-route"><b>${esc(h.city)}</b> <span class="card-sub">${h.checkin && h.checkout ? esc(h.checkin) + " → " + esc(h.checkout) + (nights ? " · " + nights + " night" + (nights > 1 ? "s" : "") : "") : "pick your dates"} · ${h.adults} guest${h.adults > 1 ? "s" : ""}</span></div>`;
    const body = ordered.map((r) => {
      const p = r.provider;
      const groupHead = p.type !== lastType ? `<div class="fl-group">${groupLabel[p.type] || ""}</div>` : "";
      lastType = p.type;
      const offerChips = r.offers.map((o) => {
        const cls = o.inWallet ? "in-wallet" : "";
        const who = o.offer.kind === "card" && o.offer.issuer ? o.offer.issuer + " " : "";
        const code = o.offer.code ? ` <code class="fl-code">${esc(o.offer.code)}</code>` : "";
        return `<div class="fl-offer ${cls}"><span class="fl-offer-k">${kindIcon(o.offer.kind)}</span>
          <span class="fl-offer-t">${esc(who)}${esc(o.offer.title)}${code} ${confBadge(o.offer.confidence)}${o.inWallet ? ` <span class="chip good">you hold this</span>` : ""}</span>
          ${o.offer.verify ? `<a class="fl-verify" href="https://${esc(String(o.offer.verify).replace(/^https?:\/\//, ""))}" target="_blank" rel="noopener">verify ↗</a>` : ""}</div>`;
      }).join("");
      const typeTag = p.type === "meta" ? `<span class="chip">compare</span>` : p.type === "chain" ? `<span class="chip rail">hotel group</span>` : `<span class="chip">travel site</span>`;
      return `${groupHead}<div class="fl-prov ${r.walletHits ? "has-wallet-offer" : ""}">
        <div class="fl-prov-head"><div><b>${esc(p.name)}</b> ${typeTag} ${confBadge(p.confidence)}</div>
        <a class="act mini fl-open" href="${r.link}" target="_blank" rel="noopener">${r.prefilled ? "open live rates ↗" : "open hotel site ↗"}</a></div>
        <div class="card-sub fl-note">${esc(p.note)}</div>
        ${offerChips || `<div class="card-sub fl-noOffer">No card/app offer tracked here — check the site for a current discount.</div>`}
      </div>`;
    }).join("");
    $("#hotel-result").innerHTML = head + body;
  }

  // ============================== ON-TRIP =================================
  function ontripState() { if (!state.ontrip) state.ontrip = { city: "" }; return state.ontrip; }
  function wireOntrip() {
    const o = ontripState();
    if ($("#ot-city")) $("#ot-city").value = o.city || "";
    if ($("#ot-city")) $("#ot-city").oninput = () => { state.ontrip = Object.assign(ontripState(), { city: $("#ot-city").value || "" }); save(); };
    if ($("#ot-go")) $("#ot-go").onclick = () => { state.ontrip = Object.assign(ontripState(), { city: ($("#ot-city") && $("#ot-city").value) || "" }); save(); renderOntrip(); const r = $("#ontrip-result"); if (r) r.scrollIntoView({ behavior: "smooth", block: "start" }); };
    wireFx();
  }

  // ---- LIVE currency converter (real ECB rates via live-data.js) ---------
  const FX_CURS = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "THB", "MYR", "JPY", "LKR", "AUD", "CAD"];
  function wireFx() {
    const fromSel = $("#fx-from"), toSel = $("#fx-to");
    if (!fromSel || !toSel || !LD) return;
    const f = state.fx || (state.fx = { from: "INR", to: "USD", amount: 1000 });
    const opts = FX_CURS.map((c) => `<option value="${c}">${c}</option>`).join("");
    fromSel.innerHTML = opts; toSel.innerHTML = opts;
    fromSel.value = f.from; toSel.value = f.to;
    if ($("#fx-amount")) $("#fx-amount").value = f.amount;
    const run = () => {
      state.fx = {
        from: fromSel.value, to: toSel.value,
        amount: ($("#fx-amount") && +$("#fx-amount").value) || 0,
      };
      save();
      runFx();
    };
    fromSel.onchange = run; toSel.onchange = run;
    if ($("#fx-amount")) $("#fx-amount").oninput = run;
    if ($("#fx-swap")) $("#fx-swap").onclick = () => { const t = fromSel.value; fromSel.value = toSel.value; toSel.value = t; run(); };
    runFx();
  }
  function runFx() {
    const out = $("#fx-result"); if (!out || !LD) return;
    const f = state.fx || { from: "INR", to: "USD", amount: 1000 };
    if (!(f.amount > 0)) { out.innerHTML = `<span class="card-sub">Enter an amount.</span>`; return; }
    if (f.from === f.to) { out.innerHTML = `<b>${LD.round2(f.amount).toLocaleString("en-IN")} ${esc(f.to)}</b> <span class="card-sub">(same currency)</span>`; return; }
    out.innerHTML = `<span class="card-sub">Fetching live rate…</span>`;
    // use `from` as the base so we get a direct rate
    LD.getRates(f.from, f.to).then((fx) => {
      const v = LD.convert(f.amount, f.from, f.to, fx.base, fx.rates);
      if (v == null) { out.innerHTML = `<span class="fl-err">Couldn't convert ${esc(f.from)}→${esc(f.to)} (currency not in ECB set).</span>`; return; }
      const per = LD.convert(1, f.from, f.to, fx.base, fx.rates);
      out.innerHTML = `<div class="fx-out"><b>${f.amount.toLocaleString("en-IN")} ${esc(f.from)}</b> = <b class="fx-big">${v.toLocaleString("en-IN")} ${esc(f.to)}</b></div>
        <div class="card-sub">1 ${esc(f.from)} = ${per} ${esc(f.to)} · ECB rate ${esc(fx.date)}${fx.fromCache ? " (cached, offline)" : ""}</div>`;
    }).catch((e) => {
      out.innerHTML = `<span class="fl-err">Live rate unavailable (${esc((e && e.message) || "offline")}). Try again when online.</span>`;
    });
  }
  function renderOntrip() {
    if (!$("#ontrip-result") || !TE) return;
    const o = ontripState();
    const wallet = state.wallet.map((id) => card(id)).filter(Boolean);

    const tips = $("#ontrip-tips");
    if (tips) tips.innerHTML = `<div class="section-h">💡 On-trip money plays</div>` + (DEALS.tips || []).map((t) => `<div class="coupon-row">
      <div class="cp-main"><div class="cp-title">💡 <b>${esc(t.title)}</b> ${confBadge(t.confidence)}</div><div class="card-sub">${esc(t.note)} · ${esc(t.who)}</div></div>
      <div class="cp-side"><span class="card-sub">checked ${esc(t.lastChecked)}</span></div></div>`).join("");

    const honesty = $("#ontrip-honesty");
    if (honesty) honesty.innerHTML = `<b>How this works:</b> each link opens the real app/site for that service. Offers are recurring mechanisms (bank tie-ups, app codes, wallet cashback), tagged how sure I am. Confirm today's exact terms in the app before you pay.`;

    const city = (o.city || "").trim();
    const out = (DEALS.categories || []).map((cat) => {
      const svcs = (DEALS.services || []).filter((s) => s.category === cat.id);
      const cards = svcs.map((s) => {
        const link = TE.buildDealLink(s, city);
        const offers = TE.offersForWallet(s, wallet);
        const walletHit = offers.some((x) => x.inWallet);
        const offerLine = offers.length ? offers.map((x) => {
          const mine = x.inWallet ? ` <span class="chip good">you hold this</span>` : "";
          const who = x.offer.kind === "card" && x.offer.issuer ? x.offer.issuer + " " : "";
          return `<div class="dl-offer">${kindIcon(x.offer.kind)} ${esc(who)}${esc(x.offer.title)} ${confBadge(x.offer.confidence)}${mine}${x.offer.verify ? ` <a class="fl-verify" href="https://${esc(String(x.offer.verify).replace(/^https?:\/\//, ""))}" target="_blank" rel="noopener">verify ↗</a>` : ""}</div>`;
        }).join("") : `<div class="card-sub">No tracked offer — check the app for a current one.</div>`;
        return `<div class="ot-svc ${walletHit ? "has-wallet-offer" : ""}">
          <div class="ot-svc-head"><b>${esc(s.name)}</b> ${confBadge(s.confidence)} <a class="act mini" href="${link}" target="_blank" rel="noopener">open ↗</a></div>
          <div class="card-sub">${esc(s.note)}</div>${offerLine}</div>`;
      }).join("");
      return `<div class="ot-cat"><div class="ot-cat-head">${cat.label}</div><div class="card-sub ot-cat-blurb">${esc(cat.blurb)}</div><div class="ot-grid">${cards}</div></div>`;
    }).join("");
    $("#ontrip-result").innerHTML = (city ? `<div class="fl-route"><b>${esc(city)}</b> <span class="card-sub">links tailored to this city where supported</span></div>` : `<div class="card-sub" style="margin:8px 0;">Tip: type a destination city above to tailor the cab/activity links to it.</div>`) + out;
  }

  // ===================== MY TRIPS + ITINERARY ============================
  function trips() { if (!state.trips) state.trips = []; return state.trips; }
  function nextSeq() { state.tripSeq = (state.tripSeq || 1) + 1; return state.tripSeq; }
  function openTrip() { return trips().find((t) => t.id === state.openTripId) || null; }
  const KIND_ICON = { flight: "✈️", hotel: "🏨", lounge: "🛋️", cab: "🚕", food: "🍽️", activity: "🎟️", note: "📝" };
  const KIND_LABEL = { flight: "Flight", hotel: "Hotel", lounge: "Lounge", cab: "Cab / transfer", food: "Food", activity: "Activity", note: "Note" };

  // build a trip from the current Plan inputs + the optimizer plan, seed it.
  function saveCurrentPlanAsTrip() {
    if (!IT || !TE) return;
    const p = planState();
    if (!p.from || !p.to) { toast("Add where you're going first."); return; }
    const plan = TE.planTrip({ from: p.from, to: p.to, depart: p.depart, nights: p.nights, adults: p.adults },
      { wallet: state.wallet, visitLog: state.visitLog, spend: state.spend, now: NOW });
    const r = plan.route;
    const t = IT.newTrip({
      title: ((r.origin ? r.origin.city : p.from) + " → " + (r.dest ? r.dest.city : p.to)),
      from: r.origin ? r.origin.city : p.from, to: r.dest ? r.dest.city : p.to,
      depart: p.depart, nights: p.nights, adults: p.adults, seed: nextSeq(), createdTs: 0,
    });
    IT.seedFromPlan(t, plan, { seedStart: (countAllItemsSeed()) });
    trips().push(t);
    state.openTripId = t.id;
    save();
    showView("trips", true);
    renderTrips();
    autoWeatherFlags(t);
    toast("Trip saved + starter itinerary filled in.");
  }
  // auto-set a trip's packing flags from the REAL forecast at its destination.
  // Runs async after the trip is created; re-renders if anything changed.
  function autoWeatherFlags(t) {
    if (!LD || !GEO) return;
    const dest = TE ? TE.resolvePlace(t.to, FLIGHTS) : null;
    const code = dest && dest.code;
    const coords = code && GEO.AIRPORT_COORDS[code];
    if (!coords) return;
    // mark intl if the destination is one of the known intl hubs
    const INTL = new Set(["DXB", "SIN", "BKK", "LHR", "JFK"]);
    LD.getWeather(coords[0], coords[1], 14).then((wx) => {
      const s = wx.parsed && wx.parsed.suggest; if (!s) return;
      t.packFlags = t.packFlags || {};
      let changed = false;
      const setFlag = (k, v) => { if (v && !t.packFlags[k]) { t.packFlags[k] = true; changed = true; } };
      setFlag("cold", s.cold); setFlag("monsoon", s.monsoon);
      if (INTL.has(code) && !t.packFlags.intl) { t.packFlags.intl = true; changed = true; }
      if (changed) { save(); if (state.openTripId === t.id) renderTrips(); }
    }).catch(() => {});
  }

  // a monotonically rising seed base so item ids never collide across trips
  function countAllItemsSeed() {
    let n = 100000;
    trips().forEach((t) => (t.days || []).forEach((d) => (n += (d.items || []).length + 1)));
    return n + 1;
  }

  function wireTripsForm() {
    if ($("#nt-create")) $("#nt-create").onclick = () => {
      if (!IT) return;
      const from = ($("#nt-from") && $("#nt-from").value || "").trim();
      const to = ($("#nt-to") && $("#nt-to").value || "").trim();
      if (!from || !to) { toast("Enter both cities."); return; }
      const depart = ($("#nt-depart") && $("#nt-depart").value) || "";
      const nights = ($("#nt-nights") && +$("#nt-nights").value) || 3;
      const adults = ($("#nt-adults") && +$("#nt-adults").value) || 2;
      const t = IT.newTrip({ title: from + " → " + to, from, to, depart, nights, adults, seed: nextSeq() });
      // seed from a fresh optimizer plan so the starter itinerary is real
      if (TE) {
        const plan = TE.planTrip({ from, to, depart, nights, adults }, { wallet: state.wallet, visitLog: state.visitLog, spend: state.spend, now: NOW });
        IT.seedFromPlan(t, plan, { seedStart: countAllItemsSeed() });
      }
      trips().push(t); state.openTripId = t.id; save(); renderTrips();
      autoWeatherFlags(t);
      toast("Trip created.");
    };
    if ($("#nt-depart")) $("#nt-depart").setAttribute("min", todayISO());
    if ($("#trip-import-btn")) $("#trip-import-btn").onclick = () => $("#trip-import-file") && $("#trip-import-file").click();
    if ($("#trip-import-file")) $("#trip-import-file").onchange = (e) => {
      const f = e.target.files && e.target.files[0]; if (!f || !IT) return;
      const rd = new FileReader();
      rd.onload = () => {
        const t = IT.importTrip(String(rd.result || ""));
        if (!t) { toast("That file isn't a TripLens trip."); return; }
        // re-id to avoid clobbering an existing trip
        t.id = IT.mkId("trip", nextSeq());
        trips().push(t); state.openTripId = t.id; save(); renderTrips();
        toast("Trip imported.");
      };
      rd.readAsText(f);
      e.target.value = "";
    };
  }

  function renderTrips() {
    const wrap = $("#trips-list"); if (!wrap || !IT) return;
    const open = openTrip();
    const newCard = $("#trips-new-card");
    if (open) {
      if (newCard) newCard.style.display = "none";
      wrap.innerHTML = renderItinerary(open);
      wireItinerary(open);
    } else {
      if (newCard) newCard.style.display = "";
      const list = trips();
      if (!list.length) {
        wrap.innerHTML = `<div class="empty">No saved trips yet. Build one on <b class="link" data-goto="plan">Plan a Trip</b> and tap “save this trip”, or start one below.</div>`;
        wireGoto();
        return;
      }
      wrap.innerHTML = `<div class="section-h">Your trips (${list.length})</div>` + list.map((t) => {
        const s = IT.tripSummary(t);
        return `<div class="trip-card" data-opentrip="${esc(t.id)}">
          <div class="tc-main">
            <div class="tc-title">🧭 ${esc(s.title)}</div>
            <div class="card-sub">${esc(s.dateRange)} · ${s.dayCount} days · ${s.itemCount} items · ${s.adults} traveller${s.adults > 1 ? "s" : ""}</div>
          </div>
          <div class="tc-actions">
            <button class="act mini" data-opentrip="${esc(t.id)}">Open →</button>
            <button class="act ghost mini" data-deltrip="${esc(t.id)}">Delete</button>
          </div>
        </div>`;
      }).join("");
      $$("[data-opentrip]").forEach((b) => b.onclick = () => { state.openTripId = b.dataset.opentrip; save(); renderTrips(); window.scrollTo({ top: 0, behavior: "smooth" }); });
      $$("[data-deltrip]").forEach((b) => b.onclick = () => {
        if (!confirm("Delete this trip?")) return;
        state.trips = trips().filter((t) => t.id !== b.dataset.deltrip);
        save(); renderTrips();
      });
    }
  }

  function renderItinerary(t) {
    const s = IT.tripSummary(t);
    const head = `<div class="itin-head">
      <button class="act ghost mini" id="itin-back">← All trips</button>
      <div class="itin-title"><b>${esc(t.title)}</b><span class="card-sub">${esc(s.dateRange)} · ${s.adults} traveller${s.adults > 1 ? "s" : ""}</span></div>
      <div class="itin-tools">
        <button class="act ghost mini" id="itin-export">⬇️ Share</button>
        <button class="act ghost mini" id="itin-jump-budget">💰 Budget</button>
        <button class="act ghost mini" id="itin-jump-pack">🎒 Packing</button>
      </div>
    </div>`;

    const days = t.days.map((day, di) => {
      const dl = day.date ? IT.dayLabel(day.date) : ("Day " + (di + 1));
      const tag = di === 0 ? `<span class="chip">arrival</span>` : di === t.days.length - 1 ? `<span class="chip rail">departure</span>` : "";
      const items = day.items.length ? day.items.map((it) => {
        const link = it.link ? ` <a class="fl-verify" href="${esc(it.link)}" target="_blank" rel="noopener">open ↗</a>` : "";
        return `<div class="itin-item kind-${esc(it.kind)}">
          <span class="ii-time">${esc(it.time || "—")}</span>
          <span class="ii-icon">${KIND_ICON[it.kind] || "•"}</span>
          <span class="ii-body"><b>${esc(it.title || KIND_LABEL[it.kind] || "Item")}</b>${it.note ? `<span class="card-sub"> ${esc(it.note)}</span>` : ""}${link}</span>
          <span class="ii-actions">
            ${di > 0 ? `<button class="ii-btn" data-mv="up" data-day="${di}" data-it="${esc(it.id)}" title="Move to previous day">↑</button>` : ""}
            ${di < t.days.length - 1 ? `<button class="ii-btn" data-mv="down" data-day="${di}" data-it="${esc(it.id)}" title="Move to next day">↓</button>` : ""}
            <button class="ii-btn del" data-delit data-day="${di}" data-it="${esc(it.id)}" title="Remove">✕</button>
          </span>
        </div>`;
      }).join("") : `<div class="card-sub itin-empty">Nothing planned. Add something below.</div>`;
      return `<div class="itin-day">
        <div class="itin-day-head">${esc(dl)} ${tag}</div>
        ${items}
        <div class="itin-add">
          <select class="cmp-select ia-kind" data-day="${di}" aria-label="Item type">
            ${Object.keys(KIND_LABEL).map((k) => `<option value="${k}">${KIND_ICON[k]} ${KIND_LABEL[k]}</option>`).join("")}
          </select>
          <input class="leg-input ia-time" data-day="${di}" type="time" aria-label="Time" />
          <input class="leg-input ia-title" data-day="${di}" placeholder="Add a plan (e.g. Baga beach)" aria-label="Title" />
          <button class="act mini ia-add" data-day="${di}">Add</button>
        </div>
      </div>`;
    }).join("");

    // packing
    const flags = t.packFlags || {};
    const pk = IT.packingList(t, flags);
    const byCat = {};
    pk.forEach((p) => { (byCat[p.cat] = byCat[p.cat] || []).push(p); });
    const packing = `<div class="section-h" id="itin-pack">🎒 Packing checklist</div>
      <div class="pack-flags">
        ${[["intl", "✈️ International"], ["cold", "🧥 Cold"], ["beach", "🏖️ Beach"], ["business", "💼 Business"], ["monsoon", "🌧️ Monsoon"]].map(([k, l]) =>
          `<label class="chip toggle"><input type="checkbox" class="pack-flag" data-flag="${k}" ${flags[k] ? "checked" : ""} /> ${l}</label>`).join("")}
      </div>
      ${Object.keys(byCat).map((cat) => `<div class="pack-cat"><div class="pack-cat-h">${esc(cat)}</div>${
        byCat[cat].map((p) => { const key = IT.packKey(p); const on = t.packing && t.packing.checked && t.packing.checked[key];
          return `<label class="pack-item ${on ? "done" : ""}"><input type="checkbox" class="pack-chk" data-key="${esc(key)}" ${on ? "checked" : ""} /> ${esc(p.item)}</label>`; }).join("")
      }</div>`).join("")}
      <p class="card-sub" style="margin-top:8px;">Tick the trip flags above to tailor the list. Checks save to this trip.</p>`;

    return head + `<div class="itin-days">${days}</div>` + budgetBlock(t) + packing +
      `<div class="honesty-note" style="margin-top:14px;">Your itinerary, budget + links are saved on this device only. The links open the real booking sites. Every rupee in the budget is a number you typed — TripLens never guesses a price. Export to share the whole plan.</div>`;
  }

  // budget tracker block for a trip (your numbers only, never fabricated)
  function budgetBlock(t) {
    if (!BUD) return "";
    const b = BUD.ensure(t);
    const s = BUD.summary(t);
    const sym = s.symbol;
    const curOpts = Object.keys(BUD.CURRENCIES).map((c) => `<option value="${c}" ${b.currency === c ? "selected" : ""}>${c} ${BUD.CURRENCIES[c]}</option>`).join("");
    const overallBar = s.total != null
      ? `<div class="bud-bar"><div class="bud-fill ${s.over ? "over" : ""}" style="width:${s.pct || 0}%"></div></div>
         <div class="bud-line"><b>${BUD.fmt(s.spent, b.currency)}</b> spent of ${BUD.fmt(s.total, b.currency)} ${s.over ? `<span class="chip bad">over by ${BUD.fmt(Math.abs(s.remaining), b.currency)}</span>` : `<span class="chip good">${BUD.fmt(s.remaining, b.currency)} left</span>`}</div>`
      : `<div class="bud-line"><b>${BUD.fmt(s.spent, b.currency)}</b> logged so far${s.spent > 0 ? ` · ${BUD.fmt(s.perPerson, b.currency)} per person` : ""}. <span class="card-sub">Set a total below to track against it.</span></div>`;

    const catRows = s.cats.map((c) => {
      const used = BUD.fmt(c.used, b.currency);
      const capBit = c.cap != null
        ? `<span class="bc-cap">${used} / ${BUD.fmt(c.cap, b.currency)} ${c.over ? `<span class="chip bad">over</span>` : ""}</span>`
        : `<span class="bc-cap">${used}<span class="card-sub"> · no cap</span></span>`;
      const bar = c.cap != null ? `<div class="bud-bar sm"><div class="bud-fill ${c.over ? "over" : ""}" style="width:${c.pct || 0}%"></div></div>` : "";
      return `<div class="bud-cat">
        <div class="bc-head"><span>${c.icon} ${c.label}</span>${capBit}</div>
        ${bar}
        <input class="leg-input bc-capinput" data-capcat="${c.id}" type="number" min="0" placeholder="set ${c.label.toLowerCase()} cap (optional)" value="${c.cap != null ? c.cap : ""}" aria-label="${c.label} cap" />
      </div>`;
    }).join("");

    // recent spends
    const spendsList = (b.spends || []).slice().reverse().map((sp) => {
      const cat = BUD.CATEGORIES.find((x) => x.id === sp.cat) || { icon: "•", label: sp.cat };
      const dayTxt = sp.day == null ? "unscheduled" : ("day " + (sp.day + 1));
      return `<div class="bud-spend"><span>${cat.icon} ${esc(sp.label || cat.label)} <span class="card-sub">· ${dayTxt}</span></span>
        <span class="bs-amt">${BUD.fmt(sp.amount, b.currency)} <button class="ii-btn del" data-delspend="${esc(sp.id)}" title="Remove">✕</button></span></div>`;
    }).join("") || `<div class="card-sub" style="padding:6px 0;">No spends logged yet. Add what you actually pay as you go — those are your real numbers.</div>`;

    const dayOpts = `<option value="">unscheduled</option>` + t.days.map((d, i) => `<option value="${i}">Day ${i + 1}${d.date ? " · " + IT.dayLabel(d.date) : ""}</option>`).join("");
    const catSelOpts = BUD.CATEGORIES.map((c) => `<option value="${c.id}">${c.icon} ${c.label}</option>`).join("");

    return `<div class="section-h" id="itin-budget">💰 Budget</div>
      <div class="bud-set">
        <label class="tp-lbl">Currency <select class="cmp-select" id="bud-cur" aria-label="Currency">${curOpts}</select></label>
        <label class="tp-lbl">Total budget <input class="fb-input" id="bud-total" type="number" min="0" placeholder="optional cap (${sym})" value="${b.total != null ? b.total : ""}" aria-label="Total budget" /></label>
      </div>
      ${overallBar}
      <div class="bud-cats">${catRows}</div>
      <div class="section-h" style="font-size:14px;margin-top:14px;">Log a spend</div>
      <div class="bud-add">
        <select class="cmp-select bud-a-cat" aria-label="Spend category">${catSelOpts}</select>
        <input class="leg-input bud-a-label" placeholder="what (e.g. dinner)" aria-label="Spend label" />
        <input class="leg-input bud-a-amt" type="number" min="0" placeholder="amount" aria-label="Amount" />
        <select class="cmp-select bud-a-day" aria-label="Spend day">${dayOpts}</select>
        <button class="act mini" id="bud-add-btn">Log</button>
      </div>
      <div class="bud-spends">${spendsList}</div>`;
  }

  function wireItinerary(t) {
    if ($("#itin-back")) $("#itin-back").onclick = () => { state.openTripId = null; save(); renderTrips(); };
    if ($("#itin-jump-pack")) $("#itin-jump-pack").onclick = () => { const p = $("#itin-pack"); if (p) p.scrollIntoView({ behavior: "smooth" }); };
    if ($("#itin-jump-budget")) $("#itin-jump-budget").onclick = () => { const p = $("#itin-budget"); if (p) p.scrollIntoView({ behavior: "smooth" }); };
    if ($("#itin-export")) $("#itin-export").onclick = () => {
      const blob = new Blob([IT.exportTrip(t)], { type: "application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = "triplens-" + (t.title || "trip").replace(/[^a-z0-9]+/gi, "-").toLowerCase() + ".json";
      a.click(); URL.revokeObjectURL(a.href);
      toast("Trip exported — share the file.");
    };
    // add item
    $$(".ia-add").forEach((b) => b.onclick = () => {
      const di = +b.dataset.day;
      const kind = ($(`.ia-kind[data-day="${di}"]`) || {}).value || "note";
      const time = ($(`.ia-time[data-day="${di}"]`) || {}).value || "";
      const title = (($(`.ia-title[data-day="${di}"]`) || {}).value || "").trim();
      if (!title) { toast("Type what to add."); return; }
      IT.addItem(t, di, { kind, time, title }, countAllItemsSeed());
      save(); renderTrips();
    });
    // remove + move
    $$("[data-delit]").forEach((b) => b.onclick = () => { IT.removeItem(t, +b.dataset.day, b.dataset.it); save(); renderTrips(); });
    $$("[data-mv]").forEach((b) => b.onclick = () => {
      const di = +b.dataset.day; const to = b.dataset.mv === "up" ? di - 1 : di + 1;
      IT.moveItem(t, di, b.dataset.it, to); save(); renderTrips();
    });
    // packing flags + checks
    $$(".pack-flag").forEach((c) => c.onchange = () => {
      t.packFlags = t.packFlags || {}; t.packFlags[c.dataset.flag] = c.checked; save(); renderTrips();
    });
    $$(".pack-chk").forEach((c) => c.onchange = () => {
      t.packing = t.packing || { checked: {} }; t.packing.checked = t.packing.checked || {};
      if (c.checked) t.packing.checked[c.dataset.key] = 1; else delete t.packing.checked[c.dataset.key];
      save();
      const lbl = c.closest(".pack-item"); if (lbl) lbl.classList.toggle("done", c.checked);
    });

    // ---- budget handlers ----
    if (BUD) {
      const cur = $("#bud-cur"); if (cur) cur.onchange = () => {
        const oldCur = (t.budget && t.budget.currency) || "INR";
        const newCur = cur.value;
        if (oldCur === newCur || !LD) { BUD.setCurrency(t, newCur); save(); renderTrips(); return; }
        // REAL conversion: restate every typed number into the new currency via live ECB rate
        toast("Converting your budget to " + newCur + " at live rates…");
        LD.getRates(oldCur, newCur).then((fx) => {
          const conv = (n) => LD.convert(n, oldCur, newCur, fx.base, fx.rates);
          if (t.budget) {
            if (t.budget.total != null) { const v = conv(t.budget.total); if (v != null) t.budget.total = v; }
            Object.keys(t.budget.byCat || {}).forEach((k) => { const v = conv(t.budget.byCat[k]); if (v != null) t.budget.byCat[k] = v; });
            (t.budget.spends || []).forEach((sp) => { const v = conv(sp.amount); if (v != null) sp.amount = v; });
          }
          BUD.setCurrency(t, newCur); save(); renderTrips();
          toast("Budget converted to " + newCur + " (live ECB rate).");
        }).catch(() => {
          // offline: switch the label only, don't fake a conversion
          BUD.setCurrency(t, newCur); save(); renderTrips();
          toast("Switched to " + newCur + " (offline — amounts not converted).");
        });
      };
      const tot = $("#bud-total"); if (tot) tot.onchange = () => { BUD.setTotal(t, tot.value); save(); renderTrips(); };
      $$("[data-capcat]").forEach((inp) => inp.onchange = () => { BUD.setCatCap(t, inp.dataset.capcat, inp.value); save(); renderTrips(); });
      const addBtn = $("#bud-add-btn");
      if (addBtn) addBtn.onclick = () => {
        const cat = ($(".bud-a-cat") || {}).value || "other";
        const label = (($(".bud-a-label") || {}).value || "").trim();
        const amount = +(($(".bud-a-amt") || {}).value || 0);
        const dayV = ($(".bud-a-day") || {}).value;
        if (!(amount > 0)) { toast("Enter an amount you actually paid."); return; }
        BUD.addSpend(t, { cat, label, amount, day: dayV === "" ? null : +dayV }, countAllItemsSeed());
        save(); renderTrips();
        const bud = $("#itin-budget"); if (bud) bud.scrollIntoView({ behavior: "smooth" });
      };
      $$("[data-delspend]").forEach((b2) => b2.onclick = () => { BUD.removeSpend(t, b2.dataset.delspend); save(); renderTrips(); });
    }
  }

  function renderFlightStats() {
    const el = $("#fl-stats");
    if (!el) return;
    const providers = (FLIGHTS.providers || []).length;
    const airlines = (FLIGHTS.providers || []).filter((p) => p.type === "airline").length;
    const otas = (FLIGHTS.providers || []).filter((p) => p.type === "ota").length;
    const offers = FE.allOffers(FLIGHTS).length;
    const pill = (n, l) => `<div class="lh-stat"><b>${n}</b><span>${l}</span></div>`;
    el.innerHTML = pill(providers, "booking sites") + pill(airlines, "airlines") + pill(otas, "OTAs") + pill(offers, "offers tracked");
  }

  function renderFlights() {
    if (!$("#fl-result")) return;
    const f = state.flight || (state.flight = { from: "", to: "", date: "" });
    // reflect persisted values into inputs
    if ($("#fl-from") && document.activeElement !== $("#fl-from")) $("#fl-from").value = f.from || "";
    if ($("#fl-to") && document.activeElement !== $("#fl-to")) $("#fl-to").value = f.to || "";
    if ($("#fl-date") && document.activeElement !== $("#fl-date")) $("#fl-date").value = f.date || "";

    const honesty = $("#fl-honesty");
    if (honesty) honesty.innerHTML = `<b>How this works:</b> a free app can't pull live airfares (no server), so I open the <b>real</b> live search on each site — you see the true price there. The offers below are recurring India card/app/coupon mechanisms, tagged how sure I am and when last checked. Always tap verify for today's exact code before you pay.`;

    const wallet = state.wallet.map((id) => card(id)).filter(Boolean);
    const from = flAirportLabel(f.from), to = flAirportLabel(f.to);

    // best way to pay across all providers (works even before a route is entered)
    const bp = $("#fl-bestpay");
    if (bp) {
      const ranked = FE.bestPay(FLIGHTS, wallet);
      if (!wallet.length) {
        bp.innerHTML = `<div class="nudge">👋 Add the cards you hold and I'll mark which booking sites give you an instant discount. <b class="link" data-goto="addcard">Add my cards →</b></div>`;
      } else if (ranked.length) {
        const top = ranked[0];
        bp.innerHTML = `<div class="bestpay">
          <div class="bp-head">💡 Best way to pay (from your wallet)</div>
          <div class="bp-card">${cardArt(top.card, { tiny: true })} <b>${top.card.name}</b> has offers on ${top.providers.slice(0, 4).join(", ")}${top.providers.length > 4 ? ` +${top.providers.length - 4} more` : ""}</div>
          <div class="card-sub">Offers rotate — confirm today's exact discount on each site before you pay.</div>
        </div>`;
      } else {
        bp.innerHTML = `<div class="card-sub" style="margin:6px 0 14px;">None of your cards match a tracked booking-site offer yet. The airline/OTA may still run a generic discount — check each site.</div>`;
      }
      wireGoto();
    }

    if (!from || !to) {
      $("#fl-result").innerHTML = `<div class="empty">Enter where you're flying from and to. I'll line up every booking site with the best discount for your wallet.</div>`;
      return;
    }
    if (from.code === to.code) {
      $("#fl-result").innerHTML = `<div class="empty">Origin and destination are the same. Pick two different cities.</div>`;
      return;
    }

    const rows = FE.comparison(FLIGHTS, from.code, to.code, f.date, wallet);
    const dateLabel = f.date ? (FE.dateParts(f.date) ? FE.dateParts(f.date).text : f.date) : "any date";
    const head = `<div class="fl-route">
      <b>${esc(from.code)}</b> <span class="fl-arrow">→</span> <b>${esc(to.code)}</b>
      <span class="card-sub">${esc(from.city)} to ${esc(to.city)} · ${esc(dateLabel)}</span>
    </div>`;

    const groupLabel = { meta: "Compare everything", airline: "Book direct (fewer fees)", ota: "Travel sites (most card offers)" };
    let lastType = null;
    const body = rows.map((r) => {
      const p = r.provider;
      const groupHead = p.type !== lastType ? `<div class="fl-group">${groupLabel[p.type] || ""}</div>` : "";
      lastType = p.type;
      const offerChips = r.offers.map((o) => {
        const cls = o.inWallet ? "in-wallet" : "";
        const who = o.offer.kind === "card" && o.offer.issuer ? o.offer.issuer + " " : "";
        const code = o.offer.code ? ` <code class="fl-code">${o.offer.code}</code>` : "";
        return `<div class="fl-offer ${cls}">
          <span class="fl-offer-k">${kindIcon(o.offer.kind)}</span>
          <span class="fl-offer-t">${who}${o.offer.title}${code} ${confBadge(o.offer.confidence)}${o.inWallet ? ` <span class="chip good">you hold this</span>` : ""}</span>
          ${o.offer.verify ? `<a class="fl-verify" href="https://${o.offer.verify.replace(/^https?:\/\//, "")}" target="_blank" rel="noopener">verify ↗</a>` : ""}
        </div>`;
      }).join("");
      const typeTag = p.type === "meta" ? `<span class="chip">compare</span>` : p.type === "airline" ? `<span class="chip rail">airline</span>` : `<span class="chip">travel site</span>`;
      return `${groupHead}
      <div class="fl-prov ${r.walletHits ? "has-wallet-offer" : ""}">
        <div class="fl-prov-head">
          <div><b>${p.name}</b> ${typeTag} ${confBadge(p.confidence)}</div>
          <a class="act mini fl-open" href="${r.link}" target="_blank" rel="noopener">${r.prefilled ? "open live fares ↗" : "open booking site ↗"}</a>
        </div>
        <div class="card-sub fl-note">${p.note}</div>
        ${offerChips || `<div class="card-sub fl-noOffer">No card/app offer tracked here — check the site for a current discount.</div>`}
      </div>`;
    }).join("");

    $("#fl-result").innerHTML = head + body;
  }

  // ---- LIVE fares (real prices, fetched in-browser from Amadeus) ----------
  const LIVE = window.LL_FLIGHT_LIVE;
  const AKEY = "loungelens.amadeus.creds"; // { clientId, clientSecret, env }
  function loadCreds() { try { return JSON.parse(localStorage.getItem(AKEY)); } catch (e) { return null; } }
  function saveCreds(c) { try { localStorage.setItem(AKEY, JSON.stringify(c)); } catch (e) {} }
  function clearCreds() { try { localStorage.removeItem(AKEY); } catch (e) {} if (LIVE) LIVE.clearToken(); }

  function renderKeyState() {
    const el = $("#fl-key-state"); if (!el) return;
    const c = loadCreds();
    if (c && c.clientId) {
      el.innerHTML = `<span class="chip good">connected</span> key ending …${c.clientId.slice(-4)} · ${c.env === "production" ? "Production (real fares)" : "Test (sample data)"}`;
      if ($("#fl-key-env")) $("#fl-key-env").value = c.env || "test";
    } else {
      el.innerHTML = `Not connected yet. Paste a free Amadeus key above to pull live fares.`;
    }
  }

  function wireKeySetup() {
    if ($("#fl-key-save")) $("#fl-key-save").onclick = () => {
      const clientId = ($("#fl-key-id").value || "").trim();
      const clientSecret = ($("#fl-key-secret").value || "").trim();
      const env = ($("#fl-key-env").value) || "test";
      if (!clientId || !clientSecret) { toast("Paste both the API key and secret."); return; }
      saveCreds({ clientId, clientSecret, env });
      if (LIVE) LIVE.clearToken();
      $("#fl-key-secret").value = "";
      renderKeyState();
      toast("Key saved on this device. Tap Get live fares.");
    };
    if ($("#fl-key-clear")) $("#fl-key-clear").onclick = () => { clearCreds(); renderKeyState(); toast("Key cleared from this device."); };
    if ($("#fl-key-env")) $("#fl-key-env").onchange = () => {
      const c = loadCreds(); if (c) { c.env = $("#fl-key-env").value; saveCreds(c); if (LIVE) LIVE.clearToken(); renderKeyState(); }
    };
    renderKeyState();
  }

  // map an airline code from Amadeus to one of OUR provider deep links (so a
  // live fare row can also offer "book on the airline / on an OTA").
  const AIRLINE_PROVIDER = { "6E": "indigo", AI: "airindia", QP: "akasa", SG: "spicejet", IX: "airindiaexpress", "9I": "alliance" };

  function getLiveFares() {
    const out = $("#fl-live-result"), status = $("#fl-live-status");
    if (!out || !status) return;
    const f = state.flight || {};
    const from = flAirportLabel(f.from), to = flAirportLabel(f.to);
    if (!from || !to) { status.innerHTML = `<div class="empty">Enter both cities first, then tap Get live fares.</div>`; return; }
    if (from.code === to.code) { status.innerHTML = `<div class="empty">Origin and destination are the same.</div>`; return; }
    if (!f.date) { status.innerHTML = `<div class="empty">Pick a travel date for live fares.</div>`; return; }
    const creds = loadCreds();
    if (!creds || !creds.clientId) {
      status.innerHTML = `<div class="nudge">⚡ To pull <b>real live fares</b>, connect a free Amadeus key once. <b class="link" id="fl-open-key">Set it up (2 min) →</b></div>`;
      const open = $("#fl-open-key"); if (open) open.onclick = () => { const d = $("#fl-key-setup"); if (d) { d.open = true; d.scrollIntoView({ behavior: "smooth" }); } };
      return;
    }
    if (!LIVE) { status.innerHTML = `<div class="empty">Live module not loaded.</div>`; return; }

    status.innerHTML = `<div class="fl-loading">⚡ Fetching live fares ${esc(from.code)} → ${esc(to.code)}…</div>`;
    out.innerHTML = "";
    LIVE.searchLive(creds, { from: from.code, to: to.code, date: f.date, adults: 1, max: 25 })
      .then((res) => {
        const rows = res.rows || [];
        if (!rows.length) { status.innerHTML = `<div class="empty">No live fares returned for ${esc(from.code)} → ${esc(to.code)} on that date. Try another date, or this route may not be in the provider's inventory.</div>`; return; }
        renderLiveFares(rows, from, to, creds);
        status.innerHTML = `<div class="fl-livehead">⚡ ${Number(rows.length)} live fares · ${esc(from.code)} → ${esc(to.code)} · ${esc(FE.dateParts(f.date) ? FE.dateParts(f.date).text : f.date)}${creds.env === "test" ? ` <span class="chip warn">test/sample data</span>` : ` <span class="chip good">live</span>`}</div>`;
      })
      .catch((err) => {
        status.innerHTML = `<div class="fl-err">Couldn't fetch live fares: ${(err && err.message) || "request failed"}.<br><span class="card-sub">If this is an auth error, re-check your key/secret and environment in the setup below. Test keys only return sample inventory.</span></div>`;
      });
  }

  // flexible-date scan: real fares across 14 days -> cheapest day + price dips
  function getFlexFares() {
    const out = $("#fl-flex-result"), status = $("#fl-live-status");
    if (!out) return;
    const f = state.flight || {};
    const from = flAirportLabel(f.from), to = flAirportLabel(f.to);
    if (!from || !to || from.code === to.code) { out.innerHTML = `<div class="empty">Enter two different cities first.</div>`; return; }
    if (!f.date) { out.innerHTML = `<div class="empty">Pick a start date — I'll scan from there.</div>`; return; }
    const creds = loadCreds();
    if (!creds || !creds.clientId) {
      out.innerHTML = `<div class="nudge">⚡ The 14-day scan uses live fares. <b class="link" id="fl-open-key2">Connect a free key (2 min) →</b></div>`;
      const o = $("#fl-open-key2"); if (o) o.onclick = () => { const d = $("#fl-key-setup"); if (d) { d.open = true; d.scrollIntoView({ behavior: "smooth" }); } };
      return;
    }
    if (!LIVE) return;
    const DAYS = 14;
    const dates = LIVE.dateRange(f.date, DAYS);
    out.innerHTML = `<div class="flex-head">📅 Scanning ${DAYS} days from ${esc(from.code)} → ${esc(to.code)}…</div>
      <div class="flex-grid" id="flex-grid">${dates.map((d) => `<div class="flex-day pending" data-d="${esc(d)}"><div class="fd-date">${esc(d.slice(8))}/${esc(d.slice(5, 7))}</div><div class="fd-price">…</div></div>`).join("")}</div>
      <div class="card-sub flex-foot">Each day is a real live fare lookup (cheapest fare that day). This takes a few seconds — free-tier is rate-limited so I go one day at a time.</div>`;

    const grid = $("#flex-grid");
    const onDay = (row) => {
      const cell = grid && grid.querySelector(`[data-d="${row.date}"]`);
      if (!cell) return;
      cell.classList.remove("pending");
      if (row.minPrice == null) { cell.classList.add("noprice"); cell.querySelector(".fd-price").textContent = row.error ? "—" : "n/a"; }
      else cell.querySelector(".fd-price").textContent = "₹" + Number(row.minPrice).toLocaleString("en-IN");
    };

    LIVE.searchFlexible(creds, { from: from.code, to: to.code, startDate: f.date, days: DAYS, adults: 1 }, onDay)
      .then((res) => {
        // mark cheapest + dips
        res.days.forEach((d) => {
          const cell = grid && grid.querySelector(`[data-d="${d.date}"]`);
          if (!cell) return;
          if (d.isCheapest) cell.classList.add("is-cheapest");
          else if (d.isDip) cell.classList.add("is-dip");
        });
        const head = $("#fl-flex-result .flex-head");
        if (res.cheapest && head) {
          const dips = res.days.filter((d) => d.isDip && !d.isCheapest).length;
          head.innerHTML = `📅 Cheapest in the next ${DAYS} days: <b>₹${Number(res.cheapest.minPrice).toLocaleString("en-IN")}</b> on ${esc(res.cheapest.date)}${res.cheapest.airline ? " (" + esc(res.cheapest.airline) + ")" : ""} · median ₹${Number(res.median).toLocaleString("en-IN")}${dips ? ` · <span class="chip warn">${Number(dips)} price dip${dips > 1 ? "s" : ""} flagged</span>` : ""}`;
        } else if (head) {
          head.innerHTML = `📅 No live fares returned across those ${DAYS} days. Try a different route or date.`;
        }
      })
      .catch((err) => { out.innerHTML = `<div class="fl-err">Scan failed: ${(err && err.message) || "request error"}.</div>`; });
  }

  function renderLiveFares(rows, from, to, creds) {
    const out = $("#fl-live-result"); if (!out) return;
    const wallet = state.wallet.map((id) => card(id)).filter(Boolean);
    const cheapest = LIVE.cheapestByAirline(rows);
    const min = rows[0] ? rows[0].priceTotal : 0;

    const cards = cheapest.map((r) => {
      const provId = AIRLINE_PROVIDER[r.airlineCode];
      const prov = provId ? (FLIGHTS.providers || []).find((p) => p.id === provId) : null;
      const link = prov ? FE.buildLink(prov, from.code, to.code, (state.flight || {}).date) : null;
      // does the user hold a card with an offer on this airline's provider?
      let payHint = "";
      if (prov && wallet.length) {
        const offers = FE.offersForProvider(prov, wallet).filter((o) => o.inWallet);
        if (offers.length) payHint = `<div class="lf-pay">💳 ${offers[0].matchedCards[0].name}${offers[0].offer.code ? ` · code ${offers[0].offer.code}` : ""} may apply${prov.type === "airline" ? " on " + prov.name : ""}</div>`;
      }
      const cheapestTag = r.priceTotal === min ? `<span class="chip good">cheapest</span>` : "";
      return `<div class="lf-card ${r.priceTotal === min ? "is-cheapest" : ""}">
        <div class="lf-top">
          <div class="lf-air">${esc(r.airline)} <span class="card-sub">${esc(r.airlineCode)}</span></div>
          <div class="lf-price">₹${Number(r.priceTotal).toLocaleString("en-IN")} ${cheapestTag}</div>
        </div>
        <div class="lf-mid">
          <span class="lf-time">${esc(r.depTime)}</span><span class="lf-dash">—</span><span class="lf-time">${esc(r.arrTime)}</span>
          <span class="card-sub">${esc(r.durationLabel)} · ${esc(r.stopsLabel)}${r.seatsLeft ? ` · ${Number(r.seatsLeft)} seats left` : ""}</span>
        </div>
        ${payHint}
        ${link ? `<a class="act mini" href="${link}" target="_blank" rel="noopener">book on ${prov.name} ↗</a>` : `<span class="card-sub">Search this airline on the sites below.</span>`}
      </div>`;
    }).join("");

    out.innerHTML = `<div class="lf-grid">${cards}</div>
      <div class="card-sub lf-foot">Cheapest per airline shown (${rows.length} total fares seen). Prices are live from the flight-data provider; the final price on the airline/OTA can differ slightly after taxes/fees. Tap through to book.</div>`;
  }

  // flight input wiring
  function wireFlights() {
    const persist = () => {
      state.flight = {
        from: ($("#fl-from") && $("#fl-from").value) || "",
        to: ($("#fl-to") && $("#fl-to").value) || "",
        date: ($("#fl-date") && $("#fl-date").value) || "",
      };
      save();
    };
    ["#fl-from", "#fl-to", "#fl-date"].forEach((s) => {
      const el = $(s);
      if (el) el.oninput = () => { persist(); };
    });
    if ($("#fl-go")) $("#fl-go").onclick = () => { persist(); renderFlights(); $("#fl-result").scrollIntoView({ behavior: "smooth", block: "start" }); };
    if ($("#fl-live")) $("#fl-live").onclick = () => { persist(); renderFlights(); getLiveFares(); const s = $("#fl-live-status"); if (s) s.scrollIntoView({ behavior: "smooth", block: "start" }); };
    if ($("#fl-flex")) $("#fl-flex").onclick = () => { persist(); getFlexFares(); const r = $("#fl-flex-result"); if (r) r.scrollIntoView({ behavior: "smooth", block: "start" }); };
    if ($("#fl-swap")) $("#fl-swap").onclick = () => {
      const a = $("#fl-from"), b = $("#fl-to");
      if (a && b) { const t = a.value; a.value = b.value; b.value = t; persist(); renderFlights(); }
    };
    wireKeySetup();
  }

  // ---- coupons & offers view ---------------------------------------------
  let couponKind = "";
  function renderCoupons() {
    if (!$("#coupon-list")) return;
    const wallet = state.wallet.map((id) => card(id)).filter(Boolean);
    const walletIssuers = new Set(wallet.map((c) => c.issuer));
    const onlyMine = $("#coupon-mine") && $("#coupon-mine").checked;
    let all = FE.allOffers(FLIGHTS);
    if (couponKind) all = all.filter((o) => (o.kind || "coupon") === couponKind);
    if (onlyMine) all = all.filter((o) => o.kind === "card" && o.issuer && walletIssuers.has(o.issuer));
    if (!all.length) { $("#coupon-list").innerHTML = `<div class="empty">No offers match this filter.</div>`; return; }

    $("#coupon-list").innerHTML = all.map((o) => {
      const mine = o.kind === "card" && o.issuer && walletIssuers.has(o.issuer);
      const who = o.kind === "card" && o.issuer ? `<span class="chip">${o.issuer}</span>` : "";
      const code = o.code ? ` <code class="fl-code">${o.code}</code>` : "";
      const checked = o.lastChecked ? `<span class="card-sub">checked ${o.lastChecked}</span>` : "";
      const verify = o.verify ? `<a class="fl-verify" href="https://${String(o.verify).replace(/^https?:\/\//, "")}" target="_blank" rel="noopener">verify ↗</a>` : "";
      return `<div class="coupon-row ${mine ? "in-wallet" : ""}">
        <div class="cp-main">
          <div class="cp-title">${kindIcon(o.kind)} ${who} <b>${o.title}</b>${code} ${confBadge(o.confidence)} ${mine ? `<span class="chip good">you hold this</span>` : ""}</div>
          <div class="card-sub">${o.note || o.terms || ""} ${o.provider ? `· on ${o.provider}` : ""}</div>
        </div>
        <div class="cp-side">${checked} ${verify}</div>
      </div>`;
    }).join("");
  }
  $$("#coupon-kind .seg-btn").forEach((b) => b.onclick = () => {
    couponKind = b.dataset.ck || "";
    $$("#coupon-kind .seg-btn").forEach((x) => x.classList.toggle("active", x === b));
    renderCoupons();
  });
  if ($("#coupon-mine")) $("#coupon-mine").onchange = renderCoupons;

  // ============================ SUGGESTIONS ===============================
  function renderSuggestions() {
    if (!$("#sug-list")) return;
    const list = state.suggestions || [];
    if (!list.length) { $("#sug-list").innerHTML = ""; return; }
    $("#sug-list").innerHTML = `<div class="card-sub" style="margin:8px 0;">Your suggestions (${list.length}) — <span class="link" id="sug-export">export to share</span>:</div>` +
      list.map((s) => `<div class="lint-row"><span class="chip ${s.kind === "lounge" ? "rail" : ""}">${s.kind}</span> <b>${s.name}</b> ${s.where ? `<span class="card-sub">· ${s.where}</span>` : ""} ${s.note ? `<span class="card-sub">— ${s.note}</span>` : ""} <span class="link" data-sugdel="${s.id}">remove</span></div>`).join("");
    const ex = $("#sug-export");
    if (ex) ex.onclick = () => {
      const blob = new Blob([JSON.stringify({ kind: "loungelens-suggestions", v: 1, suggestions: list }, null, 2)], { type: "application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "loungelens-suggestions.json"; a.click(); URL.revokeObjectURL(a.href);
    };
    $$("[data-sugdel]").forEach((b) => b.onclick = () => { state.suggestions = (state.suggestions || []).filter((x) => x.id !== b.dataset.sugdel); save(); render(); });
  }
  if ($("#sug-add")) $("#sug-add").onclick = () => {
    const kind = $("#sug-kind").value, name = $("#sug-name").value, where = $("#sug-where").value, note = $("#sug-note").value;
    if (!name.trim()) { toast("Give the lounge/card a name."); return; }
    try {
      const ts = Date.now();
      const s = SUGGEST.make(kind, name, where, note, ts);
      state.suggestions = SUGGEST.add(state.suggestions || [], s);
      save();
      $("#sug-name").value = ""; $("#sug-where").value = ""; $("#sug-note").value = "";
      render();
      toast("Added. It's in your app and ready to export/share.");
    } catch (e) { toast(e.message); }
  };

  // ---- onboarding (first run) -------------------------------------------
  function dismissOnboard(goAddCards) {
    const m = $("#onboard");
    if (m) m.hidden = true;
    state.onboarded = true; save();
    if (goAddCards) showView("addcard", true);
  }
  function maybeOnboard() {
    if (state.onboarded) return;
    const m = $("#onboard");
    if (!m) return;
    m.hidden = false;
    // primary CTA: start at Add Cards
    $("#onboard-start").onclick = () => dismissOnboard(true);
    // never trap the user: clicking the dim backdrop OR pressing Esc closes it
    m.addEventListener("click", (e) => { if (e.target === m) dismissOnboard(false); });
    document.addEventListener("keydown", function onEsc(e) {
      if (e.key === "Escape" && !m.hidden) { dismissOnboard(false); document.removeEventListener("keydown", onEsc); }
    });
  }

  // ---- toast (small non-blocking notice) --------------------------------
  function toast(msg) {
    const t = $("#toast");
    if (!t) return;
    t.textContent = msg; t.hidden = false; t.classList.add("show");
    setTimeout(() => { t.classList.remove("show"); setTimeout(() => (t.hidden = true), 300); }, 2600);
  }

  // ---- footer ------------------------------------------------------------
  $("#data-freshness").textContent = "Data reviewed " + (META.lastReviewed || "—");
  if ($("#about-version")) {
    const nCredit = CARDS.filter((c) => cardType(c) === "credit").length;
    const nDebit = CARDS.filter((c) => cardType(c) === "debit").length;
    const nFlightSites = (FLIGHTS.providers || []).length, nHotelSites = (HOTELS.providers || []).length, nDealSvcs = (DEALS.services || []).length;
    $("#about-version").textContent =
      "TripLens · data reviewed " + (META.lastReviewed || "—") + " · " + CARDS.length +
      " cards (" + nCredit + " credit, " + nDebit + " debit) · " + LOUNGES.length + " lounges · " +
      (nFlightSites + nHotelSites) + " booking sites · " + nDealSvcs + " on-trip services · all data stored locally";
  }
  $("#reset-all").onclick = () => {
    if (confirm("Clear your cards, visits and trip from this browser?")) { state = blank(); save(); applyMode(); render(); renderTripInputs(); }
  };

  // ---- master render -----------------------------------------------------
  function render() {
    if (!state.experiences) state.experiences = []; // migrate older saved state
    renderWallet(); renderLounges(); renderRecommend(); renderAddCard(); renderHealth(); renderProfile();
    renderAirports(); renderMap(); renderCompare(); renderValue(); renderSuggestions();
    renderFlights(); renderCoupons();
    renderPlanStats(); renderHotels(); renderOntrip(); renderTrips();
    if ($("#trip-result").innerHTML.trim()) renderTripResult();
    if ($("#plan-result") && $("#plan-result").innerHTML.trim()) renderPlanResult();
  }

  // ---- modal UX polish: Esc to close, click-backdrop to close -----------
  function closeModals() {
    const lm = $("#login-modal"); if (lm && !lm.hidden) lm.hidden = true;
    const cm = $("#card-modal"); if (cm && !cm.hidden) cm.hidden = true;
    // onboarding is intentionally NOT esc-closable (first-run guidance)
  }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModals(); });
  $$(".modal").forEach((m) => m.addEventListener("click", (e) => {
    // click on the dim backdrop (not the inner box) closes — except onboarding
    if (e.target === m && m.id !== "onboard") m.hidden = true;
  }));

  // landing hero stats (the product-scale moment)
  function renderHeroStats() {
    const el = $("#lh-stats");
    if (!el) return;
    const cities = new Set(LOUNGES.map((l) => l.city).filter(Boolean)).size;
    const issuers = new Set(CARDS.map((c) => c.issuer)).size;
    const pill = (n, l) => `<div class="lh-stat"><b>${n}</b><span>${l}</span></div>`;
    el.innerHTML =
      pill(CARDS.length, "cards") +
      pill(LOUNGES.length, "lounges") +
      pill(cities, "cities") +
      pill(issuers, "banks");
  }

  // init
  applyMode();
  cityDatalist();
  fillAirportList();
  fillHotelCityList();
  setFlightDateFloor();
  renderHeroStats();
  renderFlightStats();
  renderPlanStats();
  renderTripInputs();
  wireFlights();
  wirePlan();
  wireHotels();
  wireOntrip();
  wireTripsForm();
  wireDatePickers();
  render();
  renderAuthBar();
  maybeOnboard();
})();
