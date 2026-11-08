import { useCallback, useEffect, useRef, useState } from 'react';
import { createSequenceLoader, decodeFrame } from './sequenceLoader.js';
import { frameUrl, mobileSequenceQuery, sequence, sequenceOptions } from './sequenceConfig.js';

export default function useImageSequence({ posterRef, enabled, onFrame, onReset }) {
  const loader = useRef(null), frameCallback = useRef(onFrame), requested = useRef(0), active = useRef(true);
  const resetCallback = useRef(onReset);
  const [status, setStatus] = useState('loading');
  const [mobile, setMobile] = useState(() => window.matchMedia(mobileSequenceQuery).matches);
  frameCallback.current = onFrame;
  resetCallback.current = onReset;
  const seed = useCallback(() => {
    const image = posterRef.current;
    if (!image?.naturalWidth) return;
    setStatus('ready');
  }, [posterRef]);
  const fail = useCallback(() => setStatus('fallback'), []);

  useEffect(() => {
    const query = window.matchMedia(mobileSequenceQuery);
    const change = () => setMobile(query.matches);
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);

  useEffect(() => {
    if (!enabled || status === 'fallback') return;
    const options = sequenceOptions();
    let receivedFrame = false;
    const controller = createSequenceLoader({
      ...options, count: sequence.frameCount,
      load: (index, signal) => decodeFrame(frameUrl(index, options.variant), signal),
      onFrame: (image, index) => {
        if (!receivedFrame) { receivedFrame = true; setStatus('ready'); }
        frameCallback.current(image, index);
      },
      onUnavailable: fail,
    });
    loader.current = controller;
    controller.setActive(active.current);
    // Start at the current scroll frame. A responsive <picture> changes its image
    // in place, so it must not be retained in a decoded-frame cache.
    controller.seek(requested.current);
    controller.start();
    return () => {
      resetCallback.current?.();
      controller.dispose();
      if (loader.current === controller) loader.current = null;
    };
  }, [enabled, status === 'fallback', mobile, posterRef, fail]);

  useEffect(() => {
    if (posterRef.current?.complete) {
      if (posterRef.current.naturalWidth) seed(); else fail();
    }
    // A stalled first image must never trap a visitor in a long empty story.
    const timer = setTimeout(() => {
      if (!posterRef.current?.naturalWidth) fail();
    }, 10000);
    return () => clearTimeout(timer);
  }, [posterRef, seed, fail]);

  const seek = useCallback(index => { requested.current = index; loader.current?.seek(index); }, []);
  const setActive = useCallback(value => { active.current = value; loader.current?.setActive(value); }, []);
  return { status, seed, fail, seek, setActive };
}
