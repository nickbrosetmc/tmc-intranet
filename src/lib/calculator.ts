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
  };
  seo: { enabled: boolean; pagesPerMonth: number; hoursPerPage: number; tier: Tier };
  ppc: { enabled: boolean; platform: "one" | "both"; hoursPerMonth: number; tier: Tier };
  web: { enabled: boolean; scope: "manage" | "build"; hoursPerMonth: number; tier: Tier };
  email: { enabled: boolean; campaignsPerMonth: number; hoursPerCampaign: number; tier: Tier };
  video: { enabled: boolean; hoursPerMonth: number; tier: Tier };
  custom: { enabled: boolean; description: string; hoursPerMonth: number; tier: Tier };
  softwareAllocation: number;
  targetMargin: number; // 0–100
}

export const DEFAULT_PACKAGE: PackageState = {
  clientName: "",
  social: {
    enabled: false,
    postsPerWeek: 3,
    minsPerPost: 45,
    strategyHours: 2,
    contentTier: "ft",
    strategyTier: "admin",
  },
  seo: { enabled: false, pagesPerMonth: 2, hoursPerPage: 2.5, tier: "admin" },
  ppc: { enabled: false, platform: "one", hoursPerMonth: 4, tier: "admin" },
  web: { enabled: false, scope: "manage", hoursPerMonth: 1, tier: "admin" },
  email: { enabled: false, campaignsPerMonth: 2, hoursPerCampaign: 2, tier: "ft" },
  video: { enabled: false, hoursPerMonth: 8, tier: "admin" },
  custom: { enabled: false, description: "", hoursPerMonth: 4, tier: "ft" },
  softwareAllocation: 167,
  targetMargin: 40,
};

export interface BreakdownLine {
  item: string;
  tier: string;
  hours: number | "—";
  cost: number;
}

export interface PackageResults {
  lines: BreakdownLine[];
  totalCost: number;
  totalHours: number;
  targetPrice: number;
  floorPrice: number;
  profit: number;
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
    });
    if (strategyHours > 0) {
      lines.push({
        item: "Social strategy",
        tier: tierLabel(strategyTier),
        hours: strategyHours,
        cost: Math.round(strategyHours * tierRate(s, strategyTier)),
      });
    }
    if (s.reviewTier !== "none" && s.reviewMins > 0) {
      const revHrs = round1((postsPerWeek * s.reviewMins / 60) * 4.33);
      lines.push({
        item: `Content review (${s.reviewMins} min/post)`,
        tier: tierLabel(s.reviewTier),
        hours: revHrs,
        cost: Math.round(revHrs * reviewRate),
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
    });
  }

  if (pkg.ppc.enabled) {
    const { hoursPerMonth, tier, platform } = pkg.ppc;
    lines.push({
      item: platform === "both" ? "PPC (Google + Meta)" : "PPC management",
      tier: tierLabel(tier),
      hours: hoursPerMonth,
      cost: Math.round(hoursPerMonth * tierRate(s, tier)),
    });
  }

  if (pkg.web.enabled) {
    const { hoursPerMonth, tier, scope } = pkg.web;
    lines.push({
      item: scope === "build" ? "Website (build + manage)" : "Website management",
      tier: tierLabel(tier),
      hours: hoursPerMonth,
      cost: Math.round(hoursPerMonth * tierRate(s, tier)),
    });
  }

  if (pkg.email.enabled) {
    const { campaignsPerMonth, hoursPerCampaign, tier } = pkg.email;
    const hours = round1(campaignsPerMonth * hoursPerCampaign);
    lines.push({
      item: `Email (${campaignsPerMonth} campaigns/mo)`,
      tier: tierLabel(tier),
      hours,
      cost: Math.round(hours * tierRate(s, tier)),
    });
  }

  if (pkg.video.enabled) {
    const { hoursPerMonth, tier } = pkg.video;
    lines.push({
      item: "Video production",
      tier: tierLabel(tier),
      hours: hoursPerMonth,
      cost: Math.round(hoursPerMonth * tierRate(s, tier)),
    });
  }

  if (pkg.custom.enabled) {
    const { hoursPerMonth, tier, description } = pkg.custom;
    lines.push({
      item: description || "Custom service",
      tier: tierLabel(tier),
      hours: hoursPerMonth,
      cost: Math.round(hoursPerMonth * tierRate(s, tier)),
    });
  }

  if (pkg.softwareAllocation > 0) {
    lines.push({
      item: "Software allocation",
      tier: "—",
      hours: "—",
      cost: Math.round(pkg.softwareAllocation),
    });
  }

  const totalCost = lines.reduce((sum, l) => sum + l.cost, 0);
  const totalHours = round1(
    lines.reduce((sum, l) => sum + (typeof l.hours === "number" ? l.hours : 0), 0),
  );
  const tm = pkg.targetMargin / 100;
  const floor = (s.marginFloor || 30) / 100;
  const targetPrice = totalCost > 0 ? Math.round(totalCost / (1 - tm)) : 0;
  const floorPrice = totalCost > 0 ? Math.round(totalCost / (1 - floor)) : 0;
  const profit = targetPrice - totalCost;

  let verdict: PackageResults["verdict"];
  let verdictText: string;
  if (totalCost === 0) {
    verdict = "empty";
    verdictText = "Toggle services above to build a package.";
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
