"use client";

/**
 * Skeleton of a pinned scroll film. Deps: react, gsap (ScrollTrigger). If the site uses a smooth-scroll
 * library, sync it with ScrollTrigger once at app level; this component only reads scroll progress.
 * Re-tune the easing, flash colour, track length and portrait framing to the project's art direction.
 */
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { drawFrame, fitCanvas, openFilm, pickSize, PORTRAIT_STRETCH, type FilmSource } from "./frames";
import styles from "./scroll-film.module.css";

export type { FilmSource } from "./frames";

type Props = FilmSource & {
  /** Scroll length of the pinned film, in viewport heights. */
  length?: number;
  /** Text layers drawn over the film; each reads `--p` (0→1 film progress) through CSS. Real HTML: this is the film's content for search engines and screen readers. */
  children?: ReactNode;
  /** Accessible description of what the film shows. */
  label: string;
  /** First frame, rendered as an <img> for the first paint (LCP) and as the reduced-motion still. */
  poster: string;
  /** Optional `srcset` for the poster (phones take a lighter still: it is the LCP of the page). */
  posterSet?: string;
  /** Above-the-fold film: its poster is fetched first and its frames start loading right after page load. */
  priority?: boolean;
  /**
   * Montage mode: clips are independent shots. Every frame is kept (no shared seam to drop) and
   * crossing from one shot to the next fires a brief light flash, like a hard cut.
   */
  cuts?: boolean;
};

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
/** Resolves once the page has loaded, so film bytes never compete with the first paint. */
const whenLoaded = () =>
  new Promise<void>((resolve) => {
    if (document.readyState === "complete") resolve();
    else window.addEventListener("load", () => resolve(), { once: true });
  });

/**
 * A pinned canvas that steps through pre-rendered frames as the page scrolls. Consecutive clips share
 * their seam frame (each starts on the previous one's end keyframe), so the seam is dropped, unless
 * `cuts` marks them as separate shots. Frames load coarse-to-fine and the canvas draws the nearest
 * frame already decoded, so scrolling never waits on the network.
 */
export function ScrollFilm({ base, clips, sizes, video, length = 5, children, label, poster, posterSet, priority = false, cuts = false }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    const canvas = canvasRef.current;
    // Reduced motion: no pin, no scrub. CSS keeps the poster as a still and lets the copy flow below it.
    if (!el || !canvas || prefersReducedMotion()) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    gsap.registerPlugin(ScrollTrigger);

    const portrait = window.innerHeight > window.innerWidth;
    const size = pickSize(sizes, portrait ? PORTRAIT_STRETCH : 1);

    // Index of the first frame of each shot, to know when the scroll crosses a cut.
    const starts = clips.map((_, ci) => clips.slice(0, ci).reduce((sum, c, k) => sum + c.frames - (cuts || k === 0 ? 0 : 1), 0));
    const shotOf = (i: number) => {
      let s = 0;
      starts.forEach((st, k) => {
        if (i >= st) s = k;
      });
      return s;
    };
    let shot = 0;
    let current = 0;
    let dir = 1; // scroll direction, to decode ahead the right way
    let drawn = -1;

    // Redraws until the exact frame is on screen (a neighbour stands in while it decodes).
    const draw = () => {
      if (drawn === current) return;
      const n = drawFrame(ctx, store, current, dir, drawn);
      if (n >= 0) drawn = n;
    };
    const store = openFilm({ base, clips, sizes, video }, size, { seams: !cuts }, (i) => {
      if (Math.abs(i - current) <= 4) draw();
    });

    const resize = () => {
      fitCanvas(canvas);
      drawn = -1;
      draw();
    };

    const start = () =>
      void store.start().then(() => {
        el.dataset.ready = "";
      });
    // Films further down only start downloading when they are about a screen and a half away.
    let io: IntersectionObserver | undefined;
    if (priority) void whenLoaded().then(start);
    else {
      io = new IntersectionObserver(
        (entries) => {
          if (!entries.some((e) => e.isIntersecting)) return;
          io?.disconnect();
          start();
        },
        { rootMargin: "150% 0px" },
      );
      io.observe(el);
    }

    const st = ScrollTrigger.create({
      trigger: el,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => {
        el.style.setProperty("--p", self.progress.toFixed(4));
        const next = Math.round(self.progress * (store.total - 1));
        if (next !== current) dir = next > current ? 1 : -1;
        current = next;
        const nextShot = shotOf(current);
        if (nextShot !== shot) {
          shot = nextShot;
          el.dataset.shot = String(shot);
          if (cuts) flashRef.current?.animate([{ opacity: 0.7 }, { opacity: 0 }], { duration: 320, easing: "cubic-bezier(0.16, 1, 0.3, 1)" });
        }
        draw();
      },
    });

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    return () => {
      io?.disconnect();
      st.kill();
      ro.disconnect();
      store.dispose();
    };
  }, [base, clips, sizes, video, priority, cuts]);

  return (
    <div ref={root} data-film-track className={styles.track} style={{ "--len": length } as CSSProperties}>
      <div className={styles.stage}>
        {/* First frame as LCP and reduced-motion still: a plain <img> on purpose. */}
        <img
          src={poster}
          srcSet={posterSet}
          sizes={posterSet ? "(orientation: portrait) 140vw, 100vw" : undefined}
          alt=""
          className={styles.poster}
          fetchPriority={priority ? "high" : "auto"}
          loading={priority ? "eager" : "lazy"}
        />
        <canvas ref={canvasRef} className={styles.canvas} role="img" aria-label={label} />
        {cuts && <div ref={flashRef} aria-hidden="true" className={styles.flash} />}
        <div className={styles.layers}>{children}</div>
      </div>
    </div>
  );
}

/*
 * Usage (the manifest is written by `film.mjs frames|video`; import it, never readdir public/ at render):
 *
 *   import manifest from "@/film-manifest.json";
 *   const ids = ["1-reveal", "2-orbit", "3-orbit"];
 *   const clips = ids.map((id) => ({ id, frames: manifest[id].frames }));
 *   const sizes = (["sm", "lg", "xl"] as const).filter((s) => ids.every((id) => manifest[id].sizes.includes(s)));
 *   const video = (["sm", "lg", "xl"] as const).filter((s) => ids.every((id) => manifest[id].video.includes(s)));
 *
 *   <ScrollFilm base={FILM_BASE} clips={clips} sizes={sizes} video={video} length={6} priority
 *     label="What the film shows, in one sentence" poster={`${FILM_BASE}/1-reveal/sm/001.webp`}>
 *     <h2 style={{ opacity: "clamp(0, calc((var(--p) - 0.1) * 10), 1)" }}>A line that appears at 10 % of the film</h2>
 *   </ScrollFilm>
 */
