/* LoungeLens app controller — DOM glue over LL_ENGINE. Simple + Advanced modes. */
(function () {
  "use strict";
  const E = window.LL_ENGINE, CARDS = window.LL_CARDS, LOUNGES = window.LL_LOUNGES, META = window.LL_META, SELF = window.LL_SELF;
  const PROFILE = window.LL_PROFILE, SOURCES = window.LL_SOURCES, SLINKS = window.LL_SOURCE_LINKS;
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
  function blank() { return { wallet: [], visitLog: [], spend: {}, mode: "simple", trip: ["Hyderabad", ""], experiences: [], onboarded: false, profileName: "" }; }
  function save() { localStorage.setItem(KEY, JSON.stringify(state)); }

  // ---- helpers -----------------------------------------------------------
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
  // render a row of external source links (official access apps + research bases).
  // Honest: these LINK OUT — the app can't grant access itself.
  const relDots = (n) => "●".repeat(n) + "○".repeat(5 - n);
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

  // ---- mode toggle -------------------------------------------------------
  function applyMode() {
    document.body.classList.toggle("simple-mode", isSimple());
    document.body.classList.toggle("advanced-mode", !isSimple());
    $$("#mode-toggle button").forEach((b) => b.classList.toggle("active", b.dataset.mode === state.mode));
  }
  $$("#mode-toggle button").forEach((b) =>
    b.addEventListener("click", () => { state.mode = b.dataset.mode; save(); applyMode(); render(); })
  );

  // ---- routing -----------------------------------------------------------
  $$("nav button").forEach((b) =>
    b.addEventListener("click", () => {
      $$("nav button").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      $$(".view").forEach((v) => v.classList.remove("active"));
      $("#view-" + b.dataset.view).classList.add("active");
    })
  );

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
        if (isSimple()) {
          if (row.open) {
            return `<div class="lounge-line ok"><span class="ll-name">${l.name}</span> <span class="ll-loc">${loc}</span>
              <div class="use-card">use <b>${row.best.card.name}</b>${row.best.quota.unlimited ? "" : ` · ${row.best.quota.left} left`}</div></div>`;
          }
          const why = row.matches.length === 0 ? "none of your cards" :
            (row.best && !row.best.spend.met) ? `${row.best.card.name} is spend-locked` : `${row.best ? row.best.card.name : "your card"} has 0 visits left`;
          return `<div class="lounge-line no"><span class="ll-name">${l.name}</span> <span class="ll-loc">${loc}</span>
            <div class="use-card bad">can't enter — ${why}</div></div>`;
        }
        // advanced
        const openers = row.matches.length ? row.matches.map((m) => `
          <div class="opener ${m.usable ? "usable" : "unusable"}">
            <span class="who">${m.card.name}</span> via ${m.sharedRails.map(railWord).join(", ")}
            ${m.usable ? `<span class="chip good">${m.quota.unlimited ? "unlimited" : m.quota.left + " left"}</span>`
              : (!m.spend.met ? `<span class="chip warn">spend-locked</span>` : `<span class="chip bad">0 left</span>`)}
          </div>`).join("") : `<div class="card-sub">No card of yours opens this.</div>`;
        return `<div class="lounge-block">
          <div class="card-head"><div><b>${l.name}</b> ${confBadge(l.confidence)}<div class="card-sub">${loc}</div></div></div>
          ${openers}
          ${l.verify ? `<span class="verify">✔ ${l.verify}</span>` : ""}
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
    $$("[data-goto]").forEach((el) => el.onclick = () => {
      const v = el.dataset.goto;
      $$("nav button").forEach((x) => x.classList.toggle("active", x.dataset.view === v));
      $$(".view").forEach((s) => s.classList.toggle("active", s.id === "view-" + v));
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // ============================ WALLET ====================================
  function renderWallet() {
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
      <div class="card">
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
        <div class="row adv-only">${rails || '<span class="chip bad">no lounge access</span>'}</div>
        <div class="row">
          <button class="act mini" data-logvisit="${c.id}" ${(!quota.unlimited && quota.left === 0) || !spend.met ? "disabled" : ""}>I used this (-1)</button>
          ${state.visitLog.some((v) => v.cardId === c.id) ? `<button class="act ghost mini" data-undovisit="${c.id}">undo</button>` : ""}
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
  function renderLounges() {
    const q = ($("#lounge-search").value || "").toLowerCase();
    const type = $("#lounge-type").value;
    const onlyOpen = $("#lounge-filter").value === "open";
    const cov = E.coverage(state.wallet, CARDS, LOUNGES, state.visitLog, state.spend, NOW, type ? { type } : null);

    $("#coverage-stats").innerHTML = `
      <div class="stat good"><div class="num">${cov.openCount}</div><div class="lbl">You can enter</div></div>
      <div class="stat"><div class="num">${cov.total}</div><div class="lbl">Lounges listed</div></div>
      <div class="stat"><div class="num">${cov.total ? Math.round((cov.openCount / cov.total) * 100) : 0}%</div><div class="lbl">Coverage</div></div>`;

    let rows = cov.list.filter(({ lounge: l }) =>
      `${l.name} ${l.city} ${l.airport || ""} ${l.station || ""} ${l.terminal || ""}`.toLowerCase().includes(q));
    if (onlyOpen) rows = rows.filter((r) => r.open);
    if (rows.length === 0) { $("#lounge-list").innerHTML = `<div class="empty">No lounges match.</div>`; return; }

    $("#lounge-list").innerHTML = rows.map(({ lounge: l, matches, open, blockedOnly }) => {
      const cls = open ? "open" : blockedOnly ? "blocked" : "closed";
      const loc = l.type === "railway" ? `🚆 ${l.station} · ${l.city}` : `✈️ ${l.airport} ${l.terminal || ""} · ${l.city}`;
      const rails = (l.programs || []).map((p) => `<span class="chip ${p === "railway" || p === "rupay" || p === "payperuse" ? "rail" : ""}">${isSimple() ? railWord(p) : p}</span>`).join("");
      const openers = matches.length
        ? matches.map((m) => `
            <div class="opener ${m.usable ? "usable" : "unusable"}">
              <span class="who">${m.card.name}</span>${isSimple() ? "" : ` via ${m.sharedRails.map(railWord).join(", ")}`}
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
  ["#lounge-search", "#lounge-type", "#lounge-filter"].forEach((sel) => {
    const el = $(sel); el.oninput = renderLounges; el.onchange = renderLounges;
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
      <div class="card">
        <div class="card-head">
          <div><div class="card-title">#${i + 1} ${c.name} ${confBadge(c.confidence)}</div>
          <div class="card-sub">${c.issuer} · ${c.feeNote}</div></div>
          <button class="act mini" data-add="${c.id}">Add</button>
        </div>
        <div class="row">${tags}</div>
        <div class="row"><span class="rec-score">Opens <b>${r.marginalCoverage}</b> new lounge(s) for you${isSimple() ? "" : ` · score ${r.score}`}</span></div>
        ${c.eligibility ? `<div class="notes adv-only">${c.eligibility}</div>` : ""}
        ${sourceLinksHtml(SLINKS.forCard(c), "card")}
      </div>`;
    }).join("");
    $$("[data-add]").forEach((b) => b.onclick = () => { if (!state.wallet.includes(b.dataset.add)) state.wallet.push(b.dataset.add); save(); render(); });
  }
  $("#rec-easy").onchange = renderRecommend;
  $("#rec-type").onchange = renderRecommend;

  // ============================ ADD CARDS =================================
  let addCardFilter = "all"; // all | credit | debit
  function renderAddCard() {
    const q = ($("#addcard-search") && $("#addcard-search").value || "").toLowerCase();
    const list = CARDS
      .filter((c) => addCardFilter === "all" || cardType(c) === addCardFilter)
      .filter((c) => `${c.name} ${c.issuer}`.toLowerCase().includes(q));

    // filter chips + counts
    const nCredit = CARDS.filter((c) => cardType(c) === "credit").length;
    const nDebit = CARDS.filter((c) => cardType(c) === "debit").length;
    const filterBar = `<div class="row" style="margin-bottom:10px;">
      <button class="act ${addCardFilter === "all" ? "" : "ghost"} mini" data-addfilter="all">All (${CARDS.length})</button>
      <button class="act ${addCardFilter === "credit" ? "" : "ghost"} mini" data-addfilter="credit">💳 Credit (${nCredit})</button>
      <button class="act ${addCardFilter === "debit" ? "" : "ghost"} mini" data-addfilter="debit">🏧 Debit (${nDebit})</button>
    </div>`;

    const cards = list.map((c) => {
      const picked = state.wallet.includes(c.id);
      const tags = [
        `<span class="chip">${visitsLabel(c)}</span>`,
        c.ltf ? `<span class="chip good">LTF</span>` : "",
        c.spendGate ? `<span class="chip warn">spend gate</span>` : "",
        c.railway ? `<span class="chip rail">🚆</span>` : "",
        `<span class="chip">${easeWord(c.ease)}</span>`,
        c.approvalSpeed ? `<span class="chip">${speedWord(c.approvalSpeed)}</span>` : "",
      ].filter(Boolean).join("");
      return `
      <div class="card selectable ${picked ? "picked" : ""}" data-toggle="${c.id}">
        <div class="card-head">
          <div><div class="card-title">${typeBadge(c)} ${c.name} ${confBadge(c.confidence)}</div>
          <div class="card-sub">${c.issuer} · ${c.feeNote}</div></div>
          <span class="chip ${picked ? "good" : ""}">${picked ? "✓ added" : "tap to add"}</span>
        </div>
        <div class="row">${tags}</div>
      </div>`;
    }).join("") || `<div class="empty">No cards match.</div>`;

    $("#addcard-list").innerHTML = filterBar + cards;
    $$("[data-addfilter]").forEach((b) => b.onclick = () => { addCardFilter = b.dataset.addfilter; renderAddCard(); });
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

  // ---- onboarding (first run) -------------------------------------------
  function maybeOnboard() {
    if (state.onboarded) return;
    const m = $("#onboard");
    if (!m) return;
    m.hidden = false;
    $("#onboard-start").onclick = () => {
      m.hidden = true;
      state.onboarded = true; save();
      // jump them to Add Cards to start
      $$("nav button").forEach((x) => x.classList.toggle("active", x.dataset.view === "addcard"));
      $$(".view").forEach((s) => s.classList.toggle("active", s.id === "view-addcard"));
    };
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
    $("#about-version").textContent =
      "LoungeLens · data reviewed " + (META.lastReviewed || "—") + " · " + CARDS.length +
      " cards (" + nCredit + " credit, " + nDebit + " debit) · " + LOUNGES.length + " lounges · all data stored locally";
  }
  $("#reset-all").onclick = () => {
    if (confirm("Clear your cards, visits and trip from this browser?")) { state = blank(); save(); applyMode(); render(); renderTripInputs(); }
  };

  // ---- master render -----------------------------------------------------
  function render() {
    if (!state.experiences) state.experiences = []; // migrate older saved state
    renderWallet(); renderLounges(); renderRecommend(); renderAddCard(); renderHealth(); renderProfile();
    if ($("#trip-result").innerHTML.trim()) renderTripResult();
  }

  // init
  applyMode();
  cityDatalist();
  renderTripInputs();
  render();
  maybeOnboard();
})();
