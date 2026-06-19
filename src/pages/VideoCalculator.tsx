import { useEffect, useMemo, useState } from "react";
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
import { Toaster } from "@/components/ui/sonner";
import { useUser } from "@/lib/useUser";
import { fetchSettings, type CalculatorSettings } from "@/lib/calculator";
import {
  applySharedRates,
  computeVideo,
  DEFAULT_VIDEO_STATE,
  fmt$,
  type VideoState,
} from "@/lib/video-calculator";

export function VideoCalculatorPage() {
  const userState = useUser();
  const [settings, setSettings] = useState<CalculatorSettings | null>(null);
  const [s, setS] = useState<VideoState>(DEFAULT_VIDEO_STATE);

  useEffect(() => {
    if (userState.status !== "authenticated") return;
    if (userState.user.type !== "team") return;
    fetchSettings()
      .then((cs) => {
        setSettings(cs);
        setS((prev) => applySharedRates(prev, cs));
      })
      .catch((e: Error) => toast.error(`Failed to load settings: ${e.message}`));
  }, [userState.status]);

  const r = useMemo(() => computeVideo(s), [s]);

  if (userState.status === "loading") {
    return <div className="text-muted-foreground text-sm">Loading…</div>;
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
  if (userState.user.type !== "team") {
    return (
      <div className="text-center max-w-md mx-auto space-y-3">
        <h1 className="text-xl font-semibold text-tmc-dark">Team only</h1>
        <p className="text-sm text-muted-foreground">
          The video calculator is for the TMC team.
        </p>
      </div>
    );
  }
  if (!settings) {
    return <div className="text-muted-foreground text-sm">Loading calculator…</div>;
  }

  function set<K extends keyof VideoState>(key: K, v: VideoState[K]) {
    setS((prev) => ({ ...prev, [key]: v }));
  }
  function reset() {
    setS({ ...applySharedRates(DEFAULT_VIDEO_STATE, settings!) });
  }

  function copyQuote() {
    const lines: string[] = [];
    const pad = (left: string, right: string) =>
      "  " + left.padEnd(38) + right.padStart(10);
    lines.push("TMC MARKETING — VIDEO PROJECT QUOTE");
    lines.push("Generated " + new Date().toLocaleDateString());
    lines.push("==========================================");
    lines.push("");
    lines.push("SHOOT & TRAVEL");
    r.shootLines.forEach(([n, v]) => lines.push(pad(n, fmt$(v))));
    lines.push("");
    lines.push("EDIT DELIVERABLES");
    r.editLines.forEach(([n, v]) => lines.push(pad(n, fmt$(v))));
    if (r.modLines.length) {
      lines.push("");
      lines.push("MODIFIERS");
      r.modLines.forEach(([n, v]) => lines.push(pad(n, fmt$(v))));
    }
    lines.push("");
    lines.push(pad("Base subtotal", fmt$(r.baseSubtotal)));
    lines.push("");
    lines.push("VALUE MULTIPLIERS");
    r.multLines.forEach((m) => {
      if (m.mult === 1) lines.push(pad(`${m.label} (${m.mult.toFixed(2)}×)`, "no change"));
      else lines.push(pad(`${m.label} (${m.mult.toFixed(2)}×)`, "+" + fmt$(m.after - m.before)));
    });
    lines.push(pad("After multipliers", fmt$(r.adjustedSubtotal)));
    lines.push("");
    lines.push("==========================================");
    if (r.discountTotal > 0) {
      lines.push(pad("STANDARD INVESTMENT", fmt$(r.standardRounded)));
      lines.push("");
      lines.push("DISCOUNTS APPLIED");
      r.discountLines.forEach(([n, v]) =>
        lines.push(pad("  " + n, "−" + fmt$(Math.abs(v)))),
      );
      lines.push(pad("  Total savings", "−" + fmt$(r.standardRounded - r.grandRounded)));
      lines.push("");
      lines.push(pad("YOUR PRICE", fmt$(r.grandRounded)));
    } else {
      lines.push(pad("FINAL QUOTE", fmt$(r.grandRounded)));
    }
    lines.push("==========================================");
    navigator.clipboard
      .writeText(lines.join("\n"))
      .then(() => toast.success("Quote copied to clipboard"))
      .catch((e) => toast.error(`Copy failed: ${(e as Error).message}`));
  }

  return (
    <div className="w-full max-w-7xl space-y-4">
      <header className="flex items-start justify-between border-b border-tmc-gold/40 pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-tmc-dark">
            Video Production Calculator{" "}
            <span className="ml-2 inline-block text-[10px] uppercase tracking-widest font-semibold bg-tmc-dark text-tmc-gold px-2 py-0.5 rounded">
              Internal
            </span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Per-project quote builder with cost foundation, multipliers, and margin guardrails.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={reset}>
            Reset
          </Button>
          <Button
            size="sm"
            onClick={copyQuote}
            className="bg-tmc-gold text-tmc-dark hover:bg-tmc-gold-dark"
          >
            Copy quote
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-5">
        {/* LEFT: input columns */}
        <div className="space-y-4">
          <FoundationCard s={s} set={set} refHalf={r.refHalfFloor} refFull={r.refFullFloor} />
          <ShootDaysCard s={s} set={set} totalShootHours={r.totalShootHours} />
          <CrewAddOnsCard s={s} set={set} />
          <PhotographyCard s={s} set={set} />
          <TravelCard s={s} set={set} />
          <ShortFormDeliverablesCard s={s} set={set} per={r.perDeliverable} />
          <LongFormDeliverablesCard s={s} set={set} per={r.perDeliverable} seriesActive={r.seriesActive} />
          <MultipliersCard s={s} set={set} />
          <ModifiersCard s={s} set={set} />
          <SafetyCard s={s} set={set} />
          <DiscountsCard s={s} bundleDisc={r.bundleDisc} bundleNeed={r.bundleNeed} set={set} />
          <AnchorOverridesCard s={s} set={set} />
        </div>

        {/* RIGHT: quote panel */}
        <div>
          <div className="lg:sticky lg:top-24 space-y-4">
            <QuoteBreakdown r={r} s={s} />
          </div>
        </div>
      </div>

      <Toaster />
    </div>
  );
}

// ─── Card primitives ────────────────────────────────────────────────────

function Card({
  title,
  subtitle,
  internal,
  children,
}: {
  title: string;
  subtitle?: string;
  internal?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-lg border bg-card p-4 ${internal ? "ring-1 ring-orange-200 bg-orange-50/30" : ""}`}
    >
      <h2 className="text-sm font-semibold tracking-wide text-tmc-slate uppercase mb-3 flex items-center gap-2">
        {title}
        {internal && (
          <span className="text-[10px] font-normal normal-case text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded">
            internal
          </span>
        )}
      </h2>
      {subtitle && <p className="text-xs text-muted-foreground mb-3">{subtitle}</p>}
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-1">
      <div className="flex-1 min-w-0">
        <Label className="text-xs">{label}</Label>
        {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  min = 0,
  step = 1,
  className = "w-24",
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  step?: number;
  className?: string;
}) {
  return (
    <Input
      type="number"
      value={value}
      min={min}
      step={step}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      className={`${className} text-right tabular-nums`}
    />
  );
}

function CheckboxRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2 py-1 text-xs cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5"
      />
      <div className="flex-1">
        <span className="font-medium">{label}</span>
        {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
      </div>
    </label>
  );
}

// ─── Cards ──────────────────────────────────────────────────────────────

type Setter = <K extends keyof VideoState>(key: K, v: VideoState[K]) => void;

function FoundationCard({
  s,
  set,
  refHalf,
  refFull,
}: {
  s: VideoState;
  set: Setter;
  refHalf: number;
  refFull: number;
}) {
  return (
    <Card
      title="Layer 1 — Cost foundation"
      subtitle="Tier-based labor rates from team settings + project software allocation. Reference floors below show the minimum quote a typical project needs to clear the target margin."
      internal
    >
      <Row label="Admin tier rate ($/hr)" hint="Owner + senior staff (Nick, Kelly)">
        <NumberInput value={s.rateAdmin} onChange={(v) => set("rateAdmin", v)} />
      </Row>
      <Row label="Full-Time tier rate ($/hr)" hint="Salaried full-time team (Kit)">
        <NumberInput value={s.rateFT} onChange={(v) => set("rateFT", v)} />
      </Row>
      <Row label="Part-Time tier rate ($/hr)" hint="Hourly part-time support">
        <NumberInput value={s.ratePT} onChange={(v) => set("ratePT", v)} />
      </Row>
      <Row label="Editor rate ($/hr)" hint="Contracted editor (Mike default)">
        <NumberInput value={s.rateEditor} onChange={(v) => set("rateEditor", v)} />
      </Row>
      <Row label="Photography rate ($/hr)" hint="When stills are added (event coverage)">
        <NumberInput value={s.ratePhoto} onChange={(v) => set("ratePhoto", v)} />
      </Row>
      <Row label="Software allocation per project ($)" hint="Adobe + storage + DJI + ClickUp share for this project">
        <NumberInput value={s.softwareAlloc} onChange={(v) => set("softwareAlloc", v)} />
      </Row>
      <Row label="Target gross margin (%)" hint="Industry standard 50–65%">
        <NumberInput value={s.targetMargin} onChange={(v) => set("targetMargin", v)} step={5} />
      </Row>
      <div className="mt-2 pt-2 border-t text-[11px] text-muted-foreground grid grid-cols-2 gap-2">
        <div>Half-day reference floor: <strong>{fmt$(refHalf)}</strong></div>
        <div>Full-day reference floor: <strong>{fmt$(refFull)}</strong></div>
      </div>
    </Card>
  );
}

function ShootDaysCard({
  s,
  set,
  totalShootHours,
}: {
  s: VideoState;
  set: Setter;
  totalShootHours: number;
}) {
  const totalDays = s.halfDays + s.fullDays;
  return (
    <Card title="Shoot days">
      <Row label="Half-days" hint="Up to 4 hrs on site each · $1,800/day base">
        <NumberInput value={s.halfDays} step={0.5} onChange={(v) => set("halfDays", v)} />
      </Row>
      <Row label="Full-days" hint="4–9 hrs on site each · $2,800/day base">
        <NumberInput value={s.fullDays} step={0.5} onChange={(v) => set("fullDays", v)} />
      </Row>
      <Row label="Avg on-site hrs per half-day">
        <NumberInput value={s.halfHrs} step={0.5} min={1} onChange={(v) => set("halfHrs", v)} />
      </Row>
      <Row label="Avg on-site hrs per full-day">
        <NumberInput value={s.fullHrs} step={0.5} min={1} onChange={(v) => set("fullHrs", v)} />
      </Row>
      <div className="text-[11px] text-muted-foreground pt-1">
        Total shoot days: <strong>{totalDays}</strong> · Total on-site hours: <strong>{totalShootHours}</strong>
      </div>
    </Card>
  );
}

function CrewAddOnsCard({ s, set }: { s: VideoState; set: Setter }) {
  return (
    <Card
      title="Crew add-ons"
      subtitle="Each is days × $/day. FT (Kit) is COGS-only — salaried, no client charge."
    >
      <DayFeeRow label="Kit (Full-Time) on shoot" days={s.ftDays} setDays={(v) => set("ftDays", v)} />
      <DayFeeRow
        label="Part-time help"
        days={s.ptDays}
        fee={s.ptFee}
        setDays={(v) => set("ptDays", v)}
        setFee={(v) => set("ptFee", v)}
      />
      <DayFeeRow
        label="Drone (Air 3s)"
        days={s.droneDays}
        fee={s.droneFee}
        setDays={(v) => set("droneDays", v)}
        setFee={(v) => set("droneFee", v)}
      />
      <DayFeeRow
        label="Nano POV"
        days={s.nanoDays}
        fee={s.nanoFee}
        setDays={(v) => set("nanoDays", v)}
        setFee={(v) => set("nanoFee", v)}
      />
      <DayFeeRow
        label="Teleprompter"
        days={s.prompterDays}
        fee={s.prompterFee}
        setDays={(v) => set("prompterDays", v)}
        setFee={(v) => set("prompterFee", v)}
      />
    </Card>
  );
}

function DayFeeRow({
  label,
  days,
  setDays,
  fee,
  setFee,
}: {
  label: string;
  days: number;
  setDays: (v: number) => void;
  fee?: number;
  setFee?: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <Label className="flex-1 text-xs">{label}</Label>
      <NumberInput value={days} step={0.5} onChange={setDays} className="w-16" />
      <span className="text-muted-foreground">days</span>
      {fee !== undefined && setFee && (
        <>
          <span className="text-muted-foreground">@ $</span>
          <NumberInput value={fee} onChange={setFee} className="w-20" />
          <span className="text-muted-foreground">/day</span>
        </>
      )}
    </div>
  );
}

function PhotographyCard({ s, set }: { s: VideoState; set: Setter }) {
  return (
    <Card title="Photography">
      <DayFeeRow
        label="Photography (half-day)"
        days={s.photoHalfDays}
        fee={s.photoHalfFee}
        setDays={(v) => set("photoHalfDays", v)}
        setFee={(v) => set("photoHalfFee", v)}
      />
      <DayFeeRow
        label="Photography (full-day)"
        days={s.photoFullDays}
        fee={s.photoFullFee}
        setDays={(v) => set("photoFullDays", v)}
        setFee={(v) => set("photoFullFee", v)}
      />
      <DayFeeRow
        label="Additional photographer"
        days={s.extraPhotoDays}
        fee={s.extraPhotoFee}
        setDays={(v) => set("extraPhotoDays", v)}
        setFee={(v) => set("extraPhotoFee", v)}
      />
      <div className="flex items-center gap-2 text-xs">
        <label className="flex items-center gap-2 flex-1">
          <input
            type="checkbox"
            checked={s.photoRush}
            onChange={(e) => set("photoRush", e.target.checked)}
          />
          <span>Rush delivery</span>
        </label>
        <span className="text-muted-foreground">$</span>
        <NumberInput
          value={s.photoRushFee}
          onChange={(v) => set("photoRushFee", v)}
          className="w-20"
        />
      </div>
    </Card>
  );
}

function TravelCard({ s, set }: { s: VideoState; set: Setter }) {
  return (
    <Card title="Travel">
      <Row label="Total round-trip mileage" hint="Total miles for entire trip">
        <NumberInput value={s.miles} onChange={(v) => set("miles", v)} />
      </Row>
      <Row label="Free mileage included">
        <NumberInput value={s.milesFree} onChange={(v) => set("milesFree", v)} />
      </Row>
      <Row label="Mileage rate ($/mi)">
        <NumberInput value={s.milesRate} step={0.01} onChange={(v) => set("milesRate", v)} />
      </Row>
      <Row label="Total crew on overnight trip">
        <NumberInput
          value={s.totalCrewOvernight}
          onChange={(v) => set("totalCrewOvernight", v)}
        />
      </Row>
      <Row label="Overnight nights">
        <NumberInput value={s.perDiemNights} onChange={(v) => set("perDiemNights", v)} />
      </Row>
      <Row label="Per-diem rate ($/crew/night)">
        <NumberInput value={s.perDiemRate} onChange={(v) => set("perDiemRate", v)} />
      </Row>
    </Card>
  );
}

function ShortFormDeliverablesCard({
  s,
  set,
  per,
}: {
  s: VideoState;
  set: Setter;
  per: ReturnType<typeof computeVideo>["perDeliverable"];
}) {
  const items = [
    { id: "d_heroStd" as const, label: "Short brand video — Standard", hint: "60–180 sec, polished single piece", unit: 1400, total: per.heroStd },
    { id: "d_heroCine" as const, label: "Short brand video — Cinematic + motion graphics", hint: "60–180 sec, animated graphics", unit: 2200, total: per.heroCine },
    { id: "d_cutdown" as const, label: "Social cutdown", hint: "≤ 60 sec, vertical/square, from existing footage", unit: 275, total: per.cutdown },
    { id: "d_eventRecap" as const, label: "Event recap", hint: "2–4 min event-day highlights", unit: 1800, total: per.eventRecap },
    { id: "d_droneReel" as const, label: "Drone reel", hint: "up to 90 sec, aerial only", unit: 650, total: per.droneReel },
    { id: "d_testimonial" as const, label: "Interview testimonial", hint: "up to 90 sec individual story", unit: 950, total: per.testimonial },
  ];
  return (
    <Card title="Short-form deliverables (under 3 min)">
      <div className="grid grid-cols-[1fr_70px_70px_90px] gap-2 text-[10px] uppercase tracking-wider font-semibold text-tmc-slate border-b-2 border-tmc-gold pb-1">
        <div>Deliverable</div>
        <div className="text-right">Qty</div>
        <div className="text-right">Unit</div>
        <div className="text-right">Total</div>
      </div>
      {items.map((it) => (
        <div key={it.id} className="grid grid-cols-[1fr_70px_70px_90px] gap-2 items-center py-1.5 text-xs border-b last:border-b-0">
          <div>
            <div className="font-medium">{it.label}</div>
            <div className="text-[11px] text-muted-foreground">{it.hint}</div>
          </div>
          <NumberInput value={s[it.id] as number} onChange={(v) => set(it.id, v)} className="w-16" />
          <div className="text-right text-muted-foreground">${it.unit.toLocaleString()}</div>
          <div className="text-right font-semibold tabular-nums">{fmt$(it.total)}</div>
        </div>
      ))}
    </Card>
  );
}

function LongFormDeliverablesCard({
  s,
  set,
  per,
  seriesActive,
}: {
  s: VideoState;
  set: Setter;
  per: ReturnType<typeof computeVideo>["perDeliverable"];
  seriesActive: string[];
}) {
  return (
    <Card
      title="Long-form deliverables (3 min and up)"
      subtitle="Each piece is base + per-additional-minute extension. Series discount auto-applies at 5+ pieces of the same type."
    >
      <div className="grid grid-cols-[1fr_70px_70px_90px] gap-2 text-[10px] uppercase tracking-wider font-semibold text-tmc-slate border-b-2 border-tmc-gold pb-1">
        <div>Type</div>
        <div className="text-right">Qty</div>
        <div className="text-right">Min/each</div>
        <div className="text-right">Total</div>
      </div>
      <LongFormRow
        label="Long-form brand video"
        hint="Case study film, brand documentary · $2,200 base + $500/min over 3 min"
        qty={s.d_featureQty}
        min={s.d_featureMin}
        total={per.featureTotal}
        setQty={(v) => set("d_featureQty", v)}
        setMin={(v) => set("d_featureMin", v)}
      />
      <LongFormRow
        label="Training / educational module"
        hint="Course content, onboarding · $1,800 base + $250/min over 5 min"
        qty={s.d_trainingQty}
        min={s.d_trainingMin}
        total={per.trainingTotal}
        setQty={(v) => set("d_trainingQty", v)}
        setMin={(v) => set("d_trainingMin", v)}
      />
      <LongFormRow
        label="Full-length recording"
        hint="Webinar, panel, podcast · $750 base + $25/min over 30 min"
        qty={s.d_recordingQty}
        min={s.d_recordingMin}
        total={per.recordingTotal}
        setQty={(v) => set("d_recordingQty", v)}
        setMin={(v) => set("d_recordingMin", v)}
      />
      <div className="text-[11px] mt-2 text-right">
        Series discount status:{" "}
        {seriesActive.length > 0 ? (
          <span className="text-green-700 font-medium">
            −15% on {seriesActive.join(", ")}
          </span>
        ) : (
          <span className="text-muted-foreground">none active (need 5+ of one long-form type)</span>
        )}
      </div>
    </Card>
  );
}

function LongFormRow({
  label,
  hint,
  qty,
  min,
  total,
  setQty,
  setMin,
}: {
  label: string;
  hint: string;
  qty: number;
  min: number;
  total: number;
  setQty: (v: number) => void;
  setMin: (v: number) => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_70px_70px_90px] gap-2 items-center py-1.5 text-xs border-b last:border-b-0">
      <div>
        <div className="font-medium">{label}</div>
        <div className="text-[11px] text-muted-foreground">{hint}</div>
      </div>
      <NumberInput value={qty} onChange={setQty} className="w-16" />
      <NumberInput value={min} onChange={setMin} className="w-16" />
      <div className="text-right font-semibold tabular-nums">{fmt$(total)}</div>
    </div>
  );
}

function MultipliersCard({ s, set }: { s: VideoState; set: Setter }) {
  return (
    <Card
      title="Layer 3 — Value multipliers"
      subtitle="Adjust price based on what the project is worth to the client. Compounds on the post-edit subtotal."
    >
      <MultButtons
        label="Business impact"
        hint="How much does this move the needle for the buyer?"
        value={s.impact}
        options={[
          { v: 1.0, label: "Internal · 1.0×" },
          { v: 1.1, label: "Standard · 1.1×" },
          { v: 1.3, label: "High ROI · 1.3×" },
        ]}
        onChange={(v) => set("impact", v)}
      />
      <MultButtons
        label="Risk reduction"
        hint="Does TMC's reputation / process lower their risk?"
        value={s.risk}
        options={[
          { v: 1.0, label: "Off · 1.0×" },
          { v: 1.1, label: "Standard · 1.1×" },
          { v: 1.25, label: "High · 1.25×" },
        ]}
        onChange={(v) => set("risk", v)}
      />
      <MultButtons
        label="Usage rights"
        hint="Where will the finished video live?"
        value={s.usage}
        options={[
          { v: 1.0, label: "Organic · 1.0×" },
          { v: 1.2, label: "Paid ads · 1.2×" },
          { v: 1.4, label: "Full digital · 1.4×" },
          { v: 1.75, label: "Full buyout · 1.75×" },
        ]}
        onChange={(v) => set("usage", v)}
      />
      <MultButtons
        label="Rush turnaround"
        hint="Applies to edit fees only."
        value={s.rush}
        options={[
          { v: 1.0, label: "Standard · 1.0×" },
          { v: 1.15, label: "5–9 days · 1.15×" },
          { v: 1.3, label: "<5 days · 1.3×" },
          { v: 1.5, label: "Same-day · 1.5×" },
        ]}
        onChange={(v) => set("rush", v)}
      />
    </Card>
  );
}

function MultButtons({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  options: { v: number; label: string }[];
  onChange: (v: number) => void;
}) {
  return (
    <div className="py-1 space-y-1.5">
      <div>
        <Label className="text-xs">{label}</Label>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            className={`text-[11px] px-2 py-1 rounded border transition ${
              value === o.v
                ? "bg-tmc-gold border-tmc-gold-dark text-tmc-dark font-semibold"
                : "bg-card border-border text-muted-foreground hover:border-tmc-gold-dark"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className="text-[11px] text-tmc-gold-dark font-semibold">
        {value.toFixed(2)}×
      </div>
    </div>
  );
}

function ModifiersCard({ s, set }: { s: VideoState; set: Setter }) {
  return (
    <Card title="Modifiers">
      <Row label="Extra revision rounds" hint="Beyond 2 included · $150/round">
        <NumberInput value={s.extraRevs} onChange={(v) => set("extraRevs", v)} />
      </Row>
      <Row label="Licensed music upgrades" hint="$150 per deliverable">
        <NumberInput value={s.musicCount} onChange={(v) => set("musicCount", v)} />
      </Row>
      <Row label="Closed-caption / SRT" hint="$80 per deliverable">
        <NumberInput value={s.captionCount} onChange={(v) => set("captionCount", v)} />
      </Row>
      <Row label="Custom line item — name">
        <Input
          value={s.customName}
          onChange={(e) => set("customName", e.target.value)}
          className="w-44 text-left text-xs"
        />
      </Row>
      <Row label="Custom line item — amount ($)">
        <NumberInput value={s.customAmt} onChange={(v) => set("customAmt", v)} />
      </Row>
    </Card>
  );
}

function SafetyCard({ s, set }: { s: VideoState; set: Setter }) {
  return (
    <Card
      title="Layer 4 — Internal safety buffers"
      subtitle="Hidden from client. Protects margin from scope creep, payment fees, estimation error."
      internal
    >
      <CheckboxRow
        label="Apply 5% Oops buffer"
        hint="Absorbs minor scope creep"
        checked={s.oopsBuffer}
        onChange={(v) => set("oopsBuffer", v)}
      />
      <CheckboxRow
        label="Client paying by credit card (+3%)"
        hint="Bake CC fee into the quote"
        checked={s.ccFee}
        onChange={(v) => set("ccFee", v)}
      />
      <CheckboxRow
        label="Apply 1.5× edit-hour estimation multiplier"
        hint="For COGS / margin only — assumes edits run over"
        checked={s.estMult}
        onChange={(v) => set("estMult", v)}
      />
      <Row label="Auto-round increment">
        <Select
          value={String(s.roundInc)}
          onValueChange={(v) => set("roundInc", Number(v))}
        >
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">No rounding</SelectItem>
            <SelectItem value="25">$25</SelectItem>
            <SelectItem value="50">$50</SelectItem>
            <SelectItem value="100">$100</SelectItem>
          </SelectContent>
        </Select>
      </Row>
    </Card>
  );
}

function DiscountsCard({
  s,
  bundleDisc,
  bundleNeed,
  set,
}: {
  s: VideoState;
  bundleDisc: number;
  bundleNeed: number;
  set: Setter;
}) {
  return (
    <Card title="Discounts">
      <CheckboxRow
        label="Recurring monthly client (12-mo agreement)"
        hint="−12% on entire invoice"
        checked={s.recurring}
        onChange={(v) => set("recurring", v)}
      />
      <div className="text-[11px] text-muted-foreground py-1">
        Cutdown bundle (auto): {bundleDisc > 0 ? (
          <span className="text-green-700 font-medium">active −{fmt$(bundleDisc)}</span>
        ) : (
          <span>not active{bundleNeed > 0 ? ` (need ${bundleNeed} more)` : ""}</span>
        )}
      </div>

      <div className="mt-2 pt-2 border-t space-y-1">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-tmc-slate">
          Custom discount
        </div>
        <Row label="Label (shown on quote)">
          <Input
            value={s.customDiscName}
            onChange={(e) => set("customDiscName", e.target.value)}
            placeholder="e.g. Loyalty discount"
            className="w-44 text-left text-xs"
          />
        </Row>
        <Row label="Type">
          <Select
            value={s.customDiscType}
            onValueChange={(v) => set("customDiscType", v as "flat" | "pct")}
          >
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="flat">Flat ($)</SelectItem>
              <SelectItem value="pct">Percent (%)</SelectItem>
            </SelectContent>
          </Select>
        </Row>
        <Row
          label={s.customDiscType === "pct" ? "Amount (%)" : "Amount ($)"}
          hint={
            s.customDiscType === "pct"
              ? "Percent off the post-edit subtotal"
              : "Dollars off"
          }
        >
          <NumberInput
            value={s.customDiscValue}
            onChange={(v) => set("customDiscValue", v)}
            step={s.customDiscType === "pct" ? 1 : 50}
          />
        </Row>
      </div>
    </Card>
  );
}

function AnchorOverridesCard({ s, set }: { s: VideoState; set: Setter }) {
  return (
    <Card
      title="Anchor rate overrides (advanced)"
      subtitle="Override Layer 2 anchor rates for this quote only. Update master spec doc for permanent changes."
      internal
    >
      <Row label="Half-day base">
        <NumberInput value={s.halfDayOverride} onChange={(v) => set("halfDayOverride", v)} step={50} />
      </Row>
      <Row label="Full-day base">
        <NumberInput value={s.fullDayOverride} onChange={(v) => set("fullDayOverride", v)} step={50} />
      </Row>
      <Row label="Extra day rate">
        <NumberInput value={s.extraDayOverride} onChange={(v) => set("extraDayOverride", v)} step={50} />
      </Row>
    </Card>
  );
}

// ─── Quote breakdown (right side) ───────────────────────────────────────

function QuoteBreakdown({
  r,
  s,
}: {
  r: ReturnType<typeof computeVideo>;
  s: VideoState;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <h2 className="text-sm font-semibold tracking-wide text-tmc-slate uppercase">
        Quote breakdown
      </h2>

      <Section title="Layer 2 — Shoot & travel">
        {r.shootLines.length ? r.shootLines.map(([n, v], i) => (
          <QLine key={i} label={n} value={fmt$(v)} />
        )) : <Empty>— no shoot / travel —</Empty>}
      </Section>

      <Section title="Layer 2 — Edit deliverables">
        {r.editLines.length ? r.editLines.map(([n, v], i) => (
          <QLine key={i} label={n} value={fmt$(v)} />
        )) : <Empty>— no deliverables —</Empty>}
      </Section>

      <Section title="Modifiers">
        {r.modLines.length ? r.modLines.map(([n, v], i) => (
          <QLine key={i} label={n} value={fmt$(v)} />
        )) : <Empty>— none —</Empty>}
      </Section>

      <div className="font-bold pt-2 border-t-2 border-tmc-slate">
        <QLine label="Base subtotal" value={fmt$(r.baseSubtotal)} bold />
      </div>

      <Section title="Layer 3 — Value multipliers">
        {r.multLines.map((m, i) =>
          m.mult === 1 ? (
            <QLine key={i} label={m.label} value={`${m.mult.toFixed(2)}× (no change)`} muted />
          ) : (
            <QLine key={i} label={`${m.label} · ${m.mult.toFixed(2)}×`} value={"+" + fmt$(m.after - m.before)} />
          ),
        )}
      </Section>
      <QLine label="After multipliers" value={fmt$(r.adjustedSubtotal)} bold />

      <Section title="Layer 4 — Internal safety" internal>
        {r.safetyLines.length ? r.safetyLines.map(([n, v], i) => (
          <QLine key={i} label={n} value={fmt$(v)} />
        )) : <Empty>— no safety adjustments —</Empty>}
      </Section>

      <Section title="Discounts">
        {r.discountLines.length ? r.discountLines.map(([n, v], i) => (
          <QLine key={i} label={n} value={"−" + fmt$(Math.abs(v))} />
        )) : <Empty>— none —</Empty>}
      </Section>

      <div className="bg-tmc-dark text-white rounded-md p-4 mt-3 text-center">
        {r.discountTotal > 0 ? (
          <>
            <div className="text-[10px] uppercase tracking-widest text-white/60">
              Standard investment
            </div>
            <div className="text-lg font-semibold text-white/70 line-through tabular-nums">
              {fmt$(r.standardRounded)}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-tmc-gold mt-2">
              Your price
            </div>
            <div className="text-3xl font-bold text-tmc-gold mt-0.5">
              {fmt$(r.grandRounded)}
            </div>
            <div className="text-[11px] font-medium text-green-300 mt-1">
              You save {fmt$(r.standardRounded - r.grandRounded)}
            </div>
          </>
        ) : (
          <>
            <div className="text-[10px] uppercase tracking-widest text-tmc-gold">Final quote (rounded)</div>
            <div className="text-3xl font-bold text-tmc-gold mt-1">{fmt$(r.grandRounded)}</div>
          </>
        )}
        <div className="text-[11px] text-white/70 mt-1">
          Range: {fmt$(r.rangeLow)} – {fmt$(r.rangeHigh)}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <Pill label="Floor check" tone={r.cogs === 0 ? "warn" : r.floorOk ? "good" : "danger"}>
          {r.cogs === 0 ? "—" : r.floorOk ? `OK · floor ${fmt$(r.projectFloor)}` : `BELOW · need ${fmt$(r.projectFloor)}`}
        </Pill>
        <Pill
          label="Markup health"
          tone={
            r.cogs === 0 ? "warn" : r.markup >= 250 ? "good" : r.markup >= 120 ? "warn" : "danger"
          }
        >
          {r.cogs === 0 ? "—" : r.markup.toFixed(0) + "%"}
        </Pill>
      </div>

      <Section title="COGS & margin (internal)" internal>
        <QLine label="Admin labor (Nick + 2 hrs PM)" value={fmt$(r.adminLabor)} />
        <QLine label="Full-Time labor (Kit, when on shoot)" value={fmt$(r.ftLabor)} />
        <QLine label="Editor labor (1.5× est. buffer)" value={fmt$(r.editorLabor)} />
        <QLine label="Photography labor (when used)" value={fmt$(r.photoLabor)} />
        <QLine label="Part-Time labor (when used)" value={fmt$(r.ptLabor)} />
        <QLine label="Drone insurance pro-rata" value={fmt$(r.droneIns)} />
        <QLine label="Travel reimbursement" value={fmt$(r.travelReimb)} />
        <QLine label="Software allocation" value={fmt$(r.swAlloc)} />
        <div className="border-t-2 border-tmc-slate mt-1 pt-1 font-bold">
          <QLine label="Total COGS" value={fmt$(r.cogs)} bold />
        </div>
        <QLine label="Gross profit" value={fmt$(r.gross)} bold />
        <QLine label="Gross margin" value={r.margin.toFixed(1) + "%"} bold />
        <QLine label="Markup over COGS" value={r.markup.toFixed(0) + "%"} bold />
      </Section>

      <Section title="Project hours">
        <QLine label="On-site shoot hours" value={r.totalShootHours.toFixed(1) + " hrs"} />
        <QLine label="Edit hours (est.)" value={r.edHoursAdj.toFixed(1) + " hrs"} />
        <QLine label="Total project hours" value={r.projectHours.toFixed(1) + " hrs"} bold />
      </Section>

      <Section title="Tiered packages (anchoring)">
        <div className="grid grid-cols-3 gap-2">
          <TierCard label="Essential" price={r.tierEss} desc="Strip second op, drone, multi-cam" />
          <TierCard label="Signature ★" price={r.tierSig} desc={s.fullDays + s.halfDays > 0 ? "What TMC recommends" : "—"} signature />
          <TierCard label="Premium" price={r.tierPrem} desc="Add second op, drone, double cutdowns" />
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  internal,
  children,
}: {
  title: string;
  internal?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={internal ? "text-orange-700/90" : ""}>
      <h3 className="text-[10px] uppercase tracking-wider font-semibold text-tmc-slate border-b border-border pb-1 mb-1.5">
        {title}
      </h3>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function QLine({
  label,
  value,
  bold,
  muted,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between text-xs gap-3 ${bold ? "font-bold" : ""} ${muted ? "text-muted-foreground" : ""}`}>
      <span className="truncate">{label}</span>
      <span className="tabular-nums whitespace-nowrap">{value}</span>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] text-muted-foreground italic py-1">{children}</div>
  );
}

function Pill({
  label,
  tone,
  children,
}: {
  label: string;
  tone: "good" | "warn" | "danger";
  children: React.ReactNode;
}) {
  const cls = {
    good: "bg-green-50 border-green-300 text-green-800",
    warn: "bg-yellow-50 border-yellow-300 text-yellow-800",
    danger: "bg-red-50 border-red-300 text-red-800",
  }[tone];
  return (
    <div className="rounded-md border bg-card p-2">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
        {label}
      </div>
      <span className={`inline-block mt-1 px-2 py-0.5 text-[11px] rounded border ${cls}`}>
        {children}
      </span>
    </div>
  );
}

function TierCard({
  label,
  price,
  desc,
  signature,
}: {
  label: string;
  price: number;
  desc: string;
  signature?: boolean;
}) {
  return (
    <div className={`rounded-md p-2 text-center border ${signature ? "border-tmc-gold-dark bg-tmc-gold/15" : "border-border bg-muted"}`}>
      <div className="text-[10px] uppercase tracking-wider font-semibold">{label}</div>
      <div className="text-base font-bold tabular-nums my-1">
        {price > 0 ? fmt$(price) : "—"}
      </div>
      <div className="text-[10px] text-muted-foreground leading-tight">{desc}</div>
    </div>
  );
}
