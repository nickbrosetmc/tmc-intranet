// Types + math for the package pricing calculator. Pure functions; no React.

export interface CalculatorSettings {
  id: number;
  rateAdmin: number;
  rateFt: number;
  ratePt: number;
  reviewTier: Tier | "none";
  reviewMins: number;
  softwareTotal: number;
  clientCount: number;
  marginFloor: number;
  billableRate: number;
  rateDayHalf: number;
  rateDayFull: number;
  rateDayExtra: number;
  updatedBy: number | null;
  updatedAt: string;
}

export type Tier = "admin" | "ft" | "pt";

export const TIERS: { id: Tier; label: string }[] = [
  { id: "admin", label: "Admin" },
  { id: "ft", label: "Full-Time" },
  { id: "pt", label: "Part-Time" },
];

export function tierRate(s: CalculatorSettings, t: Tier): number {
  if (t === "admin") return s.rateAdmin;
  if (t === "ft") return s.rateFt;
  return s.ratePt;
}

export function tierLabel(t: Tier): string {
  return TIERS.find((x) => x.id === t)?.label ?? t;
}

export interface PackageState {
  clientName: string;
  social: {
    enabled: boolean;
    postsPerWeek: number;
    minsPerPost: number;
    strategyHours: number;
    contentTier: Tier;
    strategyTier: Tier;
    /** Include on-site filming/editing (uncheck for long-distance clients). */
    onSiteFilming: boolean;
  };
  seo: { enabled: boolean; pagesPerMonth: number; hoursPerPage: number; tier: Tier };
  ppc: { enabled: boolean; platform: "one" | "both"; hoursPerMonth: number; tier: Tier };
  /** Interim flat website model: one-time design (slider-discountable from
   *  $3,000 standard) + flat monthly management/hosting with up to 5
   *  changes per month. Not part of the margin engine. */
  web: { enabled: boolean; designPrice: number; monthlyFee: number };
  email: { enabled: boolean; campaignsPerMonth: number; hoursPerCampaign: number; tier: Tier };
  video: { enabled: boolean; hoursPerMonth: number; tier: Tier };
  custom: { enabled: boolean; description: string; hoursPerMonth: number; tier: Tier };
  softwareAllocation: number;
  targetMargin: number; // 0–100
  // Custom discount shown on the client quote.
  discountName: string;
  discountType: "flat" | "pct";
  discountValue: number; // dollars when flat, percent (0–100) when pct
}

export const WEBSITE_DESIGN_STANDARD = 3000;

export const DEFAULT_PACKAGE: PackageState = {
  clientName: "",
  social: {
    enabled: false,
    postsPerWeek: 3,
    minsPerPost: 45,
    strategyHours: 2,
    contentTier: "ft",
    strategyTier: "admin",
    onSiteFilming: true,
  },
  seo: { enabled: false, pagesPerMonth: 2, hoursPerPage: 2.5, tier: "admin" },
  ppc: { enabled: false, platform: "one", hoursPerMonth: 4, tier: "admin" },
  web: { enabled: false, designPrice: WEBSITE_DESIGN_STANDARD, monthlyFee: 150 },
  email: { enabled: false, campaignsPerMonth: 2, hoursPerCampaign: 2, tier: "ft" },
  video: { enabled: false, hoursPerMonth: 8, tier: "admin" },
  custom: { enabled: false, description: "", hoursPerMonth: 4, tier: "ft" },
  softwareAllocation: 167,
  targetMargin: 40,
  discountName: "",
  discountType: "flat",
  discountValue: 0,
};

// ─── Pre-made packages ───────────────────────────────────────────────────
// Starting points the team can apply then fine-tune. Numbers are sensible
// defaults; adjust the master definitions here as TMC's real packages firm
// up. Applying a preset preserves the current client name + any discount.

export interface PackagePreset {
  id: string;
  name: string;
  blurb: string;
  build: () => Pick<
    PackageState,
    | "social"
    | "seo"
    | "ppc"
    | "web"
    | "email"
    | "video"
    | "custom"
    | "targetMargin"
  >;
}

export const PACKAGE_PRESETS: PackagePreset[] = [
  {
    id: "social-starter",
    name: "Social Starter",
    blurb: "Social content + light strategy",
    build: () => ({
      ...servicesOff(),
      social: { enabled: true, postsPerWeek: 3, minsPerPost: 45, strategyHours: 2, contentTier: "ft", strategyTier: "admin", onSiteFilming: true },
      targetMargin: 45,
    }),
  },
  {
    id: "social-seo-growth",
    name: "Growth",
    blurb: "Social + SEO + email",
    build: () => ({
      ...servicesOff(),
      social: { enabled: true, postsPerWeek: 5, minsPerPost: 45, strategyHours: 3, contentTier: "ft", strategyTier: "admin", onSiteFilming: true },
      seo: { enabled: true, pagesPerMonth: 2, hoursPerPage: 2.5, tier: "admin" },
      email: { enabled: true, campaignsPerMonth: 2, hoursPerCampaign: 2, tier: "ft" },
      targetMargin: 45,
    }),
  },
  {
    id: "full-service",
    name: "Full-Service",
    blurb: "Social, SEO, PPC, email, web",
    build: () => ({
      ...servicesOff(),
      social: { enabled: true, postsPerWeek: 5, minsPerPost: 45, strategyHours: 4, contentTier: "ft", strategyTier: "admin", onSiteFilming: true },
      seo: { enabled: true, pagesPerMonth: 4, hoursPerPage: 2.5, tier: "admin" },
      ppc: { enabled: true, platform: "both", hoursPerMonth: 6, tier: "admin" },
      email: { enabled: true, campaignsPerMonth: 4, hoursPerCampaign: 2, tier: "ft" },
      web: { enabled: true, designPrice: 0, monthlyFee: 150 },
      targetMargin: 45,
    }),
  },
  {
    id: "video-retainer",
    name: "Video Retainer",
    blurb: "Monthly video production",
    build: () => ({
      ...servicesOff(),
      video: { enabled: true, hoursPerMonth: 12, tier: "admin" },
      targetMargin: 50,
    }),
  },
];

/** All services toggled off — the base every preset starts from. */
function servicesOff(): Pick<
  PackageState,
  "social" | "seo" | "ppc" | "web" | "email" | "video" | "custom" | "targetMargin"
> {
  return {
    social: { enabled: false, postsPerWeek: 3, minsPerPost: 45, strategyHours: 2, contentTier: "ft", strategyTier: "admin", onSiteFilming: true },
    seo: { enabled: false, pagesPerMonth: 2, hoursPerPage: 2.5, tier: "admin" },
    ppc: { enabled: false, platform: "one", hoursPerMonth: 4, tier: "admin" },
    web: { enabled: false, designPrice: WEBSITE_DESIGN_STANDARD, monthlyFee: 150 },
    email: { enabled: false, campaignsPerMonth: 2, hoursPerCampaign: 2, tier: "ft" },
    video: { enabled: false, hoursPerMonth: 8, tier: "admin" },
    custom: { enabled: false, description: "", hoursPerMonth: 4, tier: "ft" },
    targetMargin: 40,
  };
}

/** Service labels for the client-facing quote (enabled services only). */
export function enabledServiceLabels(pkg: PackageState): string[] {
  const out: string[] = [];
  if (pkg.social.enabled) out.push(`Social media management (${pkg.social.postsPerWeek} posts/week)`);
  if (pkg.seo.enabled) out.push(`Search engine optimization (${pkg.seo.pagesPerMonth} pages/month)`);
  if (pkg.ppc.enabled) out.push(pkg.ppc.platform === "both" ? "Paid ads management (Google + Meta)" : "Paid ads management");
  if (pkg.web.enabled) out.push("Website design, management & hosting");
  if (pkg.email.enabled) out.push(`Email marketing (${pkg.email.campaignsPerMonth} campaigns/month)`);
  if (pkg.video.enabled) out.push("Video production");
  if (pkg.custom.enabled) out.push(pkg.custom.description || "Custom service");
  return out;
}

/** Apply a custom discount to a monthly price; returns the post-discount price + the amount off. */
export function applyPackageDiscount(
  price: number,
  type: "flat" | "pct",
  value: number,
): { final: number; off: number } {
  if (value <= 0 || price <= 0) return { final: price, off: 0 };
  const off =
    type === "pct"
      ? Math.round(price * (Math.min(value, 100) / 100))
      : Math.min(Math.round(value), price);
  return { final: price - off, off };
}

export interface ProposalLine {
  label: string;
  amount: number;
  /** "What's included" bullets shown under the line on the proposal. */
  sublines: string[];
}

/**
 * Client-facing proposal lines: the monthly price allocated across visible
 * service groups (software overhead is folded in proportionally, never
 * shown as its own line), each with a "what's included" list. The flat
 * website management fee is appended as its own line when enabled.
 * `monthlyPrice` should be the cost-based monthly price EXCLUDING the
 * website monthly fee (i.e. results.targetPrice - results.websiteMonthly).
 */
export function proposalServiceLines(
  pkg: PackageState,
  results: PackageResults,
  monthlyPrice: number,
): ProposalLine[] {
  const HIDDEN = "Tools & software";
  const byService = new Map<string, number>();
  for (const l of results.lines) {
    if (l.service === HIDDEN) continue; // folded into the others
    byService.set(l.service, (byService.get(l.service) ?? 0) + l.cost);
  }
  const visibleCost = [...byService.values()].reduce((a, b) => a + b, 0);

  const out: ProposalLine[] = [];
  if (visibleCost > 0 && monthlyPrice > 0) {
    const entries = [...byService.entries()];
    let allocated = 0;
    entries.forEach(([label, cost], i) => {
      const amount =
        i === entries.length - 1
          ? monthlyPrice - allocated
          : Math.round((monthlyPrice * cost) / visibleCost);
      allocated += amount;
      out.push({ label, amount, sublines: sublinesFor(label, pkg) });
    });
  }

  if (pkg.web.enabled) {
    out.push({
      label: "Website management & hosting",
      amount: Math.round(pkg.web.monthlyFee),
      sublines: [
        "Hosting included",
        "Up to 5 content changes per month",
      ],
    });
  }
  return out;
}

function sublinesFor(service: string, pkg: PackageState): string[] {
  switch (service) {
    case "Social media management": {
      const perMonth = Math.round(pkg.social.postsPerWeek * 4.33);
      const lines = [
        `${pkg.social.postsPerWeek} posts per week (~${perMonth}/month)`,
      ];
      if (pkg.social.onSiteFilming) lines.push("On-site filming & editing");
      lines.push("Engagement management");
      lines.push(
        pkg.social.strategyHours > 0
          ? "Monthly reporting & strategy sessions"
          : "Monthly reporting",
      );
      return lines;
    }
    case "Search engine optimization":
      return [
        `${pkg.seo.pagesPerMonth} optimized pages / blog posts per month`,
        "Keyword & AI visibility tracking",
        "Monthly reporting",
      ];
    case "Paid advertising":
      return [
        pkg.ppc.platform === "both"
          ? "Google + Meta campaign management"
          : "Campaign management",
        "Optimization & monthly reporting",
      ];
    case "Email marketing":
      return [
        `${pkg.email.campaignsPerMonth} campaigns per month`,
        "Design, copy & delivery",
        "Performance reporting",
      ];
    case "Video production":
      return [`${pkg.video.hoursPerMonth} production hours per month`];
    default:
      return [];
  }
}

export interface BreakdownLine {
  item: string;
  tier: string;
  hours: number | "—";
  cost: number;
  /** Client-facing service group this line rolls up to (for quote breakdown). */
  service: string;
}

export interface PackageResults {
  lines: BreakdownLine[];
  totalCost: number;
  totalHours: number;
  /** Monthly price including the flat website monthly fee. */
  targetPrice: number;
  floorPrice: number;
  profit: number;
  /** Flat website monthly management/hosting fee (0 when disabled). */
  websiteMonthly: number;
  /** One-time website design price from the slider (0 when disabled). */
  websiteDesignPrice: number;
  verdict: "go" | "caution" | "stop" | "empty";
  verdictText: string;
}

export function computePackage(
  pkg: PackageState,
  s: CalculatorSettings,
): PackageResults {
  const lines: BreakdownLine[] = [];
  const reviewRate = s.reviewTier === "none" ? 0 : tierRate(s, s.reviewTier);

  if (pkg.social.enabled) {
    const { postsPerWeek, minsPerPost, strategyHours, contentTier, strategyTier } =
      pkg.social;
    const contentHrs = round1((postsPerWeek * minsPerPost / 60) * 4.33);
    lines.push({
      item: `Social content (${postsPerWeek} posts/wk)`,
      tier: tierLabel(contentTier),
      hours: contentHrs,
      cost: Math.round(contentHrs * tierRate(s, contentTier)),
      service: "Social media management",
    });
    if (strategyHours > 0) {
      lines.push({
        item: "Social strategy",
        tier: tierLabel(strategyTier),
        hours: strategyHours,
        cost: Math.round(strategyHours * tierRate(s, strategyTier)),
        service: "Social media management",
      });
    }
    if (s.reviewTier !== "none" && s.reviewMins > 0) {
      const revHrs = round1((postsPerWeek * s.reviewMins / 60) * 4.33);
      lines.push({
        item: `Content review (${s.reviewMins} min/post)`,
        tier: tierLabel(s.reviewTier),
        hours: revHrs,
        cost: Math.round(revHrs * reviewRate),
        service: "Social media management",
      });
    }
  }

  if (pkg.seo.enabled) {
    const { pagesPerMonth, hoursPerPage, tier } = pkg.seo;
    const hours = round1(pagesPerMonth * hoursPerPage);
    lines.push({
      item: `SEO (${pagesPerMonth} pages/mo)`,
      tier: tierLabel(tier),
      hours,
      cost: Math.round(hours * tierRate(s, tier)),
      service: "Search engine optimization",
    });
  }

  if (pkg.ppc.enabled) {
    const { hoursPerMonth, tier, platform } = pkg.ppc;
    lines.push({
      item: platform === "both" ? "PPC (Google + Meta)" : "PPC management",
      tier: tierLabel(tier),
      hours: hoursPerMonth,
      cost: Math.round(hoursPerMonth * tierRate(s, tier)),
      service: "Paid advertising",
    });
  }

  // Website is priced flat (design one-time + monthly fee), outside the
  // cost/margin engine — handled after the totals below.

  if (pkg.email.enabled) {
    const { campaignsPerMonth, hoursPerCampaign, tier } = pkg.email;
    const hours = round1(campaignsPerMonth * hoursPerCampaign);
    lines.push({
      item: `Email (${campaignsPerMonth} campaigns/mo)`,
      tier: tierLabel(tier),
      hours,
      cost: Math.round(hours * tierRate(s, tier)),
      service: "Email marketing",
    });
  }

  if (pkg.video.enabled) {
    const { hoursPerMonth, tier } = pkg.video;
    lines.push({
      item: "Video production",
      tier: tierLabel(tier),
      hours: hoursPerMonth,
      cost: Math.round(hoursPerMonth * tierRate(s, tier)),
      service: "Video production",
    });
  }

  if (pkg.custom.enabled) {
    const { hoursPerMonth, tier, description } = pkg.custom;
    lines.push({
      item: description || "Custom service",
      tier: tierLabel(tier),
      hours: hoursPerMonth,
      cost: Math.round(hoursPerMonth * tierRate(s, tier)),
      service: description || "Custom service",
    });
  }

  if (pkg.softwareAllocation > 0) {
    lines.push({
      item: "Software allocation",
      tier: "—",
      hours: "—",
      cost: Math.round(pkg.softwareAllocation),
      service: "Tools & software",
    });
  }

  const totalCost = lines.reduce((sum, l) => sum + l.cost, 0);
  const totalHours = round1(
    lines.reduce((sum, l) => sum + (typeof l.hours === "number" ? l.hours : 0), 0),
  );
  const tm = pkg.targetMargin / 100;
  const floor = (s.marginFloor || 30) / 100;

  // Flat website pricing sits outside the margin engine (interim model).
  const websiteMonthly = pkg.web.enabled ? Math.round(pkg.web.monthlyFee) : 0;
  const websiteDesignPrice = pkg.web.enabled
    ? Math.max(0, Math.round(pkg.web.designPrice))
    : 0;

  const marginPrice = totalCost > 0 ? Math.round(totalCost / (1 - tm)) : 0;
  const targetPrice = marginPrice + websiteMonthly;
  const floorPrice =
    (totalCost > 0 ? Math.round(totalCost / (1 - floor)) : 0) + websiteMonthly;
  const profit = targetPrice - totalCost;

  let verdict: PackageResults["verdict"];
  let verdictText: string;
  if (totalCost === 0 && websiteMonthly === 0) {
    verdict = "empty";
    verdictText = "Toggle services above to build a package.";
  } else if (totalCost === 0) {
    verdict = "go";
    verdictText = `Flat website pricing. Quote at $${targetPrice.toLocaleString()}/mo${websiteDesignPrice > 0 ? ` + $${websiteDesignPrice.toLocaleString()} one-time design` : ""}.`;
  } else if (tm >= 0.4) {
    verdict = "go";
    verdictText = `Healthy margin. Quote this package at $${targetPrice.toLocaleString()}/mo.`;
  } else if (pkg.targetMargin >= s.marginFloor) {
    verdict = "caution";
    verdictText = `Viable but thin. Confirm strategic value before quoting at $${targetPrice.toLocaleString()}/mo.`;
  } else {
    verdict = "stop";
    verdictText = `Below ${s.marginFloor}% floor. Don't quote without a compelling strategic reason.`;
  }

  return {
    lines,
    totalCost,
    totalHours,
    targetPrice,
    floorPrice,
    profit,
    websiteMonthly,
    websiteDesignPrice,
    verdict,
    verdictText,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// API wrappers

export async function fetchSettings(): Promise<CalculatorSettings> {
  const res = await fetch("/api/calculator/settings", {
    credentials: "same-origin",
  });
  if (!res.ok) throw new Error(`/api/calculator/settings ${res.status}`);
  return (await res.json()) as CalculatorSettings;
}

export async function patchSettings(
  updates: Partial<CalculatorSettings>,
): Promise<CalculatorSettings> {
  const res = await fetch("/api/admin/calculator/settings", {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    let msg = `${res.status}`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return (await res.json()) as CalculatorSettings;
}
