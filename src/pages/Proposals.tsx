// The official proposal generator. Separate from the calculators on purpose:
// the calculators produce a sales quote, this produces the document that goes
// into DocuSign and gets signed.
//
// The one-click "Pull from calculator" bridge reads the package the pricing
// calculator already saved to localStorage, so pricing is worked out there and
// transcribed here rather than typed twice.

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FileSignature, Download, Info, RefreshCw } from "lucide-react";
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
import {
  applyPackageDiscount,
  computePackage,
  DEFAULT_PACKAGE,
  fetchSettings,
  optionDetail,
  optionMonthly,
  proposalServiceLines,
  quoteTotals,
  type CalculatorSettings,
  type PackageState,
} from "@/lib/calculator";
import {
  DEFAULT_TERMS,
  deriveAgreement,
  formatLongDate,
  scheduleARows,
  TC_EFFECTIVE,
  TC_VERSION,
  TERM_OPTIONS,
  termLabel,
  type EngagementTerms,
  type TermLength,
} from "@/lib/agreement";
import {
  ANCHORS,
  downloadProposalPdf,
  type ProposalLine,
  type ProposalOptionBlock,
} from "@/lib/proposal-pdf";

const PKG_STORAGE_KEY = "tmc.calculator.package.v1";
const STORAGE_KEY = "tmc.proposal.v1";

interface ProposalState {
  clientName: string;
  intro: string;
  notes: string;
  preparedBy: string;
  services: ProposalLine[];
  monthlyStandard: number;
  monthlyFinal: number;
  discounts: { label: string; amount: number }[];
  oneTimes: { label: string; standard: number; final: number }[];
  optionBlocks: ProposalOptionBlock[];
  terms: EngagementTerms;
}

const EMPTY: ProposalState = {
  clientName: "",
  intro:
    "Thank you for the opportunity. The following outlines the scope, investment, and terms for our engagement.",
  notes: "",
  preparedBy: "",
  services: [],
  monthlyStandard: 0,
  monthlyFinal: 0,
  discounts: [],
  oneTimes: [],
  optionBlocks: [],
  terms: DEFAULT_TERMS,
};

function load(): ProposalState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ProposalState>;
      return {
        ...EMPTY,
        ...parsed,
        terms: { ...EMPTY.terms, ...(parsed.terms ?? {}) },
        services: parsed.services ?? [],
        discounts: parsed.discounts ?? [],
        oneTimes: parsed.oneTimes ?? [],
        optionBlocks: parsed.optionBlocks ?? [],
      };
    }
  } catch {
    /* ignore */
  }
  return EMPTY;
}

export function ProposalsPage() {
  const userState = useUser();
  const [settings, setSettings] = useState<CalculatorSettings | null>(null);
  const [p, setP] = useState<ProposalState>(load);
  const [busy, setBusy] = useState(false);
  const [showAnchors, setShowAnchors] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    } catch {
      /* ignore */
    }
  }, [p]);

  useEffect(() => {
    if (userState.status !== "authenticated") return;
    if (userState.user.type !== "team") return;
    fetchSettings()
      .then(setSettings)
      .catch((e: Error) => toast.error(`Failed to load settings: ${e.message}`));
  }, [userState.status]);

  // Default the preparer to whoever is signed in.
  useEffect(() => {
    if (
      userState.status === "authenticated" &&
      userState.user.type === "team" &&
      !p.preparedBy
    ) {
      setP((s) => ({ ...s, preparedBy: userState.user.name ?? "" }));
    }
  }, [userState.status]);

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
          Proposals are for the TMC team.
        </p>
      </div>
    );
  }

  // Cite whatever the team has configured; the constants are only a fallback
  // for the moment before settings load.
  const tcVersion = settings?.tcVersion?.trim() || TC_VERSION;
  const tcEffective = settings?.tcEffective?.trim() || TC_EFFECTIVE;
  const derived = deriveAgreement(p.terms, p.monthlyFinal);
  const setTerms = (patch: Partial<EngagementTerms>) =>
    setP((s) => ({ ...s, terms: { ...s.terms, ...patch } }));

  /** Copy pricing and scope across from the pricing calculator. */
  function pullFromCalculator() {
    if (!settings) {
      toast.error("Settings still loading.");
      return;
    }
    let pkg: PackageState;
    try {
      const raw = localStorage.getItem(PKG_STORAGE_KEY);
      if (!raw) {
        toast.error("No saved package. Build one in the package calculator first.");
        return;
      }
      const parsed = JSON.parse(raw) as Partial<PackageState>;
      pkg = {
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
    } catch {
      toast.error("Couldn't read the saved package.");
      return;
    }

    const results = computePackage(pkg, settings);
    const disc = applyPackageDiscount(
      results.targetPrice,
      pkg.discountType,
      pkg.discountValue,
    );
    const hostingComp = results.hostingComped ? results.websiteMonthly : 0;
    const calculated = Math.max(0, disc.final - hostingComp);
    const totals = quoteTotals(
      pkg.priceOverride != null ? pkg.priceOverride : calculated,
      [
        ...(hostingComp > 0
          ? [
              {
                label: "Hosting free with your monthly service package",
                amount: hostingComp,
              },
            ]
          : []),
        ...(disc.off > 0
          ? [{ label: pkg.discountName || "Discount applied", amount: disc.off }]
          : []),
      ],
    );

    // Allocate from the standard the proposal prints, so a hand-set price
    // reaches the service lines instead of leaving them on the calculated one.
    const breakdown = proposalServiceLines(pkg, results, totals.standard);
    if (breakdown.length === 0) {
      toast.error("That package has no services turned on.");
      return;
    }

    const alts = pkg.options.filter((o) => o.kind === "alternative");
    const addons = pkg.options.filter((o) => o.kind === "addon");
    const toItems = (list: typeof pkg.options) =>
      list.map((o) => ({
        label: o.label || "Option",
        description: o.description || undefined,
        detail: optionDetail(o) || undefined,
        amount: optionMonthly(o),
        unit: "/mo",
        oneTime: o.oneTimePrice > 0 ? o.oneTimePrice : undefined,
      }));
    const blocks: ProposalOptionBlock[] = [];
    if (alts.length) {
      blocks.push({
        heading: "Other ways we can scale this",
        note: "Swap in place of the package above. Same team, different volume.",
        items: toItems(alts),
      });
    }
    if (addons.length) {
      blocks.push({
        heading: "Optional add-ons",
        note: "Available on top of your package whenever you're ready.",
        items: toItems(addons),
      });
    }

    setP((s) => ({
      ...s,
      clientName: pkg.clientName.trim() || s.clientName,
      services: breakdown.map((b) => ({
        label: b.label,
        amount: b.amount,
        sublines: b.sublines,
      })),
      monthlyStandard: totals.standard,
      monthlyFinal: totals.final,
      discounts: totals.discounts,
      oneTimes: [
        ...(pkg.web.enabled
          ? [
              {
                label: pkg.web.ecommerce
                  ? "Website design with online store"
                  : "Website design",
                standard: results.websiteDesignStandardPrice,
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
      optionBlocks: blocks,
    }));
    toast.success("Pulled from the calculator.");
  }

  async function generate() {
    const name = p.terms.clientLegalName.trim() || p.clientName.trim();
    if (!name) {
      toast.error("Add a client name first.");
      return;
    }
    if (p.services.length === 0) {
      toast.error("Pull a package from the calculator, or the proposal has no scope.");
      return;
    }
    setBusy(true);
    try {
      const keyDates: { label: string; value: string }[] = [
        {
          label: "Start date",
          value: p.terms.startDate
            ? formatLongDate(p.terms.startDate)
            : "On first payment",
        },
        { label: "Initial term", value: termLabel(p.terms.termLength) },
        {
          label: "Renewal date",
          value: derived.renewalDate
            ? formatLongDate(derived.renewalDate)
            : "Monthly, until cancelled",
        },
      ];
      if (derived.nonRenewalNoticeBy) {
        keyDates.push({
          label: "Notice required by, to prevent renewal",
          value: formatLongDate(derived.nonRenewalNoticeBy),
        });
      }
      if (derived.setupFee > 0) {
        keyDates.push({
          label: "Setup fee (one-time, non-refundable)",
          value: `$${derived.setupFee.toLocaleString()}`,
        });
      }
      keyDates.push({ label: "Notice to cancel", value: "30 days, in writing" });

      await downloadProposalPdf({
        clientName: name,
        dateLabel: new Date().toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        }),
        preparedBy: p.preparedBy,
        intro: p.intro.trim() || undefined,
        services: p.services,
        monthlyStandard: p.monthlyStandard,
        discounts: p.discounts,
        monthlyFinal: p.monthlyFinal,
        oneTimes: p.oneTimes,
        optionBlocks: p.optionBlocks,
        scheduleRows: scheduleARows(
          p.terms,
          p.monthlyFinal,
          derived,
          enabledServiceLabelsFrom(p.services),
        ),
        keyDates,
        tcVersion,
        tcEffective,
        personalGuarantee: p.terms.personalGuarantee,
        notes: p.notes,
      });
      toast.success("Proposal downloaded");
    } catch (e) {
      toast.error(`Couldn't generate: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-4xl space-y-6">
      <header className="flex items-start justify-between border-b border-tmc-gold/40 pb-4 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-tmc-dark">
            Proposal Generator{" "}
            <span className="ml-2 inline-block text-[10px] uppercase tracking-widest font-semibold bg-tmc-dark text-tmc-gold px-2 py-0.5 rounded">
              Signature-ready
            </span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            The official document that goes to DocuSign. Selectable text with
            anchor tags, so signature fields land in the same place every time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={pullFromCalculator} className="gap-1">
            <RefreshCw size={14} /> Pull from calculator
          </Button>
          <Button
            size="sm"
            onClick={generate}
            disabled={busy}
            className="gap-1 bg-tmc-gold text-tmc-dark hover:bg-tmc-gold-dark"
          >
            <Download size={14} /> {busy ? "Generating…" : "Download proposal"}
          </Button>
        </div>
      </header>

      {p.services.length === 0 && (
        <div className="rounded-lg border border-dashed bg-card p-6 text-center space-y-2">
          <p className="text-sm text-tmc-dark font-medium">Start from a priced package</p>
          <p className="text-sm text-muted-foreground">
            Build the package in the pricing calculator, then pull it across.
            Scope, pricing, discounts and options come with it.
          </p>
          <Button variant="outline" size="sm" onClick={pullFromCalculator} className="gap-1 mt-1">
            <RefreshCw size={14} /> Pull from calculator
          </Button>
        </div>
      )}

      {/* ── Parties ── */}
      <Card title="Client and parties" icon={<FileSignature size={14} />}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <F label="Client display name">
            <Input
              value={p.clientName}
              onChange={(e) => setP((s) => ({ ...s, clientName: e.target.value }))}
              placeholder="Lakeshore BID"
            />
          </F>
          <F label="Client legal name (Schedule A)">
            <Input
              value={p.terms.clientLegalName}
              onChange={(e) => setTerms({ clientLegalName: e.target.value })}
              placeholder="Lakeshore BID, Inc."
            />
          </F>
          <F label="Location or entity">
            <Input
              value={p.terms.locationEntity}
              onChange={(e) => setTerms({ locationEntity: e.target.value })}
              placeholder="If multi-location"
            />
          </F>
          <F label="Prepared by">
            <Input
              value={p.preparedBy}
              onChange={(e) => setP((s) => ({ ...s, preparedBy: e.target.value }))}
            />
          </F>
          <F label="Authorized signer">
            <Input
              value={p.terms.signerName}
              onChange={(e) => setTerms({ signerName: e.target.value })}
            />
          </F>
          <F label="Signer title">
            <Input
              value={p.terms.signerTitle}
              onChange={(e) => setTerms({ signerTitle: e.target.value })}
              placeholder="Owner"
            />
          </F>
          <F label="Billing contact">
            <Input
              value={p.terms.billingContact}
              onChange={(e) => setTerms({ billingContact: e.target.value })}
            />
          </F>
          <F label="Billing email">
            <Input
              type="email"
              value={p.terms.billingEmail}
              onChange={(e) => setTerms({ billingEmail: e.target.value })}
            />
          </F>
          <F label="Notice email on file">
            <Input
              type="email"
              value={p.terms.noticeEmail}
              onChange={(e) => setTerms({ noticeEmail: e.target.value })}
              placeholder="Where renewal notices go"
            />
          </F>
        </div>
      </Card>

      {/* ── Dates ── */}
      <Card title="Dates and term" icon={<FileSignature size={14} />}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <F label="Start date">
            <Input
              type="date"
              value={p.terms.startDate}
              onChange={(e) => setTerms({ startDate: e.target.value })}
            />
          </F>
          <F label="Initial term">
            <Select
              value={p.terms.termLength}
              onValueChange={(v) => setTerms({ termLength: v as TermLength })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TERM_OPTIONS.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </F>
          <F label="Approval window">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={30}
                value={p.terms.approvalWindowDays}
                onChange={(e) =>
                  setTerms({
                    approvalWindowDays: Math.max(1, Number(e.target.value) || 1),
                  })
                }
                className="w-20 tabular-nums"
              />
              <span className="text-xs text-muted-foreground">business days</span>
            </div>
          </F>
        </div>
        <div className="flex flex-wrap gap-5 pt-1">
          <Check
            checked={p.terms.rawFileAccess}
            onChange={(v) => setTerms({ rawFileAccess: v })}
            label="Raw file access during term"
          />
          <Check
            checked={p.terms.personalGuarantee}
            onChange={(v) => setTerms({ personalGuarantee: v })}
            label="Personal guarantee required"
          />
        </div>
        {p.terms.personalGuarantee && (
          <F label="Guarantor name">
            <Input
              value={p.terms.guarantorName}
              onChange={(e) => setTerms({ guarantorName: e.target.value })}
              className="sm:max-w-xs"
            />
          </F>
        )}
        <div className="rounded-md bg-muted p-3 space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-tmc-slate">
            Calculated from the Terms
          </p>
          {!p.terms.startDate ? (
            <p className="text-xs text-muted-foreground">
              Set a start date to see renewal and notice dates. Without one,
              Section 2 makes the Start Date the date of first payment.
            </p>
          ) : (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs">
              <D
                label="Renews"
                value={
                  derived.renewalDate
                    ? formatLongDate(derived.renewalDate)
                    : "Monthly, until cancelled"
                }
              />
              {derived.nonRenewalNoticeBy && (
                <D label="Notice by, to stop renewal" value={formatLongDate(derived.nonRenewalNoticeBy)} />
              )}
              {derived.penaltyFreeWindowEnds && (
                <D label="Penalty-free window closes" value={formatLongDate(derived.penaltyFreeWindowEnds)} />
              )}
              {derived.sixMonthRequestBy && (
                <D label="Six-month review, request by" value={formatLongDate(derived.sixMonthRequestBy)} />
              )}
              {derived.setupFee > 0 && (
                <D label="Setup fee" value={`$${derived.setupFee.toLocaleString()}`} />
              )}
              <D
                label="Early termination floor"
                value={`$${derived.earlyTerminationFloor.toLocaleString()}`}
              />
            </dl>
          )}
        </div>
      </Card>

      {/* ── Scope + investment summary ── */}
      <Card title="Scope and investment" icon={<FileSignature size={14} />}>
        {p.services.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing pulled in yet.
          </p>
        ) : (
          <>
            <ul className="space-y-1.5">
              {p.services.map((s, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-tmc-dark">{s.label}</span>
                  <span className="tabular-nums font-medium">
                    ${s.amount.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex items-baseline justify-between gap-3 border-t pt-2">
              <span className="font-bold text-tmc-dark">Monthly investment</span>
              <span className="text-xl font-bold text-tmc-gold-dark tabular-nums">
                ${p.monthlyFinal.toLocaleString()}
                <span className="text-xs text-muted-foreground font-medium">/mo</span>
              </span>
            </div>
            {p.oneTimes.map((o, i) => (
              <div key={i} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-muted-foreground">{o.label} (one-time)</span>
                <span className="tabular-nums">${o.final.toLocaleString()}</span>
              </div>
            ))}
          </>
        )}
        <F label="Opening paragraph">
          <textarea
            className="w-full min-h-[70px] rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={p.intro}
            onChange={(e) => setP((s) => ({ ...s, intro: e.target.value }))}
          />
        </F>
        <F label="Scope notes (optional)">
          <textarea
            className="w-full min-h-[70px] rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={p.notes}
            onChange={(e) => setP((s) => ({ ...s, notes: e.target.value }))}
            placeholder="Anything specific to this engagement that isn't a line item."
          />
        </F>
      </Card>

      {/* ── DocuSign setup ── */}
      <div className="rounded-lg border bg-card p-4 space-y-2">
        <button
          type="button"
          onClick={() => setShowAnchors((v) => !v)}
          className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-tmc-slate"
        >
          <Info size={13} />
          DocuSign setup
          <span className="text-tmc-gold-dark normal-case tracking-normal font-normal">
            {showAnchors ? "hide" : "show"}
          </span>
        </button>
        {showAnchors && (
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              Configure these anchor strings once on your DocuSign template. Every
              proposal carries them as invisible white text at the signing lines, so
              the fields place themselves the same way each time.
            </p>
            <table className="text-xs w-full">
              <tbody>
                {[
                  ["Client signature", ANCHORS.clientSignature],
                  ["Client date signed", ANCHORS.clientDate],
                  ["Client printed name", ANCHORS.clientName],
                  ["Client title", ANCHORS.clientTitle],
                  ["TMC signature", ANCHORS.tmcSignature],
                  ["TMC date signed", ANCHORS.tmcDate],
                  ["Guarantor signature", ANCHORS.guarantorSignature],
                  ["Guarantor date", ANCHORS.guarantorDate],
                  ["Guarantor printed name", ANCHORS.guarantorName],
                ].map(([label, anchor]) => (
                  <tr key={anchor} className="border-b last:border-0">
                    <td className="py-1 text-muted-foreground">{label}</td>
                    <td className="py-1 text-right">
                      <code className="bg-muted px-1.5 py-0.5 rounded font-mono">
                        {anchor}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-muted-foreground">
              Guarantor anchors only appear when a personal guarantee is elected.
              Set the anchor offset so the field sits on the line, not on the token.
            </p>
          </div>
        )}
      </div>

      <Toaster />
    </div>
  );
}

/** Schedule A wants service names, not priced lines. */
function enabledServiceLabelsFrom(services: ProposalLine[]): string[] {
  return services.map((s) => s.label);
}

function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-5 space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-tmc-slate flex items-center gap-2">
        <span className="bg-tmc-gold text-tmc-dark w-7 h-7 rounded inline-flex items-center justify-center">
          {icon}
        </span>
        {title}
      </h2>
      {children}
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Check({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-tmc-gold-dark w-4 h-4"
      />
      {label}
    </label>
  );
}

function D({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-tmc-dark tabular-nums">{value}</dd>
    </div>
  );
}
