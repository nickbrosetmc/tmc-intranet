// The official proposal document, drawn as real PDF text.
//
// This deliberately does NOT reuse quote-pdf.ts. That module rasterizes HTML
// with html2canvas, which produces a flattened image: a generated quote has
// zero extractable text. That is fine for a sales one-pager and fatal for a
// document going into DocuSign, because DocuSign places signature fields by
// searching the document for anchor strings. No text layer means no anchors,
// which means dragging every field by hand on every proposal.
//
// So this is drawn with jsPDF text primitives. The output is selectable,
// searchable, a few dozen KB, and carries invisible anchor tokens at each
// signature position, so one DocuSign anchor configuration places the fields
// identically on every proposal forever.
//
// Fonts are the PDF built-in Helvetica rather than the brand faces: embedding
// Montserrat and Libre Franklin would add roughly 300KB per weight to every
// document, and a contract set in Helvetica reads as a contract.

import tmcLogo from "@/assets/tmc-logo.png";

/** DocuSign AutoPlace anchors. Configure these once against these strings. */
export const ANCHORS = {
  clientSignature: "\\s1\\",
  clientDate: "\\d1\\",
  clientName: "\\n1\\",
  clientTitle: "\\t1\\",
  tmcSignature: "\\s2\\",
  tmcDate: "\\d2\\",
  guarantorSignature: "\\s3\\",
  guarantorDate: "\\d3\\",
  guarantorName: "\\n3\\",
} as const;

export interface ProposalLine {
  label: string;
  amount: number;
  sublines: string[];
}

export interface ProposalOptionBlock {
  heading: string;
  note?: string;
  items: {
    label: string;
    description?: string;
    detail?: string;
    amount: number;
    unit?: string;
    oneTime?: number;
  }[];
}

export interface ProposalDoc {
  /** Display name; the legal name goes on Schedule A. */
  clientName: string;
  dateLabel: string;
  preparedBy: string;
  intro?: string;
  services: ProposalLine[];
  monthlyStandard: number;
  discounts: { label: string; amount: number }[];
  monthlyFinal: number;
  oneTimes: { label: string; standard: number; final: number }[];
  optionBlocks: ProposalOptionBlock[];
  scheduleRows: { field: string; entry: string }[];
  keyDates: { label: string; value: string }[];
  tcVersion: string;
  tcEffective: string;
  personalGuarantee: boolean;
  /** Free-text scope notes, printed before the investment section. */
  notes?: string;
}

const NAVY: [number, number, number] = [14, 15, 25];
const GOLD: [number, number, number] = [207, 181, 131];
const GOLD_DARK: [number, number, number] = [168, 136, 78];
const SLATE: [number, number, number] = [64, 78, 92];
const LIGHT: [number, number, number] = [212, 216, 217];
const CREAM: [number, number, number] = [241, 241, 240];

const MARGIN = 54; // 0.75in
const PAGE_W = 612;
const PAGE_H = 792;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_SPACE = 54;

type Pdf = import("jspdf").jsPDF;

function money(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

/**
 * The PDF built-in fonts use WinAnsi encoding, which has no U+2212 minus,
 * no arrows and no em dash. Feeding it one prints garbage: a "-$240" written
 * with U+2212 came out as `" $ 2 4 0`. Everything drawn goes through here.
 */
function ansi(s: string): string {
  return s
    .replace(/\u2212/g, "-")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2192/g, ">")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, "...");
}

/**
 * Downscale the logo before embedding. The source asset is ~770KB, which
 * would dwarf the rest of a text PDF.
 */
async function logoDataUrl(px = 128): Promise<string | null> {
  try {
    const url = new URL(tmcLogo, window.location.origin).href;
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.crossOrigin = "anonymous";
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const c = document.createElement("canvas");
    c.width = px;
    c.height = px;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, px, px);
    return c.toDataURL("image/png");
  } catch {
    return null;
  }
}

/** Cursor-based layout over jsPDF, with automatic page breaks. */
class Layout {
  y = MARGIN;
  readonly pdf: Pdf;
  constructor(pdf: Pdf) {
    this.pdf = pdf;
  }

  /** Ensure `h` points fit below the cursor; start a new page if not. */
  need(h: number): void {
    if (this.y + h > PAGE_H - FOOTER_SPACE) this.newPage();
  }

  newPage(): void {
    this.pdf.addPage();
    this.y = MARGIN;
  }

  gap(h: number): void {
    this.y += h;
  }

  rule(color = LIGHT): void {
    this.pdf.setDrawColor(...color);
    this.pdf.setLineWidth(0.5);
    this.pdf.line(MARGIN, this.y, PAGE_W - MARGIN, this.y);
    this.y += 1;
  }

  sectionHeading(text: string): void {
    this.need(34);
    this.pdf.setFont("helvetica", "bold");
    this.pdf.setFontSize(9);
    this.pdf.setTextColor(...SLATE);
    this.pdf.text(ansi(text.toUpperCase()), MARGIN, this.y, { charSpace: 1.1 });
    this.y += 7;
    this.rule(GOLD);
    this.y += 11;
  }

  /** Body paragraph, wrapped. */
  paragraph(text: string, opts: { size?: number; color?: [number, number, number] } = {}): void {
    const size = opts.size ?? 9.5;
    this.pdf.setFont("helvetica", "normal");
    this.pdf.setFontSize(size);
    this.pdf.setTextColor(...(opts.color ?? SLATE));
    const lines = this.pdf.splitTextToSize(ansi(text), CONTENT_W) as string[];
    const lh = size * 1.45;
    for (const line of lines) {
      this.need(lh);
      this.pdf.text(line, MARGIN, this.y);
      this.y += lh;
    }
  }

  /** Label on the left, value right-aligned. */
  row(
    label: string,
    value: string,
    opts: { bold?: boolean; size?: number; valueColor?: [number, number, number] } = {},
  ): void {
    const size = opts.size ?? 10;
    const lh = size * 1.7;
    this.need(lh);
    this.pdf.setFontSize(size);
    this.pdf.setFont("helvetica", "normal");
    this.pdf.setTextColor(...NAVY);
    this.pdf.text(ansi(label), MARGIN, this.y);
    this.pdf.setFont("helvetica", opts.bold ? "bold" : "normal");
    this.pdf.setTextColor(...(opts.valueColor ?? NAVY));
    this.pdf.text(ansi(value), PAGE_W - MARGIN, this.y, { align: "right" });
    this.y += lh;
  }

  bullet(text: string): void {
    const size = 8.5;
    const lh = size * 1.5;
    this.pdf.setFont("helvetica", "normal");
    this.pdf.setFontSize(size);
    const lines = this.pdf.splitTextToSize(ansi(text), CONTENT_W - 16) as string[];
    lines.forEach((line, i) => {
      this.need(lh);
      if (i === 0) {
        this.pdf.setTextColor(...GOLD_DARK);
        this.pdf.text("•", MARGIN + 4, this.y);
      }
      this.pdf.setTextColor(...SLATE);
      this.pdf.text(line, MARGIN + 16, this.y);
      this.y += lh;
    });
  }

  /** Two-column Schedule A style row with a hairline under it. */
  fieldRow(field: string, entry: string): void {
    const size = 9;
    const fieldW = CONTENT_W * 0.45;
    const entryW = CONTENT_W - fieldW - 10;
    this.pdf.setFontSize(size);
    this.pdf.setFont("helvetica", "normal");
    const fLines = this.pdf.splitTextToSize(ansi(field), fieldW - 8) as string[];
    this.pdf.setFont("helvetica", "bold");
    const eLines = this.pdf.splitTextToSize(ansi(entry), entryW) as string[];
    const lh = size * 1.4;
    const h = Math.max(fLines.length, eLines.length) * lh + 8;
    this.need(h);

    let yy = this.y + lh;
    this.pdf.setFont("helvetica", "normal");
    this.pdf.setTextColor(...SLATE);
    for (const l of fLines) {
      this.pdf.text(l, MARGIN, yy);
      yy += lh;
    }
    yy = this.y + lh;
    this.pdf.setFont("helvetica", "bold");
    this.pdf.setTextColor(...NAVY);
    for (const l of eLines) {
      this.pdf.text(l, MARGIN + fieldW + 10, yy);
      yy += lh;
    }
    this.y += h;
    this.rule();
  }

  /**
   * Signature line with an invisible DocuSign anchor sitting on it. The
   * anchor is drawn in white so a signer never sees it, but DocuSign's text
   * search finds it and drops the field in the same spot every time.
   */
  signatureLine(label: string, anchor: string, opts: { half?: boolean } = {}): void {
    const lh = 30;
    this.need(lh + 8);
    const width = opts.half ? CONTENT_W * 0.46 : CONTENT_W;
    this.pdf.setFont("helvetica", "normal");
    this.pdf.setFontSize(8.5);
    this.pdf.setTextColor(...SLATE);
    this.pdf.text(ansi(label), MARGIN, this.y);

    // Anchor sits just above the rule, at the left of the signing area.
    this.pdf.setTextColor(255, 255, 255);
    this.pdf.setFontSize(7);
    this.pdf.text(anchor, MARGIN + 6, this.y + 12);

    this.pdf.setDrawColor(...NAVY);
    this.pdf.setLineWidth(0.7);
    this.pdf.line(MARGIN, this.y + 18, MARGIN + width, this.y + 18);
    this.y += lh;
  }

  /** Two signature lines side by side (signature + date). */
  signaturePair(
    leftLabel: string,
    leftAnchor: string,
    rightLabel: string,
    rightAnchor: string,
  ): void {
    const lh = 34;
    this.need(lh + 8);
    const leftW = CONTENT_W * 0.6;
    const rightX = MARGIN + CONTENT_W * 0.68;
    const rightW = CONTENT_W * 0.32;

    this.pdf.setFont("helvetica", "normal");
    this.pdf.setFontSize(8.5);
    this.pdf.setTextColor(...SLATE);
    this.pdf.text(ansi(leftLabel), MARGIN, this.y);
    this.pdf.text(ansi(rightLabel), rightX, this.y);

    this.pdf.setTextColor(255, 255, 255);
    this.pdf.setFontSize(7);
    this.pdf.text(leftAnchor, MARGIN + 6, this.y + 12);
    this.pdf.text(rightAnchor, rightX + 6, this.y + 12);

    this.pdf.setDrawColor(...NAVY);
    this.pdf.setLineWidth(0.7);
    this.pdf.line(MARGIN, this.y + 18, MARGIN + leftW, this.y + 18);
    this.pdf.line(rightX, this.y + 18, rightX + rightW, this.y + 18);
    this.y += lh;
  }
}

function drawHeader(pdf: Pdf, doc: ProposalDoc, logo: string | null): number {
  const bandH = 92;
  pdf.setFillColor(...NAVY);
  pdf.rect(0, 0, PAGE_W, bandH, "F");
  let textX = MARGIN;
  if (logo) {
    pdf.addImage(logo, "PNG", MARGIN, 22, 48, 48, undefined, "FAST");
    textX = MARGIN + 62;
  }
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(...GOLD);
  pdf.text("TMC MARKETING", textX, 40, { charSpace: 2 });
  pdf.setFontSize(20);
  pdf.setTextColor(255, 255, 255);
  pdf.text("Service Proposal", textX, 62);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...GOLD);
  pdf.text(ansi(doc.clientName || "Prepared for our client"), textX, 76);
  return bandH;
}

/** Page footer, stamped on every page once the total is known. */
function stampFooters(pdf: Pdf, doc: ProposalDoc): void {
  const total = pdf.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i);
    pdf.setDrawColor(...LIGHT);
    pdf.setLineWidth(0.5);
    pdf.line(MARGIN, PAGE_H - 40, PAGE_W - MARGIN, PAGE_H - 40);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...SLATE);
    pdf.text(
      ansi(`TMC Marketing  |  Service Proposal  |  ${doc.clientName}`),
      MARGIN,
      PAGE_H - 28,
    );
    pdf.text(`Page ${i} of ${total}`, PAGE_W - MARGIN, PAGE_H - 28, {
      align: "right",
    });
  }
}

export async function downloadProposalPdf(doc: ProposalDoc): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const logo = await logoDataUrl();

  const pdf = new jsPDF({ unit: "pt", format: "letter", compress: true });
  pdf.setProperties({
    title: `TMC Marketing Service Proposal - ${doc.clientName}`,
    subject: "Service Proposal",
    author: "TMC Marketing LLC",
  });

  const L = new Layout(pdf);
  L.y = drawHeader(pdf, doc, logo) + 26;

  // ── Prepared for / by ──
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(...SLATE);
  pdf.text("PREPARED FOR", MARGIN, L.y, { charSpace: 1 });
  pdf.text("DATE", PAGE_W - MARGIN, L.y, { charSpace: 1, align: "right" });
  L.y += 13;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(...NAVY);
  pdf.text(ansi(doc.clientName), MARGIN, L.y);
  pdf.text(ansi(doc.dateLabel), PAGE_W - MARGIN, L.y, { align: "right" });
  L.y += 8;
  L.rule(GOLD);
  L.gap(20);

  if (doc.intro) {
    L.paragraph(doc.intro);
    L.gap(14);
  }

  // ── Engagement summary ──
  L.sectionHeading("Engagement summary");
  for (const d of doc.keyDates) L.row(d.label, d.value);
  L.gap(16);

  // ── Services ──
  if (doc.services.length) {
    L.sectionHeading("Services included");
    for (const s of doc.services) {
      L.row(s.label, money(s.amount), { bold: true });
      for (const sub of s.sublines) L.bullet(sub);
      L.gap(7);
    }
    L.gap(8);
  }

  if (doc.notes?.trim()) {
    L.sectionHeading("Scope notes");
    L.paragraph(doc.notes.trim());
    L.gap(16);
  }

  // ── Investment ──
  L.sectionHeading("Investment");
  const saved = Math.max(0, doc.monthlyStandard - doc.monthlyFinal);
  if (doc.discounts.length && saved > 0) {
    L.row("Standard monthly investment", `${money(doc.monthlyStandard)}/mo`, {
      valueColor: SLATE,
    });
    for (const d of doc.discounts) {
      L.row(d.label, `-${money(d.amount)}`, { valueColor: GOLD_DARK });
    }
    L.gap(4);
  }
  L.need(40);
  pdf.setFillColor(...CREAM);
  pdf.rect(MARGIN, L.y - 4, CONTENT_W, 34, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(...NAVY);
  pdf.text("YOUR INVESTMENT", MARGIN + 12, L.y + 18, { charSpace: 0.8 });
  pdf.setFontSize(17);
  pdf.setTextColor(...GOLD_DARK);
  pdf.text(`${money(doc.monthlyFinal)}/mo`, PAGE_W - MARGIN - 12, L.y + 19, {
    align: "right",
  });
  L.y += 42;
  for (const ot of doc.oneTimes) {
    L.row(
      `${ot.label} (one-time)`,
      ot.final < ot.standard
        ? `${money(ot.final)} (standard ${money(ot.standard)})`
        : money(ot.final),
      { bold: true, valueColor: GOLD_DARK },
    );
  }
  L.gap(16);

  // ── Options ──
  for (const block of doc.optionBlocks) {
    if (!block.items.length) continue;
    L.sectionHeading(block.heading);
    if (block.note) {
      L.paragraph(block.note, { size: 8.5 });
      L.gap(6);
    }
    for (const it of block.items) {
      L.row(it.label, `${money(it.amount)}${it.unit ?? "/mo"}`, { bold: true });
      if (it.description) L.bullet(it.description);
      if (it.detail) L.bullet(it.detail);
      if (it.oneTime && it.oneTime > 0) {
        L.bullet(`Plus ${money(it.oneTime)} one-time setup`);
      }
      L.gap(6);
    }
    L.gap(10);
  }

  // ── Terms ──
  L.sectionHeading("Terms and conditions");
  L.paragraph(
    `This proposal incorporates the TMC Marketing Terms and Conditions of Service, ` +
      `Version ${doc.tcVersion}, effective ${doc.tcEffective}, which govern this ` +
      `engagement in full. The version in effect on the Start Date governs for the ` +
      `Initial Term; at each renewal, the then-current version applies. A copy is ` +
      `provided with this proposal and is available on written request at any time.`,
  );
  L.gap(8);
  L.paragraph(
    `Cancellation, non-renewal, and termination of any kind require thirty (30) days ` +
      `written notice to info@marketingtmc.com. The Agreement renews automatically ` +
      `for a successive term of the same length unless cancelled. Within thirty (30) ` +
      `days after each Renewal Date, either party may cancel the renewed term without ` +
      `penalty.`,
  );
  L.gap(18);

  // ── Schedule A ──
  L.newPage();
  L.sectionHeading("Schedule A: Engagement summary");
  L.paragraph(
    "This Schedule is completed for every engagement and forms part of the Agreement. " +
      "It exists so that both parties have a single, unambiguous record of the dates " +
      "and commitments that govern the Agreement.",
    { size: 8.5 },
  );
  L.gap(12);
  for (const r of doc.scheduleRows) L.fieldRow(r.field, r.entry);
  L.gap(22);

  // ── Signatures ──
  // Kept together: a signature block split across a page break is the kind of
  // thing that gets a document sent back.
  const blockH = doc.personalGuarantee ? 250 : 150;
  L.need(blockH);
  L.sectionHeading("Acceptance");
  L.paragraph(
    "By signing below, the Client acknowledges having read, understood, and agreed to " +
      `this proposal and to the TMC Marketing Terms and Conditions of Service, Version ${doc.tcVersion}.`,
    { size: 8.5 },
  );
  L.gap(18);
  L.signaturePair(
    "Client signature",
    ANCHORS.clientSignature,
    "Date",
    ANCHORS.clientDate,
  );
  L.signaturePair(
    "Printed name",
    ANCHORS.clientName,
    "Title",
    ANCHORS.clientTitle,
  );
  L.gap(6);
  L.signaturePair(
    "TMC Marketing",
    ANCHORS.tmcSignature,
    "Date",
    ANCHORS.tmcDate,
  );

  if (doc.personalGuarantee) {
    L.gap(20);
    L.sectionHeading("Personal guarantee (Section 15)");
    L.paragraph(
      "By signing below, I am signing in my individual capacity and personally " +
        "guarantee payment of all amounts owed by the Client under this Agreement, on " +
        "the terms set out in Section 15. I acknowledge that I may be pursued directly " +
        "for these amounts and that this guarantee continues through renewal terms.",
      { size: 8.5 },
    );
    L.gap(16);
    L.signaturePair(
      "Guarantor signature",
      ANCHORS.guarantorSignature,
      "Date",
      ANCHORS.guarantorDate,
    );
    L.signatureLine("Printed name", ANCHORS.guarantorName, { half: true });
  }

  stampFooters(pdf, doc);

  const who = (doc.clientName || "Client")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "");
  pdf.save(`TMC-Proposal-${who}.pdf`);
}
