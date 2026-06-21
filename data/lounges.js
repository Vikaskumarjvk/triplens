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
];
