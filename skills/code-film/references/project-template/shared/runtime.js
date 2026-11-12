// Shared runtime for every scene. A scene is a pure function of time:
// seek(t) must always produce the same picture for the same t, in any order.
import { gsap } from "gsap";
import { CustomEase } from "gsap/CustomEase.js";

gsap.registerPlugin(CustomEase);
gsap.ticker.lagSmoothing(0);

export { gsap, CustomEase };

// film.json is the single source of truth for size, fps, palette and fonts.
export const film = await (await fetch("/film.json")).json();
const params = new URLSearchParams(location.search);

// Vertical edition: open the scene with ?v (the tools do it when FILM_FORMAT=v).
export const VERTICAL = params.has("v");
const dims = VERTICAL ? (film.vertical ?? { width: 1080, height: 1920 }) : film;
export const W = dims.width, H = dims.height, FPS = film.fps ?? 30, CX = W / 2, CY = H / 2;
// Social apps cover the top and bottom of a vertical video with their interface: keep text and essential action inside SAFE.
export const SAFE = VERTICAL ? { left: 72, right: W - 72, top: 250, bottom: H - 360 } : { left: 120, right: W - 120, top: 72, bottom: H - 112 };

// Palette tokens, as hex (source of truth for canvas / GLSL) and as CSS variables.
export const tokens = film.palette ?? {};
const root = document.documentElement;
if (VERTICAL) root.classList.add("v");
root.style.setProperty("--w", W + "px");
root.style.setProperty("--h", H + "px");
for (const [name, hex] of Object.entries(tokens)) root.style.setProperty("--" + name, hex);

// "#rrggbb" -> [r, g, b] in 0..1 (sRGB), handy for GLSL uniforms
export const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

// one motion vocabulary for the whole film: vary motion by role, never the same fade-up everywhere
export const ease = {
  out: "expo.out",                                          // entrances
  in: "expo.in",                                            // exits
  inOut: CustomEase.create("film-inout", "0.76,0,0.24,1"),  // camera moves, big transitions
  soft: "power2.out",                                       // small settles
  drift: "sine.inOut",                                      // breathing, floating
};

// deterministic PRNG (mulberry32). Never use Math.random in a scene.
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
// progress 0..1 of time t inside [a, b]
export const span = (t, a, b) => clamp((t - a) / (b - a));

const stage = document.getElementById("stage");

// The anchor: the one element every hard cut matches on (film.json "anchor": colour, size, optional x / y).
// Tween it with gsap (x, y, scale, rotation…): x / y are offsets from its rest position. null when the film has none.
export const anchor = film.anchor ? document.createElement("div") : null;
if (anchor) {
  const size = film.anchor.size ?? 12;
  anchor.id = "anchor";
  Object.assign(anchor.style, {
    width: size + "px", height: size + "px", background: film.anchor.color,
    left: (film.anchor.x ?? CX) - size / 2 + "px", top: (film.anchor.y ?? CY) - size / 2 + "px",
  });
}

/**
 * Narration, word by word. `lines` = array of strings (one per visual line, you choose the breaks; <em> allowed
 * around whole words). Each word rises out of its own mask at `at` and the block leaves at `at + hold`.
 * pos: "bl" (default) | "br" | "tl" | "c". Returns the <p>; its word spans are in el.words.
 */
export function narrate(tl, lines, { at = 0, hold = 3.5, pos = "bl", size, color, out = true, stagger = 0.055 } = {}) {
  const el = document.createElement("p");
  el.className = `narration ${pos}`;
  if (size) el.style.fontSize = size + "px";
  if (color) el.style.color = color;
  const wrapWords = (text, em) => text.split(/(\s+)/).map((tok) =>
    /^\s*$/.test(tok) ? tok : `<span class="w"><span>${em ? `<em>${tok}</em>` : tok}</span></span>`).join("");
  el.innerHTML = lines.map((l) => {
    const tmp = document.createElement("div"); tmp.innerHTML = l;
    let html = "";
    tmp.childNodes.forEach((n) => { html += n.nodeType === 3 ? wrapWords(n.textContent, false) : wrapWords(n.textContent, n.nodeName === "EM"); });
    return `<span class="wl">${html}</span>`;
  }).join("");
  stage.appendChild(el);
  const words = [...el.querySelectorAll(".w > span")];
  el.words = words;
  // initial state applied now: zero-duration sets at 0 do not render at t = 0
  gsap.set(words, { yPercent: 125, rotation: 5, transformOrigin: "0% 100%" });
  tl.to(words, { yPercent: 0, rotation: 0, duration: 0.95, ease: ease.out, stagger }, at);
  if (out) tl.to(words, { yPercent: -125, rotation: -3, duration: 0.55, ease: "expo.in", stagger: 0.025 }, at + hold);
  return el;
}

/** Chapter mark, top-left: "03 — Title". Appears at `at`, stays unless `hold` is given. */
export function chapter(tl, num, title, { at = 0.3, hold } = {}) {
  const el = document.createElement("div");
  el.className = "chapter";
  el.innerHTML = `<b>${String(num).padStart(2, "0")}</b><span>${title}</span>`;
  stage.appendChild(el);
  gsap.set(el, { autoAlpha: 0 });
  tl.set(el, { autoAlpha: 0 }, 0).to(el, { autoAlpha: 1, duration: 0.6, ease: ease.soft }, at);
  if (hold != null) tl.to(el, { autoAlpha: 0, duration: 0.5, ease: ease.soft }, at + hold);
  return el;
}

/**
 * defineScene({ id, duration, setup({ stage, tl, anchor }), render(t) })
 * - setup builds the DOM / WebGL and fills the paused master timeline `tl` (may be async).
 * - render(t) is called after the timeline has been moved to t: draw canvases / WebGL here.
 */
export function defineScene({ id, duration, setup, render }) {
  const tl = gsap.timeline({ paused: true, defaults: { ease: ease.out } });
  const capture = params.has("capture");
  if (anchor) stage.appendChild(anchor);

  const scene = {
    id, duration, ready: null,
    seek(t) {
      t = clamp(t, 0, duration);
      tl.time(t, false);
      if (render) render(t);
      scene.t = t;
    },
  };
  window.SCENE = scene;

  scene.ready = (async () => {
    for (const font of film.fonts ?? []) await document.fonts.load(font);
    await document.fonts.ready;
    await setup({ stage, tl, anchor });
    // pad the timeline so tl.time(duration) is always valid
    tl.set({}, {}, duration);
    scene.seek(0);
    if (!capture) player(scene);
  })();
  return scene;
}

// Preview transport: play / pause / scrub, snapped to the film's frame grid so the preview equals the render.
function player(scene) {
  const fit = () => {
    const s = Math.min(innerWidth / W, (innerHeight - 40) / H);
    stage.style.transform = `translate(${(innerWidth - W * s) / 2}px, ${(innerHeight - 40 - H * s) / 2}px) scale(${s})`;
  };
  addEventListener("resize", fit); fit();
  const bar = document.createElement("div");
  bar.id = "transport";
  bar.innerHTML = `<button>pause</button><input type="range" min="0" max="${scene.duration}" step="${1 / FPS}" value="0"><span></span>`;
  document.body.appendChild(bar);
  const [btn, range, label] = bar.children;
  let playing = true, t0 = performance.now(), base = 0;
  btn.onclick = () => { playing = !playing; btn.textContent = playing ? "pause" : "play"; t0 = performance.now(); base = scene.t; };
  range.oninput = () => { playing = false; btn.textContent = "play"; scene.seek(+range.value); label.textContent = scene.t.toFixed(2); };
  const loop = (now) => {
    if (playing) {
      let t = base + (now - t0) / 1000;
      if (t > scene.duration) { t = 0; base = 0; t0 = now; }
      scene.seek(Math.round(t * FPS) / FPS);
      range.value = scene.t; label.textContent = scene.t.toFixed(2);
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
