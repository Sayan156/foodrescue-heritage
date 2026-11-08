import test from 'node:test';
import assert from 'node:assert/strict';
import { createSequenceLoader } from '../src/features/home/sequenceLoader.js';

const settle = async () => { for (let i = 0; i < 10; i++) await new Promise(resolve => setImmediate(resolve)); };
const poster = { naturalWidth: 768, naturalHeight: 432, index: 0 };
const frameBytes = 768 * 432 * 4;

test('portrait preloading settles when nine neighbors exceed the decoded memory budget', async () => {
  const portraitBytes = 720 * 1280 * 4;
  const requests = [];
  const loader = createSequenceLoader({ count: 240, radius: 4, concurrency: 2, maxFrames: 10,
    maxBytes: 16 * 1024 * 1024, frameBytes: portraitBytes,
    load: async index => {
      requests.push(index);
      // Bound a regression so a reload loop fails rather than hanging the suite.
      if (requests.length > 30) loader.setActive(false);
      return { image: { index }, bytes: portraitBytes, dispose() {} };
    },
    onFrame() {},
  });
  try {
    loader.start(); await settle();
    assert.ok(requests.length <= 3, 'Only frames that fit the cache should be prefetched');
    loader.seek(120); await settle();
    const settledRequests = requests.length;
    for (let i = 0; i < 10; i++) { loader.seek(120); await settle(); }
    assert.equal(requests.length, settledRequests, 'Stationary scrolling must not reload evicted neighbors');
    assert.ok(requests.length <= 6);
    assert.equal(loader.stats().displayed, 120);
    assert.equal(loader.stats().pending, 0);
    assert.ok(loader.stats().bytes <= 16 * 1024 * 1024);
  } finally { loader.dispose(); }
});

test('mobile cache remains bounded through the entire sequence and reverse scrolling', async () => {
  const requests = [], painted = [], released = [];
  const loader = createSequenceLoader({ count: 240, radius: 4, concurrency: 2, maxFrames: 10, maxBytes: 16 * 1024 * 1024,
    load: async index => { requests.push(index); return { image: { index }, bytes: frameBytes, dispose: () => released.push(index) }; },
    onFrame: image => painted.push(image.index),
  });
  loader.seed(poster); await settle();
  assert.ok(requests.length <= 4, 'Only immediate neighbors load before scrolling');
  assert.equal(painted.at(-1), 0);
  for (const index of [...Array.from({ length: 240 }, (_, i) => i), 180, 120, 60, 0]) {
    loader.seek(index); await settle();
    assert.equal(painted.at(-1), index);
    assert.ok(loader.stats().cached <= 10);
    assert.ok(loader.stats().bytes <= 16 * 1024 * 1024);
    assert.ok(loader.stats().pending <= 2);
  }
  loader.setActive(false);
  assert.ok(loader.stats().cached <= 2);
  loader.dispose();
  assert.equal(loader.stats().bytes, 0);
  assert.ok(released.length > 200, 'Decoded images are released as the cache advances');
});

test('late results from cancelled decodes cannot overwrite the current frame', async () => {
  const jobs = [], painted = [], released = [];
  const loader = createSequenceLoader({ count: 240, radius: 1, concurrency: 2,
    load: (index, signal) => new Promise(resolve => jobs.push({ index, signal, resolve })),
    onFrame: (_, index) => painted.push(index),
  });
  loader.seed(poster); await settle();
  loader.seek(150);
  assert.ok(jobs[0].signal.aborted);
  jobs[0].resolve({ image: {}, bytes: 10, dispose: () => released.push(jobs[0].index) });
  await settle();
  const current = jobs.find(job => job.index === 150);
  current.resolve({ image: {}, bytes: 10, dispose: () => released.push(150) });
  await settle();
  assert.equal(painted.at(-1), 150);
  assert.ok(!painted.includes(1));
  assert.ok(released.includes(1));
  loader.dispose();
  for (const job of jobs) job.resolve({ image: {}, bytes: 10, dispose() {} });
  await settle();
  assert.equal(painted.at(-1), 150);
});

test('failed sequence requests preserve the poster and stop after a bounded failure window', async () => {
  let unavailable = 0, calls = 0;
  const loader = createSequenceLoader({ count: 240, radius: 5,
    load: async () => { calls++; throw new Error('Offline'); },
    onFrame: (_, index) => assert.equal(index, 0),
    onUnavailable: () => { unavailable++; loader.setActive(false); },
  });
  loader.seed(poster); await settle();
  assert.equal(unavailable, 1);
  assert.equal(calls, 5);
  assert.equal(loader.stats().displayed, 0);
  loader.dispose();
});
