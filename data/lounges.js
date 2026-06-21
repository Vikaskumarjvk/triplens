/*
 * LoungeLens — lounge dataset (airport + railway, India domestic). Reviewed 2026-06-21.
 *
 * HONESTY MODEL: India's lounge landscape changes every quarter — operators rotate
 * (an Encalm site can become Plaza Premium), and card-program access shifts.
 * Treat this as STRUCTURE-correct + DIRECTIONALLY-correct seed data, NOT legal truth.
 * Every record carries `confidence` and a `verify` hint.
 *
 * confidence: high = stable major hub, unlikely to change
 *             med  = operated but operator/program mix shifts
 *             low  = volatile, single-source, or newer — verify before relying
 *
 * `programs` = access rails that open this lounge (engine matches user's card rails):
 *   dreamfolks  - dominant domestic aggregator (most bank cards route here)
 *   priority    - Priority Pass
 *   visa / mastercard / diners - network programs (tier-gated in reality)
 *   rupay       - RuPay lounge program
 *   plaza       - Plaza Premium direct / pay-per-use
 *   payperuse   - pay at the desk (railway lounges especially)
 */
window.LL_LOUNGES = [
  // ============ HYDERABAD — home base, anchor coverage ============
  { id: "hyd-encalm-dom", name: "Encalm Lounge (Domestic)", airport: "HYD", terminal: "Domestic", city: "Hyderabad", type: "airport", area: "domestic",
    programs: ["dreamfolks", "priority", "visa", "mastercard", "diners"], confidence: "high",
    notes: "Main domestic lounge at RGIA Hyderabad.", verify: "Confirm operator + your card in the DreamFolks app before you fly." },
  { id: "hyd-plaza-dom", name: "Plaza Premium Lounge (Domestic)", airport: "HYD", terminal: "Domestic", city: "Hyderabad", type: "airport", area: "domestic",
    programs: ["dreamfolks", "priority", "plaza"], confidence: "med",
    notes: "Domestic wing; also pay-per-use.", verify: "" },
  { id: "hyd-encalm-intl", name: "Encalm Lounge (International)", airport: "HYD", terminal: "International", city: "Hyderabad", type: "airport", area: "international",
    programs: ["dreamfolks", "priority", "visa", "mastercard"], confidence: "med",
    notes: "International departures; listed for completeness.", verify: "" },
  { id: "rail-sc", name: "Executive Lounge (Secunderabad)", station: "SC", city: "Hyderabad", type: "railway", area: "domestic",
    programs: ["payperuse", "dreamfolks", "rupay"], confidence: "low",
    notes: "Railway lounge availability at SC/HYB is inconsistent — confirm it's operating.", verify: "Ask at the station; railway lounge card-comp rules vary by operator." },

  // ============ DELHI ============
  { id: "del-t3-encalm", name: "Encalm Lounge", airport: "DEL", terminal: "T3", city: "Delhi", type: "airport", area: "domestic",
    programs: ["dreamfolks", "priority", "visa", "mastercard", "diners"], confidence: "high",
    notes: "Large; T3 domestic + international wings.", verify: "" },
  { id: "del-t1-encalm", name: "Encalm Lounge", airport: "DEL", terminal: "T1", city: "Delhi", type: "airport", area: "domestic",
    programs: ["dreamfolks", "priority", "visa", "mastercard"], confidence: "med", notes: "", verify: "" },
  { id: "del-t2-dom", name: "Domestic Lounge", airport: "DEL", terminal: "T2", city: "Delhi", type: "airport", area: "domestic",
    programs: ["dreamfolks", "priority"], confidence: "med", notes: "T2 used for select carriers.", verify: "" },

  // ============ MUMBAI ============
  { id: "bom-t2-gvk", name: "Loyalty Lounge (GVK)", airport: "BOM", terminal: "T2", city: "Mumbai", type: "airport", area: "domestic",
    programs: ["dreamfolks", "priority", "visa", "mastercard", "diners"], confidence: "high", notes: "", verify: "" },
  { id: "bom-t1-dom", name: "Domestic Lounge", airport: "BOM", terminal: "T1", city: "Mumbai", type: "airport", area: "domestic",
    programs: ["dreamfolks", "priority"], confidence: "med", notes: "T1 mix changes with airline ops.", verify: "" },

  // ============ BENGALURU ============
  { id: "blr-t1-080", name: "080 Lounge", airport: "BLR", terminal: "T1", city: "Bengaluru", type: "airport", area: "domestic",
    programs: ["dreamfolks", "priority", "diners"], confidence: "med",
    notes: "Premium; often hits capacity.", verify: "Carry a backup card — frequently full." },
  { id: "blr-t2-dom", name: "T2 Domestic Lounge", airport: "BLR", terminal: "T2", city: "Bengaluru", type: "airport", area: "domestic",
    programs: ["dreamfolks", "priority", "visa", "mastercard"], confidence: "high", notes: "Newer terminal.", verify: "" },

  // ============ CHENNAI / KOLKATA ============
  { id: "maa-t1-travelclub", name: "Travel Club Lounge", airport: "MAA", terminal: "T1", city: "Chennai", type: "airport", area: "domestic",
    programs: ["dreamfolks", "priority", "visa", "mastercard"], confidence: "med", notes: "", verify: "" },
  { id: "ccu-t2-tfs", name: "TFS Domestic Lounge", airport: "CCU", terminal: "T2", city: "Kolkata", type: "airport", area: "domestic",
    programs: ["dreamfolks", "priority"], confidence: "med", notes: "", verify: "" },

  // ============ TIER-2 + SOUTH (HYD traveller's common hops) ============
  { id: "vtz-vizag", name: "Visakhapatnam Domestic Lounge", airport: "VTZ", terminal: "Main", city: "Visakhapatnam", type: "airport", area: "domestic",
    programs: ["dreamfolks", "priority"], confidence: "low", notes: "", verify: "Confirm lounge is operating at VTZ." },
  { id: "tir-tirupati", name: "Tirupati Domestic Lounge", airport: "TIR", terminal: "Main", city: "Tirupati", type: "airport", area: "domestic",
    programs: ["dreamfolks"], confidence: "low", notes: "Small airport — lounge presence uncertain.", verify: "Verify before relying." },
  { id: "goi-mopa", name: "Manohar Intl (MOPA) Lounge", airport: "GOX", terminal: "Main", city: "Goa (Mopa)", type: "airport", area: "domestic",
    programs: ["dreamfolks", "priority"], confidence: "low", notes: "Newer airport, operator volatile.", verify: "" },
  { id: "goi-dabolim", name: "Dabolim Domestic Lounge", airport: "GOI", terminal: "Main", city: "Goa (Dabolim)", type: "airport", area: "domestic",
    programs: ["dreamfolks", "priority"], confidence: "low", notes: "", verify: "" },
  { id: "pnq-pune", name: "Pune Domestic Lounge", airport: "PNQ", terminal: "Main", city: "Pune", type: "airport", area: "domestic",
    programs: ["dreamfolks", "priority"], confidence: "med", notes: "", verify: "" },
  { id: "amd-shamiana", name: "Shamiana Lounge", airport: "AMD", terminal: "T1", city: "Ahmedabad", type: "airport", area: "domestic",
    programs: ["dreamfolks", "priority", "visa"], confidence: "med", notes: "", verify: "" },
  { id: "jai-jaipur", name: "Jaipur Domestic Lounge", airport: "JAI", terminal: "T2", city: "Jaipur", type: "airport", area: "domestic",
    programs: ["dreamfolks", "priority"], confidence: "med", notes: "", verify: "" },
  { id: "cok-cochin", name: "Cochin Domestic Lounge", airport: "COK", terminal: "T2", city: "Kochi", type: "airport", area: "domestic",
    programs: ["dreamfolks", "priority", "visa"], confidence: "med", notes: "", verify: "" },
  { id: "lko-lucknow", name: "Lucknow Domestic Lounge", airport: "LKO", terminal: "T3", city: "Lucknow", type: "airport", area: "domestic",
    programs: ["dreamfolks", "priority"], confidence: "low", notes: "", verify: "" },
  { id: "ixc-chandigarh", name: "Chandigarh Domestic Lounge", airport: "IXC", terminal: "Main", city: "Chandigarh", type: "airport", area: "domestic",
    programs: ["dreamfolks", "priority"], confidence: "low", notes: "", verify: "" },
  { id: "bbi-bhubaneswar", name: "Bhubaneswar Domestic Lounge", airport: "BBI", terminal: "T1", city: "Bhubaneswar", type: "airport", area: "domestic",
    programs: ["dreamfolks", "priority"], confidence: "low", notes: "", verify: "" },

  // ============ RAILWAY (access genuinely murky — low confidence by default) ============
  { id: "rail-ndls", name: "IRCTC Executive Lounge", station: "NDLS", city: "New Delhi", type: "railway", area: "domestic",
    programs: ["payperuse", "dreamfolks", "rupay"], confidence: "med",
    notes: "Most established railway lounge. Often pay-per-use; some bank/RuPay cards comp via DreamFolks.", verify: "Confirm card eligibility at the desk; rules vary by station operator." },
  { id: "rail-hwh", name: "IRCTC Executive Lounge", station: "HWH", city: "Howrah", type: "railway", area: "domestic",
    programs: ["payperuse", "dreamfolks", "rupay"], confidence: "low", notes: "", verify: "" },
  { id: "rail-csmt", name: "Executive Lounge", station: "CSMT", city: "Mumbai", type: "railway", area: "domestic",
    programs: ["payperuse", "dreamfolks", "rupay"], confidence: "low", notes: "", verify: "" },
  { id: "rail-sbc", name: "Bengaluru City Lounge", station: "SBC", city: "Bengaluru", type: "railway", area: "domestic",
    programs: ["payperuse", "dreamfolks", "rupay"], confidence: "low", notes: "", verify: "" },
  { id: "rail-mas", name: "Chennai Central Lounge", station: "MAS", city: "Chennai", type: "railway", area: "domestic",
    programs: ["payperuse", "dreamfolks", "rupay"], confidence: "low", notes: "", verify: "" },
  { id: "rail-adi", name: "Ahmedabad Executive Lounge", station: "ADI", city: "Ahmedabad", type: "railway", area: "domestic",
    programs: ["payperuse", "dreamfolks"], confidence: "low", notes: "", verify: "" },

  // ============================================================
  // ====  EXPANDED COVERAGE (2026-06-22) — tier-2/3 airports  ===
  // ============================================================
  // HONEST: these are airports/stations known to have (or have had) a lounge.
  // Operators + card-program access at smaller airports change often and are
  // single-source, so most are confidence "low". Verify before relying. Many
  // tier-2 lounges are DreamFolks/Priority Pass via bank cards or pay-per-use.

  // ---- North ----
  { id: "ixc-extra", name: "Chandigarh Lounge (intl wing)", airport: "IXC", terminal: "Intl", city: "Chandigarh", type: "airport", area: "domestic",
    programs: ["dreamfolks", "priority"], confidence: "low", notes: "", verify: "" },
  { id: "atq-amritsar", name: "Amritsar Domestic Lounge", airport: "ATQ", terminal: "Main", city: "Amritsar", type: "airport", area: "domestic",
    programs: ["dreamfolks", "priority"], confidence: "low", notes: "", verify: "Confirm operating." },
  { id: "sxr-srinagar", name: "Srinagar Domestic Lounge", airport: "SXR", terminal: "Main", city: "Srinagar", type: "airport", area: "domestic",
    programs: ["dreamfolks"], confidence: "low", notes: "Security-heavy airport; lounge access may be limited.", verify: "" },
  { id: "ded-dehradun", name: "Dehradun Domestic Lounge", airport: "DED", terminal: "Main", city: "Dehradun", type: "airport", area: "domestic",
    programs: ["dreamfolks"], confidence: "low", notes: "", verify: "" },
  { id: "vns-varanasi", name: "Varanasi Domestic Lounge", airport: "VNS", terminal: "Main", city: "Varanasi", type: "airport", area: "domestic",
    programs: ["dreamfolks", "priority"], confidence: "low", notes: "", verify: "" },

  // ---- West ----
  { id: "stv-surat", name: "Surat Domestic Lounge", airport: "STV", terminal: "Main", city: "Surat", type: "airport", area: "domestic",
    programs: ["dreamfolks"], confidence: "low", notes: "", verify: "" },
  { id: "udr-udaipur", name: "Udaipur Domestic Lounge", airport: "UDR", terminal: "Main", city: "Udaipur", type: "airport", area: "domestic",
    programs: ["dreamfolks", "priority"], confidence: "low", notes: "", verify: "" },
  { id: "idr-indore", name: "Indore Domestic Lounge", airport: "IDR", terminal: "Main", city: "Indore", type: "airport", area: "domestic",
    programs: ["dreamfolks", "priority"], confidence: "low", notes: "", verify: "" },
  { id: "nag-nagpur", name: "Nagpur Domestic Lounge", airport: "NAG", terminal: "Main", city: "Nagpur", type: "airport", area: "domestic",
    programs: ["dreamfolks", "priority"], confidence: "low", notes: "", verify: "" },
  { id: "bdq-vadodara", name: "Vadodara Domestic Lounge", airport: "BDQ", terminal: "Main", city: "Vadodara", type: "airport", area: "domestic",
    programs: ["dreamfolks"], confidence: "low", notes: "", verify: "" },
  { id: "raj-rajkot", name: "Rajkot (Hirasar) Lounge", airport: "HSR", terminal: "Main", city: "Rajkot", type: "airport", area: "domestic",
    programs: ["dreamfolks"], confidence: "low", notes: "New Hirasar airport.", verify: "" },

  // ---- South ----
  { id: "cjb-coimbatore", name: "Coimbatore Domestic Lounge", airport: "CJB", terminal: "Main", city: "Coimbatore", type: "airport", area: "domestic",
    programs: ["dreamfolks", "priority"], confidence: "low", notes: "", verify: "" },
  { id: "trv-trivandrum", name: "Trivandrum Domestic Lounge", airport: "TRV", terminal: "Domestic", city: "Thiruvananthapuram", type: "airport", area: "domestic",
    programs: ["dreamfolks", "priority"], confidence: "low", notes: "", verify: "" },
  { id: "ccj-calicut", name: "Calicut (Kozhikode) Lounge", airport: "CCJ", terminal: "Main", city: "Kozhikode", type: "airport", area: "domestic",
    programs: ["dreamfolks"], confidence: "low", notes: "", verify: "" },
  { id: "vga-vijayawada", name: "Vijayawada Domestic Lounge", airport: "VGA", terminal: "Main", city: "Vijayawada", type: "airport", area: "domestic",
    programs: ["dreamfolks"], confidence: "low", notes: "", verify: "" },
  { id: "ixm-madurai", name: "Madurai Domestic Lounge", airport: "IXM", terminal: "Main", city: "Madurai", type: "airport", area: "domestic",
    programs: ["dreamfolks"], confidence: "low", notes: "", verify: "" },
  { id: "ixe-mangalore", name: "Mangaluru Domestic Lounge", airport: "IXE", terminal: "Main", city: "Mangaluru", type: "airport", area: "domestic",
    programs: ["dreamfolks", "priority"], confidence: "low", notes: "Adani-operated.", verify: "" },
  { id: "trz-trichy", name: "Tiruchirappalli Lounge", airport: "TRZ", terminal: "Main", city: "Tiruchirappalli", type: "airport", area: "domestic",
    programs: ["dreamfolks"], confidence: "low", notes: "", verify: "" },
  { id: "hbx-hubli", name: "Hubballi Domestic Lounge", airport: "HBX", terminal: "Main", city: "Hubballi", type: "airport", area: "domestic",
    programs: ["dreamfolks"], confidence: "low", notes: "", verify: "Confirm operating." },

  // ---- East / Northeast ----
  { id: "pat-patna", name: "Patna Domestic Lounge", airport: "PAT", terminal: "Main", city: "Patna", type: "airport", area: "domestic",
    programs: ["dreamfolks", "priority"], confidence: "low", notes: "", verify: "" },
  { id: "rpr-raipur", name: "Raipur Domestic Lounge", airport: "RPR", terminal: "Main", city: "Raipur", type: "airport", area: "domestic",
    programs: ["dreamfolks"], confidence: "low", notes: "", verify: "" },
  { id: "ixr-ranchi", name: "Ranchi Domestic Lounge", airport: "IXR", terminal: "Main", city: "Ranchi", type: "airport", area: "domestic",
    programs: ["dreamfolks"], confidence: "low", notes: "", verify: "" },
  { id: "guw-guwahati", name: "Guwahati Domestic Lounge", airport: "GAU", terminal: "Main", city: "Guwahati", type: "airport", area: "domestic",
    programs: ["dreamfolks", "priority"], confidence: "low", notes: "Adani-operated.", verify: "" },
  { id: "ixb-bagdogra", name: "Bagdogra Domestic Lounge", airport: "IXB", terminal: "Main", city: "Bagdogra", type: "airport", area: "domestic",
    programs: ["dreamfolks"], confidence: "low", notes: "", verify: "" },
  { id: "imf-imphal", name: "Imphal Domestic Lounge", airport: "IMF", terminal: "Main", city: "Imphal", type: "airport", area: "domestic",
    programs: ["dreamfolks"], confidence: "low", notes: "", verify: "Confirm operating." },
  { id: "ixz-portblair", name: "Port Blair Domestic Lounge", airport: "IXZ", terminal: "Main", city: "Port Blair", type: "airport", area: "domestic",
    programs: ["dreamfolks"], confidence: "low", notes: "", verify: "Confirm operating." },
  { id: "bbi-extra", name: "Bhubaneswar Lounge (2nd)", airport: "BBI", terminal: "T2", city: "Bhubaneswar", type: "airport", area: "domestic",
    programs: ["dreamfolks", "priority"], confidence: "low", notes: "", verify: "" },

  // ============================================================
  // ====  EXPANDED RAILWAY LOUNGES (IRCTC executive lounges)  ===
  // ============================================================
  { id: "rail-sdah", name: "Sealdah Executive Lounge", station: "SDAH", city: "Kolkata", type: "railway", area: "domestic",
    programs: ["payperuse", "dreamfolks", "rupay"], confidence: "low", notes: "", verify: "" },
  { id: "rail-bsb", name: "Varanasi Executive Lounge", station: "BSB", city: "Varanasi", type: "railway", area: "domestic",
    programs: ["payperuse", "dreamfolks"], confidence: "low", notes: "", verify: "" },
  { id: "rail-agc", name: "Agra Cantt Executive Lounge", station: "AGC", city: "Agra", type: "railway", area: "domestic",
    programs: ["payperuse", "dreamfolks"], confidence: "low", notes: "", verify: "" },
  { id: "rail-jp", name: "Jaipur Executive Lounge", station: "JP", city: "Jaipur", type: "railway", area: "domestic",
    programs: ["payperuse", "dreamfolks", "rupay"], confidence: "low", notes: "", verify: "" },
  { id: "rail-cnb", name: "Kanpur Executive Lounge", station: "CNB", city: "Kanpur", type: "railway", area: "domestic",
    programs: ["payperuse", "dreamfolks"], confidence: "low", notes: "", verify: "" },
  { id: "rail-lko", name: "Lucknow Executive Lounge", station: "LKO", city: "Lucknow", type: "railway", area: "domestic",
    programs: ["payperuse", "dreamfolks"], confidence: "low", notes: "", verify: "" },
  { id: "rail-bpl", name: "Bhopal Executive Lounge", station: "BPL", city: "Bhopal", type: "railway", area: "domestic",
    programs: ["payperuse", "dreamfolks"], confidence: "low", notes: "", verify: "" },
  { id: "rail-bct", name: "Mumbai Central Executive Lounge", station: "BCT", city: "Mumbai", type: "railway", area: "domestic",
    programs: ["payperuse", "dreamfolks"], confidence: "low", notes: "", verify: "" },
  { id: "rail-pune", name: "Pune Executive Lounge", station: "PUNE", city: "Pune", type: "railway", area: "domestic",
    programs: ["payperuse", "dreamfolks"], confidence: "low", notes: "", verify: "" },
  { id: "rail-sc-extra", name: "Hyderabad Decan Lounge", station: "HYB", city: "Hyderabad", type: "railway", area: "domestic",
    programs: ["payperuse", "dreamfolks"], confidence: "low", notes: "", verify: "Confirm operating at HYB vs SC." },
  { id: "rail-bbs", name: "Bhubaneswar Executive Lounge", station: "BBS", city: "Bhubaneswar", type: "railway", area: "domestic",
    programs: ["payperuse", "dreamfolks"], confidence: "low", notes: "", verify: "" },
  { id: "rail-ndls-2", name: "New Delhi Lounge (Ajmeri Gate side)", station: "NDLS", city: "New Delhi", type: "railway", area: "domestic",
    programs: ["payperuse", "dreamfolks", "rupay"], confidence: "low", notes: "Second lounge, other side of NDLS.", verify: "" },

  // ====  AIRPORTS FROM PRIORITY PASS INDIA LIST (2026-06-22)  ====
  { id: "ixa-dom-lounge", name: "Domestic Lounge", airport: "IXA", terminal: "Domestic", city: "Agartala", type: "airport", area: "domestic",
    programs: ["dreamfolks","priority"], confidence: "med",
    notes: "Listed on Priority Pass India network; confirm operator + your card in the DreamFolks/Priority Pass app.", verify: "Priority Pass India lounge list (2026-06-22) — confirm operator name + card access before you fly." },
  { id: "ayj-dom-lounge", name: "Domestic Lounge", airport: "AYJ", terminal: "Domestic", city: "Ayodhya", type: "airport", area: "domestic",
    programs: ["dreamfolks","priority"], confidence: "med",
    notes: "Listed on Priority Pass India network; confirm operator + your card in the DreamFolks/Priority Pass app.", verify: "Priority Pass India lounge list (2026-06-22) — confirm operator name + card access before you fly." },
  { id: "bho-dom-lounge", name: "Domestic Lounge", airport: "BHO", terminal: "Domestic", city: "Bhopal", type: "airport", area: "domestic",
    programs: ["dreamfolks","priority"], confidence: "med",
    notes: "Listed on Priority Pass India network; confirm operator + your card in the DreamFolks/Priority Pass app.", verify: "Priority Pass India lounge list (2026-06-22) — confirm operator name + card access before you fly." },
  { id: "dib-dom-lounge", name: "Domestic Lounge", airport: "DIB", terminal: "Domestic", city: "Dibrugarh", type: "airport", area: "domestic",
    programs: ["dreamfolks","priority"], confidence: "med",
    notes: "Listed on Priority Pass India network; confirm operator + your card in the DreamFolks/Priority Pass app.", verify: "Priority Pass India lounge list (2026-06-22) — confirm operator name + card access before you fly." },
  { id: "gwl-dom-lounge", name: "Domestic Lounge", airport: "GWL", terminal: "Domestic", city: "Gwalior", type: "airport", area: "domestic",
    programs: ["dreamfolks","priority"], confidence: "med",
    notes: "Listed on Priority Pass India network; confirm operator + your card in the DreamFolks/Priority Pass app.", verify: "Priority Pass India lounge list (2026-06-22) — confirm operator name + card access before you fly." },
  { id: "ixj-dom-lounge", name: "Domestic Lounge", airport: "IXJ", terminal: "Domestic", city: "Jammu", type: "airport", area: "domestic",
    programs: ["dreamfolks","priority"], confidence: "med",
    notes: "Listed on Priority Pass India network; confirm operator + your card in the DreamFolks/Priority Pass app.", verify: "Priority Pass India lounge list (2026-06-22) — confirm operator name + card access before you fly." },
  { id: "cnn-dom-lounge", name: "Domestic Lounge", airport: "CNN", terminal: "Domestic", city: "Kannur", type: "airport", area: "domestic",
    programs: ["dreamfolks","priority"], confidence: "med",
    notes: "Listed on Priority Pass India network; confirm operator + your card in the DreamFolks/Priority Pass app.", verify: "Priority Pass India lounge list (2026-06-22) — confirm operator name + card access before you fly." },
  { id: "ixd-dom-lounge", name: "Domestic Lounge", airport: "IXD", terminal: "Domestic", city: "Prayagraj", type: "airport", area: "domestic",
    programs: ["dreamfolks","priority"], confidence: "med",
    notes: "Listed on Priority Pass India network; confirm operator + your card in the DreamFolks/Priority Pass app.", verify: "Priority Pass India lounge list (2026-06-22) — confirm operator name + card access before you fly." },
];
