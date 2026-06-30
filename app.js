/* LoungeLens app controller — DOM glue over LL_ENGINE. Simple + Advanced modes. */
(function () {
  "use strict";
  const E = window.LL_ENGINE, CARDS = window.LL_CARDS, LOUNGES = window.LL_LOUNGES, META = window.LL_META, SELF = window.LL_SELF;
  const BRAND = window.LL_BRAND;
  const FE = window.LL_FLIGHT_ENGINE, FLIGHTS = window.LL_FLIGHTS;
  const TE = window.LL_TRIP_ENGINE, HOTELS = window.LL_HOTELS, DEALS = window.LL_DEALS;
  const IT = window.LL_ITINERARY, BUD = window.LL_BUDGET;
  const GEO = window.LL_GEO, LD = window.LL_LIVE;
  const TR = window.LL_TRANSPORT, TRE = window.LL_TRANSPORT_ENGINE;
  const WATCH = window.LL_WATCH;
  const MC = window.LL_MULTICITY;
  const ROUTE = window.LL_ROUTE;
  const HIST = window.LL_HISTORY;
  const HOL = window.LL_HOLIDAY, HOLIDAYS = window.LL_HOLIDAYS;
  const BRIEF = window.LL_BRIEF;
  const READY = window.LL_READINESS;
  const XP = window.LL_EXPLORE;
  const SPLIT = window.LL_SPLIT;
  const PLANNER = window.LL_PLANNER, DESTS = window.LL_DESTINATIONS;
  const QS = window.LL_QUICKSTART;
  const SEASON = window.LL_SEASON;
  // international hubs in our data — the ONE source for "is this trip international?".
  // shared by autoWeatherFlags + the readiness checklist so they never disagree.
  const INTL_CODES = ["DXB", "SIN", "BKK", "LHR", "JFK"];
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
  function blank() { return { wallet: [], visitLog: [], spend: {}, mode: "simple", trip: ["Hyderabad", ""], experiences: [], onboarded: false, profileName: "", suggestions: [], flight: { from: "", to: "", date: "" }, plan: { from: "", to: "", depart: "", nights: 3, adults: 2 }, hotel: { city: "", checkin: "", checkout: "", adults: 2 }, ontrip: { city: "" }, ground: { from: "", to: "", date: "" }, multicity: ["", "", ""], watches: [], searches: [], lw: { year: 0, custom: [] }, explore: { from: "", priority: "balanced" }, trips: [], openTripId: null, tripSeq: 1, fx: { from: "INR", to: "USD", amount: 1000 } }; }

  // account store (login): { username: { pinHash, data } } + the active username
  const ACCT_KEY = "loungelens.accounts";
  const SESSION_KEY = "loungelens.session";
  function loadAccounts() { try { return JSON.parse(localStorage.getItem(ACCT_KEY)) || {}; } catch (e) { return {}; } }
  // safe localStorage write: never throws (so no caller crashes mid-interaction),
  // returns true on success. On quota/blocked storage (private mode, full disk) it
  // warns ONCE so the user knows their changes aren't persisting, then stays quiet.
  let storageWarned = false;
  function safeWrite(key, value) {
    try { localStorage.setItem(key, value); return true; }
    catch (e) {
      if (!storageWarned) {
        storageWarned = true;
        try { toast("Storage is full or blocked — your changes won't be saved on this device. Free up space or leave private mode."); } catch (e2) { /* toast may not be ready */ }
      }
      return false;
    }
  }
  function saveAccounts(s) { return safeWrite(ACCT_KEY, JSON.stringify(s)); }
  let accounts = loadAccounts();
  let activeUser = localStorage.getItem(SESSION_KEY) || null;

  // if a user is logged in, prefer their saved data as the live state
  if (activeUser && accounts[activeUser] && accounts[activeUser].data) {
    state = accounts[activeUser].data;
  }

  function save() {
    safeWrite(KEY, JSON.stringify(state)); // device fallback copy — never throws
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
    // if the active view lives in the collapsed "More" group, open it so the
    // highlighted button is actually visible (deep links + programmatic nav).
    const moreBox = $("#nav-more");
    if (moreBox && moreBox.querySelector('button[data-view="' + view + '"]')) setNavMore(true);
    const activeView = $("#view-" + view);
    $$(".view").forEach((v) => v.classList.toggle("active", v === activeView));
    updateNavToggleLabel(view);
    // on mobile, fold the menu away after a pick so it stops covering the page
    if (isMobileNav()) setNavCollapsed(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (push && location.hash !== "#" + view) history.replaceState(null, "", "#" + view);
    // a11y: on a real navigation (not the initial route restore), move focus to the
    // new view's heading so a screen reader announces the content changed instead of
    // leaving focus on the nav button. tabindex=-1 = programmatically focusable only.
    if (push && activeView) {
      const h = activeView.querySelector("h2");
      if (h) {
        if (!h.hasAttribute("tabindex")) h.setAttribute("tabindex", "-1");
        // focus without the scroll jump (we already smooth-scrolled to top)
        try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); }
      }
    }
  }
  $$("nav button").forEach((b) =>
    b.addEventListener("click", () => b.dataset.view && showView(b.dataset.view, true))
  );
  // "More" group: show/hide the secondary nav buttons so the menu isn't a wall
  function setNavMore(open) {
    const box = $("#nav-more"), tog = $("#nav-more-toggle");
    if (!box || !tog) return;
    box.hidden = !open;
    tog.setAttribute("aria-expanded", open ? "true" : "false");
    tog.textContent = open ? "⋯ Less" : "⋯ More";
  }
  if ($("#nav-more-toggle")) $("#nav-more-toggle").onclick = () => setNavMore($("#nav-more").hidden);
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
    $$("[data-goto]").forEach((el) => {
      const go = () => showView(el.dataset.goto, true);
      el.onclick = go;
      // a11y: spans-as-links must be keyboard operable like a real button.
      // real <button>/<a> already are, so only upgrade the others.
      if (el.tagName !== "BUTTON" && el.tagName !== "A") {
        if (!el.hasAttribute("role")) el.setAttribute("role", "button");
        if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "0");
        el.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } };
      }
    });
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
          <select class="cmp-select" id="add-issuer" aria-label="Filter cards by issuer">${issuerOpts}</select>
          <select class="cmp-select" id="add-network" aria-label="Filter cards by network">${netOpts}</select>
          <select class="cmp-select" id="add-sort" aria-label="Sort cards">${sortOpts}</select>
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
        safeWrite(SESSION_KEY, activeUser);
        state = accounts[activeUser].data;
        $("#login-modal").hidden = true;
        render(); renderAuthBar();
        toast("Profile created. You're logged in.");
      } catch (e) { loginError(e.message); }
    } else {
      const v = AUTH.verifyLogin(accounts, u, pin);
      if (!v.ok) { loginError(v.reason === "wrong PIN" ? "Wrong PIN, try again." : "No profile with that username on this device. Create one?"); return; }
      activeUser = AUTH.normUser(u);
      safeWrite(SESSION_KEY, activeUser);
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

  // common alternate / old city names people actually type -> the IATA code we
  // store. Keeps the data on official names but lets users type what they know.
  const CITY_ALIASES = {
    "bangalore": "BLR", "bengaluru": "BLR",
    "bombay": "BOM", "mumbai": "BOM",
    "calcutta": "CCU", "kolkata": "CCU",
    "madras": "MAA", "chennai": "MAA",
    "trivandrum": "TRV", "thiruvananthapuram": "TRV",
    "calicut": "CCJ", "kozhikode": "CCJ",
    "vizag": "VTZ", "visakhapatnam": "VTZ", "vishakhapatnam": "VTZ",
    "cochin": "COK", "kochi": "COK",
    "pondicherry": "MAA", "puducherry": "MAA",
    "new delhi": "DEL", "delhi": "DEL", "ncr": "DEL", "gurgaon": "DEL", "gurugram": "DEL", "noida": "DEL",
    "baroda": "BDQ", "vadodara": "BDQ",
    "benares": "VNS", "banaras": "VNS", "varanasi": "VNS", "kashi": "VNS",
    "goa": "GOI", "panaji": "GOI", "panjim": "GOI",
    "blr": "BLR", "bom": "BOM",
  };
  function flAirportLabel(codeOrCity) {
    const v = (codeOrCity || "").trim();
    if (!v) return null;
    const up = v.toUpperCase();
    const byCode = (FLIGHTS.airports || []).find((a) => a.code === up);
    if (byCode) return byCode;
    const byCity = (FLIGHTS.airports || []).find((a) => a.city.toLowerCase() === v.toLowerCase());
    if (byCity) return byCity;
    // alias map: common/old names ("Bangalore" -> BLR, "Bombay" -> BOM, etc.)
    const aliasCode = CITY_ALIASES[v.toLowerCase()];
    if (aliasCode) { const byAlias = (FLIGHTS.airports || []).find((a) => a.code === aliasCode); if (byAlias) return byAlias; }
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
  // ONE-TAP START: render the "tap a place" chips and wire each to build a
  // complete, auto-planned trip with zero typing. This is the newbie front door.
  function renderQuickstart() {
    const wrap = $("#qs-chips"); if (!wrap || !QS || !DESTS) { const q = $("#quickstart"); if (q) q.hidden = true; return; }
    const chips = QS.featured(DESTS);
    if (!chips.length) { const q = $("#quickstart"); if (q) q.hidden = true; return; }
    // a tasteful accent hue per destination so the cards feel alive (decorative
    // only — it tints a soft corner glow, never affects text contrast).
    const HUES = { GOI: 28, GOX: 28, DXB: 41, JAI: 14, SIN: 168, BKK: 280, SXR: 205, COK: 150, DEL: 8, BOM: 200, BLR: 130, HYD: 320, MAA: 190, CCU: 50, LHR: 220, JFK: 230 };
    wrap.innerHTML = chips.map((c) => {
      const hue = HUES[c.code] != null ? HUES[c.code] : 250;
      return `<button class="qs-chip" data-qs="${esc(c.code)}" style="--chip-hue:${hue}" aria-label="Plan a trip to ${esc(c.city)}">
        <span class="qs-emoji" aria-hidden="true">${c.emoji}</span>
        <span class="qs-city">${esc(c.city)}</span>
        <span class="qs-known">${esc(c.knownFor)}</span>
      </button>`;
    }).join("");
    $$("[data-qs]").forEach((b) => b.onclick = () => quickStartTrip(b.dataset.qs));
    // 🎲 Surprise me: pick a random featured place (rotating seed so repeated
    // taps vary; never the same place twice in a row) and build that trip.
    if ($("#qs-surprise")) $("#qs-surprise").onclick = () => {
      if (!QS) return;
      // step the seed and run it through a simple integer hash so successive
      // taps spread across ALL featured places, not ping-pong between two.
      state.surpriseSeed = ((state.surpriseSeed || 0) + 1) % 100000;
      let h = state.surpriseSeed * 2654435761;
      h = (h ^ (h >>> 13)) >>> 0; // mix the bits
      const pick = QS.surprise(DESTS, h, state.lastSurprise);
      if (!pick) return;
      state.lastSurprise = pick.code; save();
      quickStartTrip(pick.code);
    };
    // "or type your own" just drops focus into the form below
    if ($("#qs-or-type")) $("#qs-or-type").onclick = () => {
      const f = $("#tp-from") || $("#tp-to"); if (f) { f.scrollIntoView({ behavior: "smooth", block: "center" }); f.focus(); }
    };
  }

  // one tap -> a real, ready-to-use trip. Creates the trip, seeds the optimizer
  // starter items, auto-plans the days with real Maps searches, opens it.
  // Honesty: dates are a clearly-flagged sensible default; nothing is fabricated.
  function quickStartTrip(code) {
    if (!QS || !IT || !DESTS) return;
    const spec = QS.quickTrip(code, DESTS, todayISO());
    const t = IT.newTrip({ title: spec.city, from: spec.from, to: spec.to, depart: spec.depart, nights: spec.nights, adults: spec.adults, seed: nextSeq() });
    // 1. seed the real optimizer starter (flight/lounge/hotel scaffold) if available
    if (TE) {
      const plan = TE.planTrip({ from: spec.from, to: spec.to, depart: spec.depart, nights: spec.nights, adults: spec.adults },
        { wallet: state.wallet, visitLog: state.visitLog, spend: state.spend, now: NOW });
      IT.seedFromPlan(t, plan, { seedStart: countAllItemsSeed() });
    }
    // 2. auto-fill the themed day-by-day ideas with real Maps links
    if (PLANNER) {
      const dplan = PLANNER.buildPlan({ code: spec.code, city: spec.city }, t.days.length, DESTS);
      dplan.days.forEach((pd) => {
        const day = t.days[pd.dayIndex]; if (!day) return;
        pd.slots.forEach((sl) => {
          if (!sl.theme) return;
          if ((day.items || []).some((it) => it.title === sl.title)) return;
          IT.addItem(t, pd.dayIndex, { time: sl.time, kind: sl.kind, title: sl.title, note: "Tap to open the live map search", link: sl.link }, countAllItemsSeed());
        });
      });
    }
    trips().push(t); state.openTripId = t.id; save();
    autoWeatherFlags(t);
    showView("trips", true);
    renderTrips();
    toast("Trip to " + spec.city + " ready. The dates are a guess — tap “edit dates” up top to change them.");
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
    renderQuickstart();
  }
  function todayISO() { const n = new Date(); return n.getFullYear() + "-" + ("0" + (n.getMonth() + 1)).slice(-2) + "-" + ("0" + n.getDate()).slice(-2); }

  // honest holiday-timing for a depart date: does it sit on/next to a holiday
  // (with the leave-bridge math), and what's the next long weekend after it.
  function holidayTimingFor(departISO) {
    if (!HOL || !HOLIDAYS) return null;
    const lw = (state.lw && state.lw.custom) || [];
    const out = { assess: null, nextLongWeekend: null };
    if (departISO && /^\d{4}-\d{2}-\d{2}$/.test(departISO)) {
      const year = +departISO.slice(0, 4);
      const items = HOL.planYear(HOLIDAYS.fixed, lw, year);
      // is the depart date inside any holiday's zero-leave or bridged block?
      for (const it of items) {
        const a = it.assess; if (!a) continue;
        const block = a.best || a.zeroLeave;
        if (block && departISO >= block.start && departISO <= block.end) { out.assess = a; break; }
        if (a.date === departISO) { out.assess = a; break; }
      }
      // next long weekend strictly after the depart date (good-dates nudge)
      if (!out.assess) {
        const future = items.filter((it) => it.assess && it.date > departISO && (it.assess.verdict === "free_long_weekend" || it.assess.verdict === "one_bridge"));
        if (future.length) {
          const a = future[0].assess;
          const days = (a.best && a.best.days) || (a.zeroLeave && a.zeroLeave.days) || 3;
          out.nextLongWeekend = { name: a.name, date: future[0].date, days };
        }
      }
    }
    return (out.assess || out.nextLongWeekend) ? out : null;
  }

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

    // ---- SMART TRIP BRIEF: every decision, made, on top ----
    let briefHtml = "";
    if (BRIEF) {
      const km = (GEO && r.from && r.to) ? GEO.distanceKm(r.from, r.to) : null;
      const transport = (TRE && r.from && r.to && km != null) ? TRE.compareModes(r.from, r.to) : null;
      const lo = plan.lounges.origin, ld = plan.lounges.dest;
      const composed = BRIEF.compose({
        route: { fromCity: r.origin ? r.origin.city : p.from, toCity: r.dest ? r.dest.city : p.to },
        km, transport,
        bestCard: plan.bestCard && plan.bestCard.length ? plan.bestCard[0] : null,
        walletCount: state.wallet.length,
        dates: { depart: d.depart },
        holiday: holidayTimingFor(d.depart),
        lounges: lo || ld ? { originOpen: lo ? lo.openCount : 0, destOpen: ld ? ld.openCount : 0, originTotal: lo ? lo.total : 0, destTotal: ld ? ld.total : 0 } : null,
        weather: null, // weather is async; it has its own live line in the route header
      });
      const cards = composed.decisions.map((dec) => `<div class="tb-card">
        <div class="tb-ic">${dec.icon}</div>
        <div class="tb-body">
          <div class="tb-title">${esc(dec.title)}</div>
          <div class="tb-value">${esc(dec.value)} ${confBadge(dec.confidence)}</div>
          <div class="card-sub tb-why">${esc(dec.why)}</div>
        </div>
        ${dec.action ? `<button class="act ghost mini tb-act" data-goto="${esc(dec.action)}">go</button>` : ""}
      </div>`).join("");
      const move = composed.topMove;
      briefHtml = `<div class="trip-brief">
        <div class="tb-head">⚡ <b>Your trip brief</b> <span class="card-sub">${esc(composed.headline)}</span></div>
        ${move ? `<div class="tb-move"><span class="tb-move-ic">👉</span> <b>Do this first:</b> ${esc(move.text)} ${move.action ? `<button class="act ghost mini" data-goto="${esc(move.action)}">go</button>` : ""}</div>` : ""}
        <div class="tb-grid">${cards}</div>
      </div>`;
    }

    out.innerHTML = briefHtml + routeHead + bestCardHtml + saveBtn +
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

  // ========================= TRAINS & BUSES ==============================
  function groundState() {
    if (!state.ground) state.ground = { from: "", to: "", date: "", tripType: "oneway", returnDate: "", priority: "fast" };
    if (!state.ground.tripType) state.ground.tripType = "oneway";
    if (!state.ground.priority) state.ground.priority = "fast";
    return state.ground;
  }
  // for a slug, use the city the user typed; if they typed a 3-letter code,
  // expand it to the airport's city so booking-site route slugs resolve.
  function slugCityName(input, label) {
    const v = (input || "").trim();
    if (/^[A-Za-z]{3}$/.test(v) && label && label.city) return label.city;
    return v || (label && label.city) || "";
  }
  function wireGround() {
    const g = groundState();
    if ($("#gr-from")) $("#gr-from").value = g.from || "";
    if ($("#gr-to")) $("#gr-to").value = g.to || "";
    if ($("#gr-date")) { $("#gr-date").value = g.date || ""; $("#gr-date").setAttribute("min", todayISO()); }
    if ($("#gr-return")) { $("#gr-return").value = g.returnDate || ""; $("#gr-return").setAttribute("min", todayISO()); }
    if ($("#gr-priority")) $("#gr-priority").value = g.priority || "fast";
    syncGroundTripType();
    const persist = () => {
      state.ground = {
        from: ($("#gr-from") && $("#gr-from").value) || "",
        to: ($("#gr-to") && $("#gr-to").value) || "",
        date: ($("#gr-date") && $("#gr-date").value) || "",
        tripType: ($$("#view-ground [name=gr-trip]:checked")[0] || {}).value || "oneway",
        returnDate: ($("#gr-return") && $("#gr-return").value) || "",
        priority: ($("#gr-priority") && $("#gr-priority").value) || "fast",
      };
      save();
    };
    ["#gr-from", "#gr-to", "#gr-date", "#gr-return"].forEach((s) => { const el = $(s); if (el) el.oninput = persist; });
    $$("#view-ground [name=gr-trip]").forEach((r) => r.onchange = () => { persist(); syncGroundTripType(); });
    // priority change re-ranks live if a result is already on screen
    if ($("#gr-priority")) $("#gr-priority").onchange = () => { persist(); if ($("#gr-trains") && $("#gr-trains").innerHTML.indexOf("empty") === -1 && (groundState().from || "").trim() && (groundState().to || "").trim()) renderGround(); };
    if ($("#gr-swap")) $("#gr-swap").onclick = () => { const a = $("#gr-from"), b = $("#gr-to"); if (a && b) { const t = a.value; a.value = b.value; b.value = t; persist(); } };
    if ($("#gr-go")) $("#gr-go").onclick = () => { persist(); renderGround(); const r = $("#gr-compare"); if (r) r.scrollIntoView({ behavior: "smooth", block: "start" }); };
  }
  // show/hide the return-date field based on the one-way vs round-trip pick
  function syncGroundTripType() {
    const g = groundState();
    const round = g.tripType === "round";
    const wrap = $("#gr-return-wrap");
    if (wrap) wrap.style.display = round ? "" : "none";
  }
  // one set of provider links for a single direction + date
  function groundLinkSet(fromName, toName, dateISO) {
    const trains = TRE.trainOptions(TR, fromName, toName, dateISO);
    const buses = TRE.busOptions(TR, fromName, toName, dateISO);
    const provRow = (o) => {
      const p = o.provider;
      const tag = p.type === "official" ? `<span class="chip rail">official</span>` : p.type === "aggregator" ? `<span class="chip">compare</span>` : `<span class="chip">booking site</span>`;
      const offerChips = (p.offers || []).map((of) => {
        const code = of.code ? ` <code class="fl-code">${esc(of.code)}</code>` : "";
        return `<div class="fl-offer"><span class="fl-offer-k">${kindIcon(of.kind)}</span>
          <span class="fl-offer-t">${esc(of.title)}${code} ${confBadge(of.confidence)}</span>
          ${of.verify ? `<a class="fl-verify" href="https://${esc(String(of.verify).replace(/^https?:\/\//, ""))}" target="_blank" rel="noopener">verify ↗</a>` : ""}</div>`;
      }).join("");
      return `<div class="fl-prov">
        <div class="fl-prov-head"><div><b>${esc(p.name)}</b> ${tag} ${confBadge(p.confidence)}</div>
        <a class="act mini fl-open" href="${o.link}" target="_blank" rel="noopener">open live search ↗</a></div>
        <div class="card-sub fl-note">${esc(p.note)}</div>${offerChips}</div>`;
    };
    return {
      trains: `<div class="fl-group">🚆 Trains · ${esc(fromName)} → ${esc(toName)}</div>` + trains.map(provRow).join(""),
      buses: `<div class="fl-group">🚌 Buses · ${esc(fromName)} → ${esc(toName)}</div>` + buses.map(provRow).join(""),
    };
  }
  function renderGround() {
    if (!$("#gr-trains") || !TRE || !TR) return;
    const g = groundState();
    const round = g.tripType === "round";

    // tips always render
    const tipsEl = $("#gr-tips");
    if (tipsEl) tipsEl.innerHTML = (TR.tips || []).map((t) => `<div class="coupon-row">
      <div class="cp-main"><div class="cp-title">🎟️ <b>${esc(t.title)}</b> ${confBadge(t.confidence)}</div><div class="card-sub">${esc(t.note)} · ${esc(t.who)}</div></div>
      <div class="cp-side"><span class="card-sub">checked ${esc(t.lastChecked)}</span></div></div>`).join("");

    const honesty = $("#gr-honesty");
    if (honesty) honesty.innerHTML = `<b>How this works:</b> distance is the real straight-line distance between the two cities; train and bus durations are honest estimates from that distance (trains average about 55 km/h with stops, buses about 45 km/h), not live timetables. Each link opens the real live search where the actual times, seats and fares live. I never invent a price.`;

    const fromIn = (g.from || "").trim(), toIn = (g.to || "").trim();
    const clearGround = (msg) => {
      $("#gr-compare").innerHTML = "";
      $("#gr-trains").innerHTML = `<div class="empty">${msg}</div>`;
      $("#gr-buses").innerHTML = "";
      if ($("#gr-pick")) $("#gr-pick").innerHTML = "";
      if ($("#gr-stops")) $("#gr-stops").innerHTML = "";
      if ($("#gr-via")) $("#gr-via").innerHTML = "";
    };
    if (!fromIn || !toIn) { clearGround("Enter both cities — I'll work out whether to train, bus or fly, and open the live search on every booking site."); return; }
    const fL = flAirportLabel(fromIn), tL = flAirportLabel(toIn);
    // same place: a train/bus from a city to itself makes no sense (was building
    // a "delhi-to-delhi" link). Block it like the flight search does.
    if ((fL && tL && fL.code === tL.code) || (!fL && !tL && fromIn.toLowerCase() === toIn.toLowerCase())) {
      clearGround("That's the same place — pick two different cities.");
      return;
    }
    const fromName = slugCityName(fromIn, fL), toName = slugCityName(toIn, tL);

    // remember this trains+buses search (only when both ends resolve to airports)
    if (fL && tL && fL.code !== tL.code) recordSearch({ kind: "ground", from: fL.code, to: tL.code, fromCity: fL.city, toCity: tL.city, date: g.date || "" });

    // honest fly-vs-train-vs-bus compare (needs real coords for both ends)
    const cmp = (fL && tL) ? TRE.compareModes(fL.code, tL.code) : null;
    const cEl = $("#gr-compare");
    if (cEl) {
      if (cmp) {
        const recLabel = {
          train_bus: "🚆 Take a train or bus — flying isn't worth it on this short a hop",
          compare: "🤔 It's a close call — compare all three (an overnight train or bus can save a hotel night)",
          fly_or_overnight_train: "✈️ Flying is usually the practical pick — but an overnight train is the cheap option",
          fly: "✈️ Fly — it's the only sensible option over this distance",
        };
        const modeCard = (m) => `<div class="gr-mode">
          <div class="gr-mode-h">${m.icon} <b>${m.mode === "flight" ? "Flight" : m.mode === "train" ? "Train" : "Bus"}</b></div>
          <div class="gr-mode-time">${esc(m.timeLabel)}</div>
          ${m.d2dLabel ? `<div class="card-sub gr-mode-d2d">${esc(m.d2dLabel)}</div>` : ""}
          <div class="card-sub">${esc(m.note)}</div>
          <div class="card-sub gr-mode-cost">cost: ${esc(m.costLean)}</div>
        </div>`;
        cEl.innerHTML = `<div class="gr-rec"><div class="gr-rec-dist">📏 ${cmp.km.toLocaleString("en-IN")} km between <b>${esc(fL.city)}</b> and <b>${esc(tL.city)}</b> <span class="card-sub">(straight-line)</span></div>
          <div class="gr-rec-band">${recLabel[cmp.recommend] || ""}</div></div>
          <div class="gr-modes">${cmp.modes.map(modeCard).join("")}</div>`;
      } else {
        cEl.innerHTML = `<div class="card-sub" style="margin:8px 0;">I don't have map coordinates for one of these cities, so I can't compare distances — but the live train and bus searches below still work.</div>`;
      }
    }

    // best pick for what the traveller cares about (cheapest / fastest / comfiest)
    const pickEl = $("#gr-pick");
    if (pickEl) {
      const rank = (fL && tL) ? TRE.rankModes(fL.code, tL.code, g.priority) : null;
      if (rank) {
        const modeName = (m) => m === "flight" ? "✈️ Flight" : m === "train" ? "🚆 Train" : "🚌 Bus";
        const priLabel = { fast: "Fastest door-to-door", cheap: "Cheapest", comfort: "Most comfortable" };
        const rows = rank.ranked.map((x, i) => `<div class="gr-pick-row ${i === 0 ? "top" : ""}">
          <span class="gr-pick-rank">${i + 1}</span>
          <span class="gr-pick-mode">${modeName(x.mode)}</span>
          <span class="gr-pick-why card-sub">${esc(x.why)}</span></div>`).join("");
        pickEl.innerHTML = `<div class="gr-pick-box"><div class="gr-pick-head">🎯 For "${esc(priLabel[g.priority] || g.priority)}", my honest order:</div>${rows}
          <div class="card-sub gr-pick-note">Cost and comfort are general India rules of thumb (overnight trains let you sleep flat; buses are usually cheapest; flights are quick but lose hours at the airport). Real fares live on the booking sites below — open them to confirm.</div></div>`;
      } else {
        pickEl.innerHTML = "";
      }
    }

    // honest non-stop vs connecting + alternate-route guidance (no fake schedules)
    const stopsEl = $("#gr-stops");
    if (stopsEl) {
      const sg = (fL && tL) ? TRE.stopsGuidance(TRE.compareModes(fL.code, tL.code) ? GEO.distanceKm(fL.code, tL.code) : null) : null;
      if (sg) {
        stopsEl.innerHTML = `<div class="gr-stops-box"><div class="gr-stops-head">🧭 Non-stop, connections &amp; smarter routes</div>
          <div class="gr-stops-row">✈️ <b>Flights:</b> <span class="card-sub">${esc(sg.flight)}</span></div>
          <div class="gr-stops-row">🚆 <b>Trains:</b> <span class="card-sub">${esc(sg.train)}</span></div>
          <div class="gr-stops-row">🚌 <b>Buses:</b> <span class="card-sub">${esc(sg.bus)}</span></div></div>`;
      } else {
        stopsEl.innerHTML = "";
      }
    }

    // outbound links
    const outSet = groundLinkSet(fromName, toName, g.date);
    let trainsHtml = outSet.trains, busesHtml = outSet.buses;

    // round trip: add the return-direction link sets too (Indian trains/buses
    // are booked one leg at a time, so two honest search sets is the real flow)
    if (round) {
      const retSet = groundLinkSet(toName, fromName, g.returnDate);
      trainsHtml = `<div class="gr-leg-tag">↗ Outbound${g.date ? " · " + esc(g.date) : ""}</div>` + outSet.trains
        + `<div class="gr-leg-tag">↙ Return${g.returnDate ? " · " + esc(g.returnDate) : ""}</div>` + retSet.trains;
      busesHtml = `<div class="gr-leg-tag">↗ Outbound${g.date ? " · " + esc(g.date) : ""}</div>` + outSet.buses
        + `<div class="gr-leg-tag">↙ Return${g.returnDate ? " · " + esc(g.returnDate) : ""}</div>` + retSet.buses;
    }
    $("#gr-trains").innerHTML = trainsHtml;
    $("#gr-buses").innerHTML = busesHtml;

    // smarter routes via a hub (Rome2Rio-style mixed route) — only when both ends
    // are on the map AND a sensible on-the-way hub exists. Honest: we hand the
    // live search for each leg, we never claim a specific connection exists.
    const viaEl = $("#gr-via");
    if (viaEl) {
      const r = (fL && tL && ROUTE) ? ROUTE.getAnywhere(fL.code, tL.code, { priority: g.priority, maxHubs: 3 }) : null;
      if (r && r.ok && r.via.length && r.suggestVia) {
        const modeName = (m) => m === "flight" ? "✈️ fly" : m === "train" ? "🚆 train" : m === "bus" ? "🚌 bus" : "compare";
        const legLink = (leg, mode) => {
          const fromCity = (flAirportLabel(leg.from) || {}).city || leg.from;
          const toCity = (flAirportLabel(leg.to) || {}).city || leg.to;
          if (mode === "train") { const p = (TR.trains || []).find((x) => x.id === "ixigo-trains"); return p ? TRE.buildLink(p, fromCity, toCity, g.date) : "#"; }
          if (mode === "bus") { const p = (TR.buses || []).find((x) => x.id === "redbus"); return p ? TRE.buildLink(p, fromCity, toCity, g.date) : "#"; }
          const fp = (FLIGHTS.providers || []).find((x) => x.id === "google-flights"); return fp ? FE.buildLink(fp, leg.from, leg.to, g.date) : "#";
        };
        const cards = r.via.map((v) => {
          const hubCity = (flAirportLabel(v.hub) || {}).city || v.hub;
          const leg1mode = v.leg1.suggest === "compare" ? "flight" : v.leg1.suggest;
          const leg2mode = v.leg2.suggest === "compare" ? "flight" : v.leg2.suggest;
          return `<div class="via-card">
            <div class="via-head">via <b>${esc(hubCity)}</b> <span class="card-sub">${v.totalKm.toLocaleString("en-IN")} km${v.extraPct > 0 ? " · +" + v.extraPct + "% vs direct" : ""}</span></div>
            <div class="via-legs">
              <a class="via-leg" href="${legLink(v.leg1, leg1mode)}" target="_blank" rel="noopener">${esc((flAirportLabel(v.leg1.from)||{}).city || v.leg1.from)} <span class="fl-arrow">→</span> ${esc(hubCity)} <span class="card-sub">${modeName(v.leg1.suggest)} · ${v.leg1.km.toLocaleString("en-IN")} km</span></a>
              <a class="via-leg" href="${legLink(v.leg2, leg2mode)}" target="_blank" rel="noopener">${esc(hubCity)} <span class="fl-arrow">→</span> ${esc((flAirportLabel(v.leg2.to)||{}).city || v.leg2.to)} <span class="card-sub">${modeName(v.leg2.suggest)} · ${v.leg2.km.toLocaleString("en-IN")} km</span></a>
            </div>
          </div>`;
        }).join("");
        viaEl.innerHTML = `<div class="section-h">🧭 Smarter routes via a hub</div>
          <div class="card-sub" style="margin-bottom:8px;">Sometimes a short train or bus to a big hub, then a cheap flight onward, beats a pricey direct. These hubs are roughly on the way. Each leg opens its own live search — I don't claim a specific connection exists, so check the times line up before you book.</div>
          <div class="via-list">${cards}</div>`;
      } else {
        viaEl.innerHTML = "";
      }
    }
  }

  // ========================= MULTI-CITY ===================================
  function mcStops() {
    if (!Array.isArray(state.multicity) || state.multicity.length < 2) state.multicity = ["", "", ""];
    return state.multicity;
  }
  function renderMcInputs() {
    const wrap = $("#mc-stops");
    if (!wrap) return;
    const stops = mcStops();
    wrap.innerHTML = stops.map((v, i) => `
      <div class="mc-stop-row">
        <span class="mc-pin">${i === 0 ? "🟢" : i === stops.length - 1 ? "🔴" : "🟠"}</span>
        <input class="fb-input mc-stop" data-mc="${i}" list="fl-airport-list" autocomplete="off"
          placeholder="${i === 0 ? "Start city" : i === stops.length - 1 ? "Final city" : "Stop " + i}" value="${esc(v || "")}" aria-label="Stop ${i + 1}" />
        ${stops.length > 2 ? `<button class="act ghost mini" data-mcdel="${i}" aria-label="Remove stop">✕</button>` : ""}
      </div>`).join("");
    $$("[data-mc]").forEach((inp) => inp.oninput = () => { mcStops()[Number(inp.dataset.mc)] = inp.value; save(); });
    $$("[data-mcdel]").forEach((b) => b.onclick = () => { if (mcStops().length > 2) { mcStops().splice(Number(b.dataset.mcdel), 1); save(); renderMcInputs(); } });
  }
  function wireMulticity() {
    renderMcInputs();
    if ($("#mc-add")) $("#mc-add").onclick = () => { mcStops().push(""); save(); renderMcInputs(); };
    if ($("#mc-clear")) $("#mc-clear").onclick = () => { state.multicity = ["", "", ""]; save(); renderMcInputs(); $("#mc-summary").innerHTML = ""; $("#mc-legs").innerHTML = ""; };
    if ($("#mc-go")) $("#mc-go").onclick = () => { renderMulticity(); const r = $("#mc-summary"); if (r) r.scrollIntoView({ behavior: "smooth", block: "start" }); };
  }
  function renderMulticity() {
    if (!$("#mc-legs") || !MC || !TRE) return;
    const honesty = $("#mc-honesty");
    if (honesty) honesty.innerHTML = `<b>How this works:</b> distances are real straight-line distances; the best-mode call and the times are honest estimates from those distances, not live timetables. Each leg's links open the real live search on the booking sites where the actual fares and times live. I never invent a fare or a trip total.`;

    // resolve typed cities to {city, code} via the airport list (partial match ok)
    const resolved = mcStops().map((v) => {
      const lbl = flAirportLabel(v);
      return lbl ? { city: lbl.city, code: lbl.code, raw: v } : (v && v.trim() ? { city: v.trim(), code: null, raw: v } : null);
    });
    // collapse consecutive duplicate stops (Delhi -> Delhi -> Mumbai is really
    // Delhi -> Mumbai); a zero-km leg to the same city is meaningless.
    const valid = resolved.filter((s) => s && s.code).filter((s, i, arr) => i === 0 || s.code !== arr[i - 1].code);
    if (valid.length < 2) {
      $("#mc-summary").innerHTML = "";
      $("#mc-legs").innerHTML = `<div class="empty">Add at least two cities I can place on the map (use the airport suggestions). I'll work out each leg.</div>`;
      // flag any city we couldn't place
      const unknown = resolved.filter((s) => s && !s.code);
      if (unknown.length) $("#mc-legs").innerHTML += `<div class="card-sub" style="margin-top:8px;">I couldn't find map coordinates for: ${unknown.map((u) => esc(u.city)).join(", ")}. Try the airport-list suggestion (e.g. a major city or 3-letter code).</div>`;
      return;
    }
    const trip = MC.analyzeTrip(valid);

    // summary: total distance + "whole way by X" time estimates
    const sumEl = $("#mc-summary");
    if (sumEl) {
      const fmt = (mins) => TRE.fmtDur(mins);
      const cityChain = valid.map((s) => esc(s.city)).join(" <span class='fl-arrow'>→</span> ");
      const wholeWay = (label, icon, mode) => trip.modeKnown[mode]
        ? `<div class="mc-mode"><div class="mc-mode-h">${icon} ${label} the whole way</div><div class="mc-mode-time">~${fmt(trip.modeTime[mode])}</div><div class="card-sub">door-to-door estimate, all ${trip.legCount} legs</div></div>`
        : "";
      sumEl.innerHTML = `<div class="mc-sum">
        <div class="mc-sum-chain">${cityChain}</div>
        <div class="mc-sum-dist">📏 ${trip.totalKm != null ? trip.totalKm.toLocaleString("en-IN") + " km total" : "distance unknown for some legs"} · ${trip.legCount} leg${trip.legCount > 1 ? "s" : ""}</div>
        <div class="mc-modes">${wholeWay("Fly", "✈️", "flight")}${wholeWay("Train", "🚆", "train")}${wholeWay("Bus", "🚌", "bus")}</div>
      </div>`;
    }

    // per-leg cards: best mode + the live search links for fly/train/bus
    const date = (state.plan && state.plan.depart) || "";
    const legsHtml = trip.legs.map((l, idx) => {
      const fromL = l.from, toL = l.to;
      const km = l.km;
      const recLabel = { flight: "✈️ Fly this leg", train: "🚆 Train this leg", bus: "🚌 Bus this leg", compare: "🤔 Close call — compare", null: "" };
      const flyProv = (FLIGHTS.providers || []).find((p) => p.id === "google-flights");
      const flyLink = flyProv ? FE.buildLink(flyProv, fromL.code, toL.code, date) : null;
      const trainP = (TR.trains || []).find((p) => p.id === "ixigo-trains");
      const busP = (TR.buses || []).find((p) => p.id === "redbus");
      const trainLink = trainP ? TRE.buildLink(trainP, fromL.city, toL.city, date) : null;
      const busLink = busP ? TRE.buildLink(busP, fromL.city, toL.city, date) : null;
      const timeFor = (mode) => { const m = l.compare && l.compare.modes.find((x) => x.mode === mode); return m ? m.timeLabel : ""; };
      return `<div class="mc-leg">
        <div class="mc-leg-head">
          <div class="mc-leg-route"><span class="card-sub">Leg ${idx + 1}</span> <b>${esc(fromL.city)}</b> <span class="fl-arrow">→</span> <b>${esc(toL.city)}</b></div>
          <div class="mc-leg-dist">${km != null ? km.toLocaleString("en-IN") + " km" : "—"} ${l.bestMode ? `<span class="chip ${l.bestMode === "flight" ? "" : "rail"}">${esc(recLabel[l.bestMode] || "")}</span>` : ""}</div>
        </div>
        <div class="mc-leg-links">
          ${flyLink ? `<a class="mc-leg-link" href="${flyLink}" target="_blank" rel="noopener">✈️ Flights <span class="card-sub">${esc(timeFor("flight"))}</span></a>` : ""}
          ${trainLink ? `<a class="mc-leg-link" href="${trainLink}" target="_blank" rel="noopener">🚆 Trains <span class="card-sub">${esc(timeFor("train"))}</span></a>` : ""}
          ${busLink ? `<a class="mc-leg-link" href="${busLink}" target="_blank" rel="noopener">🚌 Buses <span class="card-sub">${esc(timeFor("bus"))}</span></a>` : ""}
        </div>
      </div>`;
    }).join("");
    $("#mc-legs").innerHTML = legsHtml;
    // remember this multi-city search
    recordSearch({ kind: "multicity", stops: valid.map((s) => s.code), fromCity: valid[0].city, toCity: valid[valid.length - 1].city });
  }

  // ================== RECENT + SAVED SEARCHES ============================
  // remembers the routes you look up (flights / trains+buses / multi-city) so you
  // can jump back in one tap. Stores ONLY what you searched, never prices.
  function searches() { if (!Array.isArray(state.searches)) state.searches = []; return state.searches; }
  function recordSearch(entry) {
    if (!HIST) return;
    state.searches = HIST.record(searches(), entry, Date.now(), 12);
    save();
    renderRecentSearches();
  }
  // record a flight search only when both ends resolve to real airports
  function recordFlightSearch() {
    const f = state.flight || {};
    const from = flAirportLabel(f.from), to = flAirportLabel(f.to);
    if (from && to && from.code !== to.code) recordSearch({ kind: "flight", from: from.code, to: to.code, fromCity: from.city, toCity: to.city, date: f.date || "" });
  }
  function renderRecentSearches() {
    const el = $("#recent-searches");
    if (!el || !HIST) return;
    const list = HIST.ordered(searches());
    if (!list.length) { el.innerHTML = ""; return; }
    const kindMeta = { flight: { icon: "✈️", tab: "flights" }, ground: { icon: "🚆", tab: "ground" }, multicity: { icon: "🗺️", tab: "multicity" } };
    const rows = list.map((s) => {
      const m = kindMeta[s.kind] || { icon: "🔎", tab: "plan" };
      const dateBit = s.date ? ` <span class="card-sub">${esc(s.date)}</span>` : "";
      return `<div class="rs-row ${s.pinned ? "pinned" : ""}" data-rsid="${esc(s.id)}">
        <button class="rs-open" data-rsopen="${esc(s.id)}">${m.icon} <b>${esc(s.label)}</b>${dateBit}</button>
        <div class="rs-actions">
          <button class="rs-pin" data-rspin="${esc(s.id)}" title="${s.pinned ? "Unpin" : "Pin to top"}" aria-label="Pin">${s.pinned ? "★" : "☆"}</button>
          <button class="rs-del" data-rsdel="${esc(s.id)}" title="Remove" aria-label="Remove">✕</button>
        </div>
      </div>`;
    }).join("");
    el.innerHTML = `<div class="section-h">🕘 Recent &amp; saved searches</div>
      <div class="rs-list">${rows}</div>`;
    $$("[data-rsopen]").forEach((b) => b.onclick = () => reopenSearch(b.dataset.rsopen));
    $$("[data-rspin]").forEach((b) => b.onclick = () => { state.searches = HIST.togglePin(searches(), b.dataset.rspin); save(); renderRecentSearches(); });
    $$("[data-rsdel]").forEach((b) => b.onclick = () => { state.searches = HIST.remove(searches(), b.dataset.rsdel); save(); renderRecentSearches(); });
  }
  // re-open a saved search: refill its inputs + jump to its tab + run it.
  function reopenSearch(id) {
    const s = searches().find((x) => x.id === id);
    if (!s) return;
    if (s.kind === "flight") {
      state.flight = { from: s.from, to: s.to, date: s.date || "" };
      save(); wireFlights();
      if ($("#fl-from")) $("#fl-from").value = s.fromCity || s.from || "";
      if ($("#fl-to")) $("#fl-to").value = s.toCity || s.to || "";
      if ($("#fl-date")) $("#fl-date").value = s.date || "";
      showView("flights", true);
      renderFlights();
    } else if (s.kind === "ground") {
      state.ground = Object.assign(groundState(), { from: s.fromCity || s.from || "", to: s.toCity || s.to || "", date: s.date || "" });
      save(); wireGround();
      showView("ground", true);
      renderGround();
    } else if (s.kind === "multicity") {
      state.multicity = (s.stops || []).slice();
      save(); renderMcInputs();
      showView("multicity", true);
      renderMulticity();
    }
  }

  // ===================== EXPLORE ("Where to?") ===========================
  function exploreState() {
    if (!state.explore) state.explore = { from: "", priority: "balanced" };
    if (!state.explore.priority) state.explore.priority = "balanced";
    return state.explore;
  }

  // the destination universe: every airport we can measure a distance to, tagged
  // with intl from the shared INTL_CODES list. Real codes only, no invented places.
  function exploreDests() {
    const airports = (FLIGHTS && FLIGHTS.airports) || [];
    return airports
      .filter((a) => GEO && GEO.hasCoords(a.code))
      .map((a) => ({ code: a.code, city: a.city, intl: INTL_CODES.indexOf(a.code) !== -1 }));
  }

  // a closure that counts how many lounges the user's wallet actually opens in a
  // city (by code). Zero when no wallet — the engine then ranks on distance only.
  function loungeOpenCounter() {
    const byCode = {};
    return (code) => {
      if (!TE || !code) return 0;
      if (byCode[code] != null) return byCode[code];
      // find the city name for this code so loungesAtCity can match on city
      const ap = ((FLIGHTS && FLIGHTS.airports) || []).find((a) => a.code === code);
      const city = ap ? ap.city : code;
      const res = TE.loungesAtCity(city, state.wallet, CARDS, LOUNGES, state.visitLog, state.spend, NOW);
      byCode[code] = res ? res.openCount : 0;
      return byCode[code];
    };
  }

  function wireExplore() {
    if (!XP) return;
    const st = exploreState();
    const fromEl = $("#xp-from");
    if (fromEl) {
      fromEl.value = st.from || "";
      fromEl.oninput = () => { st.from = fromEl.value; save(); };
      fromEl.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); st.from = fromEl.value; save(); renderExplore(); } };
    }
    // priority chips
    const pr = $("#xp-priorities");
    if (pr) {
      pr.innerHTML = XP.PRIORITIES.map((p) =>
        `<button class="chip toggle xp-pri ${st.priority === p.id ? "on" : ""}" data-xp-pri="${p.id}" title="${esc(p.hint)}">${esc(p.label)}</button>`
      ).join("");
      $$("[data-xp-pri]").forEach((b) => b.onclick = () => {
        st.priority = b.dataset.xpPri; save();
        $$(".xp-pri").forEach((x) => x.classList.toggle("on", x.dataset.xpPri === st.priority));
        if (st.from && st.from.trim()) renderExplore();
      });
    }
    if ($("#xp-go")) $("#xp-go").onclick = () => { const fe = $("#xp-from"); if (fe) st.from = fe.value; save(); renderExplore(); };
  }

  function renderExplore() {
    const wrap = $("#xp-list"); if (!wrap || !XP) return;
    const st = exploreState();
    const honesty = $("#xp-honesty");
    const fromInput = (st.from || "").trim();
    if (!fromInput) {
      wrap.innerHTML = `<div class="empty">Type where you're starting from, pick what matters, and I'll find places worth the trip.</div>`;
      if (honesty) honesty.innerHTML = "";
      return;
    }
    const origin = TE ? TE.resolvePlace(fromInput, FLIGHTS) : null;
    if (!origin || !origin.code || !GEO || !GEO.hasCoords(origin.code)) {
      wrap.innerHTML = `<div class="empty">I don't have ${esc(fromInput)} on the map yet, so I can't measure distances from there. Try a major city (Delhi, Mumbai, Bengaluru, Hyderabad, Chennai, Kolkata...).</div>`;
      if (honesty) honesty.innerHTML = "";
      return;
    }

    const ranked = XP.rank(origin, exploreDests(), { distanceKm: GEO.distanceKm, loungeOpenCount: loungeOpenCounter() }, { priority: st.priority, limit: 9, measurableOnly: true });
    const prLabel = (XP.PRIORITIES.find((p) => p.id === st.priority) || {}).label || "Balanced";
    const flyProv = (FLIGHTS.providers || []).find((p) => p.id === "google-flights");

    const modeIcon = { train: "🚆", either: "🚆/✈️", fly: "✈️", unknown: "•" };
    const cards = ranked.map((d) => {
      const flyLink = flyProv && FE ? FE.buildLink(flyProv, origin.code, d.code, "") : null;
      const tag = d.international ? `<span class="chip">🌍 intl</span>` : "";
      const lounge = d.loungeOpen > 0 ? `<span class="chip ok">🛋️ ${d.loungeOpen} open</span>` : "";
      const kmLine = d.km != null ? `${d.km} km · ${modeIcon[d.mode] || "•"} ${esc(d.modeLabel)}` : "distance unknown";
      const open = flyLink ? `<a class="plan-link" href="${esc(flyLink)}" target="_blank" rel="noopener"><span>see flights</span><span class="pl-go">open ↗</span></a>` : "";
      return `<div class="xp-card">
        <div class="xp-head">
          <div class="xp-city"><b>${esc(d.city)}</b> <span class="card-sub">${esc(d.code)}</span></div>
          <div class="xp-tags">${lounge}${tag}</div>
        </div>
        <div class="card-sub xp-km">${kmLine}</div>
        <div class="xp-why">${esc(d.why)}</div>
        <div class="xp-actions">
          ${open}
          <button class="act ghost mini" data-xp-plan="${esc(d.city)}">Plan this trip →</button>
        </div>
      </div>`;
    }).join("");

    wrap.innerHTML = `<div class="section-h">From ${esc(origin.city)} · ${esc(prLabel)} <span class="card-sub" style="font-weight:400;">${ranked.length} places</span></div>
      <div class="xp-grid">${cards}</div>`;

    // "Plan this trip" prefills the Plan view with this origin -> dest and jumps there
    $$("[data-xp-plan]").forEach((b) => b.onclick = () => {
      const p = planState();
      p.from = origin.city; p.to = b.dataset.xpPlan;
      save();
      showView("plan", true);
      if ($("#tp-from")) $("#tp-from").value = origin.city;
      if ($("#tp-to")) $("#tp-to").value = b.dataset.xpPlan;
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    if (honesty) honesty.innerHTML = `Ranked on facts I can prove — real distance, your real wallet's lounge access, and a distance-based fly/train hint. The score is a transparent blend of those, not a magic number. I never invent a price; tap a place to open the live flight search and see the real fare.`;
  }

  // ===================== LONG WEEKENDS ===================================
  function lwState() {
    if (!state.lw) state.lw = { year: 0, custom: [] };
    if (!state.lw.year) state.lw.year = NOW.getFullYear();
    if (!Array.isArray(state.lw.custom)) state.lw.custom = [];
    return state.lw;
  }
  function wireLongWeekend() {
    if (!HOL || !HOLIDAYS) return;
    const lw = lwState();
    const sel = $("#lw-year");
    if (sel) {
      const base = NOW.getFullYear();
      const years = [base, base + 1, base + 2];
      if (lw.year < base) lw.year = base; // never default to a past year
      sel.innerHTML = years.map((y) => `<option value="${y}">${y}</option>`).join("");
      sel.value = String(lw.year);
      sel.onchange = () => { lwState().year = +sel.value; save(); renderLongWeekend(); };
    }
    const addBtn = $("#lw-cust-add");
    if (addBtn) addBtn.onclick = () => {
      const name = ($("#lw-cust-name") && $("#lw-cust-name").value || "").trim();
      const date = ($("#lw-cust-date") && $("#lw-cust-date").value) || "";
      if (!date) { toast("Pick the festival's date from your holiday list."); return; }
      lwState().custom.push({ date, name: name || "Custom holiday" });
      save();
      if ($("#lw-cust-name")) $("#lw-cust-name").value = "";
      if ($("#lw-cust-date")) $("#lw-cust-date").value = "";
      // jump the year selector to the added date's year so it shows up
      lwState().year = +date.slice(0, 4);
      if (sel) sel.value = String(lwState().year);
      renderLongWeekend();
    };
  }
  function renderLongWeekend() {
    const el = $("#lw-list");
    if (!el || !HOL || !HOLIDAYS) return;
    const lw = lwState();
    const honesty = $("#lw-honesty");
    if (honesty) honesty.innerHTML = `<b>How this works:</b> the weekday of every date is exact math, so the long-weekend maths is solid. I only ship fixed-date national holidays (Republic Day, Independence Day, Gandhi Jayanti, Christmas, New Year) because their date never moves. Movable festivals you add yourself — I won't guess a date that changes by year or state.`;

    const items = HOL.planYear(HOLIDAYS.fixed, lw.custom, lw.year);
    if (!items.length) { el.innerHTML = `<div class="empty">No holidays for ${lw.year} yet. Add your festival dates above.</div>`; return; }

    const fmtRange = (s, e) => {
      const f = (d) => d.slice(8) + "/" + d.slice(5, 7);
      return s === e ? f(s) : f(s) + "–" + f(e);
    };
    const dshort = (d) => HOL.DOW_SHORT[HOL.dow(d)];
    const verdictChip = {
      free_long_weekend: `<span class="chip good">free long weekend</span>`,
      one_bridge: `<span class="chip good">1 day off = 4-day break</span>`,
      bridge: `<span class="chip">bridge it</span>`,
      on_weekend: `<span class="chip warn">falls on a weekend</span>`,
      midweek: `<span class="chip">midweek</span>`,
    };
    const rows = items.map((it) => {
      const a = it.assess;
      const custTag = it.source === "custom" ? ` <span class="chip rail">yours</span> <button class="lw-del" data-lwdel="${esc(it.date)}" aria-label="Remove">✕</button>` : "";
      let plan = "";
      if (a.fallsOnWeekend) {
        plan = `<div class="card-sub">It's on a ${a.dowName} this year, so no extra day off — but still a fine weekend to travel.</div>`;
      } else if (a.verdict === "free_long_weekend") {
        plan = `<div class="lw-plan good">🎉 You already get a <b>${a.zeroLeave.days}-day break</b> (${fmtRange(a.zeroLeave.start, a.zeroLeave.end)}) with <b>zero leave</b>.</div>`;
      } else if (a.best) {
        const b = a.best;
        const leaveStr = b.leaveDays.map((d) => dshort(d) + " " + d.slice(8) + "/" + d.slice(5, 7)).join(" + ");
        plan = `<div class="lw-plan">Take <b>${b.leaveCount} day off</b> (${esc(leaveStr)}) → a <b>${b.days}-day break</b> (${fmtRange(b.start, b.end)}).</div>`;
      }
      // plan-a-trip CTA: pre-fills the Plan view depart date with the block start
      const planStart = (a.best && a.best.start) || (a.zeroLeave && a.zeroLeave.start) || it.date;
      const planDays = (a.best && a.best.days) || (a.zeroLeave && a.zeroLeave.days) || 2;
      return `<div class="lw-card">
        <div class="lw-head">
          <div class="lw-name"><b>${esc(a.name)}</b> <span class="card-sub">${esc(a.dowName)}, ${fmtRange(it.date, it.date)}</span>${custTag}</div>
          ${verdictChip[a.verdict] || ""}
        </div>
        ${plan}
        <button class="act ghost mini lw-plan-btn" data-lwplan="${esc(planStart)}" data-lwnights="${Math.max(1, planDays - 1)}">🧭 Plan a trip on these dates</button>
      </div>`;
    }).join("");
    el.innerHTML = `<div class="section-h">🏖️ ${lw.year} holidays &amp; the breaks they unlock</div><div class="lw-grid">${rows}</div>`;
    $$("[data-lwdel]").forEach((b) => b.onclick = () => { lwState().custom = lwState().custom.filter((c) => c.date !== b.dataset.lwdel); save(); renderLongWeekend(); });
    $$("[data-lwplan]").forEach((b) => b.onclick = () => {
      state.plan = Object.assign(planState(), { depart: b.dataset.lwplan, nights: +b.dataset.lwnights || 2 });
      save(); wirePlan();
      showView("plan", true);
      toast("Trip dates set to your long weekend. Add where you're going.");
      const fromEl = $("#tp-from"); if (fromEl) fromEl.focus();
    });
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
    const isIntl = INTL_CODES.indexOf(code) !== -1;
    LD.getWeather(coords[0], coords[1], 14).then((wx) => {
      const s = wx.parsed && wx.parsed.suggest; if (!s) return;
      t.packFlags = t.packFlags || {};
      let changed = false;
      const setFlag = (k, v) => { if (v && !t.packFlags[k]) { t.packFlags[k] = true; changed = true; } };
      setFlag("cold", s.cold); setFlag("monsoon", s.monsoon);
      if (isIntl && !t.packFlags.intl) { t.packFlags.intl = true; changed = true; }
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
      <div class="itin-title"><b>${esc(t.title)}</b>
        <button class="itin-dates-btn" id="itin-dates-btn" aria-expanded="false" aria-controls="itin-dates-edit">${esc(s.dateRange)} · ${s.adults} traveller${s.adults > 1 ? "s" : ""} <span class="idb-edit">✏️ edit dates</span></button>
      </div>
      <div class="itin-tools">
        <button class="act mini" id="itin-autoplan">✨ Plan my days</button>
        <button class="act mini" id="itin-share">📤 Share plan</button>
        <button class="act ghost mini" id="itin-calendar">📅 Add to calendar</button>
        <button class="act ghost mini" id="itin-jump-budget">💰 Budget</button>
        <button class="act ghost mini" id="itin-jump-pack">🎒 Packing</button>
        <button class="act ghost mini" id="itin-export">💾 Backup file</button>
      </div>
      <div class="itin-dates-edit" id="itin-dates-edit" hidden>
        <label class="tp-lbl">Start <input class="fb-input" id="ed-depart" type="date" value="${esc(t.depart || "")}" aria-label="Trip start date" /></label>
        <label class="tp-lbl">Nights <input class="fb-input tp-num" id="ed-nights" type="number" min="1" max="60" value="${t.nights || 1}" aria-label="Nights" /></label>
        <button class="act mini" id="ed-apply">Update dates</button>
        <span class="card-sub ed-note">Changing this re-dates every day. Nothing you planned is lost — if you shorten the trip, those plans move to the last day.</span>
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
    const packDone = pk.filter((p) => t.packing && t.packing.checked && t.packing.checked[IT.packKey(p)]).length;
    const packSummary = `🎒 Packing checklist <span class="tool-tag">${packDone}/${pk.length} packed</span>`;
    const packBody = `<div class="pack-flags">
        ${[["intl", "✈️ International"], ["cold", "🧥 Cold"], ["beach", "🏖️ Beach"], ["business", "💼 Business"], ["monsoon", "🌧️ Monsoon"]].map(([k, l]) =>
          `<label class="chip toggle"><input type="checkbox" class="pack-flag" data-flag="${k}" ${flags[k] ? "checked" : ""} /> ${l}</label>`).join("")}
      </div>
      ${Object.keys(byCat).map((cat) => `<div class="pack-cat"><div class="pack-cat-h">${esc(cat)}</div>${
        byCat[cat].map((p) => { const key = IT.packKey(p); const on = t.packing && t.packing.checked && t.packing.checked[key];
          return `<label class="pack-item ${on ? "done" : ""}"><input type="checkbox" class="pack-chk" data-key="${esc(key)}" ${on ? "checked" : ""} /> ${esc(p.item)}</label>`; }).join("")
      }</div>`).join("")}
      <p class="card-sub" style="margin-top:8px;">Tick the trip flags above to tailor the list. Checks save to this trip.</p>`;
    const packing = toolSection("itin-pack", packSummary, packBody, false);

    // The day-by-day plan is what a newbie wants to see first. The power tools
    // (readiness, budget, group split, packing) are wrapped in collapsible
    // <details> so they're present + one tap away, but not 5 screens of walls
    // you scroll past before your itinerary. A short summary stays visible when
    // each is folded, so nothing important is hidden.
    return head + destSnapshot(t) + `<div class="itin-days">${days}</div>` +
      readinessBlock(t) + budgetBlock(t) + groupSplitBlock(t) + packing +
      `<div class="honesty-note" style="margin-top:14px;">Your itinerary, budget + links are saved on this device only. The links open the real booking sites. Every rupee in the budget is a number you typed — TripLens never guesses a price. Export to share the whole plan.</div>`;
  }
  // wrap a tool block in a collapsible section. `id` anchors the jump buttons;
  // `summaryHtml` is the always-visible header; `open` defaults the panel open.
  function toolSection(id, summaryHtml, bodyHtml, open) {
    return `<details class="tool-sec" id="${id}"${open ? " open" : ""}>
      <summary class="tool-sum">${summaryHtml}</summary>
      <div class="tool-body">${bodyHtml}</div>
    </details>`;
  }

  // a short, honest orientation at the top of an open trip: what the place is
  // known for + its vibe (common-knowledge character from data/destinations.js),
  // a slot for the LIVE forecast (filled async by fillDestWeather), and a one-tap
  // link to explore it on a real map. Invents nothing — no price, no venue.
  function destSnapshot(t) {
    const dest = TE ? TE.resolvePlace(t.to, FLIGHTS) : null;
    const code = dest && dest.code;
    const d = (DESTS && code) ? DESTS.get(code) : null;
    const city = (d && d.city) || t.to || "your destination";
    if (!d || (!d.knownFor && !d.vibe)) return ""; // only show when we have honest character to show
    const mapsUrl = "https://www.google.com/maps/search/" + encodeURIComponent("top things to do in " + city);
    // honest seasonal context: a month nudge if the chosen start hits a known
    // climate window, else a gentle "easier weather around X" line. Always paired
    // with a real "check the season" link. Asserts nothing for unknown places.
    let seasonHtml = "";
    if (SEASON && code) {
      const month = (t.depart && /^\d{4}-(\d{2})-\d{2}$/.test(t.depart)) ? +t.depart.slice(5, 7) : null;
      const a = month ? SEASON.assess(code, month, city) : null;
      const sum = SEASON.summary(code, city);
      if (a && a.caution) {
        seasonHtml = `<div class="ds-season caution">🗓️ Heads up: ${esc(a.caution.message)} <a class="fl-verify" href="${esc(a.verifyLink)}" target="_blank" rel="noopener">check the season ↗</a></div>`;
      } else if (sum && sum.line) {
        seasonHtml = `<div class="ds-season">🗓️ ${esc(city)} is ${esc(sum.line)}. <a class="fl-verify" href="${esc(sum.verifyLink)}" target="_blank" rel="noopener">check the season ↗</a></div>`;
      }
    }
    return `<div class="dest-snap">
      <div class="ds-main">
        <div class="ds-city">📍 ${esc(city)}${d.vibe ? ` <span class="ds-vibe">${esc(d.vibe)}</span>` : ""}</div>
        ${d.knownFor ? `<div class="ds-known">Known for ${esc(d.knownFor)}.</div>` : ""}
        ${seasonHtml}
        <div class="ds-weather" id="ds-weather"><span class="card-sub">⛅ checking the forecast for your dates…</span></div>
      </div>
      <a class="act ghost mini ds-map" href="${esc(mapsUrl)}" target="_blank" rel="noopener">🗺️ Explore on map ↗</a>
    </div>`;
  }
  // fill the live forecast into the snapshot. async + graceful: if there are no
  // coords or the fetch fails, the slot just clears. Real numbers only.
  function fillDestWeather(t) {
    const el = $("#ds-weather"); if (!el || !LD || !GEO) return;
    const dest = TE ? TE.resolvePlace(t.to, FLIGHTS) : null;
    const coords = dest && dest.code && GEO.AIRPORT_COORDS[dest.code];
    if (!coords) { el.innerHTML = ""; return; }
    LD.getWeather(coords[0], coords[1], 14).then((wx) => {
      const w = wx && wx.parsed; if (!w || w.avgMax == null) { el.innerHTML = ""; return; }
      const flags = [];
      if (w.suggest) { if (w.suggest.monsoon) flags.push("🌧️ rain likely"); if (w.suggest.cold) flags.push("🧥 pack warm"); if (w.suggest.hot) flags.push("☀️ hot"); }
      el.innerHTML = `<span class="ds-wx">⛅ next 2 weeks: <b>${w.lowMin != null ? Math.round(w.lowMin) + "–" : ""}${Math.round(w.avgMax)}°C</b>${w.peakRain != null ? ` · up to ${w.peakRain}% rain` : ""}${flags.length ? ` · ${flags.join(" · ")}` : ""}</span> <span class="card-sub">${wx.fromCache ? "cached" : "live"} forecast</span>`;
    }).catch(() => { el.innerHTML = ""; });
  }

  // pre-departure readiness block: countdown + tickable checklist (docs/money/packing).
  // honest by design — never claims you need a visa, just links you to check. intl
  // decided by the shared INTL_CODES list, not guessed.
  function readinessBlock(t) {
    if (!READY) return "";
    const dest = TE ? TE.resolvePlace(t.to, FLIGHTS) : null;
    const toCode = (dest && dest.code) || "";
    // map the trip's packing flags into weather flags the engine understands
    const pf = t.packFlags || {};
    const weather = (pf.monsoon || pf.cold) ? { monsoon: !!pf.monsoon, cold: !!pf.cold } : null;
    const c = READY.buildChecklist(
      { toCode: toCode, toCity: t.to, nights: t.nights },
      { intlCodes: INTL_CODES, hasCards: state.wallet.length > 0, weather: weather }
    );
    const checked = (t.readiness && t.readiness.checked) || {};
    const p = READY.progress(c.items, checked);

    // countdown (only if the trip has a depart date)
    let countdown = "";
    if (t.depart) {
      const n = READY.daysToGo(t.depart, todayISO());
      if (n != null) {
        const cls = n < 0 ? "rail" : n <= 2 ? "warn" : "";
        countdown = `<span class="chip ${cls}">🗓️ ${esc(READY.countdownLabel(n))}</span>`;
      }
    }

    // group items by their group label, render in a stable order
    const order = ["Documents", "Bookings", "Money", "Packing"];
    const byGroup = {};
    c.items.forEach((i) => { (byGroup[i.group] = byGroup[i.group] || []).push(i); });
    const groups = order.filter((g) => byGroup[g]).map((g) => {
      const rows = byGroup[g].map((i) => {
        const on = checked[i.id] || (i.auto && checked[i.id] !== false);
        const link = i.link ? ` <a class="fl-verify" href="${esc(i.link)}" target="_blank" rel="noopener">check ↗</a>` : "";
        const autoTag = i.auto ? ` <span class="chip auto">auto</span>` : "";
        return `<label class="rd-item ${on ? "done" : ""}">
          <input type="checkbox" class="rd-chk" data-rdkey="${esc(i.id)}" ${on ? "checked" : ""} />
          <span class="rd-body"><b>${esc(i.label)}</b>${autoTag}${link}<span class="card-sub">${esc(i.hint)}</span></span>
        </label>`;
      }).join("");
      return `<div class="rd-group"><div class="rd-group-h">${esc(g)}</div>${rows}</div>`;
    }).join("");

    const readyTag = p.ready
      ? `<span class="chip ok">✅ ready to go</span>`
      : `<span class="card-sub">${p.done}/${p.total} done</span>`;

    const summary = `🧳 Trip readiness ${countdown} <span class="tool-tag">${readyTag}</span>`;
    const body = `<div class="rd-bar"><div class="rd-bar-fill" style="width:${p.pct}%;"></div></div>
      <div class="rd-meta">${readyTag}${c.international ? ` <span class="chip">🌍 international</span>` : ""}</div>
      ${groups}
      <p class="card-sub" style="margin-top:8px;">This is a checklist, not a rule. On visas I only point you to the official source — your passport + destination decide it, not me. Checks save to this trip.</p>`;
    return toolSection("itin-ready", summary, body, false);
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

    // is group mode on? (a group with 2+ members)
    const groupOn = SPLIT && t.group && Array.isArray(t.group.members) && t.group.members.length > 1;
    const gms = groupOn ? t.group.members : [];
    const payerOpts = (sel) => `<option value="">paid by…</option>` + gms.map((m) => `<option value="${esc(m.id)}" ${sel === m.id ? "selected" : ""}>${esc(m.name)}</option>`).join("");

    // recent spends
    const spendsList = (b.spends || []).slice().reverse().map((sp) => {
      const cat = BUD.CATEGORIES.find((x) => x.id === sp.cat) || { icon: "•", label: sp.cat };
      const dayTxt = sp.day == null ? "unscheduled" : ("day " + (sp.day + 1));
      // group mode adds a "paid by" selector per spend so attribution is one tap
      const payerSel = groupOn
        ? `<select class="cmp-select bs-payer" data-payerfor="${esc(sp.id)}" aria-label="Who paid">${payerOpts(sp.paidBy)}</select>`
        : "";
      // and a "who shares this" chip row — empty selection means everyone (engine default).
      // an explicit subset lets one person's solo cost skip the others.
      let shareRow = "";
      if (groupOn) {
        const shared = Array.isArray(sp.sharedBy) && sp.sharedBy.length ? new Set(sp.sharedBy) : null;
        const allLabel = shared ? `${shared.size} of ${gms.length}` : "everyone";
        const chips = gms.map((m) => {
          const on = shared ? shared.has(m.id) : true;
          return `<button class="bs-share-chip ${on ? "on" : ""}" data-sharefor="${esc(sp.id)}" data-shareid="${esc(m.id)}" title="${esc(m.name)} ${on ? "splits" : "skips"} this">${esc(m.name.split(" ")[0])}</button>`;
        }).join("");
        shareRow = `<div class="bs-shares"><span class="card-sub">split between <b>${allLabel}</b>:</span> ${chips}</div>`;
      }
      return `<div class="bud-spend"><span>${cat.icon} ${esc(sp.label || cat.label)} <span class="card-sub">· ${dayTxt}</span></span>
        <span class="bs-amt">${payerSel}${BUD.fmt(sp.amount, b.currency)} <button class="ii-btn del" data-delspend="${esc(sp.id)}" title="Remove">✕</button></span></div>${shareRow}`;
    }).join("") || `<div class="card-sub" style="padding:6px 0;">No spends logged yet. Add what you actually pay as you go — those are your real numbers.</div>`;

    const dayOpts = `<option value="">unscheduled</option>` + t.days.map((d, i) => `<option value="${i}">Day ${i + 1}${d.date ? " · " + IT.dayLabel(d.date) : ""}</option>`).join("");
    const catSelOpts = BUD.CATEGORIES.map((c) => `<option value="${c.id}">${c.icon} ${c.label}</option>`).join("");

    const spentGlance = s.spent > 0 ? ` <span class="tool-tag">${BUD.fmt(s.spent, b.currency)} logged</span>` : "";
    const summary = `💰 Budget${spentGlance}`;
    const body = `<div class="bud-set">
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
    return toolSection("itin-budget", summary, body, false);
  }

  // group split block: travellers + who-owes-whom. Pure arithmetic on the spends
  // you logged — never fabricates an amount. Settlement nets to exactly zero.
  function groupSplitBlock(t) {
    if (!SPLIT || !BUD) return "";
    const b = BUD.ensure(t);
    const on = !!t.groupMode;
    const cur = b.currency;
    // the on/off toggle lives in the body now (a <summary> shouldn't hold an
    // interactive control — clicking it would also toggle the panel).
    const toggle = `<label class="chip toggle" style="font-weight:400;"><input type="checkbox" id="split-toggle" ${on ? "checked" : ""}/> group trip</label>`;
    if (!on) {
      const summary = `👥 Split with your group <span class="tool-tag">off</span>`;
      return toolSection("itin-split", summary, toggle + `<p class="card-sub" style="margin-top:8px;">Travelling with others? Turn this on to track who paid for what and see who owes whom at the end — split evenly to the paisa, no rounding lost. Every number is still one you typed.</p>`, false);
    }
    const ms = SPLIT.seedMembers(t, countAllItemsSeed());
    const o = SPLIT.overview(t);

    const memberRows = ms.map((m) => {
      const bal = o.balances.find((x) => x.id === m.id) || { net: 0 };
      const tag = SPLIT.paise(bal.net) > 0
        ? `<span class="chip ok">owed ${BUD.fmt(bal.net, cur)}</span>`
        : SPLIT.paise(bal.net) < 0
          ? `<span class="chip bad">owes ${BUD.fmt(Math.abs(bal.net), cur)}</span>`
          : `<span class="chip">settled</span>`;
      return `<div class="sp-member">
        <input class="leg-input sp-name" data-renamem="${esc(m.id)}" value="${esc(m.name)}" aria-label="Member name" />
        ${tag}
        ${ms.length > 1 ? `<button class="ii-btn del" data-delm="${esc(m.id)}" title="Remove traveller">✕</button>` : ""}
      </div>`;
    }).join("");

    const addMember = `<div class="sp-add">
      <input class="leg-input sp-newname" id="sp-newname" placeholder="add a traveller" aria-label="New traveller name" />
      <button class="act ghost mini" id="sp-addm">＋ Add</button>
    </div>`;

    let settleHtml;
    if (o.transfers.length === 0) {
      settleHtml = o.attributedCount === 0
        ? `<div class="card-sub">Once you tag who paid for each spend (the "paid by" dropdown on each one), I'll work out who owes whom.</div>`
        : `<div class="sp-settled">✅ All square — nobody owes anyone.</div>`;
    } else {
      settleHtml = `<div class="sp-settle-h">Simplest way to settle up</div>` + o.transfers.map((x) =>
        `<div class="sp-transfer"><b>${esc(x.fromName)}</b> pays <b>${esc(x.toName)}</b> <span class="sp-amt">${BUD.fmt(x.amount, cur)}</span></div>`
      ).join("") + `<button class="act ghost mini" id="sp-share" style="margin-top:8px;">📤 Share settle-up</button>`;
    }
    const unattr = o.unattributedCount > 0
      ? `<div class="card-sub" style="margin-top:8px;">${o.unattributedCount} spend${o.unattributedCount > 1 ? "s" : ""} (${BUD.fmt(o.unattributedTotal, cur)}) ${o.unattributedCount > 1 ? "have" : "has"} no "paid by" set yet, so ${o.unattributedCount > 1 ? "they're" : "it's"} not in the settlement. Tag the payer above to include ${o.unattributedCount > 1 ? "them" : "it"}.</div>`
      : "";

    const summary = `👥 Split with your group <span class="tool-tag">${ms.length} traveller${ms.length > 1 ? "s" : ""}</span>`;
    const body = toggle +
      `<div class="sp-members" style="margin-top:8px;">${memberRows}${addMember}</div>` +
      `<div class="sp-settle">${settleHtml}${unattr}</div>` +
      `<p class="card-sub" style="margin-top:8px;">Each spend splits evenly across everyone by default; set a "paid by" on each spend above in the budget list. Shares are computed to the paisa so they add back to the exact total — I never invent or lose a rupee.</p>`;
    return toolSection("itin-split", summary, body, on);
  }

  function wireItinerary(t) {
    fillDestWeather(t); // load the live forecast into the destination snapshot
    // ✏️ Edit dates: toggle the inline editor, then reschedule (non-destructive)
    if ($("#itin-dates-btn")) $("#itin-dates-btn").onclick = () => {
      const box = $("#itin-dates-edit"); if (!box) return;
      const open = box.hidden; box.hidden = !open;
      $("#itin-dates-btn").setAttribute("aria-expanded", open ? "true" : "false");
      if (open) { const di = $("#ed-depart"); if (di) di.focus(); }
    };
    if ($("#ed-apply")) $("#ed-apply").onclick = () => {
      const depart = ($("#ed-depart") && $("#ed-depart").value) || t.depart || "";
      const nights = ($("#ed-nights") && +$("#ed-nights").value) || t.nights || 1;
      const daysBefore = t.days.length;
      IT.reschedule(t, depart, nights);
      const shrank = t.days.length < daysBefore; // fewer days -> plans were folded onto the last day
      save(); autoWeatherFlags(t); renderTrips();
      toast(shrank ? "Dates updated. Nothing lost — plans from the dropped days moved onto your last day." : "Dates updated across all your days.");
    };
    if ($("#itin-back")) $("#itin-back").onclick = () => { state.openTripId = null; save(); renderTrips(); };
    // the jump buttons now open the (collapsed) tool section before scrolling
    // so you land on it expanded, not on a folded header.
    const jumpTo = (sel) => { const p = $(sel); if (!p) return; if (p.tagName === "DETAILS") p.open = true; p.scrollIntoView({ behavior: "smooth" }); };
    if ($("#itin-jump-pack")) $("#itin-jump-pack").onclick = () => jumpTo("#itin-pack");
    if ($("#itin-jump-budget")) $("#itin-jump-budget").onclick = () => jumpTo("#itin-budget");
    // 📤 Share plan: open the phone's normal share sheet with a clean readable
    // plan (real links included), or copy it on desktop. Pure text, the user's
    // own data — nothing fabricated.
    if ($("#itin-share")) $("#itin-share").onclick = async () => {
      const text = IT.shareText(t);
      try {
        if (navigator.share) { await navigator.share({ title: (t.title || "My trip") + " plan", text }); return; }
      } catch (e) { /* user cancelled the share sheet — fall through to copy */ }
      try { await navigator.clipboard.writeText(text); toast("Plan copied — paste it anywhere to share."); }
      catch (e2) { toast("Couldn't copy automatically. Use Backup file instead, or long-press to select."); }
    };
    // 💾 Backup file: download the trip as a JSON file you can re-import later
    // or send to someone who also uses TripLens.
    if ($("#itin-export")) $("#itin-export").onclick = () => {
      const blob = new Blob([IT.exportTrip(t)], { type: "application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = "triplens-" + (t.title || "trip").replace(/[^a-z0-9]+/gi, "-").toLowerCase() + ".json";
      a.click(); URL.revokeObjectURL(a.href);
      toast("Backup file saved. Import it on another device, or keep it as a copy.");
    };
    // add the whole itinerary to your phone/desktop calendar as a standard .ics
    if ($("#itin-calendar")) $("#itin-calendar").onclick = () => {
      // DTSTAMP is generated here (DOM layer may use the clock); engine stays pure
      const d = new Date();
      const p2 = (n) => (n < 10 ? "0" + n : "" + n);
      const stamp = d.getUTCFullYear() + p2(d.getUTCMonth() + 1) + p2(d.getUTCDate()) + "T" +
        p2(d.getUTCHours()) + p2(d.getUTCMinutes()) + p2(d.getUTCSeconds()) + "Z";
      const ics = IT.toICS(t, stamp);
      if (!ics) { toast("Add a few plans with dates first, then I can build the calendar."); return; }
      const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = "triplens-" + (t.title || "trip").replace(/[^a-z0-9]+/gi, "-").toLowerCase() + ".ics";
      a.click(); URL.revokeObjectURL(a.href);
      toast("Calendar file saved — open it to add your trip to your calendar.");
    };
    // ✨ Plan my days: fill the trip's days with a paced, themed set of ideas built
    // from what the destination is genuinely known for. Each idea links to a real
    // maps search — never an invented venue or price. Augments, doesn't clobber.
    if ($("#itin-autoplan")) $("#itin-autoplan").onclick = () => {
      if (!PLANNER || !DESTS) return;
      const dest = TE ? TE.resolvePlace(t.to, FLIGHTS) : null;
      const plan = PLANNER.buildPlan({ code: dest && dest.code, city: (dest && dest.city) || t.to }, t.days.length, DESTS);
      let added = 0;
      plan.days.forEach((pd) => {
        const day = t.days[pd.dayIndex]; if (!day) return;
        pd.slots.forEach((sl) => {
          if (!sl.theme) return; // skip the settle/checkout notes — the seed covers those
          // don't double up: skip if this day already has an item with the same title
          const dupe = (day.items || []).some((it) => it.title === sl.title);
          if (dupe) return;
          IT.addItem(t, pd.dayIndex, { time: sl.time, kind: sl.kind, title: sl.title, note: "Tap to open the live map search", link: sl.link }, countAllItemsSeed());
          added++;
        });
      });
      save(); renderTrips();
      if (added > 0) {
        const where = plan.knownFor ? (" around " + plan.knownFor) : "";
        toast("Filled " + added + " idea" + (added > 1 ? "s" : "") + " across your days" + where + ". Edit freely.");
      } else {
        toast("Your days already look full — cleared nothing, added nothing.");
      }
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
    // readiness checklist checks — persist explicit true/false so auto items can be un-ticked
    $$(".rd-chk").forEach((c) => c.onchange = () => {
      t.readiness = t.readiness || { checked: {} }; t.readiness.checked = t.readiness.checked || {};
      t.readiness.checked[c.dataset.rdkey] = c.checked;
      save(); renderTrips();
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
      // group-mode: assign who paid for each spend
      $$("[data-payerfor]").forEach((sel) => sel.onchange = () => {
        const sp = (t.budget.spends || []).find((x) => x.id === sel.dataset.payerfor);
        if (sp) { sp.paidBy = sel.value || null; save(); renderTrips(); }
      });
      // group-mode: toggle who shares each spend (uneven splits)
      $$("[data-sharefor]").forEach((btn) => btn.onclick = () => {
        const sp = (t.budget.spends || []).find((x) => x.id === btn.dataset.sharefor);
        if (!sp) return;
        const all = (t.group.members || []).map((m) => m.id);
        // start from the effective set (null/empty => everyone)
        let set = new Set(Array.isArray(sp.sharedBy) && sp.sharedBy.length ? sp.sharedBy : all);
        const id = btn.dataset.shareid;
        if (set.has(id)) set.delete(id); else set.add(id);
        // never let a spend be shared by nobody — re-toggling the last one back on
        if (set.size === 0) return; // ignore the un-toggle that would empty it
        // canonicalize: "everyone" stored as null so adding a member later still splits it
        sp.sharedBy = (set.size === all.length && all.every((x) => set.has(x))) ? null : all.filter((x) => set.has(x));
        save(); renderTrips();
      });
    }

    // ---- group split handlers ----
    if (SPLIT) {
      const tog = $("#split-toggle");
      if (tog) tog.onchange = () => {
        t.groupMode = tog.checked;
        if (t.groupMode) SPLIT.seedMembers(t, countAllItemsSeed());
        save(); renderTrips();
      };
      if ($("#sp-addm")) $("#sp-addm").onclick = () => {
        const nm = (($("#sp-newname") || {}).value || "").trim();
        SPLIT.addMember(t, nm, countAllItemsSeed());
        save(); renderTrips();
      };
      $$("[data-delm]").forEach((b3) => b3.onclick = () => { SPLIT.removeMember(t, b3.dataset.delm); save(); renderTrips(); });
      $$("[data-renamem]").forEach((inp) => inp.onchange = () => { SPLIT.renameMember(t, inp.dataset.renamem, inp.value); save(); renderTrips(); });
      if ($("#sp-share")) $("#sp-share").onclick = async () => {
        const o = SPLIT.overview(t);
        const cur = (t.budget && t.budget.currency) || "INR";
        const text = SPLIT.summaryText(o, (n) => BUD.fmt(n, cur), t.title);
        try {
          if (navigator.share) { await navigator.share({ title: "Settle up", text }); return; }
        } catch (e) { /* user cancelled the share sheet — fall through to copy */ }
        try { await navigator.clipboard.writeText(text); toast("Settle-up copied — paste it to your group."); }
        catch (e2) { toast("Couldn't copy automatically. Long-press to select the settle-up text above."); }
      };
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
        recordSearch({ kind: "flight", from: from.code, to: to.code, fromCity: from.city, toCity: to.city, date: f.date || "" });
        const cheapestNow = rows[0] ? rows[0].priceTotal : null;
        status.innerHTML = `<div class="fl-livehead">⚡ ${Number(rows.length)} live fares · ${esc(from.code)} → ${esc(to.code)} · ${esc(FE.dateParts(f.date) ? FE.dateParts(f.date).text : f.date)}${creds.env === "test" ? ` <span class="chip warn">test/sample data</span>` : ` <span class="chip good">live</span>`} ${cheapestNow ? `<button class="act ghost mini" id="fl-watch-live">🔔 Watch at ₹${Number(cheapestNow).toLocaleString("en-IN")}</button>` : ""}</div>`;
        const wb = $("#fl-watch-live");
        if (wb) wb.onclick = () => { addWatch(from, to, f.date, cheapestNow, rows[0] ? rows[0].airline : null); toast("Watching this route. I'll re-check the fare each time you open the app."); };
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
        // heatmap: color each day low/mid/high vs the route's own median, and
        // flag the cheapest day + statistical dips (real fetched prices only).
        const cal = WATCH ? WATCH.calendarModel(res.days, res.median) : null;
        (cal ? cal.days : res.days).forEach((d) => {
          const cell = grid && grid.querySelector(`[data-d="${d.date}"]`);
          if (!cell) return;
          if (d.heat) cell.classList.add("heat-" + d.heat);
          if (d.isCheapest) cell.classList.add("is-cheapest");
          else if (d.isDip) cell.classList.add("is-dip");
        });
        const head = $("#fl-flex-result .flex-head");
        if (res.cheapest && head) {
          const dips = res.days.filter((d) => d.isDip && !d.isCheapest).length;
          const dowTip = cal && cal.cheapestDow ? ` · <span class="chip">${esc(cal.cheapestDow.label)}s look cheapest here</span>` : "";
          head.innerHTML = `📅 Cheapest in the next ${DAYS} days: <b>₹${Number(res.cheapest.minPrice).toLocaleString("en-IN")}</b> on ${esc(res.cheapest.date)}${res.cheapest.airline ? " (" + esc(res.cheapest.airline) + ")" : ""} · median ₹${Number(res.median).toLocaleString("en-IN")}${dips ? ` · <span class="chip warn">${Number(dips)} price dip${dips > 1 ? "s" : ""} flagged</span>` : ""}${dowTip}`;
        } else if (head) {
          head.innerHTML = `📅 No live fares returned across those ${DAYS} days. Try a different route or date.`;
        }
        // legend + watch-the-cheapest-day action
        const foot = $("#fl-flex-result .flex-foot");
        if (foot) {
          foot.innerHTML = `<span class="heat-key"><span class="hk low"></span> cheaper day · <span class="hk mid"></span> typical · <span class="hk high"></span> pricier</span> — colors are relative to this route's own median, not absolute. Each day is a real live fare lookup.`;
          if (res.cheapest) {
            foot.innerHTML += ` <button class="act ghost mini" id="fl-watch-cheapest">🔔 Watch this route at ₹${Number(res.cheapest.minPrice).toLocaleString("en-IN")}</button>`;
            const wb = $("#fl-watch-cheapest");
            if (wb) wb.onclick = () => { addWatch(from, to, f.date, res.cheapest.minPrice, res.cheapest.airline); toast("Watching this route. I'll re-check the fare each time you open the app."); };
          }
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

  // ===================== PRICE-DROP WATCHES ===============================
  // honest model: we store the real fare you watched it at, and re-check the
  // live fare when you open the app (no server pinging you). The watch-engine
  // is pure; this layer does storage + the live re-check + render.
  function watches() { if (!state.watches) state.watches = []; return state.watches; }
  function addWatch(from, to, date, price, airline) {
    if (!WATCH) return;
    const id = from.code + "_" + to.code + "_" + (date || "any");
    const existing = watches().find((w) => w.id === id);
    const ts = Date.now();
    if (existing) {
      const i = watches().indexOf(existing);
      watches()[i] = WATCH.recordCheck(existing, price, ts);
    } else {
      watches().push(WATCH.newWatch({ from: from.code, to: to.code, date: date || "", price: price, airline: airline, ts: ts }));
    }
    save();
    renderWatches();
  }
  function removeWatch(id) {
    state.watches = watches().filter((w) => w.id !== id);
    save();
    renderWatches();
  }
  function renderWatches() {
    const el = $("#fl-watches");
    if (!el || !WATCH) return;
    const ws = watches();
    if (!ws.length) { el.innerHTML = ""; return; }
    const fmtAgo = (ts) => {
      if (!ts) return "";
      const mins = Math.round((Date.now() - ts) / 60000);
      if (mins < 1) return "just now";
      if (mins < 60) return mins + "m ago";
      const h = Math.round(mins / 60);
      if (h < 24) return h + "h ago";
      return Math.round(h / 24) + "d ago";
    };
    const rows = ws.map((w) => {
      const d = WATCH.delta(w);
      const low = WATCH.lowestSeen(w);
      let deltaChip = `<span class="chip">no change yet</span>`;
      if (d && d.dir === "down") deltaChip = `<span class="chip good">▼ down ₹${Number(d.absShown).toLocaleString("en-IN")} (${d.pctShown}%)</span>`;
      else if (d && d.dir === "up") deltaChip = `<span class="chip warn">▲ up ₹${Number(d.absShown).toLocaleString("en-IN")} (${d.pctShown}%)</span>`;
      else if (d && d.dir === "flat") deltaChip = `<span class="chip">no change</span>`;
      return `<div class="watch-row" data-w="${esc(w.id)}">
        <div class="watch-main">
          <div class="watch-route"><b>${esc(w.from)} → ${esc(w.to)}</b> ${w.date ? `<span class="card-sub">${esc(w.date)}</span>` : `<span class="card-sub">any date</span>`}</div>
          <div class="watch-prices">watched at <b>₹${w.basePrice != null ? Number(w.basePrice).toLocaleString("en-IN") : "—"}</b> · now <b>₹${w.lastPrice != null ? Number(w.lastPrice).toLocaleString("en-IN") : "—"}</b> ${deltaChip}</div>
          <div class="card-sub">${low ? `lowest I've seen: ₹${Number(low.price).toLocaleString("en-IN")} · ` : ""}checked ${fmtAgo(w.lastTs || w.lastCheckedTs)}</div>
        </div>
        <div class="watch-actions">
          <button class="act ghost mini" data-recheck="${esc(w.id)}">↻ re-check</button>
          <button class="act ghost mini" data-unwatch="${esc(w.id)}">✕</button>
        </div>
      </div>`;
    }).join("");
    el.innerHTML = `<div class="section-h">🔔 Price watches <span class="card-sub" style="font-weight:400;">re-checked live when you open the app</span></div>
      <div class="watch-list">${rows}</div>
      <div class="card-sub watch-foot">There's no server emailing you — I re-check the live fare right here when you open the app or tap re-check. The price you watched + the lowest I've seen are real fares I actually fetched, never guessed.</div>`;
    $$("[data-unwatch]").forEach((b) => b.onclick = () => removeWatch(b.dataset.unwatch));
    $$("[data-recheck]").forEach((b) => b.onclick = () => recheckWatch(b.dataset.recheck));
  }
  // re-check ONE watch against the live fare API (needs a connected key).
  function recheckWatch(id) {
    const w = watches().find((x) => x.id === id);
    if (!w || !WATCH || !LIVE) return;
    const creds = loadCreds();
    if (!creds || !creds.clientId) { toast("Connect a free fare key to re-check live prices."); return; }
    const btn = document.querySelector(`[data-recheck="${id}"]`);
    if (btn) { btn.textContent = "checking…"; btn.disabled = true; }
    LIVE.searchLive(creds, { from: w.from, to: w.to, date: w.date || (state.flight || {}).date, adults: 1, max: 5 })
      .then((res) => {
        const price = (res.rows && res.rows.length) ? res.rows[0].priceTotal : null;
        const i = watches().indexOf(w);
        watches()[i] = WATCH.recordCheck(w, price, Date.now());
        save();
        renderWatches();
        toast(price == null ? "No live fare came back this time — kept the last real price." : "Re-checked: ₹" + Number(price).toLocaleString("en-IN"));
      })
      .catch(() => { if (btn) { btn.textContent = "↻ re-check"; btn.disabled = false; } toast("Re-check failed (offline or key issue)."); });
  }
  // on app open: auto re-check watches IF a key is connected, quietly, one at a
  // time (free-tier rate limit). No key = panel still shows last real prices.
  function autoRecheckWatches() {
    if (!WATCH || !LIVE) return;
    const ws = watches();
    if (!ws.length) return;
    const creds = loadCreds();
    if (!creds || !creds.clientId) return; // no key: show stored prices only
    let chain = Promise.resolve();
    ws.forEach((w) => {
      chain = chain.then(() =>
        LIVE.searchLive(creds, { from: w.from, to: w.to, date: w.date || (state.flight || {}).date, adults: 1, max: 5 })
          .then((res) => {
            const price = (res.rows && res.rows.length) ? res.rows[0].priceTotal : null;
            const i = watches().indexOf(w);
            if (i >= 0) watches()[i] = WATCH.recordCheck(watches()[i], price, Date.now());
          })
          .catch(() => {})
      );
    });
    chain.then(() => { save(); renderWatches(); });
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
    if ($("#fl-go")) $("#fl-go").onclick = () => { persist(); renderFlights(); recordFlightSearch(); $("#fl-result").scrollIntoView({ behavior: "smooth", block: "start" }); };
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
    // No blocking welcome popup anymore. The first screen ("Where to?" + the
    // tap-a-place chips) is self-explanatory, so a newbie acts immediately
    // instead of reading a chore list. Keep the modal in the DOM but never show
    // it; just mark the user onboarded so nothing else trips on the flag.
    const m = $("#onboard");
    if (m) m.hidden = true;
    if (!state.onboarded) { state.onboarded = true; save(); }
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
    renderPlanStats(); renderHotels(); renderOntrip(); renderGround(); renderWatches(); renderRecentSearches(); renderLongWeekend(); renderExplore(); renderTrips();
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

  // ---- global error boundary --------------------------------------------
  // A single uncaught error (a bad data record, a browser quirk) should never
  // leave a dead screen with no explanation. Catch them, keep the app alive, and
  // tell the user once. Dev still sees the real error in the console.
  let errorToasted = false;
  function softFail(where, err) {
    // console keeps the full error for debugging; user gets one calm notice
    try { console.error("[TripLens] " + where, err); } catch (e) {}
    if (!errorToasted) {
      errorToasted = true;
      try { toast("Something hiccuped, but your data is safe. If it looks wrong, reload the page."); } catch (e) {}
      // allow another notice later once this one has cleared
      setTimeout(() => { errorToasted = false; }, 5000);
    }
  }
  window.addEventListener("error", (e) => softFail("error", e && (e.error || e.message)));
  window.addEventListener("unhandledrejection", (e) => softFail("promise", e && e.reason));

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
  wireGround();
  wireMulticity();
  wireLongWeekend();
  wireExplore();
  wireTripsForm();
  wireDatePickers();
  render();
  renderAuthBar();
  maybeOnboard();
  autoRecheckWatches();
})();
