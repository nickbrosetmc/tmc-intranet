import { useEffect, useMemo, useState } from "react";
import { Settings as Gear } from "lucide-react";
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
  computePackage,
  DEFAULT_PACKAGE,
  fetchSettings,
  patchSettings,
  TIERS,
  type CalculatorSettings,
  type PackageState,
  type Tier,
} from "@/lib/calculator";

export function CalculatorPage() {
  const userState = useUser();
  const [settings, setSettings] = useState<CalculatorSettings | null>(null);
  const [pkg, setPkg] = useState<PackageState>(DEFAULT_PACKAGE);
  const [adminOpen, setAdminOpen] = useState(false);

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

      <div className="flex items-center gap-3 pb-3 border-b">
        <Label className="whitespace-nowrap">Client / Prospect:</Label>
        <Input
          value={pkg.clientName}
          onChange={(e) => setPkg((p) => ({ ...p, clientName: e.target.value }))}
          placeholder="Enter client name for this quote…"
        />
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
  settings,
}: {
  pkg: PackageState;
  setPkg: React.Dispatch<React.SetStateAction<PackageState>>;
  settings: CalculatorSettings;
}) {
  const s = pkg.web;
  const rate = s.tier === "admin" ? settings.rateAdmin : s.tier === "ft" ? settings.rateFt : settings.ratePt;
  const cost = s.enabled ? Math.round(s.hoursPerMonth * rate) : 0;
  return (
    <ServiceRow
      enabled={s.enabled}
      onToggle={(v) => setPkg((p) => ({ ...p, web: { ...p.web, enabled: v } }))}
      title="Website Management"
      description="Hosting, updates, maintenance"
      cost={cost}
    >
      <div className="flex items-center gap-3">
        <Label className="text-sm text-muted-foreground min-w-40">Scope:</Label>
        <Select
          value={s.scope}
          onValueChange={(v) =>
            setPkg((p) => ({ ...p, web: { ...p.web, scope: v as "manage" | "build" } }))
          }
        >
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="manage">Ongoing management</SelectItem>
            <SelectItem value="build">Build + manage (amortized)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <RangeRow label="Monthly hours:" value={s.hoursPerMonth} min={0.5} max={10} step={0.5}
        onChange={(v) => setPkg((p) => ({ ...p, web: { ...p.web, hoursPerMonth: v } }))} />
      <TierSelect label="Managed by:" value={s.tier}
        onChange={(v) => setPkg((p) => ({ ...p, web: { ...p.web, tier: v } }))} />
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
  const cost = s.enabled ? Math.round(s.hoursPerMonth * rate) : 0;
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
      <RangeRow label="Hours/month:" value={s.hoursPerMonth} min={1} max={40}
        onChange={(v) => setPkg((p) => ({ ...p, custom: { ...p.custom, hoursPerMonth: v } }))} />
      <TierSelect label="Performed by:" value={s.tier}
        onChange={(v) => setPkg((p) => ({ ...p, custom: { ...p.custom, tier: v } }))} />
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

function AdminSettingsDialog({
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
