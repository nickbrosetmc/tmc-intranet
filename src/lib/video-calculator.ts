// Pure logic + types for the Video Production calculator.
// Ported from /Users/nickbrose/Desktop/2026 Business Growth/Pricing Calculators/
// TMC_Internal_Pricing_Calculator.html — keeps the same calculation model
// so internal pricing decisions don't shift between the standalone HTML and
// the portal version.
//
// Shared rates (admin/FT/PT/software) are pulled from /api/calculator/settings
// (same source the package calculator uses). Video-specific defaults live
// inline below — admins can override them per project on the form.

import type { CalculatorSettings } from "./calculator";

export interface VideoRates {
  // Shoot anchors
  halfDay: number;
  fullDay: number;
  extraDay: number;
  // Travel + per-diem
  travelPerMile: number;
  travelFreeMiles: number;
  perDiem: number;
  // Modifier unit prices
  rev: number;
  music: number;
  caption: number;
  // Short-form unit prices
  heroStd: number;
  heroCine: number;
  cutdown: number;
  eventRecap: number;
  droneReel: number;
  testimonial: number;
  // Short-form edit hours per unit
  hoursHeroStd: number;
  hoursHeroCine: number;
  hoursCutdown: number;
  hoursEventRecap: number;
  hoursDroneReel: number;
  hoursTestimonial: number;
  // Long-form
  feature: { base: number; perMin: number; baseMin: number; hoursBase: number; hoursPerMin: number };
  training: { base: number; perMin: number; baseMin: number; hoursBase: number; hoursPerMin: number };
  recording: { base: number; perMin: number; baseMin: number; hoursBase: number; hoursPerMin: number };
  episodicSeriesDiscount: number;
}

export const DEFAULT_VIDEO_RATES: VideoRates = {
  halfDay: 1800,
  fullDay: 2800,
  extraDay: 2500,
  travelPerMile: 0.65,
  travelFreeMiles: 30,
  perDiem: 185,
  rev: 150,
  music: 150,
  caption: 80,
  heroStd: 1400,
  heroCine: 2200,
  cutdown: 275,
  eventRecap: 1800,
  droneReel: 650,
  testimonial: 950,
  hoursHeroStd: 9,
  hoursHeroCine: 16,
  hoursCutdown: 1.75,
  hoursEventRecap: 12,
  hoursDroneReel: 4,
  hoursTestimonial: 6,
  feature: { base: 2200, perMin: 500, baseMin: 3, hoursBase: 12, hoursPerMin: 3 },
  training: { base: 1800, perMin: 250, baseMin: 5, hoursBase: 8, hoursPerMin: 1 },
  recording: { base: 750, perMin: 25, baseMin: 30, hoursBase: 5, hoursPerMin: 0.15 },
  episodicSeriesDiscount: 0.15,
};

export type Multiplier = number;

export interface VideoState {
  // Project rates (editable; default from settings + DEFAULT_VIDEO_RATES)
  rateAdmin: number;
  rateFT: number;
  ratePT: number;
  rateEditor: number;
  ratePhoto: number;
  softwareAlloc: number;
  targetMargin: number; // 0–100
  // Anchor overrides
  halfDayOverride: number;
  fullDayOverride: number;
  extraDayOverride: number;
  // Shoot
  halfDays: number;
  fullDays: number;
  halfHrs: number;
  fullHrs: number;
  // Crew add-ons
  ftDays: number;
  ptDays: number; ptFee: number;
  droneDays: number; droneFee: number;
  nanoDays: number; nanoFee: number;
  prompterDays: number; prompterFee: number;
  // Photography
  photoHalfDays: number; photoHalfFee: number;
  photoFullDays: number; photoFullFee: number;
  extraPhotoDays: number; extraPhotoFee: number;
  photoRush: boolean; photoRushFee: number;
  // Travel
  miles: number;
  milesFree: number;
  milesRate: number;
  perDiemNights: number;
  totalCrewOvernight: number;
  perDiemRate: number;
  // Short-form deliverables
  d_heroStd: number;
  d_heroCine: number;
  d_cutdown: number;
  d_eventRecap: number;
  d_droneReel: number;
  d_testimonial: number;
  // Per-deliverable fee waivers (short-form). When true, the deliverable's
  // fee is comped: full price stays in the subtotal, then a matching
  // discount line zeroes it so the client sees exactly what we gave them.
  waiveHeroStd: boolean;
  waiveHeroCine: boolean;
  waiveCutdown: boolean;
  waiveEventRecap: boolean;
  waiveDroneReel: boolean;
  waiveTestimonial: boolean;
  // Long-form deliverables
  d_featureQty: number; d_featureMin: number;
  d_trainingQty: number; d_trainingMin: number;
  d_recordingQty: number; d_recordingMin: number;
  // Modifiers
  extraRevs: number;
  musicCount: number;
  captionCount: number;
  clientName: string;
  customName: string;
  customAmt: number;
  // Custom discount — a named markdown the client sees on the quote.
  customDiscName: string;
  customDiscType: "flat" | "pct";
  customDiscValue: number; // dollars when flat, percent (0–100) when pct
  // Multipliers
  impact: Multiplier;
  risk: Multiplier;
  usage: Multiplier;
  rush: Multiplier;
  // Safety / discount toggles
  oopsBuffer: boolean;
  ccFee: boolean;
  estMult: boolean;
  roundInc: number;
  recurring: boolean;
}

export const DEFAULT_VIDEO_STATE: VideoState = {
  rateAdmin: 60,
  rateFT: 23,
  ratePT: 20,
  rateEditor: 60,
  ratePhoto: 50,
  softwareAlloc: 100,
  targetMargin: 60,
  halfDayOverride: DEFAULT_VIDEO_RATES.halfDay,
  fullDayOverride: DEFAULT_VIDEO_RATES.fullDay,
  extraDayOverride: DEFAULT_VIDEO_RATES.extraDay,
  halfDays: 1,
  fullDays: 0,
  halfHrs: 4,
  fullHrs: 8,
  ftDays: 0,
  ptDays: 0, ptFee: 1200,
  droneDays: 0, droneFee: 500,
  nanoDays: 0, nanoFee: 250,
  prompterDays: 0, prompterFee: 200,
  photoHalfDays: 0, photoHalfFee: 700,
  photoFullDays: 0, photoFullFee: 1200,
  extraPhotoDays: 0, extraPhotoFee: 800,
  photoRush: false, photoRushFee: 300,
  miles: 0,
  milesFree: 30,
  milesRate: 0.65,
  perDiemNights: 0,
  totalCrewOvernight: 0,
  perDiemRate: 185,
  d_heroStd: 0,
  d_heroCine: 0,
  d_cutdown: 0,
  d_eventRecap: 0,
  d_droneReel: 0,
  d_testimonial: 0,
  waiveHeroStd: false,
  waiveHeroCine: false,
  waiveCutdown: false,
  waiveEventRecap: false,
  waiveDroneReel: false,
  waiveTestimonial: false,
  d_featureQty: 0, d_featureMin: 8,
  d_trainingQty: 0, d_trainingMin: 15,
  d_recordingQty: 0, d_recordingMin: 60,
  extraRevs: 0,
  musicCount: 0,
  captionCount: 0,
  clientName: "",
  customName: "",
  customAmt: 0,
  customDiscName: "",
  customDiscType: "flat",
  customDiscValue: 0,
  impact: 1.1,
  risk: 1.1,
  usage: 1.0,
  rush: 1.0,
  oopsBuffer: true,
  ccFee: false,
  estMult: true,
  roundInc: 50,
  recurring: false,
};

/** Apply the team's shared rates from settings to a video state object. */
export function applySharedRates(
  state: VideoState,
  s: CalculatorSettings,
): VideoState {
  return {
    ...state,
    rateAdmin: s.rateAdmin,
    rateFT: s.rateFt,
    ratePT: s.ratePt,
    softwareAlloc:
      s.clientCount > 0
        ? Math.round(s.softwareTotal / s.clientCount / 12) // rough per-project alloc; user can tweak
        : state.softwareAlloc,
  };
}

export type Line = [string, number];

export interface VideoResult {
  // Lines for breakdown sections
  shootLines: Line[];
  editLines: Line[];
  modLines: Line[];
  multLines: { label: string; mult: number; before: number; after: number }[];
  safetyLines: Line[];
  discountLines: Line[];
  // Subtotals
  baseSubtotal: number;
  adjustedSubtotal: number;
  withSafety: number;
  /** Client-facing price BEFORE any discount (the "standard rate"). */
  standardRounded: number;
  /** Sum of every discount applied (positive number). */
  discountTotal: number;
  grandRounded: number;
  rangeLow: number;
  rangeHigh: number;
  // COGS
  adminLabor: number;
  ftLabor: number;
  editorLabor: number;
  photoLabor: number;
  ptLabor: number;
  droneIns: number;
  travelReimb: number;
  swAlloc: number;
  cogs: number;
  gross: number;
  margin: number;
  markup: number;
  // Hours
  totalShootHours: number;
  editHours: number;       // raw
  edHoursAdj: number;      // ×1.5 if estMult
  adminHrs: number;
  ftHrs: number;
  editorHrs: number;
  photoShootHrs: number;
  ptShootHrs: number;
  projectHours: number;
  // Floor
  projectFloor: number;
  floorOk: boolean;
  refHalfFloor: number;
  refFullFloor: number;
  // Tier prices
  tierEss: number;
  tierSig: number;
  tierPrem: number;
  // Per-row computed values for short-form / long-form line items
  perDeliverable: {
    heroStd: number; heroCine: number; cutdown: number; eventRecap: number;
    droneReel: number; testimonial: number;
    featureUnit: number; featureTotal: number;
    trainingUnit: number; trainingTotal: number;
    recordingUnit: number; recordingTotal: number;
  };
  // Status flags
  bundleDisc: number;
  seriesDisc: number;
  seriesActive: string[];
  bundleNeed: number;
}

function fmtN(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function roundFinal(n: number, inc: number): number {
  if (!inc) return n;
  return Math.round(n / inc) * inc;
}

function roundFriendly(n: number): number {
  if (n < 1000) return Math.round(n / 50) * 50;
  if (n < 5000) return Math.round(n / 100) * 100;
  if (n < 20000) return Math.round(n / 250) * 250;
  return Math.round(n / 500) * 500;
}

export function computeVideo(s: VideoState): VideoResult {
  const r = { ...DEFAULT_VIDEO_RATES };
  r.halfDay = s.halfDayOverride || DEFAULT_VIDEO_RATES.halfDay;
  r.fullDay = s.fullDayOverride || DEFAULT_VIDEO_RATES.fullDay;
  r.extraDay = s.extraDayOverride || DEFAULT_VIDEO_RATES.extraDay;

  // ---- Shoot ----
  let shootBase = 0;
  const shootLines: Line[] = [];
  if (s.halfDays > 0) {
    const x = s.halfDays * r.halfDay;
    shootBase += x;
    shootLines.push([`Half-day shoots × ${fmtN(s.halfDays)} @ $${r.halfDay}/day`, x]);
  }
  if (s.fullDays > 0) {
    const x = s.fullDays * r.fullDay;
    shootBase += x;
    shootLines.push([`Full-day shoots × ${fmtN(s.fullDays)} @ $${r.fullDay}/day`, x]);
  }

  // Add-ons
  let addons = 0;
  function addonLine(name: string, days: number, fee: number): void {
    if (days > 0 && fee > 0) {
      const x = days * fee;
      addons += x;
      shootLines.push([`${name} × ${fmtN(days)} day${days !== 1 ? "s" : ""} @ $${fee}/day`, x]);
    }
  }
  addonLine("Part-time help", s.ptDays, s.ptFee);
  addonLine("Drone (Air 3s)", s.droneDays, s.droneFee);
  addonLine("Nano POV", s.nanoDays, s.nanoFee);
  addonLine("Teleprompter", s.prompterDays, s.prompterFee);
  addonLine("Photography (half-day)", s.photoHalfDays, s.photoHalfFee);
  addonLine("Photography (full-day)", s.photoFullDays, s.photoFullFee);
  addonLine("Additional photographer", s.extraPhotoDays, s.extraPhotoFee);
  if (s.photoRush && s.photoRushFee > 0) {
    addons += s.photoRushFee;
    shootLines.push(["Photo rush delivery", s.photoRushFee]);
  }

  // Travel
  let travelTotal = 0;
  const billableMiles = Math.max(0, s.miles - s.milesFree);
  if (s.miles > 0) {
    if (billableMiles > 0) {
      const x = billableMiles * s.milesRate;
      travelTotal += x;
      shootLines.push([
        `Travel: ${s.miles} mi total · ${s.milesFree} mi included free · ${billableMiles} billable × $${s.milesRate.toFixed(2)}`,
        x,
      ]);
    } else {
      shootLines.push([`Travel: ${s.miles} mi (within ${s.milesFree} mi free zone)`, 0]);
    }
  }
  if (s.perDiemNights > 0 && s.totalCrewOvernight > 0 && s.perDiemRate > 0) {
    const x = s.perDiemNights * s.totalCrewOvernight * s.perDiemRate;
    travelTotal += x;
    shootLines.push([
      `Per-diem: ${s.perDiemNights} night${s.perDiemNights > 1 ? "s" : ""} × ${s.totalCrewOvernight} crew × $${s.perDiemRate}`,
      x,
    ]);
  }

  const shootSubtotal = shootBase + addons + travelTotal;

  // ---- Edit (short-form) ----
  const editLines: Line[] = [];
  let editSubtotal = 0;
  let editHours = 0;

  function addEdit(label: string, qty: number, unit: number, hrPer: number): number {
    if (qty > 0) {
      const x = qty * unit;
      editSubtotal += x;
      editHours += qty * hrPer;
      editLines.push([`${label} × ${qty}`, x]);
      return x;
    }
    return 0;
  }
  const heroStdTotal = addEdit("Hero — Standard", s.d_heroStd, r.heroStd, r.hoursHeroStd);
  const heroCineTotal = addEdit("Hero — Cinematic", s.d_heroCine, r.heroCine, r.hoursHeroCine);
  const cutdownTotal = addEdit("Social cutdown", s.d_cutdown, r.cutdown, r.hoursCutdown);
  const eventRecapTotal = addEdit("Event recap", s.d_eventRecap, r.eventRecap, r.hoursEventRecap);
  const droneReelTotal = addEdit("Drone reel", s.d_droneReel, r.droneReel, r.hoursDroneReel);
  const testimonialTotal = addEdit("Interview testimonial", s.d_testimonial, r.testimonial, r.hoursTestimonial);

  // ---- Long-form ----
  function addLongForm(
    label: string,
    qty: number,
    mins: number,
    conf: VideoRates["feature"],
  ): { unit: number; total: number; qty: number } {
    if (qty <= 0) return { unit: 0, total: 0, qty: 0 };
    const overMin = Math.max(0, mins - conf.baseMin);
    const unitPrice = conf.base + overMin * conf.perMin;
    const unitHours = conf.hoursBase + overMin * conf.hoursPerMin;
    const total = qty * unitPrice;
    editSubtotal += total;
    editHours += qty * unitHours;
    editLines.push([`${label} × ${qty} (${mins} min each, $${Math.round(unitPrice).toLocaleString()}/ea)`, total]);
    return { unit: unitPrice, total, qty };
  }
  const feature = addLongForm("Long-form feature", s.d_featureQty, s.d_featureMin, r.feature);
  const training = addLongForm("Training module", s.d_trainingQty, s.d_trainingMin, r.training);
  const recording = addLongForm("Full-length recording", s.d_recordingQty, s.d_recordingMin, r.recording);

  // ---- Series + cutdown bundle discounts ----
  let seriesDisc = 0;
  const seriesActive: string[] = [];
  if (feature.qty >= 5) {
    seriesDisc += feature.total * r.episodicSeriesDiscount;
    seriesActive.push(`feature ×${feature.qty}`);
  }
  if (training.qty >= 5) {
    seriesDisc += training.total * r.episodicSeriesDiscount;
    seriesActive.push(`training ×${training.qty}`);
  }
  if (recording.qty >= 5) {
    seriesDisc += recording.total * r.episodicSeriesDiscount;
    seriesActive.push(`recording ×${recording.qty}`);
  }
  const bundleDisc = s.d_cutdown >= 5 ? s.d_cutdown * r.cutdown * 0.10 : 0;
  const bundleNeed = Math.max(0, 5 - s.d_cutdown);

  // Rush on edit
  const rushAmt = s.rush > 1 && editSubtotal > 0 ? editSubtotal * (s.rush - 1) : 0;
  const editWithRush = editSubtotal + rushAmt;

  // ---- Modifiers ----
  const modLines: Line[] = [];
  let modTotal = 0;
  if (s.extraRevs > 0) {
    const x = s.extraRevs * r.rev;
    modTotal += x;
    modLines.push([`Extra revisions × ${s.extraRevs}`, x]);
  }
  if (s.musicCount > 0) {
    const x = s.musicCount * r.music;
    modTotal += x;
    modLines.push([`Licensed music × ${s.musicCount}`, x]);
  }
  if (s.captionCount > 0) {
    const x = s.captionCount * r.caption;
    modTotal += x;
    modLines.push([`Captions × ${s.captionCount}`, x]);
  }
  if (s.customAmt > 0) {
    modTotal += s.customAmt;
    modLines.push([s.customName || "Custom", s.customAmt]);
  }

  // ---- Layer 2 base subtotal ----
  const baseSubtotal = shootSubtotal + editWithRush + modTotal;

  // ---- Layer 3 multipliers ----
  const multLines: VideoResult["multLines"] = [];
  let runningMult = baseSubtotal;
  const beforeImpact = runningMult;
  runningMult *= s.impact;
  multLines.push({ label: "Business impact", mult: s.impact, before: beforeImpact, after: runningMult });
  const beforeRisk = runningMult;
  runningMult *= s.risk;
  multLines.push({ label: "Risk reduction", mult: s.risk, before: beforeRisk, after: runningMult });
  const beforeUsage = runningMult;
  runningMult *= s.usage;
  multLines.push({ label: "Usage rights", mult: s.usage, before: beforeUsage, after: runningMult });
  const adjustedSubtotal = runningMult;

  // ---- Layer 4 safety ----
  const safetyLines: Line[] = [];
  let withSafety = adjustedSubtotal;
  if (s.oopsBuffer) {
    const x = withSafety * 0.05;
    safetyLines.push(["Oops buffer (5%)", x]);
    withSafety += x;
  }
  if (s.ccFee) {
    const x = withSafety * 0.03;
    safetyLines.push(["CC processing (3%)", x]);
    withSafety += x;
  }

  // ---- Waived deliverable fees ----
  // Each waived short-form deliverable keeps its full price in the subtotal
  // above, then gets zeroed here as a discount so the client sees the comp.
  const waiveMap: [boolean, string, number][] = [
    [s.waiveHeroStd, "Short brand video — Standard", heroStdTotal],
    [s.waiveHeroCine, "Short brand video — Cinematic", heroCineTotal],
    [s.waiveCutdown, "Social cutdown", cutdownTotal],
    [s.waiveEventRecap, "Event recap", eventRecapTotal],
    [s.waiveDroneReel, "Drone reel", droneReelTotal],
    [s.waiveTestimonial, "Interview testimonial", testimonialTotal],
  ];
  let waivedTotal = 0;
  const waivedLines: Line[] = [];
  for (const [waived, label, total] of waiveMap) {
    if (waived && total > 0) {
      waivedTotal += total;
      waivedLines.push([`${label} — waived`, -total]);
    }
  }

  // ---- Discounts ----
  const discountLines: Line[] = [];
  for (const wl of waivedLines) discountLines.push(wl);
  if (bundleDisc > 0) {
    discountLines.push(["Cutdown bundle (−10%)", -bundleDisc]);
  }
  if (seriesDisc > 0) {
    discountLines.push([
      `Long-form series (−15%)${seriesActive.length > 1 ? " multiple" : ""}`,
      -seriesDisc,
    ]);
  }
  let recurringDisc = 0;
  const subBeforeRec = withSafety - waivedTotal - bundleDisc - seriesDisc;
  if (s.recurring) {
    recurringDisc = subBeforeRec * 0.12;
    discountLines.push(["Recurring monthly (−12%)", -recurringDisc]);
  }
  const subBeforeCustom = subBeforeRec - recurringDisc;

  // Custom discount — flat dollars or a percent of the running subtotal.
  let customDisc = 0;
  if (s.customDiscValue > 0) {
    if (s.customDiscType === "pct") {
      const pct = Math.min(s.customDiscValue, 100);
      customDisc = subBeforeCustom * (pct / 100);
      discountLines.push([
        `${s.customDiscName || "Custom discount"} (−${fmtN(pct)}%)`,
        -customDisc,
      ]);
    } else {
      customDisc = Math.min(s.customDiscValue, subBeforeCustom);
      discountLines.push([s.customDiscName || "Custom discount", -customDisc]);
    }
  }

  const discountTotal =
    waivedTotal + bundleDisc + seriesDisc + recurringDisc + customDisc;
  const grand = subBeforeCustom - customDisc;
  const grandRounded = roundFinal(grand, s.roundInc);
  // The "standard" rate is the same basis without any discount.
  const standardRounded = roundFinal(withSafety, s.roundInc);

  // ---- COGS ----
  const totalShootHours = s.halfDays * s.halfHrs + s.fullDays * s.fullHrs;
  const projectMgmtHrs = totalShootHours > 0 || editHours > 0 ? 2 : 0;
  const adminHrs = totalShootHours + projectMgmtHrs;
  const ftHrs = s.ftDays * s.fullHrs;
  const ptShootHrs = s.ptDays * s.fullHrs;
  const photoShootHrs =
    s.photoHalfDays * s.halfHrs + s.photoFullDays * s.fullHrs + s.extraPhotoDays * s.fullHrs;
  const photoRetouchHrs = s.photoHalfDays * 2 + s.photoFullDays * 5;
  const totalPhotoHrs = photoShootHrs + photoRetouchHrs;
  const edHoursAdj = s.estMult ? editHours * 1.5 : editHours;

  const adminLabor = adminHrs * s.rateAdmin;
  const ftLabor = ftHrs * s.rateFT;
  const editorLabor = edHoursAdj * s.rateEditor;
  const photoLabor = totalPhotoHrs * s.ratePhoto;
  const ptLabor = ptShootHrs * s.ratePT;
  const droneIns = s.droneDays > 0 ? 25 * s.droneDays : 0;
  const travelReimb = billableMiles * 0.20;
  const swAlloc = totalShootHours > 0 || editHours > 0 ? s.softwareAlloc : 0;
  const cogs =
    adminLabor + ftLabor + editorLabor + photoLabor + ptLabor + droneIns + travelReimb + swAlloc;

  const gross = grandRounded - cogs;
  const margin = grandRounded > 0 ? (gross / grandRounded) * 100 : 0;
  const markup = cogs > 0 ? (grandRounded / cogs - 1) * 100 : 0;

  const targetMarginFraction = s.targetMargin / 100;
  const projectFloor =
    targetMarginFraction < 1 ? cogs / (1 - targetMarginFraction) : 0;
  const projectHours = adminHrs + ftHrs + edHoursAdj + photoShootHrs + ptShootHrs;
  const floorOk = grandRounded >= projectFloor && cogs > 0;

  function refFloor(shootHrs: number): number {
    const refAdmin = shootHrs + 2;
    const refEd = 9 * 1.5;
    const refCogs = refAdmin * s.rateAdmin + refEd * s.rateEditor + s.softwareAlloc;
    return targetMarginFraction < 1 ? refCogs / (1 - targetMarginFraction) : 0;
  }

  const rangeLow = roundFriendly(grandRounded * 0.92);
  const rangeHigh = roundFriendly(grandRounded * 1.08);

  return {
    shootLines,
    editLines,
    modLines,
    multLines,
    safetyLines,
    discountLines,
    baseSubtotal,
    adjustedSubtotal,
    withSafety,
    standardRounded,
    discountTotal,
    grandRounded,
    rangeLow,
    rangeHigh,
    adminLabor,
    ftLabor,
    editorLabor,
    photoLabor,
    ptLabor,
    droneIns,
    travelReimb,
    swAlloc,
    cogs,
    gross,
    margin,
    markup,
    totalShootHours,
    editHours,
    edHoursAdj,
    adminHrs,
    ftHrs,
    editorHrs: edHoursAdj,
    photoShootHrs,
    ptShootHrs,
    projectHours,
    projectFloor,
    floorOk,
    refHalfFloor: refFloor(6),
    refFullFloor: refFloor(9),
    tierEss: grandRounded > 0 ? roundFinal(grandRounded * 0.55, s.roundInc) : 0,
    tierSig: grandRounded,
    tierPrem: grandRounded > 0 ? roundFinal(grandRounded * 1.5, s.roundInc) : 0,
    perDeliverable: {
      heroStd: heroStdTotal,
      heroCine: heroCineTotal,
      cutdown: cutdownTotal,
      eventRecap: eventRecapTotal,
      droneReel: droneReelTotal,
      testimonial: testimonialTotal,
      featureUnit: feature.unit,
      featureTotal: feature.total,
      trainingUnit: training.unit,
      trainingTotal: training.total,
      recordingUnit: recording.unit,
      recordingTotal: recording.total,
    },
    bundleDisc,
    seriesDisc,
    seriesActive,
    bundleNeed,
  };
}

export function fmt$(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}
