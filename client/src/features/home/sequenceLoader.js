// No React state on the hot path. The loader owns its requests and decoded images.
export function createSequenceLoader({ count, load, onFrame, onUnavailable = () => {}, radius = 5, concurrency = 3, maxFrames = 12, maxBytes = 48 * 1024 * 1024 }) {
  const cache = new Map(), pending = new Map(), failures = new Map();
  let target = 0, direction = 1, displayed = -1, active = true, disposed = false, seeded = false, bytes = 0;

  const wanted = () => {
    const indices = [target];
    for (let distance = 1; distance <= radius; distance++) {
      for (const index of [target + direction * distance, target - direction * distance]) {
        if (index >= 0 && index < count) indices.push(index);
      }
    }
    return indices;
  };
  function remove(index) {
    const frame = cache.get(index);
    if (!frame) return;
    bytes -= frame.bytes; frame.dispose?.(); cache.delete(index);
  }
  function evict() {
    const candidates = [...cache.keys()].filter(index => index !== displayed && index !== target && index !== 0)
      .sort((a, b) => Math.abs(b - target) - Math.abs(a - target));
    while ((cache.size > maxFrames || bytes > maxBytes) && candidates.length) remove(candidates.shift());
  }
  function emit() {
    if (disposed || !active || !cache.size) return;
    const nearest = [...cache.keys()].reduce((best, index) => Math.abs(index - target) < Math.abs(best - target) ? index : best);
    if (nearest !== displayed) {
      displayed = nearest;
      onFrame(cache.get(nearest).image, nearest);
    }
    evict();
  }
  function pump() {
    if (!active || disposed || !seeded) return;
    for (const index of wanted()) {
      if (pending.size >= concurrency) break;
      const failure = failures.get(index);
      if (cache.has(index) || pending.has(index) || (failure && (failure.attempts >= 2 || Date.now() < failure.retryAt))) continue;
      const controller = new AbortController();
      const request = { controller, timedOut: false };
      pending.set(index, request);
      const timer = setTimeout(() => { request.timedOut = true; controller.abort(); }, 8000);
      Promise.resolve().then(() => load(index, controller.signal)).then(frame => {
        // A decoder can complete after abort. Never display or retain an obsolete result.
        if (disposed || controller.signal.aborted || !active || !wanted().includes(index)) { frame.dispose?.(); return; }
        cache.set(index, frame); bytes += frame.bytes; failures.delete(index); emit();
      }).catch(() => {
        if (disposed || (controller.signal.aborted && !request.timedOut)) return;
        failures.set(index, { attempts: (failure?.attempts || 0) + 1, retryAt: Date.now() + 3000 });
        if (failures.size >= 5) onUnavailable();
      }).finally(() => {
        clearTimeout(timer);
        if (pending.get(index) === request) pending.delete(index);
        pump();
      });
    }
  }
  return {
    start() { seeded = true; pump(); },
    seed(image) {
      if (disposed || cache.has(0)) return;
      seeded = true;
      cache.set(0, { image, bytes: image.naturalWidth * image.naturalHeight * 4 });
      bytes += cache.get(0).bytes; emit(); pump();
    },
    seek(index) {
      const next = Math.max(0, Math.min(count - 1, Math.round(index)));
      if (next !== target) direction = Math.sign(next - target);
      target = next;
      const keep = new Set(wanted());
      for (const [index, request] of pending) if (!keep.has(index)) request.controller.abort();
      emit(); pump();
    },
    setActive(value) {
      active = value;
      if (!active) {
        for (const request of pending.values()) request.controller.abort();
        for (const index of cache.keys()) if (index !== 0 && index !== displayed) remove(index);
      } else { emit(); pump(); }
    },
    stats: () => ({ cached: cache.size, pending: pending.size, bytes, target, displayed }),
    dispose() {
      disposed = true;
      for (const request of pending.values()) request.controller.abort();
      for (const index of cache.keys()) remove(index);
      pending.clear();
    },
  };
}

export async function decodeFrame(url, signal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('Sequence frame unavailable');
  const blob = await response.blob();
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  if (typeof createImageBitmap === 'function') {
    try {
      const image = await createImageBitmap(blob);
      if (signal.aborted) { image.close(); throw new DOMException('Aborted', 'AbortError'); }
      return { image, bytes: image.width * image.height * 4, dispose: () => image.close() };
    } catch (error) { if (signal.aborted) throw error; /* Safari/codec fallback below. */ }
  }
  const source = URL.createObjectURL(blob);
  const image = new Image();
  try {
    await new Promise((resolve, reject) => {
      const abort = () => { image.src = ''; reject(new DOMException('Aborted', 'AbortError')); };
      const finish = callback => () => { signal.removeEventListener('abort', abort); callback(); };
      image.onload = finish(resolve);
      image.onerror = finish(() => reject(new Error('Sequence frame cannot be decoded')));
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort(); else image.src = source;
    });
    return { image, bytes: image.naturalWidth * image.naturalHeight * 4, dispose: () => { image.src = ''; } };
  } finally { URL.revokeObjectURL(source); }
}
