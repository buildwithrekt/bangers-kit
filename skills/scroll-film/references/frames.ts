/**
 * Frame stores for scroll films exported by scripts/film.mjs, in two forms per clip and size:
 *  - H.264 streams `<base>/<clip>/<size>.h264` + `<size>.json` index, decoded with WebCodecs (default);
 *  - WebP frames `<base>/<clip>/<size>/NNN.webp` (fallback where VideoDecoder or H.264 is missing).
 * Both expose the same FrameStore, so the players do not know which one they read.
 * No dependency. Browser only: import it from client components.
 */

export type FrameSize = "sm" | "lg" | "xl";

export type FilmSource = {
  /** Base URL of the film: a folder under /public, or the CDN / blob store the frames were uploaded to. */
  base: string;
  /** Clips in play order with their frame counts (same count in each size). */
  clips: { id: string; frames: number }[];
  /** Sizes present for every clip (xl only exists once all clips are upscaled to 4K). */
  sizes: FrameSize[];
  /** Sizes available as H.264 streams for every clip. */
  video: FrameSize[];
};

const WIDTH: Record<FrameSize, number> = { sm: 1080, lg: 1920, xl: 2880 };
const pad = (n: number) => String(n).padStart(3, "0");

/**
 * Smallest exported width that covers the drawn width in device pixels. `stretch` is how much wider
 * than the viewport the frame is drawn (portrait phones draw it at ~1.4× the screen width).
 */
export function pickSize(sizes: FrameSize[], stretch = 1): FrameSize {
  const need = window.innerWidth * Math.min(window.devicePixelRatio, 2) * stretch;
  const sorted = (["sm", "lg", "xl"] as const).filter((s) => sizes.includes(s));
  return sorted.find((s) => WIDTH[s] >= need * 0.95) ?? sorted.at(-1) ?? "lg";
}

/**
 * Frame URLs in play order. `seams`: consecutive clips share their seam frame (each starts on the
 * previous one's last), so it is dropped; `loop` also drops the last frame when it equals the first.
 */
export function frameUrls(src: FilmSource, size: FrameSize, { seams = true, loop = false } = {}) {
  const urls = src.clips.flatMap((c, ci) =>
    Array.from({ length: c.frames }, (_, i) => i + 1)
      .filter((n) => !seams || ci === 0 || n > 1)
      .map((n) => `${src.base}/${c.id}/${size}/${pad(n)}.webp`),
  );
  if (loop && seams) urls.pop();
  return urls;
}

/** Where to draw a frame: cover in landscape; in portrait a band ~1.4× the screen width, centred. */
export function fitRect(cw: number, ch: number, iw: number, ih: number) {
  const cover = Math.max(cw / iw, ch / ih);
  const scale = ch > cw ? Math.min(cover, (cw * PORTRAIT_STRETCH) / iw) : cover;
  const w = iw * scale;
  const h = ih * scale;
  return { x: (cw - w) / 2, y: (ch - h) / 2, w, h };
}
export const PORTRAIT_STRETCH = 1.4;

export type FrameStore = {
  readonly total: number;
  /** Starts the download (around frame `first`); calling again with more `want` lanes adds lanes. */
  start(first?: number, want?: number): Promise<void>;
  /** Resolves once enough is loaded to play the whole film smoothly. */
  coarse(): Promise<void>;
  /** Closest frame that is at least downloaded (-1 when none). */
  nearest(i: number): number;
  /** Best decoded bitmap for frame `i` now (exact or nearest), asking for `i` and what follows in `dir`. */
  bitmap(i: number, dir?: number, ahead?: number): { index: number; bmp: ImageBitmap } | null;
  /** Decoded bitmap of frame `k` if it is in the cache (no request). */
  peek(k: number): ImageBitmap | undefined;
  dispose(): void;
};

/*
 * Memory model. A decoded 2880×1620 frame weighs ~19 MB, so a 700-frame orbit cannot stay decoded
 * (that crashed the tab). Frames are kept *encoded* (WebP blobs, ~0.2–0.7 MB each) and only a
 * window around what is on screen is decoded, in one LRU cache shared by every film of the page,
 * capped by a byte budget. Drawing never waits: it uses the nearest frame already decoded and asks
 * for the exact one (plus a few ahead), which lands a frame or two later.
 */
const decoded = new Map<string, ImageBitmap>(); // insertion order = LRU order
const decoding = new Map<string, Promise<ImageBitmap | null>>();
let decodedBytes = 0;
const budget = () => (window.matchMedia("(pointer: coarse)").matches ? 160 : 420) * 1024 * 1024;

function remember(url: string, bmp: ImageBitmap) {
  decoded.set(url, bmp);
  decodedBytes += bmp.width * bmp.height * 4;
  for (const [key, old] of decoded) {
    if (decodedBytes <= budget() || decoded.size <= 4) break;
    decoded.delete(key);
    decodedBytes -= old.width * old.height * 4;
    old.close();
  }
}
function touch(url: string) {
  const bmp = decoded.get(url);
  if (!bmp) return undefined;
  decoded.delete(url);
  decoded.set(url, bmp);
  return bmp;
}

/**
 * Encoded frames, fetched coarse-to-fine (every 8th, then 4th, 2nd, all) a few at a time, so any
 * position has a near frame early; decoded on demand through the shared cache.
 */
function createImageStore(urls: string[], onLoad: (i: number) => void, concurrency = 6): FrameStore {
  const blobs: (Blob | undefined)[] = new Array(urls.length);
  let alive = true;
  let started = false;
  let lanes = 0;
  // Resolved once the coarse pass (every 8th frame) is in: enough to play the clip smoothly.
  let coarseLeft = Math.ceil(urls.length / 8);
  let coarseDone: () => void = () => {};
  const coarse = new Promise<void>((resolve) => (coarseDone = resolve));

  const decode = (i: number) => {
    const url = urls[i];
    const blob = blobs[i];
    if (!blob || decoded.has(url)) return decoded.get(url) ? Promise.resolve(decoded.get(url)!) : Promise.resolve(null);
    let job = decoding.get(url);
    if (!job) {
      job = createImageBitmap(blob)
        .then((bmp) => {
          if (!alive) {
            bmp.close();
            return null;
          }
          remember(url, bmp);
          return bmp;
        })
        .catch(() => null)
        .finally(() => decoding.delete(url));
      decoding.set(url, job);
      void job.then((bmp) => bmp && alive && onLoad(i));
    }
    return job;
  };

  const load = async (i: number) => {
    if (blobs[i] || !alive) return;
    try {
      const res = await fetch(urls[i]);
      if (!res.ok) return;
      blobs[i] = await res.blob();
      if (i % 8 === 0 && --coarseLeft === 0) coarseDone();
      if (alive) onLoad(i);
    } catch {
      /* a missing frame falls back to its neighbours */
    }
  };

  const order: number[] = [];
  const seen = new Set<number>();
  for (const step of [8, 4, 2, 1])
    for (let i = 0; i < urls.length; i += step) {
      if (seen.has(i)) continue;
      seen.add(i);
      order.push(i);
    }

  const nearestBy = (i: number, has: (k: number) => boolean) => {
    for (let d = 0; d < urls.length; d++) {
      if (i - d >= 0 && has(i - d)) return i - d;
      if (i + d < urls.length && has(i + d)) return i + d;
    }
    return -1;
  };

  return {
    get total() {
      return urls.length;
    },
    start(first = 0, want = concurrency) {
      const pump = async () => {
        while (order.length && alive) await load(order.shift()!);
      };
      const open = () => {
        for (; lanes < want; lanes++) void pump();
      };
      if (started) return Promise.resolve(open());
      started = true;
      return load(first)
        .then(() => decode(first))
        .then(open);
    },
    // The coarse pass (every 8th frame) is in, or the store is empty.
    coarse: () => (urls.length ? coarse : Promise.resolve()),
    peek: (k: number) => (k >= 0 && k < urls.length ? touch(urls[k]) : undefined),
    nearest: (i: number) => nearestBy(i, (k) => !!blobs[k]),
    bitmap(i: number, dir = 1, ahead = 3) {
      for (let k = 0; k <= ahead; k++) {
        const j = i + k * dir;
        if (j >= 0 && j < urls.length) void decode(j);
      }
      const n = nearestBy(i, (k) => decoded.has(urls[k]));
      return n < 0 ? null : { index: n, bmp: touch(urls[n])! };
    },
    dispose() {
      alive = false;
      for (const url of urls) {
        const bmp = decoded.get(url);
        if (!bmp) continue;
        decoded.delete(url);
        decodedBytes -= bmp.width * bmp.height * 4;
        bmp.close();
      }
    },
  };
}


/* ───────── H.264 + WebCodecs ───────── */

type VideoIndex = { codec: string; width: number; height: number; frames: [offset: number, length: number, key: 0 | 1][] };
type ClipData = { index: VideoIndex; bytes: Uint8Array };

const supported = new Map<string, Promise<boolean>>();
function canDecode(index: VideoIndex) {
  const key = `${index.codec}:${index.width}x${index.height}`;
  if (!supported.has(key))
    supported.set(
      key,
      VideoDecoder.isConfigSupported({ codec: index.codec, codedWidth: index.width, codedHeight: index.height })
        .then((r) => !!r.supported)
        .catch(() => false),
    );
  return supported.get(key)!;
}

/**
 * Plays a film from its H.264 streams. Each clip is fetched whole (a few MB) and kept encoded; a
 * frame is shown by decoding its group of pictures (keyframe every 8 frames) into the shared bitmap
 * cache, so memory stays bounded whatever the film's length. One GOP decodes at a time, newest
 * request first; requests that went stale while waiting are dropped. If the browser cannot decode
 * the stream, the store switches itself to the WebP frames.
 */
function createVideoStore(
  src: FilmSource,
  size: FrameSize,
  { seams, loop }: { seams: boolean; loop: boolean },
  onLoad: (i: number) => void,
  fallback: () => FrameStore,
): FrameStore {
  // Global frame index → (clip, local frame), with the shared seams dropped like frameUrls().
  const map: { clip: number; local: number }[] = [];
  src.clips.forEach((c, ci) => {
    for (let n = 0; n < c.frames; n++) if (!seams || ci === 0 || n > 0) map.push({ clip: ci, local: n });
  });
  if (loop && seams) map.pop();
  const firstOf = src.clips.map((_, ci) => map.findIndex((m) => m.clip === ci));
  const keyOf = (clip: number, local: number) => `${src.base}/${src.clips[clip].id}/${size}#${local}`;

  const data: (ClipData | undefined)[] = new Array(src.clips.length);
  const loading: (Promise<void> | undefined)[] = new Array(src.clips.length);
  let alive = true;
  let started = false;
  let failed: FrameStore | null = null;
  let allDone: () => void = () => {};
  const all = new Promise<void>((resolve) => (allDone = resolve));

  const switchToImages = () => {
    if (failed || !alive) return;
    failed = fallback();
    void failed.start(0);
    void failed.coarse().then(allDone);
  };

  const loadClip = (ci: number) =>
    (loading[ci] ??= (async () => {
      const url = `${src.base}/${src.clips[ci].id}/${size}`;
      try {
        const [index, buf] = await Promise.all([
          fetch(`${url}.json`).then((r) => (r.ok ? (r.json() as Promise<VideoIndex>) : Promise.reject(r.status))),
          fetch(`${url}.h264`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status))),
        ]);
        if (!(await canDecode(index))) return switchToImages();
        data[ci] = { index, bytes: new Uint8Array(buf) };
        if (alive) onLoad(firstOf[ci]);
        if (data.every(Boolean)) allDone();
      } catch {
        switchToImages();
      }
    })());

  /* ── Decoding ── */
  let decoder: VideoDecoder | null = null;
  let codec = "";
  let outputs: Promise<void>[] = [];
  const makeDecoder = (index: VideoIndex) => {
    decoder?.close();
    codec = index.codec;
    decoder = new VideoDecoder({
      output: (frame) => {
        // Timestamps carry the clip and local frame: clip * 1e6 + local.
        const clip = Math.floor(frame.timestamp / 1e6);
        const local = frame.timestamp % 1e6;
        outputs.push(
          createImageBitmap(frame)
            .then((bmp) => {
              if (alive) remember(keyOf(clip, local), bmp);
              else bmp.close();
            })
            .catch(() => {})
            .finally(() => frame.close()),
        );
      },
      error: () => {
        decoder = null; // recreated on the next job
      },
    });
    decoder.configure({ codec: index.codec, codedWidth: index.width, codedHeight: index.height, optimizeForLatency: true });
  };

  type Job = { clip: number; gop: number; local: number; target: number };
  const queue: Job[] = [];
  let busy = false;
  let wanted = 0; // global frame the player is on, to drop stale jobs
  const gopStart = (index: VideoIndex, local: number) => {
    let k = local;
    while (k > 0 && !index.frames[k][2]) k--;
    return k;
  };
  const gopEnd = (index: VideoIndex, start: number) => {
    let k = start + 1;
    while (k < index.frames.length && !index.frames[k][2]) k++;
    return k; // exclusive
  };

  const run = async () => {
    if (busy) return;
    busy = true;
    while (queue.length && alive) {
      const job = queue.shift()!;
      if (Math.abs(job.target - wanted) > 24) continue; // the player moved on
      const clip = data[job.clip];
      if (!clip || decoded.has(keyOf(job.clip, job.local))) continue;
      try {
        if (!decoder || decoder.state === "closed" || codec !== clip.index.codec) makeDecoder(clip.index);
        const end = gopEnd(clip.index, job.gop);
        for (let k = job.gop; k < end; k++) {
          const [offset, length, key] = clip.index.frames[k];
          decoder!.decode(
            new EncodedVideoChunk({ type: key ? "key" : "delta", timestamp: job.clip * 1e6 + k, data: clip.bytes.subarray(offset, offset + length) }),
          );
        }
        await decoder!.flush();
        await Promise.all(outputs);
        outputs = [];
        if (alive) onLoad(job.target);
      } catch {
        decoder = null;
        outputs = [];
      }
    }
    busy = false;
  };

  const request = (i: number) => {
    const m = map[i];
    const clip = m && data[m.clip];
    if (!clip) return;
    const gop = gopStart(clip.index, m.local);
    if (decoded.has(keyOf(m.clip, m.local))) return;
    if (queue.some((j) => j.clip === m.clip && j.gop === gop)) return;
    queue.unshift({ clip: m.clip, gop, local: m.local, target: i }); // newest first
    queue.length = Math.min(queue.length, 3);
    void run();
  };

  const nearestBy = (i: number, has: (k: number) => boolean) => {
    for (let d = 0; d < map.length; d++) {
      if (i - d >= 0 && has(i - d)) return i - d;
      if (i + d < map.length && has(i + d)) return i + d;
    }
    return -1;
  };
  const isDecoded = (k: number) => decoded.has(keyOf(map[k].clip, map[k].local));

  return {
    get total() {
      return failed ? failed.total : map.length;
    },
    start(first = 0, want?: number) {
      if (failed) return failed.start(first, want);
      if (!started) {
        started = true;
        // The clip under `first`, then the others outward from it, two at a time.
        const c0 = map[first]?.clip ?? 0;
        const order = src.clips.map((_, ci) => ci).sort((a, b) => Math.abs(a - c0) - Math.abs(b - c0));
        const lane = async () => {
          for (let ci = order.shift(); ci !== undefined && alive; ci = order.shift()) await loadClip(ci);
        };
        return loadClip(c0).then(() => {
          request(first);
          void lane();
          void lane();
        });
      }
      return Promise.resolve();
    },
    // All clips in (or, after a switch to WebP, the fallback's coarse pass).
    coarse: () => all,
    nearest(i) {
      if (failed) return failed.nearest(i);
      return nearestBy(i, (k) => !!data[map[k].clip]);
    },
    peek(k) {
      if (failed) return failed.peek(k);
      const m = map[k];
      return m ? touch(keyOf(m.clip, m.local)) : undefined;
    },
    bitmap(i, dir = 1) {
      if (failed) return failed.bitmap(i, dir);
      wanted = i;
      request(i);
      // Next GOP in the direction of travel, so crossing a keyframe does not stall.
      const ahead = i + 6 * dir;
      if (ahead >= 0 && ahead < map.length) request(ahead);
      const n = nearestBy(i, isDecoded);
      if (n < 0) return null;
      return { index: n, bmp: touch(keyOf(map[n].clip, map[n].local))! };
    },
    dispose() {
      alive = false;
      queue.length = 0;
      if (decoder && decoder.state !== "closed") decoder.close();
      failed?.dispose();
      for (const m of map) {
        const key = keyOf(m.clip, m.local);
        const bmp = decoded.get(key);
        if (!bmp) continue;
        decoded.delete(key);
        decodedBytes -= bmp.width * bmp.height * 4;
        bmp.close();
      }
    },
  };
}

/**
 * Opens a film for playback: H.264 + WebCodecs when the size exists as video and the browser has
 * VideoDecoder, WebP frames otherwise (and as automatic fallback if the stream cannot be decoded).
 */
export function openFilm(
  src: FilmSource,
  size: FrameSize,
  opts: { seams?: boolean; loop?: boolean },
  onLoad: (i: number) => void,
  concurrency = 6,
): FrameStore {
  const seams = opts.seams ?? true;
  const loop = opts.loop ?? false;
  const images = () => createImageStore(frameUrls(src, size, { seams, loop }), onLoad, concurrency);
  if (typeof VideoDecoder === "undefined" || !src.video.includes(size)) return images();
  return createVideoStore(src, size, { seams, loop }, onLoad, images);
}

/**
 * Draws the frame to show for target `i`, given `last`, the frame already on the canvas.
 * The picture only ever moves from `last` toward `i`: it takes the decoded frame closest to `i`
 * on that path, or keeps `last` if none is ready. Showing "the nearest decoded frame" instead made
 * the film jump backwards whenever a frame behind the current one was still cached, or flicker
 * forward while a group of frames decoded during a backward scroll. `last` = -1 (first paint,
 * resize, wrap-around) takes the nearest decoded frame anywhere. Returns the frame shown.
 */
export function drawFrame(ctx: CanvasRenderingContext2D, store: FrameStore, i: number, dir = 1, last = -1) {
  const nearest = store.bitmap(i, dir); // also queues `i` and what follows in `dir`
  let index = -1;
  let bmp: ImageBitmap | undefined;
  if (last < 0) {
    if (nearest) ({ index, bmp } = nearest);
  } else {
    const step = i > last ? -1 : 1; // walk from the target back toward what is on screen
    for (let k = i; k !== last; k += step) {
      bmp = store.peek(k);
      if (bmp) {
        index = k;
        break;
      }
    }
  }
  if (index < 0 || !bmp) return last;
  const { width: cw, height: ch } = ctx.canvas;
  const r = fitRect(cw, ch, bmp.width, bmp.height);
  // Resizing the canvas resets the context: ask for the high-quality resampler on every draw.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.clearRect(0, 0, cw, ch);
  ctx.drawImage(bmp, r.x, r.y, r.w, r.h);
  return index;
}

/** Keeps a canvas' backing store at its CSS size × DPR (capped at 2). */
export function fitCanvas(canvas: HTMLCanvasElement) {
  const dpr = Math.min(window.devicePixelRatio, 2);
  canvas.width = Math.round(canvas.clientWidth * dpr);
  canvas.height = Math.round(canvas.clientHeight * dpr);
}
