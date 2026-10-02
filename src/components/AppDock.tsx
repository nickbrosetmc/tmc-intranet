// The homepage launcher as a dock along the bottom of the window: one row,
// groups split by a thin rule, and the icons nearest the pointer swell with
// the cosine falloff the macOS dock uses. It renders into the #dock-slot
// that App places between the page and the footer, which sticks to the
// bottom of the window while you scroll and settles just above the
// copyright line at the end of the page.
//
// Sizes are written straight to the DOM from a single requestAnimationFrame
// loop instead of React state, so hovering costs no re-renders, and the loop
// stops once every icon has settled. Touch screens have no hover to drive the
// effect and a dock of every app doesn't fit a phone, so those get the
// compact springboard in the page instead (the `fallback`), as does any window
// too narrow for the dock even at its smallest icon size.

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { openApp, type App, type GroupWithApps } from "@/lib/apps";

/** Resting icon size, px. Shrinks toward MIN_BASE when the row is tight. */
const BASE = 48;
const MIN_BASE = 36;
/** The icon directly under the pointer grows to this multiple. */
const MAX_SCALE = 1.5;
/** How far the swell reaches either side of the pointer, in resting icons. */
const REACH_ICONS = 2.5;
const GAP = 8;
const PAD = 8;
/** Space under the shelf, and the side gutters. */
const INSET = 16;
/** Fraction of the remaining distance covered each frame. */
const EASE = 0.22;

/**
 * `groups` is null while the apps are loading. On a touch screen the
 * fallback (a skeleton, then the springboard) holds the launcher's place in
 * the page; with a mouse nothing renders in the page at all, because the dock
 * lives at the bottom of the window.
 */
export function AppDock({
  groups,
  fallback,
}: {
  groups: GroupWithApps[] | null;
  fallback: React.ReactNode;
}) {
  const canHover = useMediaQuery("(hover: hover) and (pointer: fine)");
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const width = useViewportWidth();

  if (!canHover) return <>{fallback}</>;
  if (!groups) return null;
  // Looked up only once the apps have loaded: on the very first render App
  // hasn't committed the slot to the DOM yet.
  const slot = document.getElementById("dock-slot");
  const appCount = groups.reduce((n, g) => n + g.apps.length, 0);
  const base = fitBase(width - INSET * 2, appCount, groups.length);
  if (!slot || base == null) return <>{fallback}</>;

  return createPortal(<Dock groups={groups} base={base} magnify={!reduceMotion} />, slot);
}

function Dock({
  groups,
  base,
  magnify,
}: {
  groups: GroupWithApps[];
  base: number;
  magnify: boolean;
}) {
  const [, navigate] = useLocation();
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const sizes = useRef<number[]>([]);
  const pointer = useRef<number | null>(null);
  const frame = useRef<number | null>(null);

  const apps = groups.flatMap((g) => g.apps);
  const centers = restCenters(groups, base);
  const reach = base * REACH_ICONS;

  // Reset to resting size whenever the layout changes underneath us.
  useLayoutEffect(() => {
    sizes.current = apps.map(() => base);
    pointer.current = null;
  }, [apps.length, base]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(
    () => () => {
      if (frame.current != null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  function tick() {
    let moving = false;
    itemRefs.current.forEach((el, i) => {
      if (!el) return;
      const goal =
        pointer.current == null ? base : swell(pointer.current, centers[i], base, reach);
      const current = sizes.current[i] ?? base;
      let next = current + (goal - current) * EASE;
      if (Math.abs(goal - next) < 0.15) next = goal;
      else moving = true;
      sizes.current[i] = next;
      el.style.setProperty("--s", `${next}px`);
    });
    frame.current = moving ? requestAnimationFrame(tick) : null;
  }

  function aim(x: number | null) {
    if (!magnify) return;
    pointer.current = x;
    if (frame.current == null) frame.current = requestAnimationFrame(tick);
  }

  // Measured from the bar's centre, which never moves: the shelf is centred
  // and grows outward on both sides, so its own left edge drifts as the icons
  // swell and would feed back into the effect.
  function pointerFromEvent(e: React.MouseEvent) {
    const bar = e.currentTarget.parentElement!.getBoundingClientRect();
    return e.clientX - (bar.left + bar.width / 2);
  }

  function bounce(el: HTMLElement) {
    el.classList.remove("dock-item--bounce");
    void el.offsetWidth; // restart the animation on a repeat click
    el.classList.add("dock-item--bounce");
  }

  let index = -1;
  return (
    <div className="dock-bar" style={{ padding: `${PAD}px ${INSET}px ${INSET}px` }}>
      <nav
        aria-label="Apps"
        className="dock-shelf"
        style={{ "--base": `${base}px`, gap: GAP, padding: PAD } as React.CSSProperties}
        onMouseMove={(e) => aim(pointerFromEvent(e))}
        onMouseLeave={() => aim(null)}
      >
        {groups.map(({ group, apps: groupApps }, gi) => (
          <div key={group.id} className="contents">
            {gi > 0 && <span className="dock-rule" aria-hidden="true" />}
            {groupApps.map((app) => {
              const i = ++index;
              return (
                <button
                  key={app.id}
                  ref={(el) => {
                    itemRefs.current[i] = el;
                  }}
                  type="button"
                  className="dock-item"
                  style={{ "--s": `${base}px` } as React.CSSProperties}
                  aria-label={app.isComingSoon ? `${app.name} (coming soon)` : app.name}
                  aria-disabled={app.isComingSoon || undefined}
                  onClick={(e) => {
                    if (app.isComingSoon) return;
                    bounce(e.currentTarget);
                    openApp(app, navigate);
                  }}
                  onFocus={(e) => {
                    if (e.currentTarget.matches(":focus-visible")) aim(centers[i]);
                  }}
                  onBlur={() => aim(null)}
                  onAnimationEnd={(e) => e.currentTarget.classList.remove("dock-item--bounce")}
                >
                  <span
                    className="dock-tile"
                    style={{
                      background: app.iconBgColor ? `#${app.iconBgColor}` : "#404E5C",
                      opacity: app.isComingSoon ? 0.45 : 1,
                    }}
                  >
                    <DockIcon app={app} />
                  </span>
                  <span className="dock-label" aria-hidden="true">
                    {app.name}
                    {app.isComingSoon && <span className="dock-label-soon"> soon</span>}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>
    </div>
  );
}

function DockIcon({ app }: { app: App }) {
  const [imgFailed, setImgFailed] = useState(false);
  if (app.iconUrl && !imgFailed) {
    return (
      <img
        src={app.iconUrl}
        alt=""
        className="dock-glyph-img"
        draggable={false}
        onError={() => setImgFailed(true)}
      />
    );
  }
  if (app.iconEmoji) {
    return (
      <span aria-hidden="true" className="dock-glyph-emoji">
        {app.iconEmoji}
      </span>
    );
  }
  return (
    <span aria-hidden="true" className="dock-glyph-letter">
      {app.name.slice(0, 1)}
    </span>
  );
}

/**
 * Size of the icon whose resting centre is `center`, with the pointer at `x`.
 * A raised cosine: full MAX_SCALE under the pointer, easing to resting size
 * `reach` px away, flat beyond that.
 */
export function swell(x: number, center: number, base: number, reach: number): number {
  const d = Math.abs(x - center);
  if (d >= reach) return base;
  const t = (1 + Math.cos((Math.PI * d) / reach)) / 2;
  return base * (1 + (MAX_SCALE - 1) * t);
}

/** Each icon's resting centre, measured from the middle of the shelf. */
export function restCenters(groups: GroupWithApps[], base: number): number[] {
  const centers: number[] = [];
  let x = PAD;
  groups.forEach(({ apps }, gi) => {
    if (gi > 0) x += 1 + GAP; // the rule and the gap after it
    apps.forEach(() => {
      centers.push(x + base / 2);
      x += base + GAP;
    });
  });
  const total = x - GAP + PAD;
  return centers.map((c) => c - total / 2);
}

/**
 * The largest resting size, between MIN_BASE and BASE, at which the shelf
 * still fits `width` with room for the swell. Null when it can't fit at all.
 */
export function fitBase(width: number, appCount: number, groupCount: number): number | null {
  if (appCount === 0) return null;
  const rules = Math.max(0, groupCount - 1);
  for (let base = BASE; base >= MIN_BASE; base -= 2) {
    const shelf = appCount * base + (appCount + rules - 1) * GAP + rules + PAD * 2;
    // Magnifying widens the row by roughly one extra icon at peak.
    const swellRoom = base * (MAX_SCALE - 1) * REACH_ICONS * 0.8;
    if (shelf + swellRoom <= width) return base;
  }
  return null;
}

function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Window width less any scrollbar, which is what a fixed bar spans. */
function useViewportWidth(): number {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener("resize", onChange);
      return () => window.removeEventListener("resize", onChange);
    },
    () => document.documentElement.clientWidth,
    () => 0,
  );
}
