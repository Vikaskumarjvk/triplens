/*
 * FlightLens LIVE — real-time fares from the Amadeus Self-Service API, fetched
 * DIRECTLY from the browser (no backend). This works on a free static site
 * because Amadeus returns Access-Control-Allow-Origin:* on both its OAuth token
 * endpoint and its flight-offers endpoint (verified 2026-06-22 via preflight).
 *
 * Why Amadeus and not "scrape MakeMyTrip": OTAs/airlines run DataDome/Akamai
 * anti-bot and hard-drop browser requests (MMT returns HTTP 000). No request
 * bypasses that from a static page. Amadeus is the real free real-time path.
 *
 * The user pastes their OWN free Amadeus key (test or production). It is stored
 * only in their browser (localStorage), never sent anywhere except Amadeus.
 *
 * Split for testability: parseOffers()/cheapestByAirline() are PURE (Node-tested
 * against a real-shape fixture); the fetch functions are thin browser wrappers.
 */
(function (root) {
  "use strict";

  var HOSTS = {
    test: "https://test.api.amadeus.com",
    production: "https://api.amadeus.com",
  };

  // ---- PURE parsers (Node-testable) --------------------------------------

  // minutes from an ISO-8601 duration like "PT2H10M"
  function durationToMin(iso) {
    if (!iso) return null;
    var m = /PT(?:(\d+)H)?(?:(\d+)M)?/.exec(iso);
    if (!m) return null;
    return (Number(m[1] || 0) * 60) + Number(m[2] || 0);
  }
  function minLabel(min) {
    if (min == null) return "";
    var h = Math.floor(min / 60), mm = min % 60;
    return (h ? h + "h " : "") + (mm ? mm + "m" : (h ? "" : "0m"));
  }
  function timeLabel(iso) {
    // "2026-07-12T06:15:00" -> "06:15"
    if (!iso) return "";
    var m = /T(\d{2}:\d{2})/.exec(iso);
    return m ? m[1] : "";
  }

  // turn the raw Amadeus flight-offers JSON into clean rows the UI can render.
  // resp = { data:[offer...], dictionaries:{ carriers:{...} } }
  function parseOffers(resp) {
    if (!resp || !Array.isArray(resp.data)) return [];
    var carriers = (resp.dictionaries && resp.dictionaries.carriers) || {};
    return resp.data.map(function (o) {
      var it = (o.itineraries && o.itineraries[0]) || {};
      var segs = it.segments || [];
      var first = segs[0] || {};
      var last = segs[segs.length - 1] || {};
      var carrierCode = (o.validatingAirlineCodes && o.validatingAirlineCodes[0]) || first.carrierCode || "";
      var stops = Math.max(0, segs.length - 1);
      var price = o.price || {};
      return {
        id: o.id,
        airlineCode: carrierCode,
        airline: carriers[carrierCode] || carrierCode || "Airline",
        priceTotal: Number(price.grandTotal || price.total || 0),
        currency: price.currency || "INR",
        depTime: timeLabel(first.departure && first.departure.at),
        arrTime: timeLabel(last.arrival && last.arrival.at),
        from: (first.departure && first.departure.iataCode) || "",
        to: (last.arrival && last.arrival.iataCode) || "",
        durationMin: durationToMin(it.duration),
        durationLabel: minLabel(durationToMin(it.duration)),
        stops: stops,
        stopsLabel: stops === 0 ? "non-stop" : stops + " stop" + (stops > 1 ? "s" : ""),
        seatsLeft: o.numberOfBookableSeats || null,
      };
    }).sort(function (a, b) { return a.priceTotal - b.priceTotal; });
  }

  // cheapest fare per airline (the comparison table the user actually wants)
  function cheapestByAirline(rows) {
    var byAir = {};
    rows.forEach(function (r) {
      if (!byAir[r.airlineCode] || r.priceTotal < byAir[r.airlineCode].priceTotal) byAir[r.airlineCode] = r;
    });
    return Object.keys(byAir).map(function (k) { return byAir[k]; })
      .sort(function (a, b) { return a.priceTotal - b.priceTotal; });
  }

  // ---- BROWSER fetch wrappers (not Node-tested) --------------------------

  var TOKEN_KEY = "loungelens.amadeus.token"; // {access_token, exp}
  function loadToken() { try { return JSON.parse(localStorage.getItem(TOKEN_KEY)); } catch (e) { return null; } }
  function saveToken(t) { try { localStorage.setItem(TOKEN_KEY, JSON.stringify(t)); } catch (e) {} }

  // get (cached) OAuth token. creds = {clientId, clientSecret, env}
  function getToken(creds) {
    var cached = loadToken();
    var nowSec = Math.floor(Date.now() / 1000);
    if (cached && cached.access_token && cached.exp > nowSec + 30) return Promise.resolve(cached.access_token);
    var host = HOSTS[creds.env] || HOSTS.test;
    return fetch(host + "/v1/security/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials&client_id=" + encodeURIComponent(creds.clientId) +
            "&client_secret=" + encodeURIComponent(creds.clientSecret),
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok || !res.j.access_token) {
          var msg = (res.j && (res.j.error_description || res.j.title)) || "auth failed";
          throw new Error("Amadeus auth: " + msg);
        }
        saveToken({ access_token: res.j.access_token, exp: nowSec + (res.j.expires_in || 1700) });
        return res.j.access_token;
      });
  }

  // search live fares. q = {from, to, date, adults, env}
  function searchLive(creds, q) {
    var host = HOSTS[creds.env] || HOSTS.test;
    return getToken(creds).then(function (token) {
      var url = host + "/v2/shopping/flight-offers" +
        "?originLocationCode=" + encodeURIComponent(q.from) +
        "&destinationLocationCode=" + encodeURIComponent(q.to) +
        "&departureDate=" + encodeURIComponent(q.date) +
        "&adults=" + (q.adults || 1) +
        "&currencyCode=INR&max=" + (q.max || 20) + "&nonStop=false";
      return fetch(url, { headers: { Authorization: "Bearer " + token } })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, status: r.status, j: j }; }); })
        .then(function (res) {
          if (!res.ok) {
            var e = (res.j && res.j.errors && res.j.errors[0]) || {};
            throw new Error("Amadeus: " + (e.detail || e.title || ("HTTP " + res.status)));
          }
          return { rows: parseOffers(res.j), raw: res.j };
        });
    });
  }

  function clearToken() { try { localStorage.removeItem(TOKEN_KEY); } catch (e) {} }

  var LiveAPI = {
    HOSTS: HOSTS,
    durationToMin: durationToMin, minLabel: minLabel, timeLabel: timeLabel,
    parseOffers: parseOffers, cheapestByAirline: cheapestByAirline,
    getToken: getToken, searchLive: searchLive, clearToken: clearToken,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = LiveAPI;
  root.LL_FLIGHT_LIVE = LiveAPI;
})(typeof window !== "undefined" ? window : globalThis);
