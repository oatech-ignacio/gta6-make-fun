// Merges thousands of boxes / small meshes into single BufferGeometries so the city costs few draw calls.
import * as THREE from 'three';

const FACE_DEFS = [
  // normal, corner offsets (x,y,z in -1..1), in CCW order seen from outside
  { n: [0, 0, 1], c: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], side: true, axis: 'x' },
  { n: [0, 0, -1], c: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]], side: true, axis: 'x' },
  { n: [1, 0, 0], c: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]], side: true, axis: 'z' },
  { n: [-1, 0, 0], c: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]], side: true, axis: 'z' },
  { n: [0, 1, 0], c: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]], top: true },
  { n: [0, -1, 0], c: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]], bottom: true },
];

export class GeometryBatch {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.col = []; }

  /**
   * Add a box centred at (cx, cy, cz). Options: rotY, color [r,g,b], sides/top/bottom toggles,
   * uPerMeter / vPerMeter (texture repeats per metre on the side faces), uOffset / vOffset, topScale (taper).
   */
  addBox(cx, cy, cz, w, h, d, o = {}) {
    const color = o.color || [1, 1, 1];
    const rot = o.rotY || 0, cs = Math.cos(rot), sn = Math.sin(rot);
    const taper = o.topScale === undefined ? 1 : o.topScale;
    const uPer = o.uPerMeter === undefined ? 1 / Math.max(w, d) : o.uPerMeter;
    const vPer = o.vPerMeter === undefined ? 1 / h : o.vPerMeter;
    const uOff = o.uOffset || 0, vOff = o.vOffset || 0;
    for (const f of FACE_DEFS) {
      if (f.side && o.sides === false) continue;
      if (f.top && o.top === false) continue;
      if (f.bottom && !o.bottom) continue;
      const c = (f.top && o.topColor) ? o.topColor : color;
      const verts = [], uvs = [];
      for (const k of f.c) {
        const s = k[1] > 0 ? taper : 1;
        const lx = k[0] * w * 0.5 * s, ly = k[1] * h * 0.5, lz = k[2] * d * 0.5 * s;
        verts.push([cx + lx * cs + lz * sn, cy + ly, cz - lx * sn + lz * cs]);
        if (f.side) {
          const along = f.axis === 'x' ? k[0] * w * 0.5 * f.n[2] : -k[2] * d * 0.5 * f.n[0];
          uvs.push([uOff + (along + (f.axis === 'x' ? w : d) * 0.5) * uPer, vOff + (ly + h * 0.5) * vPer]);
        } else uvs.push([(k[0] * 0.5 + 0.5) * (o.topU || 1), (k[2] * 0.5 + 0.5) * (o.topV || 1)]);
      }
      const nx = f.n[0] * cs + f.n[2] * sn, nz = -f.n[0] * sn + f.n[2] * cs;
      for (const idx of [0, 1, 2, 0, 2, 3]) {
        this.pos.push(verts[idx][0], verts[idx][1], verts[idx][2]);
        this.nor.push(nx, f.n[1], nz);
        this.uv.push(uvs[idx][0], uvs[idx][1]);
        this.col.push(c[0], c[1], c[2]);
      }
    }
    return this;
  }

  /** Add a flat quad on the ground (y up), with a texture repeating uRep x vRep times. */
  addGroundQuad(cx, y, cz, w, d, o = {}) {
    const color = o.color || [1, 1, 1], rot = o.rotY || 0, cs = Math.cos(rot), sn = Math.sin(rot);
    const uR = o.uRepeat || 1, vR = o.vRepeat || 1;
    const corners = [[-0.5, 0.5, 0, 0], [0.5, 0.5, 1, 0], [0.5, -0.5, 1, 1], [-0.5, -0.5, 0, 1]];
    for (const idx of [0, 1, 2, 0, 2, 3]) {
      const k = corners[idx], lx = k[0] * w, lz = k[1] * d;
      this.pos.push(cx + lx * cs + lz * sn, y, cz - lx * sn + lz * cs);
      this.nor.push(0, 1, 0);
      this.uv.push(k[2] * uR, k[3] * vR);
      this.col.push(color[0], color[1], color[2]);
    }
    return this;
  }

  /** Add an arbitrary THREE geometry, transformed by a Matrix4 and tinted. */
  addGeometry(geometry, matrix, color = [1, 1, 1]) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv, c = g.attributes.color;
    const v = new THREE.Vector3(), nm = new THREE.Matrix3();
    if (matrix) nm.getNormalMatrix(matrix);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i); if (matrix) v.applyMatrix4(matrix);
      this.pos.push(v.x, v.y, v.z);
      if (n) { v.fromBufferAttribute(n, i); if (matrix) v.applyMatrix3(nm).normalize(); this.nor.push(v.x, v.y, v.z); } else this.nor.push(0, 1, 0);
      this.uv.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0);
      if (c) this.col.push(c.getX(i) * color[0], c.getY(i) * color[1], c.getZ(i) * color[2]); else this.col.push(color[0], color[1], color[2]);
    }
    return this;
  }

  get vertexCount() { return this.pos.length / 3; }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    return g;
  }
}

export function hexToRgb(hex) { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; }

export function buildBatchMesh(batch, material, opts = {}) {
  const mesh = new THREE.Mesh(batch.build(), material);
  mesh.castShadow = !!opts.castShadow; mesh.receiveShadow = opts.receiveShadow !== false;
  mesh.matrixAutoUpdate = false;
  return mesh;
}
