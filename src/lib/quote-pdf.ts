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
  /** Optional one-time charge shown after the monthly summary (e.g.
   *  website design). When final < standard the standard shows struck. */
  oneTime?: { label: string; standard: number; final: number };
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

/**
 * Render the branded quote in an off-screen iframe, rasterize it, and
 * trigger a real PDF download. Falls back to a print window if the PDF
 * libraries fail to load. Heavy libs are dynamically imported so they
 * only load when a quote is actually generated.
 */
export async function downloadQuotePdf(doc: QuoteDoc): Promise<void> {
  const logoUrl = new URL(tmcLogo, window.location.origin).href;
  const html = buildHtml(doc, logoUrl);

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
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, pageW, imgH);
    } else {
      paginateCanvas(pdf, canvas, pageW, pageH);
    }
    pdf.save(fileName(doc));
  } catch {
    // Fallback: open a print window the user can "Save as PDF" from.
    printFallback(html);
  } finally {
    document.body.removeChild(iframe);
  }
}

type PdfDoc = import("jspdf").jsPDF;

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

  const oneTimeBlock = doc.oneTime
    ? `<div class="price-row" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--light-gray)">
        <span class="price-row-label">${esc(doc.oneTime.label)} (one-time)</span>
        <span style="font-variant-numeric:tabular-nums">
          ${
            doc.oneTime.final < doc.oneTime.standard
              ? `<span style="text-decoration:line-through;color:var(--slate);font-size:14px">${money(doc.oneTime.standard)}</span>
                 <span style="font-family:Montserrat,sans-serif;font-weight:800;font-size:20px;color:var(--gold-dark);margin-left:8px">${money(doc.oneTime.final)}</span>`
              : `<span style="font-family:Montserrat,sans-serif;font-weight:800;font-size:20px;color:var(--gold-dark)">${money(doc.oneTime.final)}</span>`
          }
        </span>
      </div>`
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
    ${doc.footnote ? `<div class="footnote">${esc(doc.footnote)}</div>` : ""}

    <div class="footer">
      MARKETINGTMC.COM
      <div class="contact">info@marketingtmc.com</div>
    </div>
  </div>
</body>
</html>`;
}
