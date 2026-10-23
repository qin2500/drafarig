// A small multilayer perceptron in plain JavaScript (no dependencies): ReLU hidden layers, one logit output, trained with
// Adam on binary cross-entropy (did this side go on to win?). Used as the engine's learned position value.
import { readFileSync } from 'node:fs';

export class MLP {
  /** sizes: [inputs, hidden…, 1] */
  constructor(sizes, seed = 1) {
    this.sizes = sizes;
    let s = seed >>> 0;
    const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
    this.W = []; this.b = [];
    for (let l = 0; l + 1 < sizes.length; l++) {
      const n = sizes[l], m = sizes[l + 1], sc = Math.sqrt(2 / n);
      this.W.push(Float32Array.from({ length: n * m }, () => gauss() * sc));
      this.b.push(new Float32Array(m));
    }
  }
  static load(file) {
    const j = JSON.parse(readFileSync(file, 'utf8'));
    const net = new MLP(j.sizes);
    net.W = j.W.map((w) => Float32Array.from(w)); net.b = j.b.map((w) => Float32Array.from(w));
    net.meta = j.meta ?? {};
    return net;
  }
  toJSON(meta = {}) { return { sizes: this.sizes, W: this.W.map((w) => Array.from(w, (x) => +x.toFixed(6))), b: this.b.map((w) => Array.from(w, (x) => +x.toFixed(6))), meta }; }

  /** The logit for input x; with acts, keeps every layer's activations (for training). */
  forward(x, acts = null) {
    let a = x;
    if (acts) acts.push(a);
    for (let l = 0; l < this.W.length; l++) {
      const n = this.sizes[l], m = this.sizes[l + 1], W = this.W[l], out = new Float32Array(m);
      for (let j = 0; j < m; j++) {
        let z = this.b[l][j];
        const row = j * n;
        for (let i = 0; i < n; i++) z += W[row + i] * a[i];
        out[j] = l + 1 < this.W.length ? (z > 0 ? z : 0) : z;
      }
      a = out;
      if (acts) acts.push(a);
    }
    return a[0];
  }

  /**
   * Train on X (array of Float32Array) and y (0/1). Returns per-epoch { train, val } log loss; keeps the weights of the
   * best validation epoch (Xv, yv).
   */
  train(X, y, Xv, yv, { epochs = 30, batch = 256, lr = 1e-3, l2 = 1e-4, seed = 7, log = () => {} } = {}) {
    const L = this.W.length;
    const mW = this.W.map((w) => new Float32Array(w.length)), vW = this.W.map((w) => new Float32Array(w.length));
    const mb = this.b.map((w) => new Float32Array(w.length)), vb = this.b.map((w) => new Float32Array(w.length));
    const gW = this.W.map((w) => new Float32Array(w.length)), gb = this.b.map((w) => new Float32Array(w.length));
    let t = 0, s = seed >>> 0;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const idx = X.map((_, i) => i);
    let best = { val: Infinity, W: null, b: null, epoch: -1 };
    const hist = [];
    for (let ep = 0; ep < epochs; ep++) {
      for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
      let tl = 0;
      for (let s0 = 0; s0 < idx.length; s0 += batch) {
        gW.forEach((g) => g.fill(0)); gb.forEach((g) => g.fill(0));
        const end = Math.min(idx.length, s0 + batch);
        for (let k = s0; k < end; k++) {
          const acts = [];
          const z = this.forward(X[idx[k]], acts);
          const p = 1 / (1 + Math.exp(-z));
          tl += -(y[idx[k]] ? Math.log(p + 1e-9) : Math.log(1 - p + 1e-9));
          let delta = new Float32Array([p - y[idx[k]]]);
          for (let l = L - 1; l >= 0; l--) {
            const n = this.sizes[l], m = this.sizes[l + 1], a = acts[l], W = this.W[l];
            const prev = l > 0 ? new Float32Array(n) : null;
            for (let j = 0; j < m; j++) {
              const d = delta[j];
              if (!d) continue;
              gb[l][j] += d;
              const row = j * n;
              for (let i = 0; i < n; i++) { gW[l][row + i] += d * a[i]; if (prev) prev[i] += d * W[row + i]; }
            }
            if (prev) { for (let i = 0; i < n; i++) if (a[i] <= 0) prev[i] = 0; delta = prev; }
          }
        }
        const bs = end - s0;
        t++;
        const b1 = 0.9, b2 = 0.999, c1 = 1 - b1 ** t, c2 = 1 - b2 ** t;
        for (let l = 0; l < L; l++) {
          const W = this.W[l], g = gW[l], m1 = mW[l], v1 = vW[l];
          for (let i = 0; i < W.length; i++) { const gi = g[i] / bs + l2 * W[i]; m1[i] = b1 * m1[i] + (1 - b1) * gi; v1[i] = b2 * v1[i] + (1 - b2) * gi * gi; W[i] -= lr * (m1[i] / c1) / (Math.sqrt(v1[i] / c2) + 1e-8); }
          const B = this.b[l], h = gb[l], m2 = mb[l], v2 = vb[l];
          for (let i = 0; i < B.length; i++) { const gi = h[i] / bs; m2[i] = b1 * m2[i] + (1 - b1) * gi; v2[i] = b2 * v2[i] + (1 - b2) * gi * gi; B[i] -= lr * (m2[i] / c1) / (Math.sqrt(v2[i] / c2) + 1e-8); }
        }
      }
      const val = this.loss(Xv, yv);
      hist.push({ epoch: ep, train: +(tl / idx.length).toFixed(4), val: +val.toFixed(4) });
      log(hist.at(-1));
      if (val < best.val) best = { val, W: this.W.map((w) => w.slice()), b: this.b.map((w) => w.slice()), epoch: ep };
    }
    if (best.W) { this.W = best.W; this.b = best.b; }
    return { hist, best: { epoch: best.epoch, val: +best.val.toFixed(4) } };
  }
  loss(X, y) { let l = 0; for (let i = 0; i < X.length; i++) { const p = 1 / (1 + Math.exp(-this.forward(X[i]))); l -= y[i] ? Math.log(p + 1e-9) : Math.log(1 - p + 1e-9); } return l / Math.max(1, X.length); }
  accuracy(X, y) { let a = 0; for (let i = 0; i < X.length; i++) a += (this.forward(X[i]) > 0) === !!y[i] ? 1 : 0; return a / Math.max(1, X.length); }
}
