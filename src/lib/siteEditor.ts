// Constrained website-editing engine. Renders a client's stitched site
// (header + a page body + footer) inside an iframe document and lets the
// client edit ONLY the marked zones (data-edit). Tracks every change with an
// undo, and regenerates the COMPLETE header/footer/body blocks for GHL — the
// whole block, even if one line changed, with all data-edit markers intact.
//
// Framework-agnostic on purpose: React just hands it the iframe document.

import type { ProjectWithPages, SubmissionBlock, SubmissionChange } from "./website";

type Scope = "header" | "footer" | number; // number = pageId

interface ChangeRec {
  label: string;
  from: string;
  to: string;
  scope: Scope;
  revert: () => void;
}

const AFFORDANCE_CSS = `
  [data-edit] { position: relative; }
  .__ed-on [data-edit="text"]:hover, .__ed-on [data-edit="image"]:hover {
    outline: 2px dashed #2f80ed; outline-offset: 3px; cursor: text; border-radius: 4px; }
  .__ed-on [data-edit="image"]:hover { cursor: pointer; }
  .__ed-on [data-scope="global"]:hover { outline-color: #d99a00; }
  [contenteditable="true"] { outline: 2px solid #2f80ed !important; outline-offset: 3px;
    border-radius: 4px; background: #fffdf2; }
  .__ed-item { position: relative; }
  .__ed-on .__ed-item:hover { outline: 1px dashed #b9c6da; outline-offset: 4px; }
  .__ed-tools { position: absolute; top: -12px; right: -6px; display: none; gap: 4px; z-index: 5; }
  .__ed-on .__ed-item:hover > .__ed-tools { display: flex; }
  .__ed-tools button { width: 26px; height: 26px; border-radius: 6px; border: 1px solid #d6dce6;
    background: #fff; cursor: pointer; font-size: 13px; line-height: 1; box-shadow: 0 2px 6px rgba(0,0,0,.15); }
  .__ed-dragging { opacity: .4; }
  .__ed-add { text-align: center; padding: 10px; }
  .__ed-add button { border: 1px dashed #b9c6da; background: #f7f9fc; color: #4a5a72;
    border-radius: 8px; padding: 8px 16px; cursor: pointer; font-size: 13px; font-family: system-ui, sans-serif; }
`;

export interface SiteEditorOptions {
  doc: Document;
  project: ProjectWithPages;
  uploadImage: (file: File) => Promise<string>;
  onChange: () => void;
}

export class SiteEditor {
  private doc: Document;
  private project: ProjectWithPages;
  private uploadImage: (file: File) => Promise<string>;
  private onChange: () => void;

  private headerHost!: HTMLElement;
  private footerHost!: HTMLElement;
  private bodyHost!: HTMLElement;
  private bodyEls = new Map<number, HTMLElement>();
  private activeId = 0;

  private changes = new Map<string, ChangeRec>();
  private originals = new Map<string, string>();
  private uid = 0;
  private reorderTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(opts: SiteEditorOptions) {
    this.doc = opts.doc;
    this.project = opts.project;
    this.uploadImage = opts.uploadImage;
    this.onChange = opts.onChange;
  }

  mount() {
    const doc = this.doc;
    doc.open();
    doc.write(
      `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body class="__ed-on"><div id="__hdr"></div><div id="__body"></div><div id="__ftr"></div></body></html>`,
    );
    doc.close();

    const style = doc.createElement("style");
    style.textContent = AFFORDANCE_CSS;
    doc.head.appendChild(style);

    this.headerHost = doc.getElementById("__hdr")!;
    this.bodyHost = doc.getElementById("__body")!;
    this.footerHost = doc.getElementById("__ftr")!;

    this.headerHost.innerHTML = this.project.project.headerHtml;
    this.wire(this.headerHost, "Header", "header");

    for (const page of this.project.pages) {
      const wrap = doc.createElement("div");
      wrap.className = "__page";
      wrap.innerHTML = page.bodyHtml;
      this.bodyHost.appendChild(wrap);
      this.bodyEls.set(page.id, wrap);
      this.wire(wrap, page.title, page.id);
    }

    this.footerHost.innerHTML = this.project.project.footerHtml;
    this.wire(this.footerHost, "Footer", "footer");

    if (this.project.pages[0]) this.showPage(this.project.pages[0].id);
  }

  showPage(pageId: number) {
    this.activeId = pageId;
    for (const [id, el] of this.bodyEls) el.style.display = id === pageId ? "" : "none";
  }
  getActivePageId() {
    return this.activeId;
  }

  reset() {
    // After a submit: keep the edits on screen but re-baseline so new edits
    // track fresh.
    this.changes.clear();
    this.originals.clear();
    this.uid = 0;
    // Re-snapshot originals for currently-wired text/image nodes.
    for (const el of this.doc.querySelectorAll<HTMLElement>("[data-ed-id]")) {
      const id = el.getAttribute("data-ed-id")!;
      this.originals.set(
        id,
        el.getAttribute("data-edit") === "text"
          ? (el.textContent ?? "").trim()
          : (el as HTMLImageElement).getAttribute("src") ?? "",
      );
    }
    this.onChange();
  }

  getChanges(): SubmissionChange[] {
    return [...this.changes.values()].map((c) => ({ label: c.label, group: this.groupTitle(c.scope) }));
  }
  changeList() {
    return [...this.changes.entries()].map(([key, c]) => ({
      key,
      label: c.label,
      from: c.from,
      to: c.to,
      global: c.scope === "header" || c.scope === "footer",
    }));
  }
  changeCount() {
    return this.changes.size;
  }
  revert(key: string) {
    const c = this.changes.get(key);
    if (c) c.revert();
    this.changes.delete(key);
    this.onChange();
  }

  buildBlocks(): SubmissionBlock[] {
    const scopes = new Set([...this.changes.values()].map((c) => c.scope));
    const blocks: SubmissionBlock[] = [];
    if (scopes.has("header"))
      blocks.push({
        title: "Universal header block",
        note: "complete header — paste over the existing universal header in GHL",
        code: this.clean(this.headerHost),
      });
    if (scopes.has("footer"))
      blocks.push({
        title: "Universal footer block",
        note: "complete footer — paste over the existing universal footer in GHL",
        code: this.clean(this.footerHost),
      });
    for (const page of this.project.pages) {
      if (scopes.has(page.id)) {
        const el = this.bodyEls.get(page.id)!;
        blocks.push({
          title: `Page ${page.slug} — body block`,
          note: "complete body — paste over this page’s body in GHL",
          code: this.clean(el),
        });
      }
    }
    return blocks;
  }

  // ── internals ──

  private groupTitle(scope: Scope): string {
    if (scope === "header") return "Universal header block";
    if (scope === "footer") return "Universal footer block";
    const page = this.project.pages.find((p) => p.id === scope);
    return `Page ${page?.slug ?? "?"} — body block`;
  }

  private clean(host: HTMLElement): string {
    const c = host.cloneNode(true) as HTMLElement;
    c.querySelectorAll(".__ed-tools, .__ed-add").forEach((n) => n.remove());
    c.querySelectorAll("[contenteditable]").forEach((n) => n.removeAttribute("contenteditable"));
    c.querySelectorAll("[draggable]").forEach((n) => n.removeAttribute("draggable"));
    c.querySelectorAll("[data-ed-id]").forEach((n) => n.removeAttribute("data-ed-id"));
    c.querySelectorAll(".__ed-item").forEach((n) => n.classList.remove("__ed-item"));
    return c.innerHTML.replace(/\n\s*\n/g, "\n").trim();
  }

  private wire(container: HTMLElement, ctx: string, scope: Scope) {
    container.querySelectorAll<HTMLElement>('[data-edit="text"]').forEach((el) => {
      if (!el.dataset.edWired) this.wireText(el, ctx, scope);
    });
    container.querySelectorAll<HTMLImageElement>('[data-edit="image"]').forEach((el) => {
      if (!el.dataset.edWired) this.wireImage(el, ctx, scope);
    });
    container.querySelectorAll<HTMLElement>('[data-edit="list"]').forEach((el) => {
      if (!el.dataset.edWired) this.wireList(el, ctx, scope);
    });
  }

  private snapshot(el: HTMLElement): string {
    let id = el.getAttribute("data-ed-id");
    if (!id) {
      id = `e${++this.uid}`;
      el.setAttribute("data-ed-id", id);
    }
    if (!this.originals.has(id)) {
      this.originals.set(
        id,
        el.getAttribute("data-edit") === "text"
          ? (el.textContent ?? "").trim()
          : (el as HTMLImageElement).getAttribute("src") ?? "",
      );
    }
    return id;
  }

  private labelFor(el: HTMLElement, ctx: string): string {
    const heading = el.closest("section,header,footer")?.querySelector("h1,h2,h3")?.textContent?.trim();
    const field = heading?.slice(0, 24) || el.tagName.toLowerCase();
    return `${ctx} · ${field}`;
  }

  private record(key: string, label: string, from: string, to: string, scope: Scope, revert: () => void) {
    this.changes.set(key, { label, from, to, scope, revert });
    this.onChange();
  }

  private wireText(el: HTMLElement, ctx: string, scope: Scope) {
    el.dataset.edWired = "1";
    const id = this.snapshot(el);
    el.addEventListener("click", () => {
      if (el.getAttribute("contenteditable") === "true") return;
      el.setAttribute("contenteditable", "true");
      el.focus();
      const sel = this.doc.getSelection?.();
      sel?.selectAllChildren(el);
    });
    el.addEventListener("blur", () => {
      el.removeAttribute("contenteditable");
      const now = (el.textContent ?? "").trim();
      const was = this.originals.get(id) ?? "";
      if (now !== was) {
        this.record(id, this.labelFor(el, ctx), was, now, scope, () => {
          el.textContent = was;
        });
      } else if (this.changes.has(id)) {
        this.changes.delete(id);
        this.onChange();
      }
    });
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && el.tagName !== "P") {
        e.preventDefault();
        el.blur();
      }
    });
  }

  private wireImage(el: HTMLImageElement, ctx: string, scope: Scope) {
    el.dataset.edWired = "1";
    const id = this.snapshot(el);
    const origSrc = this.originals.get(id) ?? "";
    el.addEventListener("click", () => {
      const input = this.doc.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        const preview = URL.createObjectURL(file);
        el.src = preview;
        this.record(id, this.labelFor(el, ctx), "(original image)", `📷 ${file.name}`, scope, () => {
          el.src = origSrc;
        });
        try {
          const url = await this.uploadImage(file);
          el.src = url;
          const rec = this.changes.get(id);
          if (rec) rec.revert = () => (el.src = origSrc);
        } catch {
          el.src = origSrc;
          this.changes.delete(id);
          this.onChange();
        }
      };
      input.click();
    });
  }

  private wireList(list: HTMLElement, ctx: string, scope: Scope) {
    list.dataset.edWired = "1";
    const originalOrder = [...list.querySelectorAll<HTMLElement>(":scope > [data-edit-item]")];
    list.querySelectorAll<HTMLElement>(":scope > [data-edit-item]").forEach((item) =>
      this.decorateItem(item, list, ctx, scope),
    );
    this.wire(list, ctx, scope); // wire text/images inside items

    const addRow = this.doc.createElement("div");
    addRow.className = "__ed-add";
    const btn = this.doc.createElement("button");
    btn.textContent = "+ Add item";
    btn.onclick = () => {
      const first = list.querySelector<HTMLElement>("[data-edit-item]");
      if (!first) return;
      const clone = first.cloneNode(true) as HTMLElement;
      clone.querySelectorAll(".__ed-tools").forEach((n) => n.remove());
      clone.querySelectorAll<HTMLElement>("[data-ed-id]").forEach((n) => {
        n.removeAttribute("data-ed-id");
        delete n.dataset.edWired;
      });
      delete clone.dataset.edWired;
      list.appendChild(clone);
      this.decorateItem(clone, list, ctx, scope);
      this.wire(clone, ctx, scope);
      this.record(`add${++this.uid}`, `${ctx} · added list item`, "", "＋ new item", scope, () =>
        clone.remove(),
      );
    };
    addRow.appendChild(btn);
    list.after(addRow);

    // stash for reorder revert
    (list as unknown as { __order?: HTMLElement[] }).__order = originalOrder;
  }

  private decorateItem(item: HTMLElement, list: HTMLElement, ctx: string, scope: Scope) {
    item.classList.add("__ed-item");
    if (item.querySelector(":scope > .__ed-tools")) return;
    const tools = this.doc.createElement("div");
    tools.className = "__ed-tools";
    tools.innerHTML =
      '<button data-a="up" title="Move up">↑</button><button data-a="down" title="Move down">↓</button><button data-a="del" title="Remove">✕</button>';
    tools.querySelector('[data-a="up"]')!.addEventListener("click", (e) => {
      e.stopPropagation();
      const prev = item.previousElementSibling;
      if (prev && prev.hasAttribute("data-edit-item")) list.insertBefore(item, prev);
      this.logReorder(list, ctx, scope);
    });
    tools.querySelector('[data-a="down"]')!.addEventListener("click", (e) => {
      e.stopPropagation();
      const next = item.nextElementSibling;
      if (next) list.insertBefore(next, item);
      this.logReorder(list, ctx, scope);
    });
    tools.querySelector('[data-a="del"]')!.addEventListener("click", (e) => {
      e.stopPropagation();
      const parent = item.parentNode!;
      const next = item.nextElementSibling;
      item.remove();
      this.record(`del${++this.uid}`, `${ctx} · removed list item`, "item", "", scope, () => {
        parent.insertBefore(item, next);
      });
    });
    item.appendChild(tools);

    item.setAttribute("draggable", "true");
    item.addEventListener("dragstart", () => item.classList.add("__ed-dragging"));
    item.addEventListener("dragend", () => {
      item.classList.remove("__ed-dragging");
      this.logReorder(list, ctx, scope);
    });
    item.addEventListener("dragover", (e) => {
      e.preventDefault();
      const dragging = list.querySelector<HTMLElement>(".__ed-dragging");
      if (!dragging || dragging === item) return;
      const r = item.getBoundingClientRect();
      const after = e.clientY - r.top > r.height / 2;
      list.insertBefore(dragging, after ? item.nextElementSibling : item);
    });
  }

  private logReorder(list: HTMLElement, ctx: string, scope: Scope) {
    if (this.reorderTimer) clearTimeout(this.reorderTimer);
    this.reorderTimer = setTimeout(() => {
      const order = (list as unknown as { __order?: HTMLElement[] }).__order ?? [];
      this.record(`reorder-${scope}-${(list.dataset.edId ?? list.className)}`, `${ctx} · reordered list`, "original order", "new order", scope, () => {
        order.forEach((n) => {
          if (n.isConnected) list.appendChild(n);
        });
      });
    }, 150);
  }
}
