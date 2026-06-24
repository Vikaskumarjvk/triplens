/*
 * TripLens — Smart Trip Brief engine. Pure, no DOM, no clock, no network.
 *
 * THE CAPSTONE: you give it one trip, it gives you every decision already made,
 * ranked, on top of your mind. It does NOT fetch anything itself — the app feeds
 * it the values the other engines already computed (distance, transport compare,
 * best card, lounges, weather, holiday timing). This engine's job is the JUDGEMENT:
 * pick the best option on each dimension, say why in one line, and surface the
 * single most important next move.
 *
 * HONESTY: it decides between OPTIONS and picks the smart DEFAULT — it never
 * invents a price or a total. Every "why" is a real reason (distance band, a card
 * you actually hold, a real forecast flag, an exact weekday). Confidence-tagged.
 */
(function (root) {
  "use strict";

  // ---- "getting there" decision from real distance + transport bands ------
  // transport = LL_TRANSPORT_ENGINE.compareModes() result (or null if no coords).
  function getThereDecision(km, transport) {
    if (km == null || !transport) {
      return { key: "mode", icon: "🧭", title: "Getting there", value: "Add cities I can map", why: "I need both ends on the map to call the best way.", confidence: "low" };
    }
    var rec = transport.recommend;
    var map = {
      train_bus: { value: "Take a train or bus", why: "Only " + fmtKm(km) + " — flying wastes more time at the airport than it saves." },
      compare: { value: "Compare train vs fly", why: fmtKm(km) + " is the toss-up zone; an overnight train can save a hotel night." },
      fly_or_overnight_train: { value: "Fly (or overnight train to save cash)", why: fmtKm(km) + " — flying is the practical pick, overnight train is the cheap one." },
      fly: { value: "Fly", why: fmtKm(km) + " — too far for road or rail to make sense." },
    };
    var m = map[rec] || map.fly;
    return { key: "mode", icon: rec === "fly" || rec === "fly_or_overnight_train" ? "✈️" : "🚆", title: "Getting there", value: m.value, why: m.why, confidence: "high" };
  }
  function fmtKm(km) { return km != null ? km.toLocaleString("en-IN") + " km" : ""; }

  // ---- "pay with" decision from the best card already computed ------------
  function payDecision(bestCard, walletCount) {
    if (!walletCount) return { key: "pay", icon: "💳", title: "Pay with", value: "Add your cards", why: "Tell me which cards you hold and I'll pick the one that discounts the most of this trip.", confidence: "low", action: "addcard" };
    if (!bestCard) return { key: "pay", icon: "💳", title: "Pay with", value: "Any card — no tracked match", why: "None of your cards hit a tracked offer on this trip's sites; the sites may still run a generic discount.", confidence: "med" };
    var n = (bestCard.places && bestCard.places.length) || 0;
    return { key: "pay", icon: "💳", title: "Pay with", value: bestCard.card.name, why: "Has offers on " + n + " of this trip's booking site" + (n > 1 ? "s" : "") + ". Confirm today's exact terms before you pay.", confidence: "med", card: bestCard.card };
  }

  // ---- "best timing" decision from holiday/long-weekend assessment --------
  // holiday = { onOrNearLongWeekend, assess, nextLongWeekend } (app composes it).
  function timingDecision(dates, holiday) {
    if (!holiday) return null;
    if (holiday.assess && dates && dates.depart) {
      var a = holiday.assess;
      if (a.verdict === "free_long_weekend" || (a.zeroLeave && a.zeroLeave.days >= 3)) {
        return { key: "timing", icon: "🎉", title: "Your timing", value: "Already a long weekend", why: a.name + " gives you a " + a.zeroLeave.days + "-day break with zero leave. Great dates.", confidence: "high" };
      }
      if (a.best && a.best.leaveCount <= 2) {
        return { key: "timing", icon: "🗓️", title: "Your timing", value: "Take " + a.best.leaveCount + " day off for a " + a.best.days + "-day break", why: "Your dates are next to " + a.name + " — one bridge day stretches it.", confidence: "high" };
      }
    }
    if (holiday.nextLongWeekend) {
      var nlw = holiday.nextLongWeekend;
      return { key: "timing", icon: "🏖️", title: "Smarter dates", value: nlw.name + " is a long weekend", why: "Not on a holiday now — " + nlw.name + " (" + nlw.date + ") gives a " + nlw.days + "-day break if your dates are flexible.", confidence: "high" };
    }
    return null;
  }

  // ---- lounges decision ----------------------------------------------------
  function loungeDecision(lounges, walletCount) {
    if (!lounges) return null;
    var oOpen = lounges.originOpen || 0, dOpen = lounges.destOpen || 0;
    var oTot = lounges.originTotal || 0, dTot = lounges.destTotal || 0;
    if (!oTot && !dTot) return null;
    if (!walletCount) return { key: "lounge", icon: "🛋️", title: "Airport lounges", value: (oTot + dTot) + " on your route", why: "Add your cards to see which you can walk into free.", confidence: "low", action: "addcard" };
    var open = oOpen + dOpen;
    if (!open) return { key: "lounge", icon: "🛋️", title: "Airport lounges", value: "None your cards open", why: "Your current cards don't unlock a lounge on this route.", confidence: "med" };
    return { key: "lounge", icon: "🛋️", title: "Airport lounges", value: open + " you can walk into", why: "Your cards open " + oOpen + " at the start and " + dOpen + " at the destination — free.", confidence: "med" };
  }

  // ---- weather + one-line packing -----------------------------------------
  // weather = parsed flags from live-data (cold/hot/monsoon/maxC/minC) or null.
  function weatherDecision(weather, destCity) {
    if (!weather) return null;
    var bits = [];
    if (weather.monsoon) bits.push("pack a rain layer");
    if (weather.cold) bits.push("it'll be cold, bring warm clothes");
    if (weather.hot) bits.push("it'll be hot, pack light + sunscreen");
    var why = bits.length ? bits.join("; ") : "mild — pack normal.";
    var range = (weather.minC != null && weather.maxC != null) ? weather.minC + "–" + weather.maxC + "°C" : "";
    return { key: "weather", icon: weather.monsoon ? "🌧️" : weather.cold ? "🧥" : weather.hot ? "☀️" : "🌤️", title: "Weather + packing", value: range || "Forecast loaded", why: (destCity ? destCity + ": " : "") + why, confidence: "high" };
  }

  // ---- compose: rank the decisions + pick the single top move -------------
  function compose(inp) {
    inp = inp || {};
    var decisions = [];
    var push = function (d) { if (d) decisions.push(d); };
    push(getThereDecision(inp.km, inp.transport));
    push(payDecision(inp.bestCard, inp.walletCount || 0));
    push(timingDecision(inp.dates, inp.holiday));
    push(loungeDecision(inp.lounges, inp.walletCount || 0));
    push(weatherDecision(inp.weather, inp.route && inp.route.toCity));

    // the single most important next move = first unmet setup, else first action.
    var topMove = null;
    if (!(inp.walletCount > 0)) topMove = { text: "Add the cards you hold — that unlocks the best-pay + lounge calls.", action: "addcard" };
    else if (!(inp.dates && inp.dates.depart)) topMove = { text: "Pick your travel date so I can pull live fares + check your timing.", action: "plan" };
    else {
      var mode = decisions.find(function (d) { return d.key === "mode"; });
      topMove = { text: mode ? mode.value + " — open the live search and book the smart way." : "Open the booking links below.", action: "plan" };
    }

    // headline = the route + the mode call in one breath
    var modeDec = decisions.find(function (d) { return d.key === "mode"; });
    var headline = (inp.route && inp.route.fromCity && inp.route.toCity)
      ? inp.route.fromCity + " to " + inp.route.toCity + (modeDec && modeDec.confidence === "high" ? " · " + modeDec.value : "")
      : "Your trip at a glance";

    return { headline: headline, decisions: decisions, topMove: topMove };
  }

  var Engine = { getThereDecision: getThereDecision, payDecision: payDecision, timingDecision: timingDecision, loungeDecision: loungeDecision, weatherDecision: weatherDecision, compose: compose };
  if (typeof module !== "undefined" && module.exports) module.exports = Engine;
  root.LL_BRIEF = Engine;
})(typeof window !== "undefined" ? window : globalThis);
