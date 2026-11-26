import * as THREE from 'three';

/**
 * Procedural pixel-art texture factory for the OurSongs v5 / Graytail-style 2.5D WHU diorama.
 * Surfaces use integer-pixel art on compact grids with NearestFilter crispness, paired with
 * soft optical bokeh sprites for floating golden dust / fireflies and streetlamp halos.
 */

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export { mulberry32 };

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x), Math.floor(y), Math.max(1, Math.floor(w)), Math.max(1, Math.floor(h)));
}

export function createTextureFactory(renderer) {
  const registry = [];
  const cache = new Map();
  const maxAniso = renderer ? Math.min(4, renderer.capabilities.getMaxAnisotropy()) : 4;

  function register(label, canvas, { srgb = true, repeat = [1, 1], mip = true, wrap = true, pixel = true } = {}) {
    if (cache.has(label)) return cache.get(label);
    const tex = new THREE.CanvasTexture(canvas);
    if (wrap) {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
    } else {
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
    }
    tex.repeat.set(repeat[0], repeat[1]);
    if (pixel) {
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = mip ? THREE.NearestMipmapLinearFilter : THREE.NearestFilter;
    } else {
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = mip ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
    }
    tex.generateMipmaps = mip;
    tex.anisotropy = pixel ? 1 : maxAniso;
    if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    const bytes = Math.round(canvas.width * canvas.height * 4 * (mip ? 1.333 : 1));
    registry.push({ label, width: canvas.width, height: canvas.height, bytes, texture: tex });
    cache.set(label, tex);
    return tex;
  }

  /** Crisp 32x32 pixel-art warm granite blocks with subtle 3-tone dither & horizontal joints. */
  function granite(label = 'granite', base = '#f2ece1', seed = 11) {
    const S = 32;
    const c = makeCanvas(S, S);
    const ctx = c.getContext('2d');
    const rand = mulberry32(seed);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, S, S);
    const tones = ['#ebe3d5', '#e2d8c8', '#faf6ee'];
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        if (y % 8 === 0) {
          px(ctx, x, y, 1, 1, 'rgba(130,118,105,0.22)');
        } else if (y % 8 === 1) {
          px(ctx, x, y, 1, 1, 'rgba(255,252,246,0.35)');
        } else if (rand() < 0.28) {
          px(ctx, x, y, 1, 1, tones[Math.floor(rand() * tones.length)]);
        }
      }
    }
    return register(label, c, { pixel: true, mip: true });
  }

  /** Crisp 32x32 pixel-art flagstone paving with mortar seams, top-left highlights & moss flecks. */
  function paving(label = 'paving', repeat = [10, 10], base = '#e8dfd2', joint = '#8e8476', seed = 21) {
    const S = 32;
    const c = makeCanvas(S, S);
    const ctx = c.getContext('2d');
    const rand = mulberry32(seed);
    px(ctx, 0, 0, S, S, joint);

    const bInt = parseInt(base.slice(1), 16);
    const br = (bInt >> 16) & 255;
    const bg = (bInt >> 8) & 255;
    const bb = bInt & 255;

    const rows = 4;
    const rh = S / rows; // 8
    const cw = 8;
    for (let r = 0; r < rows; r++) {
      const off = r % 2 ? 4 : 0;
      for (let sx = -cw; sx < S; sx += cw) {
        const x = sx + off;
        const y = r * rh;
        const delta = Math.floor((rand() - 0.5) * 18);
        const rr = Math.max(0, Math.min(255, br + delta));
        const gg = Math.max(0, Math.min(255, bg + delta - 1));
        const bb2 = Math.max(0, Math.min(255, bb + delta - 2));
        px(ctx, x + 1, y + 1, cw - 1, rh - 1, `rgb(${rr},${gg},${bb2})`);
        // Lit top-left pixel bevel
        px(ctx, x + 1, y + 1, cw - 1, 1, 'rgba(255,250,240,0.42)');
        px(ctx, x + 1, y + 1, 1, rh - 1, 'rgba(255,250,240,0.28)');
        // Shaded bottom edge
        px(ctx, x + 1, y + rh - 1, cw - 1, 1, 'rgba(104,92,80,0.22)');
      }
    }
    // Subtle moss & grain pixels in joints
    for (let i = 0; i < 48; i++) {
      const mx = Math.floor(rand() * S);
      const my = Math.floor(rand() * S);
      if (my % rh === 0) {
        px(ctx, mx, my, 1, 1, rand() > 0.35 ? '#6d8a55' : '#587446');
      } else if (rand() < 0.45) {
        px(ctx, mx, my, 1, 1, 'rgba(120,108,96,0.18)');
      }
    }
    return register(label, c, { repeat, pixel: true, mip: true });
  }

  /** Crisp 32x32 pixel-art meadow with 4 olive-emerald pixel tones & tiny blossom specks. */
  function grass(label = 'grass', repeat = [24, 24], seed = 31) {
    const S = 32;
    const c = makeCanvas(S, S);
    const ctx = c.getContext('2d');
    const rand = mulberry32(seed);
    const tones = ['#5a8248', '#689351', '#78a35c', '#4a6e3e'];
    px(ctx, 0, 0, S, S, tones[1]);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const v = rand();
        if (v < 0.16) px(ctx, x, y, 1, 1, tones[3]);
        else if (v < 0.42) px(ctx, x, y, 1, 1, tones[0]);
        else if (v > 0.80) px(ctx, x, y, 1, 1, tones[2]);
      }
    }
    // Tiny warm meadow flower pixels
    for (let i = 0; i < 12; i++) {
      const fx = Math.floor(rand() * S);
      const fy = Math.floor(rand() * S);
      px(ctx, fx, fy, 1, 1, rand() > 0.45 ? '#fff2be' : '#ffd8e4');
    }
    return register(label, c, { repeat, pixel: true, mip: true });
  }

  /** Crisp 32x32 pixel-art ashlar masonry retaining walls. */
  function ashlarStone(label = 'ashlar-stone', base = '#dfd2bc', seed = 79) {
    const S = 32;
    const c = makeCanvas(S, S);
    const ctx = c.getContext('2d');
    const rand = mulberry32(seed);
    px(ctx, 0, 0, S, S, '#8c7d69');

    const rows = 4;
    const rh = S / rows; // 8
    const cw = 8;
    const bInt = parseInt(base.slice(1), 16);
    const br = (bInt >> 16) & 255;
    const bg = (bInt >> 8) & 255;
    const bb = bInt & 255;

    for (let r = 0; r < rows; r++) {
      const offset = (r % 2) * 4;
      for (let col = -1; col <= 4; col++) {
        const x = col * cw + offset;
        const y = r * rh;
        const tone = Math.floor((rand() - 0.5) * 20);
        const cr = Math.min(255, Math.max(0, br + tone));
        const cg = Math.min(255, Math.max(0, bg + tone - 1));
        const cb = Math.min(255, Math.max(0, bb + tone - 3));
        px(ctx, x + 1, y + 1, cw - 1, rh - 1, `rgb(${cr},${cg},${cb})`);
        px(ctx, x + 1, y + 1, cw - 1, 1, 'rgba(255,250,242,0.42)');
        px(ctx, x + 1, y + rh - 1, cw - 1, 1, 'rgba(96,84,70,0.28)');
      }
    }
    for (let i = 0; i < 40; i++) {
      px(ctx, rand() * S, rand() * S, 1, 1, rand() > 0.5 ? 'rgba(110,98,84,0.22)' : 'rgba(255,252,246,0.28)');
    }
    return register(label, c, { pixel: true, mip: true });
  }

  /** Crisp 32x32 pixel-art concrete pier slabs with weathered planks & seams. */
  function concretePier(label = 'concrete-pier', seed = 83) {
    const S = 32;
    const c = makeCanvas(S, S);
    const ctx = c.getContext('2d');
    const rand = mulberry32(seed);
    px(ctx, 0, 0, S, S, '#cbc3b4');
    const tones = ['#c1b8a8', '#d4ccb9', '#bdb4a4'];
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        if (rand() < 0.25) px(ctx, x, y, 1, 1, tones[Math.floor(rand() * tones.length)]);
      }
    }
    // Expansion joints every 16px
    for (const jx of [0, 16]) {
      px(ctx, jx, 0, 1, S, '#6d6962');
      px(ctx, jx + 1, 0, 1, S, 'rgba(255,252,246,0.48)');
    }
    for (const jy of [0, 16]) {
      px(ctx, 0, jy, S, 1, 'rgba(105,100,92,0.34)');
    }
    return register(label, c, { pixel: true, mip: true });
  }

  /** Crisp 32x32 pixel-art fluted peacock-blue glazed tiles + stepped bump map. */
  function glazedTiles(label = 'glazed') {
    const S = 32;
    const albedo = makeCanvas(S, S);
    const bump = makeCanvas(S, S);
    const a = albedo.getContext('2d');
    const b = bump.getContext('2d');

    const valley = '#113742';
    const flank = '#1a5663';
    const body = '#24737e';
    const ridge = '#4ea3a4';
    const glint = '#8ed8d3';

    // 4 flutes across 32px -> 8px per tile flute
    for (let y = 0; y < S; y++) {
      const isLap = y % 8 === 7;
      const isEdge = y % 8 === 0;
      for (let x = 0; x < S; x++) {
        const fx = x % 8;
        let col = body;
        let bv = 165;
        if (fx === 0 || fx === 7) {
          col = valley;
          bv = 60;
        } else if (fx === 1 || fx === 6) {
          col = flank;
          bv = 120;
        } else if (fx === 3 || fx === 4) {
          col = ridge;
          bv = 225;
          if (fx === 3 && y % 4 === 1) {
            col = glint;
            bv = 250;
          }
        }
        if (isLap) bv = Math.max(40, bv - 45);
        else if (isEdge) bv = Math.min(255, bv + 20);
        px(a, x, y, 1, 1, col);
        px(b, x, y, 1, 1, `rgb(${bv},${bv},${bv})`);
      }
    }
    return {
      map: register(`${label}-albedo`, albedo, { repeat: [2, 2], pixel: true, mip: true }),
      bumpMap: register(`${label}-bump`, bump, { srgb: false, repeat: [2, 2], pixel: true, mip: true }),
    };
  }

  /** Legacy canopy wrapper kept for API compatibility. */
  function sakuraCanopy(label = 'sakura-canopy', baseHex = '#ffebf3', accentHex = '#ffadc9', seed = 88) {
    const tex = sakuraSprig(`${label}-fallback`, seed);
    return { map: tex, bumpMap: tex };
  }

  /** Crisp 64x64 pixel-art stone facade with recessed windows & warm amber night glow. */
  function facade(label, { wall = '#ebd9c1', cols = 4, rows = 3, arched = true, seed = 41 } = {}) {
    const S = 64;
    const albedo = makeCanvas(S, S);
    const emissive = makeCanvas(S, S);
    const a = albedo.getContext('2d');
    const e = emissive.getContext('2d');
    const rand = mulberry32(seed);

    px(a, 0, 0, S, S, wall);
    px(e, 0, 0, S, S, '#000000');

    // Subtle stone texture pixels & string courses
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        if (y % 16 === 0) px(a, x, y, 1, 1, 'rgba(130,110,88,0.18)');
        else if (rand() < 0.14) px(a, x, y, 1, 1, 'rgba(145,124,102,0.12)');
      }
    }

    const cw = Math.floor(S / cols);
    const rh = Math.floor(S / rows);
    for (let r = 0; r < rows; r++) {
      // Floor trim band
      px(a, 0, r * rh + rh - 2, S, 1, '#faf4ea');
      px(a, 0, r * rh + rh - 1, S, 1, 'rgba(128,110,90,0.32)');
      for (let c = 0; c < cols; c++) {
        const ww = Math.max(6, Math.floor(cw * 0.44));
        const wh = Math.max(8, Math.floor(rh * 0.56));
        const x = c * cw + Math.floor((cw - ww) / 2);
        const y = r * rh + Math.floor(rh * 0.18);

        // Cream stone surround & dark bronze frame
        px(a, x - 1, y - 1, ww + 2, wh + 2, '#f7efe2');
        px(a, x - 1, y + wh + 1, ww + 2, 1, '#b8a894');
        px(a, x, y, ww, wh, '#2a3b4e');

        const lit = rand() < 0.55;
        if (arched && r === rows - 1) {
          px(a, x + 1, y + 2, ww - 2, wh - 3, '#33506b');
          px(a, x + 2, y + 1, ww - 4, 1, '#33506b');
        } else {
          px(a, x + 1, y + 1, ww - 2, wh - 2, '#2d4760');
        }
        // Highlight pane reflection
        px(a, x + 1, y + 2, 1, Math.max(2, wh - 4), '#7da6cc');
        // Mullion cross
        px(a, x + Math.floor(ww / 2), y + 1, 1, wh - 2, '#ded4c4');
        px(a, x + 1, y + Math.floor(wh * 0.48), ww - 2, 1, '#ded4c4');

        if (lit) {
          px(e, x + 1, y + 1, ww - 2, wh - 2, '#ffb55c');
          px(e, x + 2, y + 2, ww - 4, wh - 4, '#ffd98a');
          px(e, x + Math.floor(ww / 2), y + 1, 1, wh - 2, '#000000');
          px(e, x + 1, y + Math.floor(wh * 0.48), ww - 2, 1, '#000000');
        }
      }
    }
    return {
      map: register(`${label}-albedo`, albedo, { pixel: true, mip: true }),
      emissiveMap: register(`${label}-emissive`, emissive, { pixel: true, mip: true }),
    };
  }

  /** Crisp inscription panel for the archway lintel (256x64, NearestFilter pixel crispness). */
  function inscription(label, chars, { w = 256, h = 64 } = {}) {
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    const rand = mulberry32(label.length * 97);
    px(ctx, 0, 0, w, h, '#efe8dc');
    for (let i = 0; i < 420; i++) {
      px(ctx, rand() * w, rand() * h, 2, 2, rand() > 0.55 ? 'rgba(130,120,108,0.16)' : 'rgba(255,252,246,0.42)');
    }
    ctx.strokeStyle = '#9a8f80';
    ctx.lineWidth = 2;
    ctx.strokeRect(3, 4, w - 6, h - 8);
    ctx.strokeStyle = '#fbf7ef';
    ctx.lineWidth = 1;
    ctx.strokeRect(5, 6, w - 10, h - 12);
    const font =
      '"STKaiti","KaiTi","Kaiti SC","BiauKai","DFKai-SB","Songti SC","Noto Serif SC","Noto Serif CJK SC","SimSun",serif';
    ctx.font = `700 ${Math.round(h * 0.52)}px ${font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const step = (w - 32) / chars.length;
    chars.forEach((ch, i) => {
      const x = 16 + step * (i + 0.5);
      const y = h * 0.53;
      ctx.fillStyle = 'rgba(255,252,245,0.88)';
      ctx.fillText(ch, x + 1, y + 1);
      ctx.fillStyle = '#202634';
      ctx.fillText(ch, x, y);
    });
    return register(label, c, { wrap: false, pixel: true, mip: true });
  }

  /** Crisp 32x32 pixel-art relief medallion for drum buttresses. */
  function rosette(label = 'rosette') {
    const S = 32;
    const c = makeCanvas(S, S);
    const ctx = c.getContext('2d');
    px(ctx, 0, 0, S, S, '#7e7e7e');
    const cx = 15.5;
    const cy = 15.5;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d > 12.2 && d < 14.5) px(ctx, x, y, 1, 1, '#dcdcdc');
        else if (d > 9.5 && d < 11.0) px(ctx, x, y, 1, 1, '#cfcfcf');
        else if (d < 3.2) px(ctx, x, y, 1, 1, '#eeeeee');
        else if (d < 9.2) {
          const ang = Math.atan2(y - cy, x - cx);
          if (Math.cos(ang * 8) > 0.35 && d > 4.2) px(ctx, x, y, 1, 1, '#d6d6d6');
        }
      }
    }
    return register(label, c, { srgb: false, wrap: false, pixel: true, mip: true });
  }

  /** Crisp 32x32 pixel-art cherry blossom sprig silhouette (OurSongs block-foliage feel). */
  function sakuraSprig(label = 'sakura-sprig', seed = 901) {
    const S = 32;
    const c = makeCanvas(S, S);
    const ctx = c.getContext('2d');
    const rand = mulberry32(seed);
    ctx.clearRect(0, 0, S, S);

    // Subtle interior pixel twigs
    px(ctx, 15, 16, 2, 8, '#6a4b45');
    px(ctx, 11, 13, 4, 2, '#6a4b45');
    px(ctx, 17, 13, 4, 2, '#6a4b45');

    const puffs = [
      [16, 8, 5.5],
      [9, 12, 4.8],
      [23, 12, 4.8],
      [7, 18, 4.2],
      [25, 18, 4.2],
      [15, 14, 5.4],
      [12, 20, 4.4],
      [20, 20, 4.4],
      [16, 23, 3.8],
    ];
    for (let y = 1; y < S - 1; y++) {
      for (let x = 1; x < S - 1; x++) {
        let minD = 99;
        for (const [cx, cy, r] of puffs) {
          const d = Math.hypot(x - cx, y - cy) / r;
          if (d < minD) minD = d;
        }
        if (minD > 0.96) continue;
        // Airy interior cutout holes (~18%) so canopies never look solid boxy
        if (minD > 0.62 && rand() < 0.22) continue;
        const hNorm = y / S;
        const n = rand();
        let col = '#ffe2eb';
        if (hNorm < 0.34 || (minD < 0.45 && n > 0.35)) col = '#fff8f5';
        else if (hNorm > 0.68 || minD > 0.78) col = n > 0.4 ? '#d98cab' : '#c77ea0';
        else if (n > 0.55) col = '#ffdbe8';
        else col = '#f4b5cd';
        px(ctx, x, y, 1, 1, col);
      }
    }
    return register(label, c, { wrap: false, pixel: true, mip: false });
  }

  /** Crisp 32x32 pixel-art camphor / evergreen leaf sprig. */
  function leafSprig(label = 'leaf-sprig', seed = 922) {
    const S = 32;
    const c = makeCanvas(S, S);
    const ctx = c.getContext('2d');
    const rand = mulberry32(seed);
    ctx.clearRect(0, 0, S, S);

    px(ctx, 15, 16, 2, 9, '#574a38');
    const puffs = [
      [16, 8, 5.2],
      [10, 12, 4.6],
      [22, 12, 4.6],
      [8, 18, 4.2],
      [24, 18, 4.2],
      [16, 15, 5.2],
      [13, 21, 4.2],
      [19, 21, 4.2],
    ];
    for (let y = 1; y < S - 1; y++) {
      for (let x = 1; x < S - 1; x++) {
        let minD = 99;
        for (const [cx, cy, r] of puffs) {
          const d = Math.hypot(x - cx, y - cy) / r;
          if (d < minD) minD = d;
        }
        if (minD > 0.96) continue;
        if (minD > 0.60 && rand() < 0.25) continue;
        const hNorm = y / S;
        const n = rand();
        let col = '#6f9e5a';
        if (hNorm < 0.35 && n > 0.25) col = '#a9cc72';
        else if (hNorm > 0.68 || minD > 0.78) col = n > 0.45 ? '#355c42' : '#284a39';
        else if (n < 0.42) col = '#4f7f4c';
        px(ctx, x, y, 1, 1, col);
      }
    }
    return register(label, c, { wrap: false, pixel: true, mip: false });
  }

  /** Crisp 16x32 pixel-art warm cherrywood bark. */
  function bark(label = 'bark') {
    const W = 16;
    const H = 32;
    const c = makeCanvas(W, H);
    const ctx = c.getContext('2d');
    const rand = mulberry32(77);
    px(ctx, 0, 0, W, H, '#6a4c44');
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (x % 4 === 0 && rand() < 0.75) px(ctx, x, y, 1, 1, '#4a322d');
        else if (x % 4 === 1 && rand() < 0.55) px(ctx, x, y, 1, 1, '#846257');
      }
    }
    for (let i = 0; i < 18; i++) {
      px(ctx, Math.floor(rand() * (W - 3)), Math.floor(rand() * H), 3, 1, '#9c776b');
    }
    return register(label, c, { pixel: true, mip: true });
  }

  /**
   * Hand-pixeled 48x64 OurSongs protagonist chibi sprite (2.2-head-tall silver-blue haired girl,
   * fitted sky-blue tracksuit w/ white stripes, chunky skate sneakers, silver camera + #ff3b3b red dot).
   */
  function protagonistFrame(frameIdx = 0) {
    const label = `protagonist-frame-${frameIdx}`;
    if (cache.has(label)) return cache.get(label);

    const W = 48;
    const H = 64;
    const c = makeCanvas(W, H);
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    const OUT = '#202840';
    const H_HI = '#f4f8ff';
    const H_BASE = '#cfdcf6';
    const H_MID = '#9fb6e2';
    const H_SHAD = '#687fb2';

    const SKIN = '#ffe8de';
    const SKIN_SHAD = '#f1c7b8';
    const BLUSH = '#ffb8c4';
    const EYE_DARK = '#1b346e';
    const EYE_MID = '#428be6';
    const EYE_HI = '#ffffff';

    const SUIT_HI = '#9ed4f5';
    const SUIT = '#68b2e5';
    const SUIT_SHAD = '#4284bc';
    const SUIT_DARK = '#2a5a8a';
    const STRIPE = '#f7fbff';

    const SHOE_TOP = '#8cc7ee';
    const SHOE_SHAD = '#5c9bc9';
    const SOLE = '#fafcff';
    const SOLE_SHAD = '#cfd8ea';

    const CAM_BODY = '#cfd7e3';
    const CAM_DARK = '#384154';
    const RED_DOT = '#ff3b3b';

    const bob = frameIdx === 1 ? 1 : 0;
    const hairShift = frameIdx === 1 ? 1 : 0;
    const step = frameIdx === 1 ? 1 : 0;

    // 1. Hair back curtain falling to lower thigh/waist (iconic silhouette block!)
    px(ctx, 13, 18 + bob, 22, 26, H_SHAD);
    px(ctx, 12, 22 + bob, 24, 21, H_SHAD);
    px(ctx, 14, 26 + bob, 20, 18, H_MID);
    px(ctx, 11 - hairShift, 32 + bob, 5, 11, H_MID);
    px(ctx, 32 + hairShift, 32 + bob, 5, 11, H_MID);
    // Hair tips splayed slightly outward
    px(ctx, 10 - hairShift, 41 + bob, 4, 3, H_SHAD);
    px(ctx, 34 + hairShift, 41 + bob, 4, 3, H_SHAD);
    px(ctx, 15, 42 + bob, 18, 3, H_SHAD);

    // 2. Legs & Track Pants (narrow slender legs)
    const legY = 44;
    // Left leg
    px(ctx, 18, legY, 5, 12 - step, SUIT_SHAD);
    px(ctx, 19, legY, 3, 12 - step, SUIT);
    px(ctx, 18, legY, 1, 11 - step, STRIPE); // white side stripe
    // Right leg
    px(ctx, 25, legY, 5, 12, SUIT_SHAD);
    px(ctx, 26, legY, 3, 12, SUIT);
    px(ctx, 29, legY, 1, 11, STRIPE); // white side stripe

    // 3. Chunky light-blue skate sneakers with flat white cupsole
    // Left shoe
    const lsY = 55 - step;
    px(ctx, 16, lsY, 7, 3, SHOE_TOP);
    px(ctx, 17, lsY, 5, 1, STRIPE); // laces
    px(ctx, 16, lsY + 2, 7, 1, SHOE_SHAD);
    px(ctx, 16, lsY + 3, 7, 2, SOLE);
    px(ctx, 16, lsY + 5, 7, 1, SOLE_SHAD);
    // Right shoe
    const rsY = 55;
    px(ctx, 25, rsY, 7, 3, SHOE_TOP);
    px(ctx, 26, rsY, 5, 1, STRIPE);
    px(ctx, 25, rsY + 2, 7, 1, SHOE_SHAD);
    px(ctx, 25, rsY + 3, 7, 2, SOLE);
    px(ctx, 25, rsY + 5, 7, 1, SOLE_SHAD);

    // 4. Fitted Sky-Blue Stand-Collar Zip Track Jacket (slender waist!)
    const bodyY = 30 + bob;
    px(ctx, 17, bodyY, 14, 15, SUIT);
    px(ctx, 17, bodyY + 11, 14, 4, SUIT_SHAD);
    px(ctx, 23, bodyY, 2, 14, STRIPE); // center zip line
    px(ctx, 20, bodyY - 2, 8, 3, SUIT_DARK); // stand collar
    px(ctx, 21, bodyY - 2, 6, 2, SUIT_HI);

    // Arms & white shoulder/sleeve stripes + hands holding silver camera
    px(ctx, 14, bodyY + 1, 3, 10, SUIT);
    px(ctx, 14, bodyY + 1, 1, 9, STRIPE);
    px(ctx, 31, bodyY + 1, 3, 10, SUIT);
    px(ctx, 33, bodyY + 1, 1, 9, STRIPE);
    // Sleeve highlights
    px(ctx, 18, bodyY + 1, 4, 8, SUIT_HI);
    px(ctx, 26, bodyY + 1, 4, 8, SUIT_HI);
    // Hands
    px(ctx, 15, bodyY + 9, 4, 3, SKIN);
    px(ctx, 28, bodyY + 9, 4, 3, SKIN);

    // 5. Silver Retro Camera with iconic #ff3b3b red recording dot
    px(ctx, 19, bodyY + 7, 10, 6, CAM_DARK);
    px(ctx, 20, bodyY + 8, 8, 4, CAM_BODY);
    px(ctx, 22, bodyY + 8, 4, 4, CAM_DARK); // lens ring
    px(ctx, 23, bodyY + 9, 2, 2, '#78b0e8'); // lens glass glint
    px(ctx, 26, bodyY + 8, 2, 2, RED_DOT); // #ff3b3b beacon!

    // 6. Chibi Head (large, ~42% of height)
    const headY = 8 + bob;
    px(ctx, 15, headY + 4, 18, 17, SKIN);
    px(ctx, 16, headY + 19, 16, 2, SKIN_SHAD);
    // Expressive large pixel eyes (deep blue + sky highlight + white sparkle)
    // Left eye
    px(ctx, 17, headY + 12, 4, 5, EYE_DARK);
    px(ctx, 18, headY + 14, 3, 3, EYE_MID);
    px(ctx, 18, headY + 12, 2, 2, EYE_HI);
    px(ctx, 20, headY + 16, 1, 1, EYE_HI);
    // Right eye
    px(ctx, 27, headY + 12, 4, 5, EYE_DARK);
    px(ctx, 27, headY + 14, 3, 3, EYE_MID);
    px(ctx, 28, headY + 12, 2, 2, EYE_HI);
    px(ctx, 27, headY + 16, 1, 1, EYE_HI);
    // Subtle cheek blush & quiet mouth
    px(ctx, 16, headY + 17, 2, 1, BLUSH);
    px(ctx, 30, headY + 17, 2, 1, BLUSH);
    px(ctx, 23, headY + 19, 2, 1, '#c9888c');

    // 7. Silver-blue hair crown, side locks & layered bangs
    px(ctx, 14, headY, 20, 8, H_BASE);
    px(ctx, 16, headY - 1, 16, 3, H_HI);
    px(ctx, 13, headY + 3, 22, 6, H_BASE);
    // Ahoge / crown highlight band
    px(ctx, 16, headY + 2, 16, 2, H_HI);
    px(ctx, 21, headY - 2, 4, 2, H_BASE);
    px(ctx, 22, headY - 3, 2, 1, H_HI);
    // Bangs framing face
    px(ctx, 14, headY + 7, 5, 5, H_BASE);
    px(ctx, 19, headY + 7, 4, 4, H_HI);
    px(ctx, 23, headY + 7, 3, 5, H_BASE);
    px(ctx, 26, headY + 7, 4, 4, H_HI);
    px(ctx, 30, headY + 7, 4, 5, H_BASE);
    px(ctx, 22, headY + 8, 2, 5, H_MID);
    // Side hair locks framing cheeks down past shoulders
    px(ctx, 12, headY + 7, 3, 22, H_BASE);
    px(ctx, 13, headY + 9, 2, 18, H_HI);
    px(ctx, 33, headY + 7, 3, 22, H_BASE);
    px(ctx, 33, headY + 9, 2, 18, H_HI);
    px(ctx, 12, headY + 26, 3, 7, H_MID);
    px(ctx, 33, headY + 26, 3, 7, H_MID);

    // 8. Automatic 1px crisp dark-indigo outline pass over alpha silhouette
    const img = ctx.getImageData(0, 0, W, H);
    const src = new Uint8ClampedArray(img.data);
    const outR = 32, outG = 40, outB = 64;
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i = (y * W + x) * 4;
        if (src[i + 3] > 20) continue;
        const n =
          src[((y - 1) * W + x) * 4 + 3] > 20 ||
          src[((y + 1) * W + x) * 4 + 3] > 20 ||
          src[(y * W + x - 1) * 4 + 3] > 20 ||
          src[(y * W + x + 1) * 4 + 3] > 20;
        if (n) {
          img.data[i] = outR;
          img.data[i + 1] = outG;
          img.data[i + 2] = outB;
          img.data[i + 3] = 255;
        }
      }
    }
    ctx.putImageData(img, 0, 0);

    return register(label, c, { wrap: false, pixel: true, mip: false });
  }

  /** Soft circular optical glow sprite for floating golden dust, fireflies & warm lamp halos. */
  function bokehDot(label = 'bokeh-dot') {
    if (cache.has(label)) return cache.get(label);
    const S = 32;
    const c = makeCanvas(S, S);
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.28, 'rgba(255,244,218,0.82)');
    g.addColorStop(0.65, 'rgba(255,224,160,0.22)');
    g.addColorStop(1, 'rgba(255,220,150,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    return register(label, c, { wrap: false, pixel: false, mip: false });
  }

  function getStats() {
    const totalBytes = registry.reduce((acc, item) => acc + item.bytes, 0);
    return {
      count: registry.length,
      totalBytes,
      totalKB: +(totalBytes / 1024).toFixed(1),
      items: registry.map(({ label, width, height, bytes }) => ({
        label,
        dims: `${width}x${height}`,
        bytes,
      })),
    };
  }

  return {
    granite,
    paving,
    grass,
    ashlarStone,
    concretePier,
    glazedTiles,
    sakuraCanopy,
    sakuraSprig,
    leafSprig,
    facade,
    inscription,
    rosette,
    bark,
    protagonistFrame,
    bokehDot,
    getStats,
  };
}
