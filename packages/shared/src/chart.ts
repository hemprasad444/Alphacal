// Chart helpers. A phone draws at most a few hundred points per chart, so long histories
// are thinned while keeping their shape.

/**
 * Indices of the points to draw: the first and last, and each bucket's lowest and highest,
 * so peaks and dips survive. At most `max` indices, in order.
 */
export function downsample(values: number[], max = 120): number[] {
  const n = values.length;
  if (n <= max) return values.map((_, i) => i);
  const buckets = Math.max(1, Math.floor((max - 2) / 2));
  const size = (n - 2) / buckets;
  const out = [0];
  for (let b = 0; b < buckets; b++) {
    const from = 1 + Math.floor(b * size), to = Math.min(n - 1, 1 + Math.floor((b + 1) * size));
    let lo = from, hi = from;
    for (let i = from; i < to; i++) {
      if (values[i] < values[lo]) lo = i;
      if (values[i] > values[hi]) hi = i;
    }
    if (from < to) out.push(...(lo < hi ? [lo, hi] : lo > hi ? [hi, lo] : [lo]));
  }
  out.push(n - 1);
  return out;
}
