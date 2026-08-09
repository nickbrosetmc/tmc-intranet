// Branded, client-ready quote document. Renders a self-contained quote in
// TMC's house brand (navy + gold, Montserrat / Libre Franklin) inside an
// isolated off-screen iframe, rasterizes it, and downloads a real PDF file.
// Used by both the video and package calculators.
//
// The real TMC logo file (src/assets/tmc-logo.png) is passed in and placed
// unaltered — never recreated as text.

import tmcLogo from "@/assets/tmc-logo.png";

export interface QuoteLineItem {
  label: string;
  amount: number;
  /** Optional "what's included" bullets rendered under the label. */
  sublines?: string[];
}

export interface QuoteSection {
  heading: string;
  items: QuoteLineItem[];
  /** If true, items render as plain bullets without a price column. */
  bulletsOnly?: boolean;
}

export interface QuoteDiscount {
  label: string;
  amount: number; // positive number, the dollars taken off
}

export interface QuoteDoc {
  /** e.g. "Video Production Quote" or "Marketing Package Proposal". */
  docTitle: string;
  clientName?: string;
  dateLabel: string;
  sections: QuoteSection[];
  standardTotal: number;
  discounts: QuoteDiscount[];
  finalTotal: number;
  /** "/mo" for retainers, "" for one-off projects. */
  priceUnit?: string;
  /** Optional smaller note under the price (e.g. project range). */
  priceNote?: string;
  /** One-time charges shown after the monthly summary (e.g. website design,
   *  podcast setup). When final < standard the standard shows struck. */
  oneTimes?: { label: string; standard: number; final: number }[];
  /** Blocks rendered after the price summary — e.g. "Other options we can
   *  scale to" and "Optional add-ons". Not part of the quoted total. */
  extraSections?: {
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
  }[];
  /** Start date / term / renewal, shown as its own block on the proposal. */
  engagement?: { label: string; value: string }[];
  /** Optional fine print at the bottom. */
  footnote?: string;
}

const BRAND = {
  cream: "#F1F1F0",
  gold: "#CFB583",
  goldDark: "#A8884E",
  slate: "#404E5C",
  lightGray: "#D4D8D9",
  navy: "#0E0F19",
};

function money(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}

function esc(s: string): string {
  return s.replace(
    /[<>&"]/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!,
  );
}

function fileName(doc: QuoteDoc): string {
  const who = (doc.clientName || doc.docTitle).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
  return `TMC-Quote-${who}.pdf`;
}

export interface ScheduleADoc {
  clientName: string;
  dateLabel: string;
  tcVersion: string;
  tcEffective: string;
  /** Field / entry pairs, in the order the signed Schedule A lists them. */
  rows: { field: string; entry: string }[];
  /** Plain-language date summary shown above the signature blocks. */
  keyDates: { label: string; value: string }[];
  /** Render the Guarantor signature block (Section 15). */
  personalGuarantee: boolean;
}

function scheduleAFileName(doc: ScheduleADoc): string {
  const who = (doc.clientName || "Client")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "");
  return `TMC-Schedule-A-${who}.pdf`;
}

/**
 * Render the branded quote in an off-screen iframe, rasterize it, and
 * trigger a real PDF download. Falls back to a print window if the PDF
 * libraries fail to load. Heavy libs are dynamically imported so they
 * only load when a quote is actually generated.
 */
export async function downloadQuotePdf(doc: QuoteDoc): Promise<void> {
  const logoUrl = new URL(tmcLogo, window.location.origin).href;
  await renderPdf(buildHtml(doc, logoUrl), fileName(doc));
}

/**
 * Schedule A: the engagement summary that gets attached to the Service
 * Agreement. Shares this module's rasterize/paginate/compress pipeline.
 */
export async function downloadScheduleAPdf(doc: ScheduleADoc): Promise<void> {
  const logoUrl = new URL(tmcLogo, window.location.origin).href;
  await renderPdf(buildScheduleAHtml(doc, logoUrl), scheduleAFileName(doc));
}

/** Rasterize an HTML document off-screen and save it as a letter-size PDF. */
async function renderPdf(html: string, name: string): Promise<void> {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed; left:-10000px; top:0; width:800px; height:1200px; border:0;";
  document.body.appendChild(iframe);

  try {
    const idoc = iframe.contentDocument;
    if (!idoc) throw new Error("no iframe document");
    idoc.open();
    idoc.write(html);
    idoc.close();

    await waitForReady(iframe);

    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import("html2canvas-pro"),
      import("jspdf"),
    ]);

    const target = (idoc.querySelector(".page") as HTMLElement) ?? idoc.body;
    fitToPages(idoc, target);

    const canvas = await html2canvas(target, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
    });

    const pdf = new jsPDF({ unit: "pt", format: "letter" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgH = (canvas.height / canvas.width) * pageW;

    if (imgH <= pageH) {
      pdf.addImage(
        canvas.toDataURL("image/png"),
        "PNG",
        0,
        0,
        pageW,
        imgH,
        undefined,
        IMAGE_COMPRESSION,
      );
    } else {
      paginateCanvas(pdf, canvas, pageW, pageH);
    }
    pdf.save(name);
  } catch {
    // Fallback: open a print window the user can "Save as PDF" from.
    printFallback(html);
  } finally {
    document.body.removeChild(iframe);
  }
}

/**
 * Trim the layout if that saves a page.
 *
 * The rasterized `.page` is mapped across the full letter width, so one PDF
 * page holds `width x 11/8.5` of layout. A quote that runs a few millimetres
 * long spills a near-empty page carrying nothing but the gold footer bar,
 * which reads as a mistake rather than as a two-page document. Step down
 * through the density tiers and keep the first one that drops the page count;
 * if none does, the content genuinely needs the extra page, so leave it at
 * full spacing and let paginateCanvas break it cleanly.
 */
function fitToPages(idoc: Document, target: HTMLElement): void {
  const capacity = target.offsetWidth * (11 / 8.5);
  if (capacity <= 0) return;
  const pages = () => Math.ceil(target.offsetHeight / capacity);
  const natural = pages();
  if (natural <= 1) return;
  for (const tier of ["dense-1", "dense-2", "dense-3"]) {
    idoc.documentElement.classList.add(tier);
    if (pages() < natural) return;
    idoc.documentElement.classList.remove(tier);
  }
}

type PdfDoc = import("jspdf").jsPDF;

/**
 * Canvas PNGs carry an alpha channel, so jsPDF decodes them and embeds a raw
 * bitmap unless told to deflate. Without this a two-page quote ships at ~9MB;
 * with it, ~200KB, and it's lossless either way. "FAST" measured smaller than
 * "MEDIUM" on this content and is quicker than "SLOW" for the same result.
 */
const IMAGE_COMPRESSION = "FAST" as const;

/**
 * Split the rasterized quote across letter pages.
 *
 * Two things matter here. Each page gets its own cropped canvas rather than the
 * full-height image nudged upward, so a page only carries its own pixels (the
 * old approach embedded the whole image once per page and pushed quotes past
 * 8MB). And each cut is pulled up to the nearest band of blank pixels, so a
 * break lands in the gutter between blocks instead of slicing through a line of
 * text or a table row.
 */
function paginateCanvas(
  pdf: PdfDoc,
  canvas: HTMLCanvasElement,
  pageW: number,
  pageH: number,
): void {
  const ctx = canvas.getContext("2d");
  const pxPerPt = canvas.width / pageW;
  // Canvas pixels per CSS pixel, used to size the whitespace bands we look for.
  const unit = Math.max(1, Math.round(canvas.width / 720));
  const pagePx = Math.floor(pageH * pxPerPt);
  // Breathing room at the top of continuation pages so content does not butt
  // up against the trim edge.
  const gapPx = Math.round(18 * pxPerPt);
  const blank = ctx ? scanBlankRows(ctx, canvas.width, canvas.height) : null;

  let y = 0;
  let page = 0;
  // Hard cap: a runaway loop must not lock up the browser.
  while (y < canvas.height && page < 40) {
    const topPad = page === 0 ? 0 : gapPx;
    const budget = pagePx - topPad;
    let sliceH = Math.min(budget, canvas.height - y);

    if (blank && y + sliceH < canvas.height) {
      // Never give up more than 40% of the page hunting for a gap.
      const cut = findCut(blank, unit, y + sliceH, y + Math.floor(budget * 0.6));
      if (cut > y) sliceH = cut - y;
    }

    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = sliceH + topPad;
    const sctx = slice.getContext("2d");
    if (!sctx) break;
    sctx.fillStyle = "#ffffff";
    sctx.fillRect(0, 0, slice.width, slice.height);
    sctx.drawImage(
      canvas,
      0,
      y,
      canvas.width,
      sliceH,
      0,
      topPad,
      canvas.width,
      sliceH,
    );

    if (page > 0) pdf.addPage();
    pdf.addImage(
      slice.toDataURL("image/png"),
      "PNG",
      0,
      0,
      pageW,
      slice.height / pxPerPt,
      undefined,
      IMAGE_COMPRESSION,
    );

    y += sliceH;
    page += 1;
  }
}

/**
 * Flag every row that is a single flat color across its width, meaning nothing
 * (text, rule, border, chart) crosses it. Those rows are safe to cut on.
 */
function scanBlankRows(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): Uint8Array | null {
  const flags = new Uint8Array(height);
  const step = Math.max(1, Math.floor(width / 400));
  const CHUNK = 512;
  for (let top = 0; top < height; top += CHUNK) {
    const h = Math.min(CHUNK, height - top);
    let data: Uint8ClampedArray;
    try {
      data = ctx.getImageData(0, top, width, h).data;
    } catch {
      // Tainted canvas: fall back to plain page-height cuts.
      return null;
    }
    for (let row = 0; row < h; row++) {
      const base = row * width * 4;
      const r0 = data[base];
      const g0 = data[base + 1];
      const b0 = data[base + 2];
      let flat = true;
      for (let x = step; x < width; x += step) {
        const i = base + x * 4;
        if (
          Math.abs(data[i] - r0) > 6 ||
          Math.abs(data[i + 1] - g0) > 6 ||
          Math.abs(data[i + 2] - b0) > 6
        ) {
          flat = false;
          break;
        }
      }
      flags[top + row] = flat ? 1 : 0;
    }
  }
  return flags;
}

/**
 * Walk up from the ideal cut looking for a run of blank rows. A wide band is a
 * real gap between blocks; the narrow retry catches leading between two lines
 * when a section is taller than a page and has to break somewhere.
 */
function findCut(
  blank: Uint8Array,
  unit: number,
  ideal: number,
  floor: number,
): number {
  const start = Math.min(ideal, blank.length - 1);
  for (const band of [10 * unit, 2 * unit]) {
    for (let y = start; y > floor + band; y--) {
      let ok = true;
      for (let k = 0; k < band; k++) {
        if (!blank[y - k]) {
          ok = false;
          break;
        }
      }
      if (ok) return y + 1;
    }
  }
  return ideal;
}

function waitForReady(iframe: HTMLIFrameElement): Promise<void> {
  return new Promise((resolve) => {
    const idoc = iframe.contentDocument;
    const finish = () => {
      const fonts = (idoc as Document & { fonts?: FontFaceSet }).fonts;
      const ready = fonts?.ready ?? Promise.resolve();
      ready.finally(() => setTimeout(resolve, 200));
    };
    if (idoc && idoc.readyState === "complete") finish();
    else iframe.contentWindow?.addEventListener("load", finish, { once: true });
    // Hard timeout so a slow font/image can't hang the download.
    setTimeout(resolve, 4000);
  });
}

function printFallback(html: string): void {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.open();
  w.document.write(
    html.replace(
      "</body>",
      `<script>window.addEventListener("load",function(){setTimeout(function(){window.print();},300);});</script></body>`,
    ),
  );
  w.document.close();
}

function buildHtml(doc: QuoteDoc, logoUrl: string): string {
  const unit = doc.priceUnit ?? "";
  const savings = Math.max(0, doc.standardTotal - doc.finalTotal);
  const hasDiscount = doc.discounts.length > 0 && savings > 0;

  const sectionsHtml = doc.sections
    .filter((s) => s.items.length > 0)
    .map(
      (s) => `
      <section class="block">
        <h2 class="block-heading">${esc(s.heading)}</h2>
        <table class="lines">
          ${s.items
            .map(
              (it) => `
            <tr>
              <td class="line-label">
                ${esc(it.label)}
                ${
                  it.sublines && it.sublines.length
                    ? `<ul class="sublines">${it.sublines
                        .map((sl) => `<li>${esc(sl)}</li>`)
                        .join("")}</ul>`
                    : ""
                }
              </td>
              ${
                s.bulletsOnly
                  ? `<td class="line-check">✓</td>`
                  : `<td class="line-amt">${money(it.amount)}</td>`
              }
            </tr>`,
            )
            .join("")}
        </table>
      </section>`,
    )
    .join("");

  const discountHtml = hasDiscount
    ? `
      <section class="block discounts">
        <h2 class="block-heading">Discounts applied</h2>
        <table class="lines">
          ${doc.discounts
            .map(
              (d) => `
            <tr>
              <td class="line-label">${esc(d.label)}</td>
              <td class="line-amt disc">&minus;${money(d.amount)}</td>
            </tr>`,
            )
            .join("")}
        </table>
      </section>`
    : "";

  const priceBlock = hasDiscount
    ? `
      <div class="price-row">
        <span class="price-row-label">Standard investment</span>
        <span class="price-row-strike">${money(doc.standardTotal)}${esc(unit)}</span>
      </div>
      <div class="price-row save">
        <span class="price-row-label">You save</span>
        <span class="price-row-save">${money(savings)}</span>
      </div>
      <div class="price-final">
        <span class="price-final-label">Your investment</span>
        <span class="price-final-amt">${money(doc.finalTotal)}<span class="unit">${esc(unit)}</span></span>
      </div>`
    : `
      <div class="price-final">
        <span class="price-final-label">Your investment</span>
        <span class="price-final-amt">${money(doc.finalTotal)}<span class="unit">${esc(unit)}</span></span>
      </div>`;

  const priceNote = doc.priceNote
    ? `<div class="price-note">${esc(doc.priceNote)}</div>`
    : "";

  const oneTimeList = (doc.oneTimes ?? []).filter((o) => o.final > 0 || o.standard > 0);
  const oneTimeBlock = oneTimeList.length
    ? oneTimeList
        .map(
          (ot, i) => `<div class="price-row" style="margin-top:${i === 0 ? 12 : 4}px;${
            i === 0 ? "padding-top:12px;border-top:1px solid var(--light-gray);" : ""
          }">
        <span class="price-row-label">${esc(ot.label)} (one-time)</span>
        <span style="font-variant-numeric:tabular-nums">
          ${
            ot.final < ot.standard
              ? `<span style="text-decoration:line-through;color:var(--slate);font-size:14px">${money(ot.standard)}</span>
                 <span style="font-family:Montserrat,sans-serif;font-weight:800;font-size:20px;color:var(--gold-dark);margin-left:8px">${money(ot.final)}</span>`
              : `<span style="font-family:Montserrat,sans-serif;font-weight:800;font-size:20px;color:var(--gold-dark)">${money(ot.final)}</span>`
          }
        </span>
      </div>`,
        )
        .join("")
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(doc.docTitle)}${doc.clientName ? " — " + esc(doc.clientName) : ""}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,600;0,700;0,800;1,800&family=Libre+Franklin:wght@400;500;600&display=swap" rel="stylesheet" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  :root {
    --cream: ${BRAND.cream};
    --gold: ${BRAND.gold};
    --gold-dark: ${BRAND.goldDark};
    --slate: ${BRAND.slate};
    --light-gray: ${BRAND.lightGray};
    --navy: ${BRAND.navy};
  }
  html, body { background: #fff; }
  body {
    font-family: "Libre Franklin", system-ui, sans-serif;
    color: var(--navy);
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    width: 7.5in;
    margin: 0 auto;
    padding: 0;
  }

  /* Header band */
  .header {
    background: var(--navy);
    color: var(--cream);
    padding: 32px 40px;
    display: flex;
    align-items: center;
    gap: 20px;
  }
  .header img { width: 64px; height: 64px; object-fit: contain; }
  .header .eyebrow {
    font-family: "Montserrat", sans-serif;
    font-weight: 600;
    font-size: 11px;
    letter-spacing: 2.5px;
    text-transform: uppercase;
    color: var(--gold);
  }
  .header .title {
    font-family: "Montserrat", sans-serif;
    font-weight: 800;
    font-size: 26px;
    line-height: 1.1;
    margin-top: 4px;
  }

  /* Meta row (client + date) */
  .meta {
    display: flex;
    justify-content: space-between;
    padding: 20px 40px;
    border-bottom: 2px solid var(--gold);
  }
  .meta .label {
    font-family: "Montserrat", sans-serif;
    font-weight: 600;
    font-size: 9px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: var(--slate);
  }
  .meta .value {
    font-size: 15px;
    font-weight: 600;
    margin-top: 2px;
  }
  .meta .right { text-align: right; }

  /* Body */
  .body { padding: 28px 40px 8px; }
  .block { margin-bottom: 22px; }
  .block-heading {
    font-family: "Montserrat", sans-serif;
    font-weight: 700;
    font-size: 11px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: var(--slate);
    padding-bottom: 6px;
    margin-bottom: 8px;
    border-bottom: 1px solid var(--light-gray);
  }
  table.lines { width: 100%; border-collapse: collapse; }
  table.lines td { padding: 6px 0; font-size: 14px; vertical-align: top; }
  .line-label { color: var(--navy); }
  .line-amt {
    text-align: right;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    padding-left: 24px;
  }
  .line-amt.disc { color: var(--gold-dark); }
  .line-check { text-align: right; color: var(--gold-dark); font-weight: 700; }
  ul.sublines { list-style: none; margin: 4px 0 2px; }
  ul.sublines li { font-size: 12px; color: var(--slate); padding: 1.5px 0 1.5px 14px; position: relative; }
  ul.sublines li::before { content: "•"; color: var(--gold-dark); position: absolute; left: 2px; }
  .discounts .block-heading { color: var(--gold-dark); border-bottom-color: var(--gold); }

  /* Price summary */
  .summary {
    margin: 8px 40px 0;
    background: var(--cream);
    border-radius: 10px;
    padding: 22px 26px;
  }
  .price-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 3px 0;
  }
  .price-row-label {
    font-family: "Montserrat", sans-serif;
    font-weight: 600;
    font-size: 11px;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--slate);
  }
  .price-row-strike {
    font-size: 16px;
    color: var(--slate);
    text-decoration: line-through;
    font-variant-numeric: tabular-nums;
  }
  .price-row-save { font-size: 15px; font-weight: 700; color: var(--gold-dark); font-variant-numeric: tabular-nums; }
  .price-final {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-top: 10px;
    padding-top: 14px;
    border-top: 2px solid var(--gold);
  }
  /* No discount block above it: the rule would be a divider with nothing on
     the other side. Applies to every density tier. */
  .price-final:first-child { margin-top: 0; padding-top: 0; border-top: 0; }
  .price-final-label {
    font-family: "Montserrat", sans-serif;
    font-weight: 800;
    font-size: 15px;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: var(--navy);
  }
  .price-final-amt {
    font-family: "Montserrat", sans-serif;
    font-weight: 800;
    font-size: 40px;
    line-height: 1;
    color: var(--gold-dark);
    font-variant-numeric: tabular-nums;
  }
  .price-final-amt .unit { font-size: 18px; color: var(--slate); font-weight: 600; }
  .price-note { text-align: right; font-size: 12px; color: var(--slate); margin-top: 8px; }

  .footnote { padding: 16px 40px 0; font-size: 11px; color: var(--slate); line-height: 1.5; }

  .options { padding: 18px 40px 0; }
  .opt-block { margin-bottom: 14px; }
  .opt-heading {
    font-family: "Montserrat", sans-serif; font-weight: 700; font-size: 11px;
    letter-spacing: 1.5px; text-transform: uppercase; color: var(--slate);
    padding-bottom: 5px; margin-bottom: 8px; border-bottom: 1px solid var(--light-gray);
  }
  .opt-note { font-size: 12px; color: var(--slate); margin: -4px 0 8px; }
  .opt-row {
    display: flex; justify-content: space-between; align-items: baseline;
    gap: 16px; padding: 7px 12px; background: var(--cream);
    border-radius: 8px; margin-bottom: 6px;
  }
  .opt-name { font-weight: 600; font-size: 14px; }
  .opt-desc { font-size: 12px; color: var(--slate); margin-top: 2px; }
  .opt-detail { font-size: 11px; color: var(--gold-dark); margin-top: 2px; font-weight: 600; }
  .opt-price {
    font-family: "Montserrat", sans-serif; font-weight: 800; font-size: 18px;
    color: var(--gold-dark); white-space: nowrap; font-variant-numeric: tabular-nums;
  }
  .opt-price .u { font-size: 12px; color: var(--slate); font-weight: 600; }
  .opt-onetime { font-size: 11px; color: var(--slate); display: block; text-align: right; margin-top: 2px; }

  /* Gold footer bar */
  .footer {
    margin-top: 28px;
    background: var(--gold);
    color: var(--navy);
    text-align: center;
    padding: 14px 40px;
    font-family: "Montserrat", sans-serif;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    font-size: 12px;
  }
  .footer .contact { font-weight: 500; letter-spacing: 0.5px; text-transform: none; font-size: 11px; margin-top: 2px; }

  /* Density tiers, roughly -6% / -13% / -21% of layout height. fitToPages()
     applies the gentlest one that pulls the document onto one fewer page, so
     a quote never spills a few millimetres of content (usually nothing but
     the gold footer bar) onto a page of its own. Whitespace only, apart from
     the hero price, so body type always reads at full size. */
  html.dense-1 .header { padding: 28px 40px; }
  html.dense-1 .meta { padding: 17px 40px; }
  html.dense-1 .body { padding: 24px 40px 7px; }
  html.dense-1 .block { margin-bottom: 19px; }
  html.dense-1 .block-heading { padding-bottom: 5px; margin-bottom: 7px; }
  html.dense-1 table.lines td { padding: 5px 0; }
  html.dense-1 ul.sublines li { padding-top: 1.25px; padding-bottom: 1.25px; }
  html.dense-1 .summary { margin-top: 7px; padding: 19px 25px; }
  html.dense-1 .price-final { margin-top: 8px; padding-top: 12px; }
  html.dense-1 .price-final-amt { font-size: 37px; }
  html.dense-1 .options { padding-top: 15px; }
  html.dense-1 .opt-block { margin-bottom: 12px; }
  html.dense-1 .opt-row { padding: 6px 12px; margin-bottom: 5px; }
  html.dense-1 .footnote { padding-top: 14px; }
  html.dense-1 .footer { margin-top: 22px; padding: 12px 40px; }

  html.dense-2 .header { padding: 24px 40px; }
  html.dense-2 .meta { padding: 15px 40px; }
  html.dense-2 .body { padding: 20px 40px 6px; }
  html.dense-2 .block { margin-bottom: 16px; }
  html.dense-2 .block-heading { padding-bottom: 4px; margin-bottom: 6px; }
  html.dense-2 table.lines td { padding: 4px 0; }
  html.dense-2 ul.sublines li { padding-top: 1px; padding-bottom: 1px; }
  html.dense-2 .summary { margin-top: 6px; padding: 16px 24px; }
  html.dense-2 .price-final { margin-top: 7px; padding-top: 10px; }
  html.dense-2 .price-final-amt { font-size: 34px; }
  html.dense-2 .options { padding-top: 12px; }
  html.dense-2 .opt-block { margin-bottom: 10px; }
  html.dense-2 .opt-row { padding: 5px 12px; margin-bottom: 4px; }
  html.dense-2 .footnote { padding-top: 12px; }
  html.dense-2 .footer { margin-top: 18px; padding: 11px 40px; }

  html.dense-3 .header { padding: 18px 40px; }
  html.dense-3 .meta { padding: 12px 40px; }
  html.dense-3 .body { padding: 14px 40px 4px; }
  html.dense-3 .block { margin-bottom: 12px; }
  html.dense-3 .block-heading { padding-bottom: 3px; margin-bottom: 4px; }
  html.dense-3 table.lines td { padding: 3px 0; }
  html.dense-3 ul.sublines li { padding-top: 0; padding-bottom: 0; }
  html.dense-3 .summary { margin-top: 4px; padding: 12px 20px; }
  html.dense-3 .price-final { margin-top: 5px; padding-top: 8px; }
  html.dense-3 .price-final-amt { font-size: 30px; }
  html.dense-3 .options { padding-top: 8px; }
  html.dense-3 .opt-block { margin-bottom: 8px; }
  html.dense-3 .opt-row { padding: 4px 12px; margin-bottom: 3px; }
  html.dense-3 .footnote { padding-top: 8px; }
  html.dense-3 .footer { margin-top: 12px; padding: 9px 40px; }

  @page { margin: 0.5in; }
  @media print {
    .page { width: 100%; }
    body { background: #fff; }
  }
</style>
</head>
<body>
  <div class="page">
    <div class="header">
      <img src="${logoUrl}" alt="TMC Marketing" />
      <div>
        <div class="eyebrow">TMC Marketing</div>
        <div class="title">${esc(doc.docTitle)}</div>
      </div>
    </div>

    <div class="meta">
      <div>
        <div class="label">Prepared for</div>
        <div class="value">${doc.clientName ? esc(doc.clientName) : "Valued client"}</div>
      </div>
      <div class="right">
        <div class="label">Date</div>
        <div class="value">${esc(doc.dateLabel)}</div>
      </div>
    </div>

    <div class="body">
      ${sectionsHtml}
      ${discountHtml}
    </div>

    <div class="summary">
      ${priceBlock}
      ${oneTimeBlock}
      ${priceNote}
    </div>

    ${
      doc.extraSections && doc.extraSections.length
        ? `<div class="options">${doc.extraSections
            .filter((sec) => sec.items.length > 0)
            .map(
              (sec) => `
          <div class="opt-block">
            <div class="opt-heading">${esc(sec.heading)}</div>
            ${sec.note ? `<div class="opt-note">${esc(sec.note)}</div>` : ""}
            ${sec.items
              .map(
                (it) => `
              <div class="opt-row">
                <div>
                  <div class="opt-name">${esc(it.label)}</div>
                  ${it.description ? `<div class="opt-desc">${esc(it.description)}</div>` : ""}
                  ${it.detail ? `<div class="opt-detail">${esc(it.detail)}</div>` : ""}
                </div>
                <div>
                  <span class="opt-price">${money(it.amount)}<span class="u">${esc(it.unit ?? "/mo")}</span></span>
                  ${
                    it.oneTime && it.oneTime > 0
                      ? `<span class="opt-onetime">+ ${money(it.oneTime)} one-time setup</span>`
                      : ""
                  }
                </div>
              </div>`,
              )
              .join("")}
          </div>`,
            )
            .join("")}</div>`
        : ""
    }
    ${
      doc.engagement && doc.engagement.length
        ? `<div class="options"><div class="opt-block">
            <div class="opt-heading">Engagement terms</div>
            <table class="lines">
              ${doc.engagement
                .map(
                  (e) => `<tr>
                    <td class="line-label">${esc(e.label)}</td>
                    <td class="line-amt">${esc(e.value)}</td>
                  </tr>`,
                )
                .join("")}
            </table>
          </div></div>`
        : ""
    }
    ${doc.footnote ? `<div class="footnote">${esc(doc.footnote)}</div>` : ""}

    <div class="footer">
      MARKETINGTMC.COM
      <div class="contact">info@marketingtmc.com</div>
    </div>
  </div>
</body>
</html>`;
}


/**
 * Schedule A: Engagement Summary. Mirrors the table in the Terms document so
 * a signed copy and a generated copy line up field for field, with the key
 * dates spelled out above the signature blocks. The Terms themselves are not
 * regenerated here: this attaches to them and cites the governing version.
 */
function buildScheduleAHtml(doc: ScheduleADoc, logoUrl: string): string {
  const rows = doc.rows
    .map(
      (r) => `
      <tr>
        <td class="sa-field">${esc(r.field)}</td>
        <td class="sa-entry">${esc(r.entry)}</td>
      </tr>`,
    )
    .join("");

  const dates = doc.keyDates.length
    ? `<div class="block">
        <h2 class="block-heading">Key dates</h2>
        <table class="lines">
          ${doc.keyDates
            .map(
              (d) => `<tr>
                <td class="line-label">${esc(d.label)}</td>
                <td class="line-amt">${esc(d.value)}</td>
              </tr>`,
            )
            .join("")}
        </table>
      </div>`
    : "";

  const guarantee = doc.personalGuarantee
    ? `<div class="sa-sign" style="margin-top:26px">
        <div class="block-heading">Personal Guarantee (Section 15)</div>
        <p class="sa-note">By signing below, I am signing in my individual capacity and
        personally guarantee payment of all amounts owed by the Client under this
        Agreement, on the terms set out in Section 15. I acknowledge that I may be
        pursued directly for these amounts and that this guarantee continues through
        renewal terms.</p>
        <div class="sa-line">Guarantor signature: <span></span> Date: <span class="short"></span></div>
        <div class="sa-line">Printed name: <span></span></div>
      </div>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Schedule A${doc.clientName ? " — " + esc(doc.clientName) : ""}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,600;0,700;0,800&family=Libre+Franklin:wght@400;500;600&display=swap" rel="stylesheet" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  :root {
    --cream: ${BRAND.cream};
    --gold: ${BRAND.gold};
    --gold-dark: ${BRAND.goldDark};
    --slate: ${BRAND.slate};
    --light-gray: ${BRAND.lightGray};
    --navy: ${BRAND.navy};
  }
  html, body { background: #fff; }
  body { font-family: "Libre Franklin", system-ui, sans-serif; color: var(--navy); }
  .page { width: 7.5in; margin: 0 auto; }
  .header {
    background: var(--navy); color: var(--cream);
    padding: 28px 40px; display: flex; align-items: center; gap: 20px;
  }
  .header img { width: 56px; height: 56px; object-fit: contain; }
  .header .eyebrow {
    font-family: "Montserrat", sans-serif; font-weight: 600; font-size: 11px;
    letter-spacing: 2.5px; text-transform: uppercase; color: var(--gold);
  }
  .header .title {
    font-family: "Montserrat", sans-serif; font-weight: 800; font-size: 24px;
    line-height: 1.1; margin-top: 4px;
  }
  .meta {
    display: flex; justify-content: space-between;
    padding: 16px 40px; border-bottom: 2px solid var(--gold);
    font-size: 12px; color: var(--slate);
  }
  .body { padding: 22px 40px 8px; }
  .intro { font-size: 12px; color: var(--slate); line-height: 1.5; margin-bottom: 16px; }
  .block { margin-bottom: 18px; }
  .block-heading {
    font-family: "Montserrat", sans-serif; font-weight: 700; font-size: 11px;
    letter-spacing: 1.5px; text-transform: uppercase; color: var(--slate);
    padding-bottom: 6px; margin-bottom: 8px; border-bottom: 1px solid var(--light-gray);
  }
  table { width: 100%; border-collapse: collapse; }
  table.lines td { padding: 5px 0; font-size: 13px; vertical-align: top; }
  .line-label { color: var(--navy); }
  .line-amt { text-align: right; font-weight: 600; white-space: nowrap; padding-left: 24px; }
  .sa-field {
    width: 45%; padding: 7px 12px 7px 0; font-size: 12px; color: var(--slate);
    border-bottom: 1px solid var(--light-gray); vertical-align: top;
  }
  .sa-entry {
    padding: 7px 0; font-size: 13px; font-weight: 600;
    border-bottom: 1px solid var(--light-gray); vertical-align: top;
  }
  .sa-sign { padding: 4px 40px 0; }
  .sa-note { font-size: 11px; color: var(--slate); line-height: 1.5; margin-bottom: 12px; }
  .sa-line { font-size: 12px; margin-top: 16px; display: flex; align-items: baseline; gap: 8px; }
  .sa-line span {
    flex: 1; border-bottom: 1px solid var(--navy); height: 14px; display: inline-block;
  }
  .sa-line span.short { flex: 0 0 120px; }
  .footnote { padding: 16px 40px 0; font-size: 10px; color: var(--slate); line-height: 1.5; }
  .footer {
    margin-top: 24px; background: var(--gold); color: var(--navy);
    text-align: center; padding: 12px 40px;
    font-family: "Montserrat", sans-serif; font-weight: 700;
    letter-spacing: 1.5px; text-transform: uppercase; font-size: 11px;
  }
  html.dense-1 .body { padding-top: 16px; }
  html.dense-1 .sa-field, html.dense-1 .sa-entry { padding-top: 5px; padding-bottom: 5px; }
  html.dense-1 .sa-line { margin-top: 12px; }
  html.dense-2 .header { padding: 22px 40px; }
  html.dense-2 .body { padding-top: 14px; }
  html.dense-2 .sa-field, html.dense-2 .sa-entry { padding-top: 4px; padding-bottom: 4px; }
  html.dense-2 .sa-line { margin-top: 10px; }
  html.dense-3 .header { padding: 16px 40px; }
  html.dense-3 .body { padding-top: 10px; }
  html.dense-3 .sa-field, html.dense-3 .sa-entry { padding-top: 3px; padding-bottom: 3px; }
  html.dense-3 .sa-line { margin-top: 8px; }
  html.dense-3 .footer { margin-top: 14px; }
</style>
</head>
<body>
  <div class="page">
    <div class="header">
      <img src="${logoUrl}" alt="TMC Marketing" />
      <div>
        <div class="eyebrow">TMC Marketing</div>
        <div class="title">Schedule A: Engagement Summary</div>
      </div>
    </div>
    <div class="meta">
      <div>${doc.clientName ? esc(doc.clientName) : "Client"}</div>
      <div>Terms and Conditions Version ${esc(doc.tcVersion)} &middot; Effective ${esc(doc.tcEffective)}</div>
    </div>
    <div class="body">
      <p class="intro">This Schedule is completed for every engagement and attached to the
      Service Agreement or Order Form. It exists so that both parties have a single,
      unambiguous record of the dates and commitments that govern the Agreement.</p>
      <table>${rows}</table>
    </div>
    <div class="body" style="padding-top:14px">${dates}</div>
    <div class="sa-sign">
      <div class="sa-line">Client signature: <span></span> Date: <span class="short"></span></div>
      <div class="sa-line">Printed name and title: <span></span></div>
      <div class="sa-line">TMC Marketing: <span></span> Date: <span class="short"></span></div>
    </div>
    ${guarantee}
    <div class="footnote">Prepared ${esc(doc.dateLabel)}. Dates shown are calculated from the
    Start Date and Initial Term under Sections 3.1 to 3.6 of the Terms and Conditions.
    Where this Schedule and the Terms conflict, the Terms control except where this
    Schedule expressly identifies the section it modifies.</div>
    <div class="footer">marketingtmc.com</div>
  </div>
</body>
</html>`;
}
