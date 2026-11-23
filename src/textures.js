import * as THREE from 'three';

/**
 * Procedural, zero-asset canvas texture factory for the sunlit WHU campus.
 * Every texture is generated at runtime (no external downloads) with lean memory
 * footprint and registered for accurate HUD VRAM telemetry.
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

function speckle(ctx, w, h, rand, count, colorFn, sizeMin = 1, sizeMax = 2.2) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colorFn(rand());
    const s = sizeMin + rand() * (sizeMax - sizeMin);
    ctx.fillRect(rand() * w, rand() * h, s, s);
  }
}

export function createTextureFactory(renderer) {
  const registry = [];
  const cache = new Map();
  const maxAniso = renderer ? Math.min(4, renderer.capabilities.getMaxAnisotropy()) : 4;

  function register(label, canvas, { srgb = true, repeat = [1, 1], mip = true, wrap = true } = {}) {
    if (cache.has(label)) return cache.get(label);
    const tex = new THREE.CanvasTexture(canvas);
    if (wrap) {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
    }
    tex.repeat.set(repeat[0], repeat[1]);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = mip ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
    tex.generateMipmaps = mip;
    tex.anisotropy = maxAniso;
    if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    const bytes = Math.round(canvas.width * canvas.height * 4 * (mip ? 1.333 : 1));
    registry.push({ label, width: canvas.width, height: canvas.height, bytes, texture: tex });
    cache.set(label, tex);
    return tex;
  }

  /** Fine-grained sunlit white granite (archway, balustrades, steps). */
  function granite(label = 'granite', base = '#f5f2ec', seed = 11) {
    const S = 256;
    const c = makeCanvas(S, S);
    const ctx = c.getContext('2d');
    const rand = mulberry32(seed);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 45; i++) {
      const x = rand() * S;
      const y = rand() * S;
      const r = 12 + rand() * 36;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const dark = rand() > 0.5;
      g.addColorStop(0, dark ? 'rgba(175,170,164,0.09)' : 'rgba(255,255,255,0.24)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    speckle(
      ctx,
      S,
      S,
      rand,
      2800,
      (v) =>
        v > 0.62
          ? 'rgba(130,128,132,0.18)'
          : v > 0.3
            ? 'rgba(205,200,194,0.28)'
            : 'rgba(255,255,255,0.48)',
      0.7,
      1.6
    );
    return register(label, c);
  }

  /** Large sunlit granite paving slabs for the archway plaza & avenues. */
  function paving(label = 'paving', repeat = [10, 10], base = '#efece6', joint = '#d4cfc7', seed = 21) {
    const S = 256;
    const c = makeCanvas(S, S);
    const ctx = c.getContext('2d');
    const rand = mulberry32(seed);
    ctx.fillStyle = joint;
    ctx.fillRect(0, 0, S, S);
    const rows = 4;
    const rh = S / rows;
    for (let r = 0; r < rows; r++) {
      const off = r % 2 ? 32 : 0;
      for (let x = -64; x < S; x += 64) {
        const tone = Math.floor((rand() - 0.5) * 10);
        const b = parseInt(base.slice(1), 16);
        const cr = Math.max(0, Math.min(255, ((b >> 16) & 255) + tone));
        const cg = Math.max(0, Math.min(255, ((b >> 8) & 255) + tone));
        const cb = Math.max(0, Math.min(255, (b & 255) + tone + 2));
        ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
        ctx.fillRect(x + off + 1, r * rh + 1, 62, rh - 2);
      }
    }
    speckle(
      ctx,
      S,
      S,
      rand,
      2200,
      (v) => (v > 0.55 ? 'rgba(150,146,150,0.14)' : 'rgba(255,255,255,0.35)'),
      0.7,
      1.5
    );
    return register(label, c, { repeat });
  }

  /** Seamlessly tiled spring lawn texture (rich natural green micro-variation, zero grid seams). */
  function grass(label = 'grass', repeat = [24, 24], seed = 31) {
    const S = 256;
    const c = makeCanvas(S, S);
    const ctx = c.getContext('2d');
    const rand = mulberry32(seed);
    ctx.fillStyle = '#68985d';
    ctx.fillRect(0, 0, S, S);
    // Toroidally wrapped radial gradients so tile edges are 100% invisible
    for (let i = 0; i < 64; i++) {
      const x = rand() * S;
      const y = rand() * S;
      const r = 18 + rand() * 38;
      const c0 = rand() > 0.5 ? 'rgba(72,118,62,0.22)' : 'rgba(130,174,104,0.22)';
      for (const ox of [-S, 0, S]) {
        for (const oy of [-S, 0, S]) {
          const px = x + ox;
          const py = y + oy;
          if (px + r < 0 || px - r > S || py + r < 0 || py - r > S) continue;
          const g = ctx.createRadialGradient(px, py, 0, px, py, r);
          g.addColorStop(0, c0);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.fillRect(px - r, py - r, r * 2, r * 2);
        }
      }
    }
    speckle(
      ctx,
      S,
      S,
      rand,
      3600,
      (v) =>
        v > 0.68
          ? 'rgba(58,98,52,0.26)'
          : v > 0.34
            ? 'rgba(116,158,90,0.26)'
            : 'rgba(154,192,122,0.22)',
      0.8,
      1.9
    );
    return register(label, c, { repeat });
  }

  /** Dressed ashlar limestone masonry for campus retaining walls & terraces. */
  function ashlarStone(label = 'ashlar-stone', base = '#eae0cf', seed = 79) {
    const S = 256;
    const c = makeCanvas(S, S);
    const ctx = c.getContext('2d');
    const rand = mulberry32(seed);
    ctx.fillStyle = '#cbbca5';
    ctx.fillRect(0, 0, S, S);

    const rows = 8;
    const rh = S / rows;
    const cols = 4;
    const cw = S / cols;
    const bInt = parseInt(base.slice(1), 16);
    const br = (bInt >> 16) & 255;
    const bg = (bInt >> 8) & 255;
    const bb = bInt & 255;

    for (let r = 0; r < rows; r++) {
      const offset = (r % 2) * (cw * 0.5);
      for (let col = -1; col <= cols; col++) {
        const x = col * cw + offset;
        const y = r * rh;
        const tone = Math.floor((rand() - 0.5) * 18);
        ctx.fillStyle = `rgb(${Math.min(255, Math.max(0, br + tone))},${Math.min(255, Math.max(0, bg + tone - 1))},${Math.min(255, Math.max(0, bb + tone - 3))})`;
        ctx.fillRect(x + 1.5, y + 1.5, cw - 3, rh - 3);
        ctx.fillStyle = 'rgba(255,252,246,0.28)';
        ctx.fillRect(x + 1.5, y + 1.5, cw - 3, 2);
        ctx.fillStyle = 'rgba(118,104,88,0.18)';
        ctx.fillRect(x + 1.5, y + rh - 3.5, cw - 3, 2);
      }
    }
    speckle(
      ctx,
      S,
      S,
      rand,
      2600,
      (v) => (v > 0.5 ? 'rgba(135,120,102,0.12)' : 'rgba(255,252,246,0.22)'),
      0.7,
      1.6
    );
    return register(label, c);
  }

  /** Weathered warm-grey lakeside concrete slab texture with expansion joints for Lingbo Pier. */
  function concretePier(label = 'concrete-pier', seed = 83) {
    const S = 256;
    const c = makeCanvas(S, S);
    const ctx = c.getContext('2d');
    const rand = mulberry32(seed);
    ctx.fillStyle = '#e7e4de';
    ctx.fillRect(0, 0, S, S);

    for (let i = 0; i < 40; i++) {
      const x = rand() * S;
      const y = rand() * S;
      const r = 14 + rand() * 34;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rand() > 0.5 ? 'rgba(156,154,148,0.14)' : 'rgba(255,254,250,0.22)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // Expansion joints (2 slabs per tile repeat)
    for (const jx of [0, S * 0.5]) {
      ctx.fillStyle = 'rgba(112,114,118,0.38)';
      ctx.fillRect(jx, 0, 2.5, S);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillRect(jx + 2.5, 0, 1.5, S);
    }
    speckle(
      ctx,
      S,
      S,
      rand,
      3000,
      (v) => (v > 0.55 ? 'rgba(128,128,132,0.16)' : 'rgba(252,251,248,0.3)'),
      0.6,
      1.5
    );
    return register(label, c);
  }

  /**
   * Radiant WHU Peacock-Blue/Turquoise Glazed Tiles (孔雀蓝琉璃瓦) —
   * bright high-value albedo + grayscale bumpMap so curved roof slopes stay vivid turquoise!
   */
  function glazedTiles(label = 'glazed') {
    const W = 128;
    const H = 128;
    const albedo = makeCanvas(W, H);
    const bump = makeCanvas(W, H);
    const a = albedo.getContext('2d');
    const b = bump.getContext('2d');
    const aimg = a.createImageData(W, H);
    const bimg = b.createImageData(W, H);

    const colValley = new THREE.Color('#197a8c');
    const colBody = new THREE.Color('#30b2bf');
    const colCrest = new THREE.Color('#9cf2ef');

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const u = (x / W) * 6;
        const fu = u - Math.floor(u);
        const v = (y / H) * 5;
        const fv = v - Math.floor(v);

        const dist = Math.abs(fu - 0.5);
        let hVal = 0.25;
        if (dist < 0.32) {
          const s = dist / 0.32;
          hVal = 0.45 + 0.55 * Math.sqrt(Math.max(0, 1 - s * s));
        } else {
          const s = (dist - 0.32) / 0.18;
          hVal = 0.22 + 0.12 * s;
        }
        if (fv > 0.88) hVal *= 0.78;
        else if (fv < 0.08) hVal = Math.min(1, hVal * 1.12);

        const col =
          hVal < 0.5
            ? colValley.clone().lerp(colBody, hVal / 0.5)
            : colBody.clone().lerp(colCrest, (hVal - 0.5) / 0.5);

        const idx = (y * W + x) * 4;
        aimg.data[idx] = Math.round(col.r * 255);
        aimg.data[idx + 1] = Math.round(col.g * 255);
        aimg.data[idx + 2] = Math.round(col.b * 255);
        aimg.data[idx + 3] = 255;

        const bv = Math.round(hVal * 255);
        bimg.data[idx] = bv;
        bimg.data[idx + 1] = bv;
        bimg.data[idx + 2] = bv;
        bimg.data[idx + 3] = 255;
      }
    }
    a.putImageData(aimg, 0, 0);
    b.putImageData(bimg, 0, 0);
    return {
      map: register(`${label}-albedo`, albedo, { repeat: [2, 2] }),
      bumpMap: register(`${label}-bump`, bump, { srgb: false, repeat: [2, 2] }),
    };
  }

  /**
   * Lush cherry blossom petal-cluster canopy texture (albedo + soft bump)
   * so blossom clouds have delicate multi-petal texture instead of flat plastic.
   */
  function sakuraCanopy(label = 'sakura-canopy', baseHex = '#ffebf3', accentHex = '#ffadc9', seed = 88) {
    const S = 128;
    const albedo = makeCanvas(S, S);
    const bump = makeCanvas(S, S);
    const a = albedo.getContext('2d');
    const b = bump.getContext('2d');
    const rand = mulberry32(seed);

    a.fillStyle = baseHex;
    a.fillRect(0, 0, S, S);
    b.fillStyle = '#707070';
    b.fillRect(0, 0, S, S);

    const palette = ['#ffffff', '#fff2f7', baseHex, accentHex, '#ff94b8'];
    for (let i = 0; i < 420; i++) {
      const px = rand() * S;
      const py = rand() * S;
      const rx = 2.2 + rand() * 3.8;
      const ry = 1.4 + rand() * 2.4;
      const rot = rand() * Math.PI;

      a.save();
      a.translate(px, py);
      a.rotate(rot);
      a.fillStyle = palette[Math.floor(rand() * palette.length)];
      a.beginPath();
      a.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      a.fill();
      a.restore();

      b.save();
      b.translate(px, py);
      b.rotate(rot);
      const shade = 140 + Math.floor(rand() * 110);
      b.fillStyle = `rgb(${shade},${shade},${shade})`;
      b.beginPath();
      b.ellipse(0, 0, rx * 0.9, ry * 0.9, 0, 0, Math.PI * 2);
      b.fill();
      b.restore();
    }

    return {
      map: register(`${label}-map`, albedo, { repeat: [2, 2] }),
      bumpMap: register(`${label}-bump`, bump, { srgb: false, repeat: [2, 2] }),
    };
  }

  /**
   * Stone facade with blue-tinted glazed windows (albedo + emissive for twilight glow).
   */
  function facade(label, { wall = '#f2eadc', cols = 4, rows = 3, arched = true, seed = 41 } = {}) {
    const S = 256;
    const albedo = makeCanvas(S, S);
    const emissive = makeCanvas(S, S);
    const a = albedo.getContext('2d');
    const e = emissive.getContext('2d');
    const rand = mulberry32(seed);
    a.fillStyle = wall;
    a.fillRect(0, 0, S, S);

    for (let y = 0; y < S; y += 16) {
      a.fillStyle = 'rgba(165,148,128,0.15)';
      a.fillRect(0, y, S, 1);
    }
    speckle(
      a,
      S,
      S,
      rand,
      1600,
      (v) => (v > 0.5 ? 'rgba(150,130,110,0.10)' : 'rgba(255,255,255,0.28)'),
      0.6,
      1.4
    );
    e.fillStyle = '#000';
    e.fillRect(0, 0, S, S);

    const cw = S / cols;
    const rh = S / rows;
    for (let r = 0; r < rows; r++) {
      a.fillStyle = 'rgba(255,252,246,0.92)';
      a.fillRect(0, r * rh + rh - 5, S, 3);
      a.fillStyle = 'rgba(155,136,118,0.32)';
      a.fillRect(0, r * rh + rh - 2, S, 1);
      for (let c = 0; c < cols; c++) {
        const ww = cw * 0.42;
        const wh = rh * 0.52;
        const x = c * cw + (cw - ww) / 2;
        const y = r * rh + rh * 0.18;
        // Stone sill, lintel shadow & recessed dark bronze frame
        a.fillStyle = 'rgba(128,112,96,0.34)';
        a.fillRect(x - 3.5, y - 3.5, ww + 7, wh + 6);
        a.fillStyle = '#fcfaf5';
        a.fillRect(x - 3, y - 2.5, ww + 6, wh + 4);
        a.fillStyle = '#e7dfd0';
        a.fillRect(x - 4.5, y + wh + 1.5, ww + 9, 3.5);
        a.fillStyle = '#334659';
        a.fillRect(x - 1.5, y - 1.5, ww + 3, wh + 3);
        const g = a.createLinearGradient(x, y, x + ww, y + wh);
        g.addColorStop(0, '#5a8cb6');
        g.addColorStop(0.5, '#345e85');
        g.addColorStop(1, '#1d3955');
        a.fillStyle = g;
        if (arched && r === rows - 1) {
          a.beginPath();
          a.moveTo(x, y + wh);
          a.lineTo(x, y + ww / 2);
          a.arc(x + ww / 2, y + ww / 2, ww / 2, Math.PI, 0);
          a.lineTo(x + ww, y + wh);
          a.closePath();
          a.fill();
        } else {
          a.fillRect(x, y, ww, wh);
        }
        a.fillStyle = 'rgba(215,238,255,0.35)';
        a.fillRect(x + 2, y + 2, ww * 0.18, wh * 0.55);
        a.fillStyle = '#e8e2d5';
        a.fillRect(x + ww / 2 - 1, y, 2, wh);
        a.fillRect(x, y + wh * 0.42, ww, 2);
        a.fillRect(x, y + wh * 0.72, ww, 1.5);

        if (rand() < 0.72) {
          const ge = e.createLinearGradient(x, y, x, y + wh);
          ge.addColorStop(0, '#ffd8a2');
          ge.addColorStop(1, '#ffa460');
          e.fillStyle = ge;
          e.fillRect(x, y, ww, wh);
          e.fillStyle = '#000';
          e.fillRect(x + ww / 2 - 1, y, 2, wh);
          e.fillRect(x, y + wh * 0.42, ww, 2);
        }
      }
    }
    return {
      map: register(`${label}-albedo`, albedo),
      emissiveMap: register(`${label}-emissive`, emissive),
    };
  }

  /**
   * Carved inscription panel for the archway central lintel.
   */
  function inscription(label, chars, { w = 512, h = 128 } = {}) {
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    const rand = mulberry32(label.length * 97);
    ctx.fillStyle = '#f5f2ec';
    ctx.fillRect(0, 0, w, h);
    speckle(
      ctx,
      w,
      h,
      rand,
      3200,
      (v) => (v > 0.6 ? 'rgba(130,126,130,0.16)' : 'rgba(255,255,255,0.45)'),
      0.6,
      1.5
    );
    ctx.strokeStyle = 'rgba(160,154,148,0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(6, 8, w - 12, h - 16);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(8, 10, w - 16, h - 20);
    const font =
      '"STKaiti","KaiTi","Kaiti SC","BiauKai","DFKai-SB","Songti SC","Noto Serif SC","Noto Serif CJK SC","SimSun",serif';
    ctx.font = `700 ${Math.round(h * 0.52)}px ${font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const step = (w - 64) / chars.length;
    chars.forEach((ch, i) => {
      const x = 32 + step * (i + 0.5);
      const y = h * 0.53;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fillText(ch, x + 1.5, y + 1.5);
      ctx.fillStyle = '#202834';
      ctx.fillText(ch, x, y);
    });
    return register(label, c, { wrap: false });
  }

  /** Grayscale relief for the drum-stone medallions (used as bumpMap). */
  function rosette(label = 'rosette') {
    const S = 128;
    const c = makeCanvas(S, S);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, S, S);
    ctx.translate(S / 2, S / 2);
    ctx.strokeStyle = '#dfdfdf';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, S * 0.43, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, S * 0.36, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 8; i++) {
      ctx.save();
      ctx.rotate((i / 8) * Math.PI * 2);
      ctx.fillStyle = '#dadada';
      ctx.beginPath();
      ctx.ellipse(0, -S * 0.21, S * 0.065, S * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#f2f2f2';
    ctx.beginPath();
    ctx.arc(0, 0, S * 0.09, 0, Math.PI * 2);
    ctx.fill();
    return register(label, c, { srgb: false, wrap: false });
  }

  /**
   * Airy alpha-cutout 5-petal Yoshino cherry blossom sprig (染井吉野樱枝簇)
   * with ~35% transparent negative space so sky & sunlight filter naturally through canopies.
   */
  function sakuraSprig(label = 'sakura-sprig', seed = 901) {
    const S = 512;
    const c = makeCanvas(S, S);
    const ctx = c.getContext('2d');
    const rand = mulberry32(seed);

    ctx.clearRect(0, 0, S, S);

    // Delicate cherrywood twigs strictly tucked inside the blossom volume (no dangling tips!)
    const twigs = [
      [S * 0.5, S * 0.68, S * 0.45, S * 0.48, S * 0.30, S * 0.28],
      [S * 0.5, S * 0.68, S * 0.55, S * 0.50, S * 0.72, S * 0.30],
      [S * 0.5, S * 0.64, S * 0.50, S * 0.42, S * 0.51, S * 0.22],
      [S * 0.42, S * 0.52, S * 0.30, S * 0.46, S * 0.22, S * 0.44],
      [S * 0.58, S * 0.52, S * 0.70, S * 0.46, S * 0.78, S * 0.42],
    ];
    ctx.lineCap = 'round';
    twigs.forEach(([x0, y0, cx, cy, x1, y1], idx) => {
      ctx.strokeStyle = 'rgba(116,86,78,0.40)';
      ctx.lineWidth = idx < 3 ? 2.5 : 1.6;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(cx, cy, x1, y1);
      ctx.stroke();
    });

    function drawBlossom(bx, by, radius, rot, tone) {
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(rot);

      const petalFill =
        tone === 0 ? '#fffcfe' : tone === 1 ? '#fff4f9' : tone === 2 ? '#ffe4ef' : '#fbd1e2';
      const innerTint = tone === 0 ? '#ffe5ef' : '#f7b8d0';

      for (let p = 0; p < 5; p++) {
        ctx.save();
        ctx.rotate((p / 5) * Math.PI * 2);
        const grad = ctx.createRadialGradient(0, -radius * 0.18, 1, 0, -radius * 0.55, radius * 0.96);
        grad.addColorStop(0, innerTint);
        grad.addColorStop(0.5, petalFill);
        grad.addColorStop(1, 'rgba(255,255,255,0.94)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(
          -radius * 0.48,
          -radius * 0.35,
          -radius * 0.46,
          -radius * 0.92,
          -radius * 0.1,
          -radius * 0.95
        );
        // Signature notched sakura petal tip
        ctx.lineTo(0, -radius * 0.78);
        ctx.lineTo(radius * 0.1, -radius * 0.95);
        ctx.bezierCurveTo(
          radius * 0.46,
          -radius * 0.92,
          radius * 0.48,
          -radius * 0.35,
          0,
          0
        );
        ctx.fill();
        ctx.restore();
      }

      // Delicate rose-blush calyx center + warm golden stamen dots (no harsh magenta dot!)
      ctx.fillStyle = 'rgba(236,154,186,0.78)';
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.13, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#f6da8e';
      for (let st = 0; st < 6; st++) {
        const a = (st / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * radius * 0.19, Math.sin(a) * radius * 0.19, radius * 0.04, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Place blossom clusters concentrated around branch tips & lower center so twigs stay covered
    const anchors = [
      [0.5, 0.24, 0.19],
      [0.29, 0.32, 0.17],
      [0.72, 0.33, 0.17],
      [0.2, 0.49, 0.15],
      [0.81, 0.48, 0.15],
      [0.44, 0.45, 0.18],
      [0.6, 0.46, 0.17],
      [0.36, 0.62, 0.14],
      [0.64, 0.61, 0.14],
      [0.5, 0.66, 0.13],
    ];

    for (let i = 0; i < 72; i++) {
      const anc = anchors[i % anchors.length];
      const ang = rand() * Math.PI * 2;
      const dist = rand() * anc[2] * S;
      const bx = anc[0] * S + Math.cos(ang) * dist;
      const by = anc[1] * S + Math.sin(ang) * dist;
      if (bx < 28 || bx > S - 28 || by < 28 || by > S - 36) continue;
      const radius = 17 + rand() * 17;
      const rPick = rand();
      const tone = rPick < 0.48 ? 0 : rPick < 0.78 ? 1 : rPick < 0.93 ? 2 : 3;
      drawBlossom(bx, by, radius, rand() * Math.PI * 2, tone);
    }

    // Unopened soft-rose buds along outer tips
    for (let b = 0; b < 14; b++) {
      const anc = anchors[b % 5];
      const bx = anc[0] * S + (rand() - 0.5) * anc[2] * S * 1.4;
      const by = anc[1] * S + (rand() - 0.5) * anc[2] * S * 1.4;
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(rand() * Math.PI * 2);
      ctx.fillStyle = '#ed8fb4';
      ctx.beginPath();
      ctx.ellipse(0, 0, 5.2, 8.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    return register(label, c, { wrap: false });
  }

  /**
   * Airy alpha-cutout camphor / evergreen leaf sprig for Luojia background trees.
   */
  function leafSprig(label = 'leaf-sprig', seed = 922) {
    const S = 256;
    const c = makeCanvas(S, S);
    const ctx = c.getContext('2d');
    const rand = mulberry32(seed);

    ctx.clearRect(0, 0, S, S);
    ctx.strokeStyle = 'rgba(92,82,64,0.7)';
    ctx.lineWidth = 2.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(S * 0.5, S * 0.68);
    ctx.quadraticCurveTo(S * 0.48, S * 0.50, S * 0.30, S * 0.28);
    ctx.moveTo(S * 0.5, S * 0.68);
    ctx.quadraticCurveTo(S * 0.54, S * 0.50, S * 0.72, S * 0.30);
    ctx.stroke();

    const greens = ['#4c7f53', '#5c9160', '#6da169', '#7eb072', '#90bd7f'];
    for (let i = 0; i < 72; i++) {
      const ang = rand() * Math.PI * 2;
      const rad = Math.pow(rand(), 0.7) * S * 0.36;
      const lx = S * 0.5 + Math.cos(ang) * rad;
      const ly = S * 0.46 + Math.sin(ang) * rad * 0.85;
      const lw = 8 + rand() * 8;
      const ll = 15 + rand() * 12;

      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(rand() * Math.PI * 2);
      ctx.fillStyle = greens[Math.floor(rand() * greens.length)];
      ctx.beginPath();
      ctx.moveTo(0, -ll * 0.5);
      ctx.quadraticCurveTo(lw * 0.7, 0, 0, ll * 0.5);
      ctx.quadraticCurveTo(-lw * 0.7, 0, 0, -ll * 0.5);
      ctx.fill();
      ctx.restore();
    }

    return register(label, c, { wrap: false });
  }

  /** Warm natural reddish-brown cherrywood bark with horizontal lenticels. */
  function bark(label = 'bark') {
    const c = makeCanvas(128, 256);
    const ctx = c.getContext('2d');
    const rand = mulberry32(77);
    ctx.fillStyle = '#735750';
    ctx.fillRect(0, 0, 128, 256);
    for (let v = 0; v < 90; v++) {
      ctx.fillStyle = rand() > 0.5 ? 'rgba(54,38,34,0.28)' : 'rgba(136,108,98,0.25)';
      ctx.fillRect(rand() * 128, rand() * 256, 2 + rand() * 3, 24 + rand() * 55);
    }
    for (let i = 0; i < 160; i++) {
      ctx.fillStyle = rand() > 0.4 ? 'rgba(178,136,122,0.45)' : 'rgba(48,32,28,0.48)';
      ctx.fillRect(rand() * 128, rand() * 256, 8 + rand() * 22, 1.8);
    }
    return register(label, c);
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
    getStats,
  };
}
