import { useEffect, useMemo, useState } from "react";
import { Settings as Gear, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";
import { useUser } from "@/lib/useUser";
import {
  applyPackageDiscount,
  computePackage,
  customManualMonthly,
  DEFAULT_PACKAGE,
  fetchSettings,
  optionDetail,
  optionMonthly,
  PACKAGE_PRESETS,
  patchSettings,
  proposalServiceLines,
  TIERS,
  WEBSITE_DESIGN_STANDARD,
  type CalculatorSettings,
  type PackageState,
  type ProposalOption,
  type Tier,
} from "@/lib/calculator";
import { downloadQuotePdf, type QuoteDiscount } from "@/lib/quote-pdf";

const PKG_STORAGE_KEY = "tmc.calculator.package.v1";

function loadPackage(): PackageState {
  try {
    const raw = localStorage.getItem(PKG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PackageState>;
      // Deep-merge each service so states saved before a shape change
      // (e.g. the flat website model) pick up new fields from defaults.
      return {
        ...DEFAULT_PACKAGE,
        ...parsed,
        social: { ...DEFAULT_PACKAGE.social, ...(parsed.social ?? {}) },
        seo: { ...DEFAULT_PACKAGE.seo, ...(parsed.seo ?? {}) },
        ppc: { ...DEFAULT_PACKAGE.ppc, ...(parsed.ppc ?? {}) },
        web: { ...DEFAULT_PACKAGE.web, ...(parsed.web ?? {}) },
        email: { ...DEFAULT_PACKAGE.email, ...(parsed.email ?? {}) },
        video: { ...DEFAULT_PACKAGE.video, ...(parsed.video ?? {}) },
        custom: { ...DEFAULT_PACKAGE.custom, ...(parsed.custom ?? {}) },
        options: parsed.options ?? [],
      };
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_PACKAGE;
}

export function CalculatorPage() {
  const userState = useUser();
  const [settings, setSettings] = useState<CalculatorSettings | null>(null);
  const [pkg, setPkg] = useState<PackageState>(loadPackage);
  const [adminOpen, setAdminOpen] = useState(false);

  // Persist inputs across reloads until the user hits Reset.
  useEffect(() => {
    try {
      localStorage.setItem(PKG_STORAGE_KEY, JSON.stringify(pkg));
    } catch {
      /* ignore */
    }
  }, [pkg]);

  function resetPackage() {
    try {
      localStorage.removeItem(PKG_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setPkg({
      ...DEFAULT_PACKAGE,
      softwareAllocation:
        settings && settings.clientCount > 0
          ? Math.round(settings.softwareTotal / settings.clientCount)
          : DEFAULT_PACKAGE.softwareAllocation,
    });
    toast.success("Calculator reset");
  }

  // Load settings on mount, but only once we know the user is authenticated.
  useEffect(() => {
    if (userState.status !== "authenticated") return;
    fetchSettings()
      .then((s) => {
        setSettings(s);
        // Sync derived software allocation
        setPkg((p) => ({
          ...p,
          softwareAllocation:
            s.clientCount > 0 ? Math.round(s.softwareTotal / s.clientCount) : 0,
        }));
      })
      .catch((e: Error) => toast.error(`Failed to load settings: ${e.message}`));
  }, [userState.status]);

  const isAdmin =
    userState.status === "authenticated" &&
    userState.user.type === "team" &&
    userState.user.role === "admin";

  const isClient =
    userState.status === "authenticated" && userState.user.type === "client";

  const results = useMemo(
    () => (settings ? computePackage(pkg, settings) : null),
    [pkg, settings],
  );

  if (userState.status === "loading") {
    return (
      <div className="text-muted-foreground text-sm">Loading…</div>
    );
  }
  if (userState.status === "anonymous") {
    return (
      <div className="text-center max-w-md mx-auto space-y-3">
        <h1 className="text-xl font-semibold">Sign in required</h1>
        <a href="/auth/login" className="text-tmc-gold-dark hover:underline">
          Sign in →
        </a>
      </div>
    );
  }

  if (isClient) {
    return (
      <div className="text-center max-w-md mx-auto space-y-3">
        <h1 className="text-xl font-semibold text-tmc-dark">Team only</h1>
        <p className="text-sm text-muted-foreground">
          The pricing calculator is for the TMC team.
        </p>
      </div>
    );
  }

  if (!settings || !results) {
    return <div className="text-muted-foreground text-sm">Loading calculator…</div>;
  }

  return (
    <div className="w-full max-w-4xl space-y-6">
      <header className="flex items-start justify-between border-b border-tmc-gold/40 pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-tmc-dark">
            Package Pricing Calculator{" "}
            <span className="ml-2 inline-block text-[10px] uppercase tracking-widest font-semibold bg-tmc-dark text-tmc-gold px-2 py-0.5 rounded">
              Internal
            </span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Build packages, validate margins, generate quotes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={resetPackage}>
            Reset
          </Button>
          {isAdmin && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setAdminOpen(true)}
              title="Calculator settings"
            >
              <Gear size={18} />
            </Button>
          )}
        </div>
      </header>

      <BuildPackagePanel pkg={pkg} setPkg={setPkg} settings={settings} />
      <ResultsPanel pkg={pkg} setPkg={setPkg} results={results} settings={settings} />

      {isAdmin && (
        <AdminSettingsDialog
          open={adminOpen}
          onOpenChange={setAdminOpen}
          settings={settings}
          onSaved={(s) => {
            setSettings(s);
            setPkg((p) => ({
              ...p,
              softwareAllocation:
                s.clientCount > 0 ? Math.round(s.softwareTotal / s.clientCount) : 0,
            }));
            toast.success("Settings saved");
          }}
        />
      )}

      <Toaster />
    </div>
  );
}

// ─── Build package panel ─────────────────────────────────────────────────

function BuildPackagePanel({
  pkg,
  setPkg,
  settings,
}: {
  pkg: PackageState;
  setPkg: React.Dispatch<React.SetStateAction<PackageState>>;
  settings: CalculatorSettings;
}) {
  const reviewRate =
    settings.reviewTier === "none"
      ? 0
      : settings.reviewTier === "admin"
        ? settings.rateAdmin
        : settings.reviewTier === "ft"
          ? settings.rateFt
          : settings.ratePt;

  return (
    <div className="rounded-lg border bg-card p-5 space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-tmc-slate flex items-center gap-2">
        <span className="bg-tmc-gold text-tmc-dark text-xs w-7 h-7 rounded inline-flex items-center justify-center">+</span>
        Build Package
      </h2>

      <div className="flex flex-col sm:flex-row gap-3 pb-3 border-b">
        <div className="flex items-center gap-3 flex-1">
          <Label className="whitespace-nowrap">Client / Prospect:</Label>
          <Input
            value={pkg.clientName}
            onChange={(e) => setPkg((p) => ({ ...p, clientName: e.target.value }))}
            placeholder="Enter client name for this quote…"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label className="whitespace-nowrap text-muted-foreground">Start from:</Label>
          <Select
            value="__none__"
            onValueChange={(id) => {
              const preset = PACKAGE_PRESETS.find((p) => p.id === id);
              if (!preset) return;
              setPkg((p) => ({ ...p, ...preset.build() }));
              toast.success(`Applied "${preset.name}" package`);
            }}
          >
            <SelectTrigger className="w-48 h-9">
              <SelectValue placeholder="Pre-made package…" />
            </SelectTrigger>
            <SelectContent>
              {PACKAGE_PRESETS.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} — {p.blurb}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <ServiceSocial pkg={pkg} setPkg={setPkg} reviewRate={reviewRate} settings={settings} />
      <ServiceSeo pkg={pkg} setPkg={setPkg} settings={settings} />
      <ServicePpc pkg={pkg} setPkg={setPkg} settings={settings} />
      <ServiceWeb pkg={pkg} setPkg={setPkg} settings={settings} />
      <ServiceEmail pkg={pkg} setPkg={setPkg} settings={settings} />
      <ServiceVideo pkg={pkg} setPkg={setPkg} settings={settings} />
      <ServiceCustom pkg={pkg} setPkg={setPkg} settings={settings} />

      <div className="flex flex-wrap items-center gap-3 bg-muted rounded-md p-3 text-sm">
        <Label className="whitespace-nowrap">Software allocation per client: $</Label>
        <Input
          type="number"
          className="w-24"
          value={pkg.softwareAllocation}
          onChange={(e) =>
            setPkg((p) => ({ ...p, softwareAllocation: Number(e.target.value) || 0 }))
          }
        />
        <span className="text-xs text-muted-foreground">
          (auto-calculated from admin settings)
        </span>
      </div>
    </div>
  );
}

interface SvcRowProps {
  enabled: boolean;
  onToggle: (v: boolean) => void;
  title: string;
  description: string;
  cost: number;
  children: React.ReactNode;
}

function ServiceRow({ enabled, onToggle, title, description, cost, children }: SvcRowProps) {
  return (
    <div className="border-b last:border-b-0 pb-4 last:pb-0">
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4 py-2">
        <Toggle checked={enabled} onChange={onToggle} />
        <div>
          <h3 className="font-semibold text-sm">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="font-bold text-tmc-dark text-right min-w-20">
          ${cost.toLocaleString()}
        </div>
      </div>
      {enabled && <div className="pl-12 pt-2 space-y-3">{children}</div>}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="relative inline-block w-11 h-6 cursor-pointer flex-shrink-0">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="opacity-0 w-0 h-0 peer"
      />
      <span
        className={`absolute inset-0 rounded-full transition ${checked ? "bg-tmc-gold-dark" : "bg-muted-foreground/40"}`}
      />
      <span
        className={`absolute top-[3px] left-[3px] h-[18px] w-[18px] bg-white rounded-full transition-transform ${checked ? "translate-x-[20px]" : ""}`}
      />
    </label>
  );
}

function RangeRow({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  formatValue,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  formatValue?: (v: number) => string;
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Label className="text-sm text-muted-foreground min-w-40">{label}</Label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 min-w-44 accent-tmc-gold-dark"
      />
      <span className="font-semibold text-sm min-w-10 text-center">
        {formatValue ? formatValue(value) : value}
      </span>
    </div>
  );
}

function TierSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Tier;
  onChange: (v: Tier) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <Label className="text-sm text-muted-foreground min-w-40">{label}</Label>
      <Select value={value} onValueChange={(v) => onChange(v as Tier)}>
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TIERS.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ─── Service rows ─────────────────────────────────────────────────────────

function ServiceSocial({
  pkg,
  setPkg,
  reviewRate,
  settings,
}: {
  pkg: PackageState;
  setPkg: React.Dispatch<React.SetStateAction<PackageState>>;
  reviewRate: number;
  settings: CalculatorSettings;
}) {
  const s = pkg.social;
  const rate = (t: Tier) => (t === "admin" ? settings.rateAdmin : t === "ft" ? settings.rateFt : settings.ratePt);
  const contentHrs = Math.round(((s.postsPerWeek * s.minsPerPost) / 60) * 4.33 * 10) / 10;
  const reviewHrs =
    settings.reviewTier !== "none"
      ? Math.round(((s.postsPerWeek * settings.reviewMins) / 60) * 4.33 * 10) / 10
      : 0;
  const cost = s.enabled
    ? Math.round(contentHrs * rate(s.contentTier)) +
      (s.strategyHours > 0 ? Math.round(s.strategyHours * rate(s.strategyTier)) : 0) +
      (settings.reviewTier !== "none" ? Math.round(reviewHrs * reviewRate) : 0)
    : 0;

  return (
    <ServiceRow
      enabled={s.enabled}
      onToggle={(v) => setPkg((p) => ({ ...p, social: { ...p.social, enabled: v } }))}
      title="Social Media Management"
      description="Content creation, scheduling, approvals"
      cost={cost}
    >
      <RangeRow
        label="Posts per week:"
        value={s.postsPerWeek}
        min={1}
        max={7}
        onChange={(v) => setPkg((p) => ({ ...p, social: { ...p.social, postsPerWeek: v } }))}
      />
      <RangeRow
        label="Minutes per post:"
        value={s.minsPerPost}
        min={15}
        max={90}
        step={5}
        onChange={(v) => setPkg((p) => ({ ...p, social: { ...p.social, minsPerPost: v } }))}
      />
      <RangeRow
        label="Strategy hrs/month:"
        value={s.strategyHours}
        min={0}
        max={8}
        step={0.5}
        onChange={(v) => setPkg((p) => ({ ...p, social: { ...p.social, strategyHours: v } }))}
      />
      <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
        <input
          type="checkbox"
          checked={s.onSiteFilming}
          onChange={(e) =>
            setPkg((p) => ({ ...p, social: { ...p.social, onSiteFilming: e.target.checked } }))
          }
          className="accent-tmc-gold-dark w-4 h-4"
        />
        <span>
          Include on-site filming & editing
          <span className="text-muted-foreground text-xs"> (uncheck for long-distance clients)</span>
        </span>
      </label>
      <TierSelect
        label="Content created by:"
        value={s.contentTier}
        onChange={(v) => setPkg((p) => ({ ...p, social: { ...p.social, contentTier: v } }))}
      />
      <TierSelect
        label="Strategy handled by:"
        value={s.strategyTier}
        onChange={(v) => setPkg((p) => ({ ...p, social: { ...p.social, strategyTier: v } }))}
      />
      <p className="text-xs text-muted-foreground bg-muted rounded p-2">
        {settings.reviewTier !== "none"
          ? `Review: ${settings.reviewTier.toUpperCase()} tier at ${settings.reviewMins} min/post ($${reviewRate}/hr). Change in admin settings.`
          : "No reviewer configured. Set one in admin settings to include review costs."}
      </p>
    </ServiceRow>
  );
}

function ServiceSeo({
  pkg,
  setPkg,
  settings,
}: {
  pkg: PackageState;
  setPkg: React.Dispatch<React.SetStateAction<PackageState>>;
  settings: CalculatorSettings;
}) {
  const s = pkg.seo;
  const rate = s.tier === "admin" ? settings.rateAdmin : s.tier === "ft" ? settings.rateFt : settings.ratePt;
  const cost = s.enabled ? Math.round(s.pagesPerMonth * s.hoursPerPage * rate) : 0;
  return (
    <ServiceRow
      enabled={s.enabled}
      onToggle={(v) => setPkg((p) => ({ ...p, seo: { ...p.seo, enabled: v } }))}
      title="SEO"
      description="Page creation, optimization, reporting"
      cost={cost}
    >
      <RangeRow label="Pages per month:" value={s.pagesPerMonth} min={1} max={8}
        onChange={(v) => setPkg((p) => ({ ...p, seo: { ...p.seo, pagesPerMonth: v } }))} />
      <RangeRow label="Hours per page:" value={s.hoursPerPage} min={1} max={6} step={0.5}
        onChange={(v) => setPkg((p) => ({ ...p, seo: { ...p.seo, hoursPerPage: v } }))} />
      <TierSelect label="Performed by:" value={s.tier}
        onChange={(v) => setPkg((p) => ({ ...p, seo: { ...p.seo, tier: v } }))} />
    </ServiceRow>
  );
}

function ServicePpc({
  pkg,
  setPkg,
  settings,
}: {
  pkg: PackageState;
  setPkg: React.Dispatch<React.SetStateAction<PackageState>>;
  settings: CalculatorSettings;
}) {
  const s = pkg.ppc;
  const rate = s.tier === "admin" ? settings.rateAdmin : s.tier === "ft" ? settings.rateFt : settings.ratePt;
  const cost = s.enabled ? Math.round(s.hoursPerMonth * rate) : 0;
  return (
    <ServiceRow
      enabled={s.enabled}
      onToggle={(v) => setPkg((p) => ({ ...p, ppc: { ...p.ppc, enabled: v } }))}
      title="PPC / Paid Ads"
      description="Google Ads, Meta Ads campaign management"
      cost={cost}
    >
      <div className="flex items-center gap-3">
        <Label className="text-sm text-muted-foreground min-w-40">Platform:</Label>
        <Select
          value={s.platform}
          onValueChange={(v) =>
            setPkg((p) => ({ ...p, ppc: { ...p.ppc, platform: v as "one" | "both" } }))
          }
        >
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="one">Google OR Meta</SelectItem>
            <SelectItem value="both">Google AND Meta</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <RangeRow label="Mgmt hours/month:" value={s.hoursPerMonth} min={1} max={20}
        onChange={(v) => setPkg((p) => ({ ...p, ppc: { ...p.ppc, hoursPerMonth: v } }))} />
      <TierSelect label="Managed by:" value={s.tier}
        onChange={(v) => setPkg((p) => ({ ...p, ppc: { ...p.ppc, tier: v } }))} />
    </ServiceRow>
  );
}

function ServiceWeb({
  pkg,
  setPkg,
}: {
  pkg: PackageState;
  setPkg: React.Dispatch<React.SetStateAction<PackageState>>;
  settings: CalculatorSettings;
}) {
  const s = pkg.web;
  const discounted = s.designPrice < WEBSITE_DESIGN_STANDARD;
  return (
    <ServiceRow
      enabled={s.enabled}
      onToggle={(v) => setPkg((p) => ({ ...p, web: { ...p.web, enabled: v } }))}
      title="Website Design & Management"
      description={`$${WEBSITE_DESIGN_STANDARD.toLocaleString()} design one-time · $${s.monthlyFee}/mo hosting + up to 5 changes`}
      cost={s.enabled ? Math.round(s.monthlyFee) : 0}
    >
      <div className="flex items-center gap-3 bg-muted rounded-md p-3">
        <Label className="whitespace-nowrap text-sm font-semibold">Design price (one-time):</Label>
        <input
          type="range"
          min={0}
          max={WEBSITE_DESIGN_STANDARD}
          step={50}
          value={s.designPrice}
          onChange={(e) =>
            setPkg((p) => ({ ...p, web: { ...p.web, designPrice: Number(e.target.value) } }))
          }
          className="flex-1 accent-tmc-gold-dark"
        />
        <span className="min-w-28 text-right">
          {discounted && (
            <span className="text-xs text-muted-foreground line-through mr-1">
              ${WEBSITE_DESIGN_STANDARD.toLocaleString()}
            </span>
          )}
          <span className="font-bold text-tmc-gold-dark text-lg tabular-nums">
            ${s.designPrice.toLocaleString()}
          </span>
        </span>
      </div>
      {discounted && (
        <p className="text-[11px] text-tmc-gold-dark">
          Design discounted by ${(WEBSITE_DESIGN_STANDARD - s.designPrice).toLocaleString()} — shows as savings on the proposal.
        </p>
      )}
      <div className="flex items-center gap-3">
        <Label className="text-sm text-muted-foreground min-w-40">Management & hosting ($/mo):</Label>
        <Input
          type="number"
          min={0}
          value={s.monthlyFee}
          onChange={(e) =>
            setPkg((p) => ({ ...p, web: { ...p.web, monthlyFee: Number(e.target.value) || 0 } }))
          }
          className="w-28 tabular-nums"
        />
        <span className="text-xs text-muted-foreground">includes hosting + up to 5 changes/mo</span>
      </div>
      {(pkg.social.enabled || pkg.seo.enabled || pkg.ppc.enabled || pkg.email.enabled || pkg.video.enabled || pkg.custom.enabled) ? (
        <p className="text-xs font-medium text-green-700 bg-green-50 rounded p-2">
          Hosting is FREE with their monthly service package — the ${s.monthlyFee}/mo
          shows as a bundled discount on the proposal, on top of any other discount.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground bg-muted rounded p-2">
          Hosting bills at ${s.monthlyFee}/mo standalone. It becomes FREE if they
          also take any monthly service (social, SEO, ads, email, or video).
        </p>
      )}
    </ServiceRow>
  );
}

function ServiceEmail({
  pkg,
  setPkg,
  settings,
}: {
  pkg: PackageState;
  setPkg: React.Dispatch<React.SetStateAction<PackageState>>;
  settings: CalculatorSettings;
}) {
  const s = pkg.email;
  const rate = s.tier === "admin" ? settings.rateAdmin : s.tier === "ft" ? settings.rateFt : settings.ratePt;
  const cost = s.enabled ? Math.round(s.campaignsPerMonth * s.hoursPerCampaign * rate) : 0;
  return (
    <ServiceRow
      enabled={s.enabled}
      onToggle={(v) => setPkg((p) => ({ ...p, email: { ...p.email, enabled: v } }))}
      title="Email Marketing"
      description="Campaign creation, automation, reporting"
      cost={cost}
    >
      <RangeRow label="Campaigns/month:" value={s.campaignsPerMonth} min={1} max={8}
        onChange={(v) => setPkg((p) => ({ ...p, email: { ...p.email, campaignsPerMonth: v } }))} />
      <RangeRow label="Hours per campaign:" value={s.hoursPerCampaign} min={1} max={6} step={0.5}
        onChange={(v) => setPkg((p) => ({ ...p, email: { ...p.email, hoursPerCampaign: v } }))} />
      <TierSelect label="Created by:" value={s.tier}
        onChange={(v) => setPkg((p) => ({ ...p, email: { ...p.email, tier: v } }))} />
    </ServiceRow>
  );
}

function ServiceVideo({
  pkg,
  setPkg,
  settings,
}: {
  pkg: PackageState;
  setPkg: React.Dispatch<React.SetStateAction<PackageState>>;
  settings: CalculatorSettings;
}) {
  const s = pkg.video;
  const rate = s.tier === "admin" ? settings.rateAdmin : s.tier === "ft" ? settings.rateFt : settings.ratePt;
  const cost = s.enabled ? Math.round(s.hoursPerMonth * rate) : 0;
  return (
    <ServiceRow
      enabled={s.enabled}
      onToggle={(v) => setPkg((p) => ({ ...p, video: { ...p.video, enabled: v } }))}
      title="Video Production"
      description="Long-form video, editing, post-production"
      cost={cost}
    >
      <RangeRow label="Estimated hours/month:" value={s.hoursPerMonth} min={1} max={40}
        onChange={(v) => setPkg((p) => ({ ...p, video: { ...p.video, hoursPerMonth: v } }))} />
      <TierSelect label="Produced by:" value={s.tier}
        onChange={(v) => setPkg((p) => ({ ...p, video: { ...p.video, tier: v } }))} />
    </ServiceRow>
  );
}

function ServiceCustom({
  pkg,
  setPkg,
  settings,
}: {
  pkg: PackageState;
  setPkg: React.Dispatch<React.SetStateAction<PackageState>>;
  settings: CalculatorSettings;
}) {
  const s = pkg.custom;
  const rate = s.tier === "admin" ? settings.rateAdmin : s.tier === "ft" ? settings.rateFt : settings.ratePt;
  const manual = s.pricingMode !== "hours";
  const cost = !s.enabled
    ? 0
    : manual
      ? customManualMonthly(s)
      : Math.round(s.hoursPerMonth * rate);
  const set = (patch: Partial<PackageState["custom"]>) =>
    setPkg((p) => ({ ...p, custom: { ...p.custom, ...patch } }));
  return (
    <ServiceRow
      enabled={s.enabled}
      onToggle={(v) => setPkg((p) => ({ ...p, custom: { ...p.custom, enabled: v } }))}
      title="Custom Line Item"
      description="Any additional service or recurring cost"
      cost={cost}
    >
      <div className="flex items-center gap-3 flex-wrap">
        <Label className="text-sm text-muted-foreground min-w-40">Description:</Label>
        <Input
          className="flex-1 min-w-44"
          placeholder="e.g., Photography, consulting"
          value={s.description}
          onChange={(e) =>
            setPkg((p) => ({ ...p, custom: { ...p.custom, description: e.target.value } }))
          }
        />
      </div>
      <div className="flex items-center gap-3">
        <Label className="text-sm text-muted-foreground min-w-40">Pricing:</Label>
        <Select
          value={s.pricingMode}
          onValueChange={(v) => set({ pricingMode: v as typeof s.pricingMode })}
        >
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="hours">Hours x tier rate (costed)</SelectItem>
            <SelectItem value="flat">Set price manually</SelectItem>
            <SelectItem value="perUnit">Per unit (e.g. per episode)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {s.pricingMode === "flat" && (
        <div className="flex items-center gap-3">
          <Label className="text-sm text-muted-foreground min-w-40">Price ($/mo):</Label>
          <Input
            type="number"
            min={0}
            value={s.flatPrice || ""}
            onChange={(e) => set({ flatPrice: Number(e.target.value) || 0 })}
            className="w-32 tabular-nums"
          />
        </div>
      )}
      {s.pricingMode === "perUnit" && (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <Label className="text-sm text-muted-foreground min-w-40">Price per unit ($):</Label>
            <Input
              type="number"
              min={0}
              value={s.unitPrice || ""}
              onChange={(e) => set({ unitPrice: Number(e.target.value) || 0 })}
              className="w-28 tabular-nums"
            />
            <span className="text-sm text-muted-foreground">per</span>
            <Input
              className="w-32"
              placeholder="episode"
              value={s.unitLabel}
              onChange={(e) => set({ unitLabel: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Label className="text-sm text-muted-foreground min-w-40">Units per month:</Label>
            <Input
              type="number"
              min={1}
              value={s.quantity || ""}
              onChange={(e) => set({ quantity: Math.max(1, Number(e.target.value) || 1) })}
              className="w-24 tabular-nums"
            />
            <span className="text-sm text-muted-foreground">
              {s.unitPrice > 0
                ? `= $${customManualMonthly(s).toLocaleString()}/mo on the proposal`
                : "Set a unit price to see the monthly total"}
            </span>
          </div>
        </>
      )}
      {manual ? (
        <>
          <div className="flex items-center gap-3">
            <Label className="text-sm text-muted-foreground min-w-40">Setup fee ($):</Label>
            <Input
              type="number"
              min={0}
              value={s.setupFee || ""}
              onChange={(e) => set({ setupFee: Number(e.target.value) || 0 })}
              className="w-32 tabular-nums"
            />
            <span className="text-xs text-muted-foreground">One-time, optional</span>
          </div>
          <p className="text-xs text-muted-foreground bg-muted rounded p-2">
            Manually-priced items bypass the margin engine. They're added to
            the quote as-is, so sanity-check the margin yourself.
          </p>
        </>
      ) : (
        <>
          <RangeRow label="Hours/month:" value={s.hoursPerMonth} min={1} max={40}
            onChange={(v) => set({ hoursPerMonth: v })} />
          <TierSelect label="Performed by:" value={s.tier}
            onChange={(v) => set({ tier: v })} />
        </>
      )}
    </ServiceRow>
  );
}

// ─── Results ──────────────────────────────────────────────────────────────

function ResultsPanel({
  pkg,
  setPkg,
  results,
  settings,
}: {
  pkg: PackageState;
  setPkg: React.Dispatch<React.SetStateAction<PackageState>>;
  results: ReturnType<typeof computePackage>;
  settings: CalculatorSettings;
}) {
  const verdictClass = {
    go: "bg-green-50 text-green-800 border-green-300",
    caution: "bg-yellow-50 text-yellow-800 border-yellow-300",
    stop: "bg-red-50 text-red-800 border-red-300",
    empty: "bg-muted text-muted-foreground border",
  }[results.verdict];

  const disc = applyPackageDiscount(
    results.targetPrice,
    pkg.discountType,
    pkg.discountValue,
  );

  const [pdfBusy, setPdfBusy] = useState(false);

  async function downloadPackagePdf() {
    const breakdown = proposalServiceLines(pkg, results);
    if (breakdown.length === 0) {
      toast.error("Toggle on at least one service first.");
      return;
    }
    const discounts: QuoteDiscount[] = [];
    if (results.hostingComped) {
      discounts.push({
        label: "Hosting free with your monthly service package",
        amount: results.websiteMonthly,
      });
    }
    if (disc.off > 0) {
      discounts.push({ label: pkg.discountName || "Custom discount", amount: disc.off });
    }
    const hostingComp = results.hostingComped ? results.websiteMonthly : 0;
    setPdfBusy(true);
    try {
      await downloadQuotePdf({
        docTitle: "Marketing Package Proposal",
        clientName: pkg.clientName.trim() || undefined,
        dateLabel: new Date().toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        }),
        sections: [
          {
            heading: "Monthly services",
            items: breakdown.map((b) => ({
              label: b.label,
              amount: b.amount,
              sublines: b.sublines,
            })),
          },
        ],
        standardTotal: results.targetPrice,
        discounts,
        finalTotal: Math.max(0, disc.final - hostingComp),
        priceUnit: "/mo",
        oneTimes: [
          ...(pkg.web.enabled
            ? [
                {
                  label: "Website design",
                  standard: WEBSITE_DESIGN_STANDARD,
                  final: results.websiteDesignPrice,
                },
              ]
            : []),
          ...(results.customSetup > 0
            ? [
                {
                  label: `${pkg.custom.description || "Custom service"} setup`,
                  standard: results.customSetup,
                  final: results.customSetup,
                },
              ]
            : []),
        ],
        extraSections: buildOptionSections(pkg.options),
        footnote:
          "Proposed monthly retainer. 30-day terms. Final scope confirmed in the service agreement.",
      });
      toast.success("Quote PDF downloaded");
    } catch {
      toast.error("Couldn't generate the PDF. Try again.");
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <div className="rounded-lg border bg-card p-5 space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-tmc-slate flex items-center gap-2">
        <span className="bg-tmc-gold text-tmc-dark text-xs w-7 h-7 rounded inline-flex items-center justify-center">%</span>
        Pricing Results
      </h2>

      <div className="flex items-center gap-3 bg-muted rounded-md p-3">
        <Label className="whitespace-nowrap font-semibold">Target margin:</Label>
        <input
          type="range"
          min={10}
          max={70}
          step={5}
          value={pkg.targetMargin}
          onChange={(e) => setPkg((p) => ({ ...p, targetMargin: Number(e.target.value) }))}
          className="flex-1 accent-tmc-gold-dark"
        />
        <span className="font-bold text-tmc-gold-dark min-w-12 text-center text-lg">
          {pkg.targetMargin}%
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <ResultCard label="Total cost" value={`$${results.totalCost.toLocaleString()}`} variant="cost" />
        <ResultCard label="Quote at target" value={`$${results.targetPrice.toLocaleString()}`} variant="price" />
        <ResultCard label="Monthly profit" value={`$${results.profit.toLocaleString()}`} variant="margin" />
        <ResultCard label={`Floor (${settings.marginFloor}% min)`} value={`$${results.floorPrice.toLocaleString()}`} variant="floor" />
      </div>

      <div className={`rounded-md border px-4 py-3 text-sm font-medium text-center ${verdictClass}`}>
        {results.verdictText}
      </div>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-muted-foreground border-b-2 bg-muted">
            <th className="text-left py-2 px-3 font-semibold">Line item</th>
            <th className="text-left py-2 px-3 font-semibold">Tier</th>
            <th className="text-left py-2 px-3 font-semibold">Hours/mo</th>
            <th className="text-right py-2 px-3 font-semibold">Cost/mo</th>
          </tr>
        </thead>
        <tbody>
          {results.lines.map((l, i) => (
            <tr key={i} className="border-b">
              <td className="py-2 px-3">{l.item}</td>
              <td className="py-2 px-3">{l.tier}</td>
              <td className="py-2 px-3">{typeof l.hours === "number" ? l.hours : l.hours}</td>
              <td className="py-2 px-3 text-right">${l.cost.toLocaleString()}</td>
            </tr>
          ))}
          {results.lines.length > 0 && (
            <>
              <tr className="font-bold border-t-2 border-tmc-dark">
                <td className="py-3 px-3">Total delivery cost</td>
                <td></td>
                <td className="py-3 px-3">{results.totalHours}</td>
                <td className="py-3 px-3 text-right">${results.totalCost.toLocaleString()}</td>
              </tr>
              <tr className={`font-bold ${pkg.targetMargin >= settings.marginFloor ? "text-green-700" : "text-red-700"}`}>
                <td className="py-2 px-3">Quote at {pkg.targetMargin}% margin</td>
                <td></td>
                <td></td>
                <td className="py-2 px-3 text-right">${results.targetPrice.toLocaleString()}/mo</td>
              </tr>
              {results.targetPrice !== results.floorPrice && (
                <tr className="font-bold text-muted-foreground">
                  <td className="py-2 px-3">Floor at {settings.marginFloor}% margin</td>
                  <td></td>
                  <td></td>
                  <td className="py-2 px-3 text-right">${results.floorPrice.toLocaleString()}/mo</td>
                </tr>
              )}
            </>
          )}
        </tbody>
      </table>

      <ProposalOptionsCard
        pkg={pkg}
        setPkg={setPkg}
        currentMonthly={results.targetPrice}
      />

      {/* ── Client quote: custom discount + standard vs your price ── */}
      <div className="rounded-lg border-2 border-tmc-gold/50 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-tmc-slate">
            Client quote
          </h3>
          <Button
            size="sm"
            onClick={downloadPackagePdf}
            disabled={pdfBusy}
            className="gap-1 bg-tmc-gold text-tmc-dark hover:bg-tmc-gold-dark"
          >
            <FileText size={14} /> {pdfBusy ? "Generating…" : "Download PDF"}
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Discount label</Label>
            <Input
              value={pkg.discountName}
              onChange={(e) => setPkg((p) => ({ ...p, discountName: e.target.value }))}
              placeholder="e.g. New client offer"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Type</Label>
            <Select
              value={pkg.discountType}
              onValueChange={(v) =>
                setPkg((p) => ({ ...p, discountType: v as "flat" | "pct" }))
              }
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="flat">Flat ($/mo)</SelectItem>
                <SelectItem value="pct">Percent (%)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">
              {pkg.discountType === "pct" ? "Amount (%)" : "Amount ($/mo)"}
            </Label>
            <Input
              type="number"
              min={0}
              value={pkg.discountValue || ""}
              onChange={(e) =>
                setPkg((p) => ({ ...p, discountValue: Number(e.target.value) || 0 }))
              }
              className="h-8 text-sm tabular-nums"
            />
          </div>
        </div>

        {(() => {
          const hostingComp = results.hostingComped ? results.websiteMonthly : 0;
          const finalMonthly = Math.max(0, disc.final - hostingComp);
          const anyDiscount = disc.off > 0 || hostingComp > 0;
          return anyDiscount ? (
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Standard rate</span>
                <span className="line-through text-muted-foreground tabular-nums">
                  ${results.targetPrice.toLocaleString()}/mo
                </span>
              </div>
              {hostingComp > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-green-700 font-medium">
                    Hosting free with monthly package
                  </span>
                  <span className="text-green-700 font-medium tabular-nums">
                    −${hostingComp.toLocaleString()}/mo
                  </span>
                </div>
              )}
              {disc.off > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-tmc-gold-dark font-medium">
                    {pkg.discountName || "Discount"}
                  </span>
                  <span className="text-tmc-gold-dark font-medium tabular-nums">
                    −${disc.off.toLocaleString()}/mo
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between pt-1 border-t">
                <span className="font-bold text-tmc-dark">Your price</span>
                <span className="text-2xl font-bold text-tmc-gold-dark tabular-nums">
                  ${finalMonthly.toLocaleString()}
                  <span className="text-sm text-muted-foreground font-medium">/mo</span>
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between pt-1 border-t">
              <span className="font-bold text-tmc-dark">Quote</span>
              <span className="text-2xl font-bold text-tmc-gold-dark tabular-nums">
                ${results.targetPrice.toLocaleString()}
                <span className="text-sm text-muted-foreground font-medium">/mo</span>
              </span>
            </div>
          );
        })()}
        {pkg.web.enabled && (
          <div className="flex items-center justify-between pt-1 border-t text-sm">
            <span className="text-tmc-dark font-medium">Website design (one-time)</span>
            <span className="tabular-nums">
              {results.websiteDesignPrice < WEBSITE_DESIGN_STANDARD && (
                <span className="line-through text-muted-foreground mr-2">
                  ${WEBSITE_DESIGN_STANDARD.toLocaleString()}
                </span>
              )}
              <span className="font-bold text-tmc-gold-dark">
                ${results.websiteDesignPrice.toLocaleString()}
              </span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultCard({
  label,
  value,
  variant,
}: {
  label: string;
  value: string;
  variant: "cost" | "price" | "margin" | "floor";
}) {
  const cls = {
    cost: "bg-red-50 text-red-700",
    price: "bg-green-50 text-green-700",
    margin: "bg-yellow-50 text-yellow-700",
    floor: "bg-muted text-tmc-dark",
  }[variant];
  return (
    <div className={`rounded-md p-4 text-center ${cls}`}>
      <div className="text-xs uppercase tracking-wide font-medium opacity-80 mb-1">{label}</div>
      <div className="text-2xl font-bold tracking-tight">{value}</div>
    </div>
  );
}

// ─── Admin settings dialog ───────────────────────────────────────────────

export function AdminSettingsDialog({
  open,
  onOpenChange,
  settings,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  settings: CalculatorSettings;
  onSaved: (s: CalculatorSettings) => void;
}) {
  const [draft, setDraft] = useState<CalculatorSettings>(settings);
  const [saving, setSaving] = useState(false);

  // Reset draft when dialog opens
  useEffect(() => {
    if (open) setDraft(settings);
  }, [open, settings]);

  async function save() {
    setSaving(true);
    try {
      const fresh = await patchSettings({
        rateAdmin: draft.rateAdmin,
        rateFt: draft.rateFt,
        ratePt: draft.ratePt,
        reviewTier: draft.reviewTier,
        reviewMins: draft.reviewMins,
        softwareTotal: draft.softwareTotal,
        clientCount: draft.clientCount,
        marginFloor: draft.marginFloor,
        billableRate: draft.billableRate,
        rateDayHalf: draft.rateDayHalf,
        rateDayFull: draft.rateDayFull,
        rateDayExtra: draft.rateDayExtra,
      });
      onSaved(fresh);
      onOpenChange(false);
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  function set<K extends keyof CalculatorSettings>(key: K, value: CalculatorSettings[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Calculator settings</DialogTitle>
          <DialogDescription>
            Internal cost rates and overhead. These reflect what it costs to deliver,
            not what you charge. Saved settings apply to everyone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Internal Cost Rates ($/hr)</h3>
            <RateRow label="Admin" desc="Owners, senior staff, contractors at senior rate"
              value={draft.rateAdmin} onChange={(v) => set("rateAdmin", v)} />
            <RateRow label="Full-Time" desc="Salaried full-time team members"
              value={draft.rateFt} onChange={(v) => set("rateFt", v)} />
            <RateRow label="Part-Time" desc="Hourly part-time support"
              value={draft.ratePt} onChange={(v) => set("ratePt", v)} />
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Content Review</h3>
            <div className="flex items-center gap-3 text-sm">
              <Label className="min-w-44">Reviewer cost tier:</Label>
              <Select value={draft.reviewTier} onValueChange={(v) =>
                set("reviewTier", v as CalculatorSettings["reviewTier"])
              }>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="ft">Full-Time</SelectItem>
                  <SelectItem value="pt">Part-Time</SelectItem>
                  <SelectItem value="none">No reviewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Label className="min-w-44">Minutes per post for review:</Label>
              <Input type="number" className="w-24"
                value={draft.reviewMins}
                onChange={(e) => set("reviewMins", Number(e.target.value) || 0)} />
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Video Day Rates ($)</h3>
            <p className="text-[11px] text-muted-foreground -mt-1">
              Standard shoot rates used by the video calculator. Per-quote
              tweaks are still possible in the advanced override card.
            </p>
            <NumRow label="Half-day rate:" value={draft.rateDayHalf}
              onChange={(v) => set("rateDayHalf", v)} />
            <NumRow label="Full-day rate:" value={draft.rateDayFull}
              onChange={(v) => set("rateDayFull", v)} />
            <NumRow label="Each extra day:" value={draft.rateDayExtra}
              onChange={(v) => set("rateDayExtra", v)} />
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Overhead & Guardrails</h3>
            <NumRow label="Monthly software total ($):" value={draft.softwareTotal}
              onChange={(v) => set("softwareTotal", v)} />
            <NumRow label="Current client count:" value={draft.clientCount}
              onChange={(v) => set("clientCount", v)} />
            <NumRow label="Margin floor (%):" value={draft.marginFloor}
              onChange={(v) => set("marginFloor", v)} />
            <NumRow label="External billable rate ($/hr):" value={draft.billableRate}
              onChange={(v) => set("billableRate", v)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={save}
            disabled={saving}
            className="bg-tmc-gold text-tmc-dark hover:bg-tmc-gold-dark"
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RateRow({
  label,
  desc,
  value,
  onChange,
}: {
  label: string;
  desc: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 bg-muted rounded p-2 text-sm">
      <span className="font-semibold min-w-24">{label}</span>
      <span className="flex-1 text-xs text-muted-foreground">{desc}</span>
      <span>$</span>
      <Input type="number" className="w-20 text-center"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)} />
    </div>
  );
}

function NumRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <Label className="min-w-44">{label}</Label>
      <Input type="number" className="w-24"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)} />
    </div>
  );
}

// ─── Proposal options: alternatives + optional add-ons ────────────────────

/** Group the saved options into the PDF's extraSections shape. */
function buildOptionSections(options: ProposalOption[]) {
  const alts = options.filter((o) => o.kind === "alternative");
  const addons = options.filter((o) => o.kind === "addon");
  const toItems = (list: ProposalOption[]) =>
    list.map((o) => ({
      label: o.label || "Option",
      description: o.description || undefined,
      detail: optionDetail(o) || undefined,
      amount: optionMonthly(o),
      unit: "/mo",
      oneTime: o.oneTimePrice > 0 ? o.oneTimePrice : undefined,
    }));

  const sections: NonNullable<Parameters<typeof downloadQuotePdf>[0]["extraSections"]> = [];
  if (alts.length) {
    sections.push({
      heading: "Other ways we can scale this",
      note: "Swap in place of the package above. Same team, different volume.",
      items: toItems(alts),
    });
  }
  if (addons.length) {
    sections.push({
      heading: "Optional add-ons",
      note: "Available on top of your package whenever you're ready.",
      items: toItems(addons),
    });
  }
  return sections.length ? sections : undefined;
}

function ProposalOptionsCard({
  pkg,
  setPkg,
  currentMonthly,
}: {
  pkg: PackageState;
  setPkg: React.Dispatch<React.SetStateAction<PackageState>>;
  currentMonthly: number;
}) {
  function addOption(kind: ProposalOption["kind"], seedPrice = 0) {
    const fresh: ProposalOption = {
      id: `${Date.now()}-${Math.round(Math.random() * 1e6)}`,
      kind,
      label: "",
      description: "",
      pricingMode: "flat",
      monthlyPrice: seedPrice,
      unitLabel: "episode",
      unitPrice: 0,
      quantity: 4,
      oneTimePrice: 0,
    };
    setPkg((p) => ({ ...p, options: [...p.options, fresh] }));
  }
  function update(id: string, patch: Partial<ProposalOption>) {
    setPkg((p) => ({
      ...p,
      options: p.options.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    }));
  }
  function remove(id: string) {
    setPkg((p) => ({ ...p, options: p.options.filter((o) => o.id !== id) }));
  }

  return (
    <div className="rounded-lg border bg-card p-5 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-tmc-slate">
            Proposal options
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Extra blocks on the proposal that don't change the quoted total:
            scaled alternatives ("if you did 2 posts/week instead") and
            optional add-ons ("podcast production").
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={() => addOption("alternative")}>
            + Alternative
          </Button>
          <Button size="sm" variant="outline" onClick={() => addOption("addon")}>
            + Add-on
          </Button>
        </div>
      </div>

      {pkg.options.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          None yet. Tip: set the sliders to the scaled-down version, click
          "+ Alternative", then "Use current price" to snapshot it — and set
          the sliders back to what you're actually quoting.
        </p>
      ) : (
        <div className="space-y-3">
          {pkg.options.map((o) => {
            const perUnit = o.pricingMode === "perUnit";
            return (
              <div
                key={o.id}
                className="rounded-md border p-3 space-y-2 bg-muted/30"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <Select
                    value={o.kind}
                    onValueChange={(v) =>
                      update(o.id, { kind: v as ProposalOption["kind"] })
                    }
                  >
                    <SelectTrigger className="h-8 w-36 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alternative">Alternative</SelectItem>
                      <SelectItem value="addon">Add-on</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    className="flex-1 min-w-44 h-8 text-sm"
                    placeholder={
                      o.kind === "alternative"
                        ? "e.g. Lighter option: 2 posts per week"
                        : "e.g. Podcast production"
                    }
                    value={o.label}
                    onChange={(e) => update(o.id, { label: e.target.value })}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-destructive"
                    onClick={() => remove(o.id)}
                  >
                    Remove
                  </Button>
                </div>

                <Input
                  className="h-8 text-sm"
                  placeholder="Short description shown under the name (optional)"
                  value={o.description}
                  onChange={(e) => update(o.id, { description: e.target.value })}
                />

                <div className="flex items-center gap-2 flex-wrap">
                  <Select
                    value={o.pricingMode}
                    onValueChange={(v) =>
                      update(o.id, { pricingMode: v as ProposalOption["pricingMode"] })
                    }
                  >
                    <SelectTrigger className="h-8 w-40 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flat">Flat monthly</SelectItem>
                      <SelectItem value="perUnit">Per unit x qty</SelectItem>
                    </SelectContent>
                  </Select>

                  {perUnit ? (
                    <>
                      <span className="text-xs text-muted-foreground">$</span>
                      <Input
                        type="number"
                        min={0}
                        className="h-8 w-24 text-sm tabular-nums"
                        value={o.unitPrice || ""}
                        onChange={(e) =>
                          update(o.id, { unitPrice: Number(e.target.value) || 0 })
                        }
                      />
                      <span className="text-xs text-muted-foreground">per</span>
                      <Input
                        className="h-8 w-28 text-sm"
                        placeholder="episode"
                        value={o.unitLabel}
                        onChange={(e) => update(o.id, { unitLabel: e.target.value })}
                      />
                      <span className="text-xs text-muted-foreground">x</span>
                      <Input
                        type="number"
                        min={0}
                        className="h-8 w-20 text-sm tabular-nums"
                        value={o.quantity || ""}
                        onChange={(e) =>
                          update(o.id, { quantity: Number(e.target.value) || 0 })
                        }
                      />
                      <span className="text-xs text-muted-foreground">per month</span>
                    </>
                  ) : (
                    <>
                      <span className="text-xs text-muted-foreground">$</span>
                      <Input
                        type="number"
                        min={0}
                        className="h-8 w-28 text-sm tabular-nums"
                        value={o.monthlyPrice || ""}
                        onChange={(e) =>
                          update(o.id, { monthlyPrice: Number(e.target.value) || 0 })
                        }
                      />
                      <span className="text-xs text-muted-foreground">/mo</span>
                      {o.kind === "alternative" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-xs text-tmc-gold-dark"
                          onClick={() => update(o.id, { monthlyPrice: currentMonthly })}
                          title="Snapshot the price currently showing above"
                        >
                          Use current price (${currentMonthly.toLocaleString()})
                        </Button>
                      )}
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-[11px] text-muted-foreground">
                    One-time setup ($, optional):
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    className="h-8 w-28 text-sm tabular-nums"
                    value={o.oneTimePrice || ""}
                    onChange={(e) =>
                      update(o.id, { oneTimePrice: Number(e.target.value) || 0 })
                    }
                  />
                  <span className="ml-auto text-sm font-semibold text-tmc-gold-dark tabular-nums">
                    ${optionMonthly(o).toLocaleString()}/mo
                    {o.oneTimePrice > 0 && (
                      <span className="text-xs text-muted-foreground font-normal">
                        {" "}+ ${o.oneTimePrice.toLocaleString()} setup
                      </span>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
