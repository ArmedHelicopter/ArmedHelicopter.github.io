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

  /** Crisp 48x48 pixel-art meadow with visible blade tufts, clover clumps & blossom specks. */
  function grass(label = 'grass', repeat = [22, 22], seed = 31) {
    const S = 48;
    const c = makeCanvas(S, S);
    const ctx = c.getContext('2d');
    const rand = mulberry32(seed);
    const tones = ['#5a8347', '#6a9652', '#7da85f', '#4b703d'];
    px(ctx, 0, 0, S, S, tones[1]);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const v = rand();
        if (v < 0.18) px(ctx, x, y, 1, 1, tones[3]);
        else if (v < 0.44) px(ctx, x, y, 1, 1, tones[0]);
        else if (v > 0.78) px(ctx, x, y, 1, 1, tones[2]);
      }
    }
    // Crisp sunlit grass blade tufts & clover clusters
    for (let i = 0; i < 36; i++) {
      const tx = Math.floor(rand() * (S - 3)) + 1;
      const ty = Math.floor(rand() * (S - 3)) + 2;
      px(ctx, tx, ty, 2, 1, '#3d5f34');
      px(ctx, tx, ty - 1, 1, 1, '#8fb86d');
      px(ctx, tx + 1, ty - 2, 1, 1, '#a6cd7e');
    }
    // Tiny clover wildflowers & fallen sakura petals
    for (let i = 0; i < 16; i++) {
      const fx = Math.floor(rand() * S);
      const fy = Math.floor(rand() * S);
      px(ctx, fx, fy, 1, 1, rand() > 0.42 ? '#fff1bd' : '#ffd8e6');
    }
    return register(label, c, { repeat, pixel: true, mip: true });
  }

  /** Crisp 32x32 pixel-art ashlar masonry retaining walls with soft natural mortar. */
  function ashlarStone(label = 'ashlar-stone', base = '#dfd2bc', seed = 79) {
    const S = 32;
    const c = makeCanvas(S, S);
    const ctx = c.getContext('2d');
    const rand = mulberry32(seed);
    px(ctx, 0, 0, S, S, '#bfb29e');

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
    // Subtle expansion joints every 16px
    for (const jx of [0, 16]) {
      px(ctx, jx, 0, 1, S, '#a8a093');
      px(ctx, jx + 1, 0, 1, S, 'rgba(255,252,246,0.38)');
    }
    for (const jy of [0, 16]) {
      px(ctx, 0, jy, S, 1, 'rgba(160,152,140,0.28)');
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

  /** Crisp 96x96 multi-tone botanical floret cluster sakura canopy texture. */
  function sakuraCanopy(label = 'sakura-canopy', baseHex = '#ffe8f0', accentHex = '#ffc4d9', seed = 88) {
    const S = 96;
    const c = makeCanvas(S, S);
    const ctx = c.getContext('2d');
    const rand = mulberry32(seed);
    px(ctx, 0, 0, S, S, baseHex);
    const tones = ['#fffafd', '#ffeff6', accentHex, '#f09ebb', '#da7ea0'];
    for (let i = 0; i < 420; i++) {
      const cx = Math.floor(rand() * S);
      const cy = Math.floor(rand() * S);
      const v = rand();
      const t = v < 0.24 ? tones[0] : v < 0.50 ? tones[1] : v < 0.78 ? tones[2] : v < 0.92 ? tones[3] : tones[4];
      const w = 3 + Math.floor(rand() * 4);
      const h = 2 + Math.floor(rand() * 3);
      px(ctx, cx, cy, w, h, t);
      if (v > 0.78 && rand() < 0.5) px(ctx, cx + 1, cy - 1, 2, 1, '#fffafd');
    }
    return {
      map: register(`${label}-albedo`, c, { repeat: [2, 2], pixel: true, mip: true }),
      bumpMap: null,
    };
  }

  /** Crisp 96x96 multi-tone clustered camphor leaf canopy texture for sculpted forest crowns. */
  function leafCanopy(label = 'leaf-canopy', seed = 91) {
    const S = 96;
    const c = makeCanvas(S, S);
    const ctx = c.getContext('2d');
    const rand = mulberry32(seed);
    px(ctx, 0, 0, S, S, '#699754');
    const tones = ['#bce080', '#8cbe64', '#588a4c', '#3c663e', '#2c4d32'];
    for (let i = 0; i < 460; i++) {
      const cx = Math.floor(rand() * S);
      const cy = Math.floor(rand() * S);
      const v = rand();
      const t = v < 0.24 ? tones[0] : v < 0.52 ? tones[1] : v < 0.78 ? tones[2] : v < 0.93 ? tones[3] : tones[4];
      const w = 3 + Math.floor(rand() * 4);
      const h = 2 + Math.floor(rand() * 3);
      px(ctx, cx, cy, w, h, t);
      if (v > 0.80 && rand() < 0.4) px(ctx, cx + 1, cy, 2, 1, '#bce080');
    }
    return register(`${label}-albedo`, c, { repeat: [2, 2], pixel: true, mip: true });
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
        const ww = Math.max(7, Math.floor(cw * 0.50));
        const wh = Math.max(9, Math.floor(rh * 0.56));
        const x = c * cw + Math.floor((cw - ww) / 2);
        const y = r * rh + Math.floor(rh * 0.18);

        // Recessed cream stone surround & warm lower sill shadow (prevents barcode striping)
        px(a, x - 1, y - 1, ww + 2, wh + 2, '#f6eee0');
        px(a, x - 1, y + wh + 1, ww + 2, 1, '#c4b49e');
        px(a, x, y, ww, wh, '#364b5f');

        const lit = rand() < 0.58;
        if (arched && r === rows - 1) {
          px(a, x + 1, y + 2, ww - 2, wh - 3, '#3b5c78');
          px(a, x + 2, y + 1, ww - 4, 1, '#3b5c78');
        } else {
          px(a, x + 1, y + 1, ww - 2, wh - 2, '#355470');
        }
        // Layered glass pane gradient + bright sky specular corner sheen
        px(a, x + 1, y + 2, Math.max(2, Math.floor(ww * 0.42)), Math.max(2, wh - 5), '#5f89ab');
        px(a, x + 1, y + 2, 1, Math.max(2, Math.floor(wh * 0.55)), '#b7d7ec');
        px(a, x + Math.floor(ww / 2), y + 1, 1, wh - 2, '#cfc3b0');
        px(a, x + 1, y + Math.floor(wh * 0.48), ww - 2, 1, '#cfc3b0');

        if (lit) {
          const vLit = rand();
          const winOuter = vLit < 0.35 ? '#ffb050' : vLit < 0.72 ? '#ffcb74' : '#d68846';
          const winInner = vLit < 0.35 ? '#ffd684' : vLit < 0.72 ? '#ffe5ad' : '#f0aa5c';
          px(e, x + 1, y + 1, ww - 2, wh - 2, winOuter);
          px(e, x + 2, y + 2, ww - 4, wh - 4, winInner);
          if (vLit > 0.78) {
            px(e, x + 2, y + 2, Math.max(1, Math.floor((ww - 4) * 0.45)), wh - 4, '#6b4928');
          }
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

  /** Refined 128x128 painterly cluster blossom sprite (fine overlapping 5-petal florets, lacy silhouette). */
  function sakuraSprig(label = 'sakura-sprig', seed = 901) {
    const S = 128;
    const c = makeCanvas(S, S);
    const ctx = c.getContext('2d');
    const rand = mulberry32(seed);
    ctx.clearRect(0, 0, S, S);

    const clusters = [];
    for (let i = 0; i < 44; i++) {
      const ang = (i / 44) * Math.PI * 2 + (rand() - 0.5) * 0.48;
      const dist = i < 10 ? rand() * 12 : 15 + rand() * 27;
      const cx = S * 0.5 + Math.cos(ang) * dist;
      const cy = S * 0.50 + Math.sin(ang) * dist * 0.88;
      const r = i < 10 ? 13.0 + rand() * 4.5 : 6.2 + rand() * 4.8;
      const toneIdx = cy < S * 0.36 ? 0 : cy > S * 0.66 ? 2 : 1;
      clusters.push({ cx, cy, r, toneIdx, ph: rand() * 6.28 });
    }
    const tones = ['#fff8fa', '#ffd9e8', '#efa5bf'];
    for (let y = 2; y < S - 2; y++) {
      for (let x = 2; x < S - 2; x++) {
        let hit = null;
        let bestD = 99;
        for (const cl of clusters) {
          const dx = x - cl.cx;
          const dy = y - cl.cy;
          const a = Math.atan2(dy, dx);
          const scalloped = cl.r * (0.90 + 0.16 * Math.cos(a * 5 + cl.ph));
          const d = Math.hypot(dx, dy) / scalloped;
          if (d < bestD) {
            bestD = d;
            hit = cl;
          }
        }
        if (!hit || bestD > 1.0) continue;
        let col = tones[hit.toneIdx];
        if (bestD < 0.42 && y < S * 0.45) col = '#fffcfd';
        else if (bestD > 0.84 && hit.toneIdx === 2) col = '#df8ca9';
        else if (rand() < 0.25 && hit.toneIdx === 1) col = '#ffeaf2';
        px(ctx, x, y, 1, 1, col);
      }
    }
    return register(label, c, { wrap: false, pixel: true, mip: true });
  }

  /** Refined 128x128 painterly deciduous leaf spray (crisp serrated broadleaf clusters & deep foliage crevices). */
  function leafSprig(label = 'leaf-sprig', seed = 922) {
    const S = 128;
    const c = makeCanvas(S, S);
    const ctx = c.getContext('2d');
    const rand = mulberry32(seed);
    ctx.clearRect(0, 0, S, S);

    const clusters = [];
    for (let i = 0; i < 44; i++) {
      const ang = (i / 44) * Math.PI * 2 + (rand() - 0.5) * 0.48;
      const dist = i < 10 ? rand() * 12 : 15 + rand() * 27;
      const cx = S * 0.5 + Math.cos(ang) * dist;
      const cy = S * 0.50 + Math.sin(ang) * dist * 0.88;
      const r = i < 10 ? 12.5 + rand() * 4.5 : 6.2 + rand() * 4.8;
      const toneIdx = cy < S * 0.36 ? 0 : cy > S * 0.66 ? 2 : 1;
      clusters.push({ cx, cy, r, toneIdx, ph: rand() * 6.28 });
    }
    const tones = ['#a4ca68', '#5c8f48', '#2a5235'];
    for (let y = 2; y < S - 2; y++) {
      for (let x = 2; x < S - 2; x++) {
        let hit = null;
        let bestD = 99;
        for (const cl of clusters) {
          const dx = x - cl.cx;
          const dy = y - cl.cy;
          const a = Math.atan2(dy, dx);
          const scalloped = cl.r * (0.90 + 0.18 * Math.cos(a * 4 + cl.ph));
          const d = Math.hypot(dx, dy) / scalloped;
          if (d < bestD) {
            bestD = d;
            hit = cl;
          }
        }
        if (!hit || bestD > 1.0) continue;
        let col = tones[hit.toneIdx];
        if (bestD < 0.40 && y < S * 0.44) col = '#bcd97a';
        else if (bestD > 0.78 && hit.toneIdx === 2) col = '#1d3c27';
        else if (rand() < 0.28 && hit.toneIdx === 1) col = '#7cad56';
        px(ctx, x, y, 1, 1, col);
      }
    }
    return register(label, c, { wrap: false, pixel: true, mip: true });
  }

  /** Crisp 32x64 pixel-art warm cherrywood bark with chestnut furrows & lenticels. */
  function bark(label = 'bark') {
    const W = 32;
    const H = 64;
    const c = makeCanvas(W, H);
    const ctx = c.getContext('2d');
    const rand = mulberry32(77);
    px(ctx, 0, 0, W, H, '#8d685c');
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if ((x % 6 === 0 || x % 6 === 1) && rand() < 0.72) px(ctx, x, y, 1, 1, '#684840');
        else if (x % 6 === 3 && rand() < 0.62) px(ctx, x, y, 1, 1, '#b58e7e');
        else if (rand() < 0.25) px(ctx, x, y, 1, 1, '#7a584d');
      }
    }
    for (let i = 0; i < 34; i++) {
      const lx = Math.floor(rand() * (W - 5));
      const ly = Math.floor(rand() * H);
      px(ctx, lx, ly, 4 + Math.floor(rand() * 3), 1, '#cfa996');
      px(ctx, lx, ly + 1, 3, 1, '#5d3f38');
    }
    return register(label, c, { pixel: true, mip: true });
  }

  /**
   * Authentic Guardian Tales (坎公骑冠剑) compact chibi pixel-art character sprite
   * inspired by gtlibrary Spine rigs (knight_demon_queen hair silhouette + knight_female_sport_uniform
   * tracksuit proportions) and the user's silver-haired sky-blue tracksuit character design.
   * Uses colored selvedge outlines, plump cheeks, tall 4x5 jewel blue eyes, sculpted 5-ramp hair
   * clusters, and zero internal black lines across the waist or neck.
   */
  const GT_KANADE_PAL = {
    '.': null,
    // Hair & unified colored selvedge outlines (consistent slate-indigo outline clarity on all tips)
    O: '#3c4c6e', // upper dome cool slate-indigo selvedge
    o: '#46587c', // matching outer hair-tip selvedge so lower tips pop against bright tiles
    W: '#ffffff', // pure halo zig-zag crown sheen
    H: '#f4f8ff', // luminous icy silver-white light
    S: '#dde7f7', // cool silver-white base hair
    M: '#b8c9e4', // cool periwinkle-silver mid shadow
    D: '#8a9ec0', // deep periwinkle hair crease
    // Plump cheeks, warm skin & balanced rose-umber selvedge
    k: '#6b4c52', // crisp warm plum-umber chin/hand selvedge
    f: '#fff2ea', // warm porcelain-cream face/hand highlight
    s: '#fadbc9', // soft peach cheek warmth
    c: '#ecc0aa', // gentle chin/palm shadow bevel
    b: '#f6adb0', // cute small cheek blush dots
    m: '#c26b6e', // tiny delicate rose mouth
    // Guardian Tales tall jewel eyes & calm silver-blue brows
    L: '#2c263b', // dark espresso-plum upper eyelash
    e: '#284584', // deep sapphire upper iris
    i: '#4e96e2', // vivid cerulean mid-iris
    g: '#96e0ff', // luminous ice-cyan lower iris crescent
    w: '#ffffff', // crisp sclera & directional eye sparkle
    r: '#7d8fb2', // calm silver-blue eyebrow
    // Powder sky-blue tracksuit & navy sneakers (unified navy selvedge, soft internal seams)
    u: '#3c5174', // unified cool navy garment/shoe outer selvedge
    B: '#bfe5f8', // sky-blue jacket highlight & pocket piping
    T: '#90c5e0', // powder sky-blue main fabric
    t: '#6799b5', // soft sky-blue internal fold/seam shadow
    d: '#4b7690', // collar/hem shadow
    Z: '#f8fcff', // crisp white center zipper, outer leg stripes & sneaker sole
    N: '#344970', // dark navy sneaker upper
    n: '#273858', // subtle sneaker toe shadow (no near-black blocks)
  };

  function drawSpriteGrid(rows, pal = GT_KANADE_PAL, mirrorX = false) {
    const h = rows.length;
    const w = rows[0].length;
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    for (let y = 0; y < h; y++) {
      const row = rows[y];
      for (let x = 0; x < w; x++) {
        const ch = row[mirrorX ? w - 1 - x : x];
        const col = pal[ch];
        if (col) {
          ctx.fillStyle = col;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    return c;
  }

  function protagonistParts() {
    if (cache.has('protagonist-parts')) return cache.get('protagonist-parts');

    // 1. Graceful sculpted bell-shaped silver back hair closed with crisp 'o' selvedge (30x25)
    const BACK_HAIR_ROWS = [
      '..............................',
      '........oooooooooooooo........',
      '......ooSSSSSSSSSSSSSSoo......',
      '.....oSSSSSSMMMMMMSSSSSSo.....',
      '....oSSSSSMMMMDDDDMMMMSSSo....',
      '....oSSSSMMMDDDDDDDDMMMSSo....',
      '...oSSSSMMMDDDDDDDDDDMMMSSo...',
      '...oSSSMMMDDDDDDDDDDDDMMMSo...',
      '..oSSSMMMDDDDDDDDDDDDDDMMMSo..',
      '..oSSSMMMDDDDDDDDDDDDDDMMMSo..',
      '.oSSSMMMMDDDDDDDDDDDDDDMMMMSo.',
      '.oSSSMMMDDDDDDDDDDDDDDDDMMMSo.',
      '.oSSMMMMDDDDDDDDDDDDDDDDMMMMSo',
      'oSSSMMMMDDDDDDMDDDDDMDDDDMMMSo',
      'oSSSMMMDDDDDDDMDDDDDMDDDDDMMSo',
      'oSSSMMMDDDDDDDMDDDDDMDDDDDMMSo',
      'oSSMMMDDDDDDDDMDDDDDMDDDDDDMSo',
      '.oSMMMDDDDDMDDMDMMMMDMDDDDMMSo',
      '.oSMMDDDDDoDMDDMMMMMMDMDDoMMSo',
      '..oSMDDDo..oDMDDMMMMDDMDo.oMSo',
      '..oSDDDo....oDDDoMMoDDDo...oo.',
      '...oDDo......oDo.oo.oDo.......',
      '....oo........o......o........',
      '..............................',
      '..............................',
    ];

    // 2. Stubby powder-blue tracksuit leg + dark navy white-soled sneaker (7x9, soft internal seam)
    const LEFT_LEG_ROWS = [
      '.......',
      '.uZTTt.',
      '.uZTTt.',
      '.uZTtt.',
      '.udtdt.',
      'uNNNNt.',
      'uNnnNu.',
      'uZZZZu.',
      '.uuuu..',
    ];

    // 3. Compact Guardian Tales zip-up tracksuit jacket: vertical zipper only (NO '+' cross) & soft internal cuffs (15x11)
    const TORSO_ROWS = [
      '...............',
      '....udTZTdu....',
      '...uBBTZTBBu...',
      '..BBBBTZTBTTt..',
      '..BTTTZTTTTtt..',
      '..TTTTZTTTTtt..',
      '..TBTTZTTTtBt..',
      '..uTTTZTTTttu..',
      '..utttZtttttu..',
      '...udddZdddu...',
      '...utTTdTTtu...',
    ];

    // 4. Outstretched A-pose stubby tracksuit sleeve + chunky peach hand w/ crisp closed outline (9x10)
    const LEFT_ARM_ROWS = [
      '.........',
      '.....tB..',
      '....uZBT.',
      '...uZBTT.',
      '..uZBTtd.',
      '.uZBTtdu.',
      '.ukffkdu.',
      '.kfffck..',
      '.kfscck..',
      '..kkkk...',
    ];

    // 5. Rounded Guardian Tales Kanade chibi head: zero jaw specks, full bottom tip selvedge (30x26)
    const HEAD_OPEN_ROWS = [
      '..............................',
      '...........OOOOOOOO...........',
      '........OOOHHHHHHHHOOO........',
      '......OOHHHHHHHHHHHHHHOO......',
      '.....OHHHHWWWWWWWWWWHHHHO.....',
      '....OHHWWWWWHHHHHHWWWWWHHO....',
      '...OHHWWWHHHHHMMHHHHHWWWHHO...',
      '..OHHHHHHHHHHMMHMHHHHHHHHHHO..',
      '..OSHSSHHHHMMMMMMMMHHHHSSSHO..',
      '.oOSSSSSHHMHHHMMHHHMMHHSSSSOo.',
      '.oOSSHSHHMffHHHHHHffHMHSHSSOo.',
      '.oOSHSHHMfrrffHHffrrfMHSHSSOo.',
      '.oOSHSHkffffffMSffffffkSHSSOo.',
      'oOSSHSkfLLLLffMSffLLLLfkSHSSOo',
      'oOSSHMkfwwweffffffweeeffkMSSOo',
      'oOSSHSkfwwiiffffffwiiiffkMSSOo',
      'oOSSHMkfwggiffssffwggiffkMSSOo',
      '.oSSHMkfbbfssffffssfbbbbfMSSo.',
      '.oSSHMMsffffscmmcffffffsMMSSo.',
      '.oSSHMMssssssccccssssssMMSSSo.',
      '..oSHMoooookkkkkkkkoooooMHSo..',
      '..oSHo..................oHSo..',
      '...oHo..................oHo...',
      '...oMo..................oMo...',
      '....o....................o....',
      '..............................',
    ];

    const HEAD_BLINK_ROWS = HEAD_OPEN_ROWS.map((row, idx) => {
      if (idx === 13) return 'oOSSHSkfffffffMSfffffffkSHSSOo';
      if (idx === 14) return 'oOSSHMkfcLLffffffffLLcfkMSSOo.';
      if (idx === 15) return 'oOSSHSkfLLLLffffffLLLLfkMSSOo.';
      if (idx === 16) return 'oOSSHMkfffffffssfffffffkMSSOo.';
      return row;
    });

    const bhCanvas = drawSpriteGrid(BACK_HAIR_ROWS);
    const llCanvas = drawSpriteGrid(LEFT_LEG_ROWS, GT_KANADE_PAL, false);
    const rlCanvas = drawSpriteGrid(LEFT_LEG_ROWS, GT_KANADE_PAL, true);
    const trCanvas = drawSpriteGrid(TORSO_ROWS);
    const laCanvas = drawSpriteGrid(LEFT_ARM_ROWS, GT_KANADE_PAL, false);
    const raCanvas = drawSpriteGrid(LEFT_ARM_ROWS, GT_KANADE_PAL, true);
    const hoCanvas = drawSpriteGrid(HEAD_OPEN_ROWS);
    const hbCanvas = drawSpriteGrid(HEAD_BLINK_ROWS);

    const parts = {
      backHair: register('protagonist-back-hair', bhCanvas, { wrap: false, pixel: true, mip: false }),
      leg: register('protagonist-leg', llCanvas, { wrap: false, pixel: true, mip: false }),
      leftLeg: register('protagonist-left-leg', llCanvas, { wrap: false, pixel: true, mip: false }),
      rightLeg: register('protagonist-right-leg', rlCanvas, { wrap: false, pixel: true, mip: false }),
      torso: register('protagonist-torso', trCanvas, { wrap: false, pixel: true, mip: false }),
      arm: register('protagonist-arm', laCanvas, { wrap: false, pixel: true, mip: false }),
      leftArm: register('protagonist-left-arm', laCanvas, { wrap: false, pixel: true, mip: false }),
      rightArm: register('protagonist-right-arm', raCanvas, { wrap: false, pixel: true, mip: false }),
      headOpen: register('protagonist-head-open', hoCanvas, { wrap: false, pixel: true, mip: false }),
      headBlink: register('protagonist-head-blink', hbCanvas, { wrap: false, pixel: true, mip: false }),
    };
    cache.set('protagonist-parts', parts);
    return parts;
  }

  function protagonistFrame(frameIdx = 0) {
    const label = `protagonist-frame-${frameIdx}`;
    if (cache.has(label)) return cache.get(label);
    const parts = protagonistParts();
    const c = makeCanvas(36, 40);
    const ctx = c.getContext('2d');
    ctx.drawImage(parts.backHair.image, 3, 13);
    ctx.drawImage(parts.leftLeg.image, 11, 30);
    ctx.drawImage(parts.rightLeg.image, 18, 30);
    ctx.drawImage(parts.torso.image, 10, 21);
    ctx.drawImage(parts.leftArm.image, 5, 22);
    ctx.drawImage(parts.rightArm.image, 22, 22);
    ctx.drawImage(frameIdx === 1 ? parts.headBlink.image : parts.headOpen.image, 3, 2);
    return register(label, c, { wrap: false, pixel: true, mip: false });
  }

  /** Continuous single-piece soft-feathered human silhouette shadow anchored smoothly at shoes. */
  function chibiShadowMap(label = 'chibi-shadow-map') {
    if (cache.has(label)) return cache.get(label);
    const W = 48;
    const H = 96;
    const c = makeCanvas(W, H);
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    const img = ctx.createImageData(W, H);
    for (let y = 0; y < H; y++) {
      const v = y / (H - 1); // 0 = shoe base (near feet), 1 = head crown tip
      // Continuous connected profile width along shadow projection (zero neck pinch or detached gap!)
      let halfW = 14.5;
      if (v < 0.22) {
        halfW = 11.5 + (v / 0.22) * 3.0;
      } else if (v < 0.56) {
        halfW = 14.5 - ((v - 0.22) / 0.34) * 3.0;
      } else if (v < 0.80) {
        halfW = 11.5 + ((v - 0.56) / 0.24) * 4.5;
      } else {
        halfW = 16.0 * Math.sqrt(Math.max(0.0, 1.0 - Math.pow((v - 0.80) / 0.20, 2)));
      }
      // Taper cleanly at front of shoes (v < 0.08)
      if (v < 0.10) {
        halfW *= Math.sqrt(Math.max(0.05, v / 0.10));
      }
      for (let x = 0; x < W; x++) {
        const dx = Math.abs(x - (W - 1) * 0.5);
        const norm = halfW > 0.2 ? dx / halfW : 9.0;
        if (norm >= 1.15) continue;
        const edgeAlpha = norm < 0.72 ? 1.0 : Math.max(0, 1.0 - (norm - 0.72) / 0.43);
        const lenFade = v > 0.88 ? Math.max(0, 1.0 - (v - 0.88) / 0.12) : 1.0;
        const a = Math.round(255 * edgeAlpha * lenFade);
        const i = (y * W + x) * 4;
        img.data[i] = 22;
        img.data[i + 1] = 34;
        img.data[i + 2] = 56;
        img.data[i + 3] = a;
      }
    }
    ctx.putImageData(img, 0, 0);
    return register(label, c, { wrap: false, pixel: false, mip: false });
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
    leafCanopy,
    sakuraSprig,
    leafSprig,
    facade,
    inscription,
    rosette,
    bark,
    protagonistParts,
    protagonistFrame,
    chibiShadowMap,
    bokehDot,
    getStats,
  };
}
