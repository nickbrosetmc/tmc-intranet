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

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ unit: "pt", format: "letter" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgH = (canvas.height / canvas.width) * pageW;

    if (imgH <= pageH) {
      pdf.addImage(imgData, "PNG", 0, 0, pageW, imgH);
    } else {
      // Slice across pages: place the full image shifted up each page;
      // off-page content is clipped by the page boundary.
      let position = 0;
      let remaining = imgH;
      while (remaining > 0) {
        pdf.addImage(imgData, "PNG", 0, position, pageW, imgH);
        remaining -= pageH;
        if (remaining > 0) {
          pdf.addPage();
          position -= pageH;
        }
      }
    }
    pdf.save(fileName(doc));
  } catch {
    // Fallback: open a print window the user can "Save as PDF" from.
    printFallback(html);
  } finally {
    document.body.removeChild(iframe);
  }
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
              <td class="line-label">${esc(it.label)}</td>
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
      ${priceNote}
    </div>

    ${doc.footnote ? `<div class="footnote">${esc(doc.footnote)}</div>` : ""}

    <div class="footer">
      MARKETINGTMC.COM
      <div class="contact">info@marketingtmc.com</div>
    </div>
  </div>
</body>
</html>`;
}
