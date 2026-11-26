import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export { mergeGeometries, mergeVertices };

/* ------------------------------------------------------------------ */
/* Deterministic noise                                                 */
/* ------------------------------------------------------------------ */
function hash3(x, y, z) {
  let h = x * 374761393 + y * 668265263 + z * 1274126177;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return ((h >>> 0) % 100000) / 100000;
}

export function valueNoise3(x, y, z) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = x - xi;
  const yf = y - yi;
  const zf = z - zi;
  const s = (t) => t * t * (3 - 2 * t);
  const u = s(xf);
  const v = s(yf);
  const w = s(zf);
  const L = (a, b, t) => a + (b - a) * t;
  const c000 = hash3(xi, yi, zi);
  const c100 = hash3(xi + 1, yi, zi);
  const c010 = hash3(xi, yi + 1, zi);
  const c110 = hash3(xi + 1, yi + 1, zi);
  const c001 = hash3(xi, yi, zi + 1);
  const c101 = hash3(xi + 1, yi, zi + 1);
  const c011 = hash3(xi, yi + 1, zi + 1);
  const c111 = hash3(xi + 1, yi + 1, zi + 1);
  return L(L(L(c000, c100, u), L(c010, c110, u), v), L(L(c001, c101, u), L(c011, c111, u), v), w) * 2 - 1;
}

export function fbm3(x, y, z, oct = 3) {
  let a = 0.5;
  let f = 1;
  let sum = 0;
  for (let i = 0; i < oct; i++) {
    sum += a * valueNoise3(x * f, y * f, z * f);
    f *= 2.03;
    a *= 0.5;
  }
  return sum;
}

/* ------------------------------------------------------------------ */
/* Static helpers                                                      */
/* ------------------------------------------------------------------ */
export function lockStatic(root) {
  root.traverse((o) => {
    o.matrixAutoUpdate = false;
    o.updateMatrix();
  });
  root.updateMatrixWorld(true);
}

export function mesh(geo, mat, { cast = true, receive = true, pos, rot, scale } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast;
  m.receiveShadow = receive;
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  if (scale) (Array.isArray(scale) ? m.scale.set(scale[0], scale[1], scale[2]) : m.scale.setScalar(scale));
  return m;
}

/** Scales BoxGeometry UVs per-face snapped to 0.25 window units so narrow end walls keep natural proportions. */
export function fitBoxFacadeUVs(geo, w, h, d, fullRepeatSpan = 6.8) {
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const uv = geo.attributes.uv;
  if (!pos || !nor || !uv) return geo;
  const snapQuarter = (val) => Math.max(0.25, Math.round(val * 4) / 4);
  const repX = snapQuarter(d / fullRepeatSpan);
  const repZ = snapQuarter(w / fullRepeatSpan);
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i));
    const nz = Math.abs(nor.getZ(i));
    const u = uv.getX(i);
    const v = uv.getY(i);
    if (nx > 0.5) uv.setXY(i, u * repX, v);
    else if (nz > 0.5) uv.setXY(i, u * repZ, v);
    else uv.setXY(i, 0.02, 0.02);
  }
  uv.needsUpdate = true;
  return geo;
}

/** Transforms a geometry in place by TRS and returns it (for merging). */
export function xform(geo, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(...pos),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),
    new THREE.Vector3(...(Array.isArray(scale) ? scale : [scale, scale, scale]))
  );
  geo.applyMatrix4(m);
  return geo;
}

/** Ensures every geometry has the same attribute set before merging. */
export function mergeSafe(geos) {
  const prepared = geos.map((g) => {
    let gg = g.index ? g.toNonIndexed() : g;
    if (!gg.attributes.uv) {
      gg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(gg.attributes.position.count * 2), 2));
    }
    if (!gg.attributes.normal) gg.computeVertexNormals();
    for (const k of Object.keys(gg.attributes)) {
      if (k !== 'position' && k !== 'normal' && k !== 'uv') gg.deleteAttribute(k);
    }
    return gg;
  });
  return mergeGeometries(prepared, false);
}

/** Polyline tube (ridges, branches). */
export function tubeAlong(points, radius, radial = 8, tubular = null, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points, closed, 'centripetal');
  return new THREE.TubeGeometry(curve, tubular || Math.max(4, points.length * 3), radius, radial, closed);
}

/** Tapered organic branch tube along a 3D spline. */
export function taperedTubeAlong(points, rStart, rEnd, radial = 7, tubular = 8) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const geo = new THREE.TubeGeometry(curve, tubular, 1, radial, false);
  const pos = geo.attributes.position;
  const ringVerts = radial + 1;
  const cPt = new THREE.Vector3();
  const vPt = new THREE.Vector3();

  for (let i = 0; i <= tubular; i++) {
    const t = i / tubular;
    curve.getPointAt(t, cPt);
    const r = rStart + (rEnd - rStart) * t;
    for (let j = 0; j < ringVerts; j++) {
      const idx = i * ringVerts + j;
      vPt.fromBufferAttribute(pos, idx);
      vPt.sub(cPt).multiplyScalar(r).add(cPt);
      pos.setXYZ(idx, vPt.x, vPt.y, vPt.z);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Multi-card cupped & domed botanical spray geometry with radial-upward transferred normals.
 * Breaks up solid silhouettes with feathery alpha-tested petal/leaf rims from every view angle.
 */
export function crossedSprayGeometry(size = 1.0, cards = 4) {
  const parts = [];
  const tilts = [0.44, -0.48, 0.38];
  const radialCards = Math.min(3, cards);
  for (let c = 0; c < radialCards; c++) {
    const p = new THREE.PlaneGeometry(size, size, 2, 2);
    const pPos = p.attributes.position;
    for (let i = 0; i < pPos.count; i++) {
      const px = pPos.getX(i);
      const py = pPos.getY(i);
      const r2 = (px * px + py * py) / Math.max(0.01, size * size * 0.25);
      pPos.setZ(i, (1 - Math.min(1, r2)) * size * 0.08);
    }
    const tilt = tilts[c % tilts.length];
    const yaw = (c / radialCards) * Math.PI * 2;
    xform(p, [0, 0, 0.12 * size], [0, 0, 0], [1, 0.90, 1]);
    xform(p, [0, 0, 0], [tilt, yaw, 0]);
    parts.push(p);
  }
  if (cards >= 4) {
    const cap = new THREE.PlaneGeometry(size * 1.05, size * 1.05, 2, 2);
    const cPos = cap.attributes.position;
    for (let i = 0; i < cPos.count; i++) {
      const px = cPos.getX(i);
      const py = cPos.getY(i);
      const r2 = (px * px + py * py) / Math.max(0.01, size * size * 0.28);
      cPos.setZ(i, (1 - Math.min(1, r2)) * size * 0.14);
    }
    xform(cap, [0, size * 0.12, 0], [-Math.PI / 2 + 0.14, 0.4, 0]);
    parts.push(cap);
  }
  const merged = mergeSafe(parts);
  const pos = merged.attributes.position;
  const nor = merged.attributes.normal;
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    n.fromBufferAttribute(pos, i);
    n.y += size * 0.72;
    n.normalize();
    nor.setXYZ(i, n.x, n.y, n.z);
  }
  return merged;
}

/* ------------------------------------------------------------------ */
/* Lumpy blossom / foliage / cloud puff                                */
/* ------------------------------------------------------------------ */
export function puffGeometry({ detail = 2, seed = 1, lump = 0.32, freq = 1.7, flatten = 0.25, soften = 0.45 } = {}) {
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const n = fbm3(v.x * freq + seed * 7.1, v.y * freq + seed * 3.3, v.z * freq + seed * 1.7, 3);
    let r = 1 + lump * n;
    // flatter underside like real blossom canopies / cumulus bases
    if (v.y < 0) r *= 1 - flatten * Math.pow(-v.y, 1.5);
    pos.setXYZ(i, v.x * r, v.y * r * (v.y < 0 ? 0.82 : 1), v.z * r);
  }
  g.computeVertexNormals();
  // blend toward radial normals for a soft, light-scattering volume look
  const nor = g.attributes.normal;
  const rn = new THREE.Vector3();
  const cn = new THREE.Vector3();
  for (let i = 0; i < nor.count; i++) {
    rn.fromBufferAttribute(pos, i).normalize();
    cn.fromBufferAttribute(nor, i).lerp(rn, soften).normalize();
    nor.setXYZ(i, cn.x, cn.y, cn.z);
  }
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    rn.fromBufferAttribute(pos, i).normalize();
    uv[i * 2] = Math.atan2(rn.z, rn.x) / (Math.PI * 2) + 0.5;
    uv[i * 2 + 1] = Math.asin(THREE.MathUtils.clamp(rn.y, -1, 1)) / Math.PI + 0.5;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/* ------------------------------------------------------------------ */
/* Chinese curved roofs: 歇山 (xieshan), 庑殿/四坡 (hip), 腰檐 (ring)    */
/* ------------------------------------------------------------------ */
/**
 * Builds a curved, upswept Chinese roof as smooth patches with crisp creases.
 * Origin = centre of the eave plane (y = 0 at the eave line).
 * Returns { tiles, gables, ridges: Vector3[][], eave: Vector3[][] }
 */
export function buildChineseRoof({
  halfW,
  halfD,
  H,
  mode = 'xieshan',
  inset = null,
  ring = null,
  lift = 0.6,
  segU = 22,
  segV = 12,
  tilePitch = 0.32,
}) {
  const ins = inset ?? halfD * 0.42;
  const rng = ring ?? halfD * 0.5;
  const dTop = mode === 'ring' ? rng : halfD;
  const Hn = H;
  const P = (d) => {
    const t = Math.min(1, Math.max(0, d / dTop));
    return Hn * (0.28 * t + 0.72 * Math.pow(t, 1.75));
  };
  const Rc = Math.min(halfW, halfD) * 1.05;
  const liftAt = (x, z) => {
    const dc = Math.hypot(halfW - Math.abs(x), halfD - Math.abs(z));
    const f = Math.max(0, 1 - dc / Rc);
    return f * f;
  };
  const deform = (x, y, z) => {
    const f = liftAt(x, z);
    return [x + Math.sign(x) * f * lift * 0.35, y + f * lift, z + Math.sign(z) * f * lift * 0.35];
  };

  function patch(nu, nv, fn, outwardY = true) {
    const verts = [];
    const uvs = [];
    for (let j = 0; j <= nv; j++) {
      for (let i = 0; i <= nu; i++) {
        const r = fn(i / nu, j / nv);
        const [x, y, z] = deform(r[0], r[1], r[2]);
        verts.push(x, y, z);
        uvs.push(r[3], r[4]);
      }
    }
    const idx = [];
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        const a = j * (nu + 1) + i;
        const b = a + 1;
        const c = a + (nu + 1);
        const d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    // orient normals: roofs face up, gables face outward
    const n = g.attributes.normal;
    let sum = 0;
    for (let k = 0; k < n.count; k++) sum += outwardY ? n.getY(k) : n.getX(k) * Math.sign(verts[k * 3] || 1);
    if (sum < 0) {
      for (let k = 0; k < idx.length; k += 3) {
        const t = idx[k + 1];
        idx[k + 1] = idx[k + 2];
        idx[k + 2] = t;
      }
      g.setIndex(idx);
      g.computeVertexNormals();
    }
    return g.toNonIndexed();
  }

  const tiles = [];
  const gables = [];
  const xmaxFront = (dz) => (mode === 'xieshan' ? halfW - Math.min(dz, ins) : halfW - dz);
  for (const sz of [1, -1]) {
    tiles.push(
      patch(segU, segV, (u, v) => {
        const dz = dTop * (1 - v);
        const xm = xmaxFront(dz);
        const x = (u * 2 - 1) * xm;
        return [x, P(dz), sz * (halfD - dz), x / tilePitch, (dTop - dz) / (tilePitch * 1.4)];
      })
    );
  }
  const dTopSide = mode === 'xieshan' ? ins : dTop;
  for (const sx of [1, -1]) {
    tiles.push(
      patch(Math.max(8, Math.round(segU * 0.6)), Math.max(4, Math.round(segV * (dTopSide / dTop))), (u, v) => {
        const dx = dTopSide * (1 - v);
        const zm = halfD - dx;
        const z = (u * 2 - 1) * zm;
        return [sx * (halfW - dx), P(dx), z, z / tilePitch, (dTopSide - dx) / (tilePitch * 1.4)];
      })
    );
    if (mode === 'xieshan') {
      // vertical gable triangle (山花)
      const zEdge = halfD - ins;
      gables.push(
        patch(
          12,
          6,
          (u, v) => {
            const z = (u * 2 - 1) * zEdge;
            const top = P(halfD - Math.abs(z));
            const yb = P(ins);
            const gy = yb + (top - yb) * v;
            return [sx * (halfW - ins) * 0.995, gy, z, z * 0.32, gy * 0.32];
          },
          false
        )
      );
    }
  }

  const ridges = [];
  const R = (x, y, z) => new THREE.Vector3(...deform(x, y, z));
  const N = 10;
  if (mode !== 'ring') {
    const xr = mode === 'xieshan' ? halfW - ins : Math.max(0.01, halfW - halfD);
    const pts = [];
    for (let i = 0; i <= N; i++) pts.push(R(-xr + (2 * xr * i) / N, Hn + 0.02, 0));
    ridges.push({ pts, main: true });
  }
  // hip ridges
  const dStart = mode === 'xieshan' ? ins : dTop;
  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) {
      const pts = [];
      for (let i = 0; i <= N; i++) {
        const d = dStart * (1 - i / N);
        pts.push(R(sx * (halfW - d), P(d) + 0.02, sz * (halfD - d)));
      }
      ridges.push({ pts });
      if (mode === 'xieshan') {
        const p2 = [];
        for (let i = 0; i <= N; i++) {
          const z = (halfD - ins) * (i / N);
          p2.push(R(sx * (halfW - ins), P(halfD - z) + 0.02, sz * z));
        }
        ridges.push({ pts: p2 });
      }
    }
  }
  // eave perimeter, as 4 edges
  const eave = [];
  const M = 40;
  for (const sz of [1, -1]) {
    const pts = [];
    for (let i = 0; i <= M; i++) pts.push(R(-halfW + (2 * halfW * i) / M, 0, sz * halfD));
    eave.push(pts);
  }
  for (const sx of [1, -1]) {
    const pts = [];
    for (let i = 0; i <= Math.round(M * (halfD / halfW)); i++) {
      const n = Math.round(M * (halfD / halfW));
      pts.push(R(sx * halfW, 0, -halfD + (2 * halfD * i) / n));
    }
    eave.push(pts);
  }

  return {
    tiles: mergeGeometries(tiles, false),
    gables: gables.length ? mergeGeometries(gables, false) : null,
    ridges,
    eave,
  };
}

/** Thin fascia band hanging under an eave polyline (gives roofs visible thickness). */
export function eaveBand(pts, depth = 0.12) {
  const verts = [];
  const uvs = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    verts.push(p.x, p.y - 0.028, p.z, p.x, p.y - depth - 0.028, p.z);
    uvs.push(i / (pts.length - 1), 1, i / (pts.length - 1), 0);
  }
  const idx = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g.toNonIndexed();
}

/**
 * Solid underside soffit ceiling bridging the upturned eave lip inward to the building core
 * strictly below the curved tile surface so zero triangles pierce upward at corners.
 */
export function eaveSoffitBand(pts, depth = 0.12, halfW = 1, halfD = 1, inward = 0.72) {
  const verts = [];
  const uvs = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const ix = p.x * Math.max(0.18, 1 - inward / Math.max(0.4, halfW));
    const iz = p.z * Math.max(0.18, 1 - inward / Math.max(0.4, halfD));
    const outerY = p.y - depth * 0.96;
    const iy = Math.min(-0.04, p.y - depth * 1.15);
    verts.push(p.x, outerY, p.z, ix, iy, iz);
    uvs.push(i / (pts.length - 1), 0, i / (pts.length - 1), 1);
  }
  const idx = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 2, a + 1, a + 2, a + 3, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g.toNonIndexed();
}

/**
 * Assembles a complete roof Group (tiles + gables + ridges + sculpted 吻兽 + fascia + soffit + optional rafters)
 */
export function roofGroup(opts, mats) {
  const r = buildChineseRoof(opts);
  const group = new THREE.Group();
  const tiles = new THREE.Mesh(r.tiles, mats.tile);
  tiles.castShadow = true;
  tiles.receiveShadow = true;
  group.add(tiles);
  if (r.gables) {
    const g = new THREE.Mesh(r.gables, mats.gable || mats.ridge);
    g.castShadow = true;
    g.receiveShadow = true;
    group.add(g);
    // Flush chevron bargeboard ribs following the gable slope strictly inside the hip tiles
    if (opts.mode === 'xieshan') {
      const ins = opts.inset ?? opts.halfD * 0.42;
      const zSpan = (opts.halfD - ins) * 0.88;
      const topY = opts.H - 0.04;
      const botY = opts.H * 0.34;
      const rafterLen = Math.hypot(zSpan, topY - botY);
      const slopeAng = Math.atan2(topY - botY, zSpan);
      for (const sx of [-1, 1]) {
        const bx = sx * (opts.halfW - ins) * 0.992;
        for (const sz of [-1, 1]) {
          const bar = new THREE.BoxGeometry(0.045, 0.055, rafterLen);
          xform(bar, [bx, (topY + botY) * 0.5, sz * zSpan * 0.5], [sz * slopeAng, 0, 0]);
          group.add(new THREE.Mesh(bar, mats.fascia || mats.ridge));
        }
      }
    }
  }
  const scale = opts.ridgeR ?? Math.max(0.045, opts.halfD * 0.04);
  const ridgeGeos = r.ridges.map((rd) => tubeAlong(rd.pts, rd.main ? scale * 1.45 : scale * 0.95, 6, 16));

  // Crisp traditional stylized 吻兽 / ridge-scroll finials (replacing oversized sphere blobs)
  r.ridges
    .filter((rd) => rd.main)
    .forEach((rd) => {
      for (const p of [rd.pts[0], rd.pts[rd.pts.length - 1]]) {
        const dirX = Math.sign(p.x) || 1;
        const base = new THREE.BoxGeometry(scale * 2.2, scale * 1.7, scale * 1.8);
        xform(base, [p.x, p.y + scale * 0.75, p.z]);
        ridgeGeos.push(base);

        const crest = new THREE.ConeGeometry(scale * 1.15, scale * 3.1, 6);
        xform(
          crest,
          [p.x + dirX * scale * 0.55, p.y + scale * 2.15, p.z],
          [0, 0, -dirX * 0.42],
          [0.9, 1.0, 0.7]
        );
        ridgeGeos.push(crest);

        const curl = new THREE.CylinderGeometry(scale * 0.55, scale * 0.85, scale * 1.3, 6);
        xform(curl, [p.x - dirX * scale * 0.45, p.y + scale * 1.65, p.z], [0, 0, dirX * 0.28]);
        ridgeGeos.push(curl);
      }
    });

  const fasciaDepth = opts.fascia ?? Math.max(0.08, opts.H * 0.06);
  const fascia = r.eave.map((pts) => eaveBand(pts, fasciaDepth));
  const soffit = r.eave.map((pts) =>
    eaveSoffitBand(
      pts,
      fasciaDepth,
      opts.halfW,
      opts.halfD,
      opts.soffitInward ?? Math.min(opts.halfW, opts.halfD) * 0.62
    )
  );

  // Optional carved timber eave rafters / brackets (kept strictly inside upturned corner zones)
  if (opts.rafters) {
    for (const pts of r.eave) {
      const step = Math.max(2, Math.floor(pts.length / 8));
      for (let i = 5; i < pts.length - 5; i += step) {
        const p = pts[i];
        const len = Math.min(opts.halfW, opts.halfD) * 0.24;
        const dx = Math.abs(p.x) > opts.halfW * 0.85 ? -Math.sign(p.x) * len * 0.5 : 0;
        const dz = Math.abs(p.z) > opts.halfD * 0.85 ? -Math.sign(p.z) * len * 0.5 : 0;
        const beam = new THREE.BoxGeometry(
          dx !== 0 ? len : 0.08,
          0.09,
          dz !== 0 ? len : 0.08
        );
        xform(beam, [p.x + dx, p.y - fasciaDepth * 1.45, p.z + dz]);
        soffit.push(beam);
      }
    }
  }

  const ridgeMesh = new THREE.Mesh(mergeSafe([...ridgeGeos]), mats.ridge);
  ridgeMesh.castShadow = true;
  group.add(ridgeMesh);
  const fasciaMesh = new THREE.Mesh(mergeSafe(fascia), mats.fascia || mats.ridge);
  fasciaMesh.material.side = THREE.DoubleSide;
  group.add(fasciaMesh);
  const soffitMesh = new THREE.Mesh(mergeSafe(soffit), mats.soffit || mats.fascia || mats.ridge);
  soffitMesh.material.side = THREE.DoubleSide;
  soffitMesh.castShadow = true;
  group.add(soffitMesh);
  group.userData.eave = r.eave;
  return group;
}

/* ------------------------------------------------------------------ */
/* Sakura petal geometry                                               */
/* ------------------------------------------------------------------ */
export function petalGeometry(size = 0.14) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.45, 0.15, 0.55, 0.75, 0.2, 1.0);
  s.lineTo(0, 0.88); // the characteristic notch
  s.lineTo(-0.2, 1.0);
  s.bezierCurveTo(-0.55, 0.75, -0.45, 0.15, 0, 0);
  const g = new THREE.ShapeGeometry(s, 4);
  g.translate(0, -0.5, 0);
  g.scale(size, size, size);
  // gentle cup
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    p.setZ(i, (x * x) / size * 0.9);
  }
  g.computeVertexNormals();
  return g;
}
