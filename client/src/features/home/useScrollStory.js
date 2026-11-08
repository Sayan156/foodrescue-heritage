import { useEffect, useState } from 'react';
import { clamp, progressToFrame } from './sequenceConfig.js';

export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(query.matches);
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);
  return reduced;
}

// CSS pins the full viewport. Scroll position is sampled once per animation frame.
export default function useScrollStory({ sectionRef, stageRef, sequenceRef, animated }) {
  useEffect(() => {
    const section = sectionRef.current, stage = stageRef.current;
    const opening = section.querySelector('[data-story-opening]');
    const ending = section.querySelector('[data-story-ending]');
    let raf = 0, visible = true, previousTravel = null, previousProgress = 0, wasPinned = false;
    function update() {
      raf = 0;
      const travel = section.offsetHeight - stage.offsetHeight;
      // Desktop and phone have different scroll distances. Keep the same scene
      // when crossing that breakpoint, without changing normal scroll behavior.
      if (animated && previousTravel !== null && travel !== previousTravel && wasPinned) {
        const start = window.scrollY + section.getBoundingClientRect().top;
        window.scrollTo({ top: start + previousProgress * travel, behavior: 'instant' });
      }
      const progress = animated && travel > 0 ? clamp(-section.getBoundingClientRect().top / travel) : 0;
      previousTravel = travel;
      previousProgress = progress;
      const top = section.getBoundingClientRect().top;
      wasPinned = top <= 0 && -top <= travel;
      const index = progressToFrame(progress);
      const introOpacity = animated ? clamp((0.17 - progress) / 0.09) : 1;
      const endingOpacity = animated ? clamp((progress - 0.86) / 0.09) : 0;
      section.dataset.progress = progress.toFixed(4);
      section.dataset.targetFrame = String(index + 1);
      opening.style.opacity = introOpacity;
      opening.style.transform = `translate3d(0, ${(1 - introOpacity) * -12}px, 0)`;
      ending.style.opacity = endingOpacity;
      ending.style.transform = `translate3d(0, ${(1 - endingOpacity) * 14}px, 0)`;
      ending.inert = endingOpacity < 0.1;
      ending.setAttribute('aria-hidden', String(ending.inert));
      stage.style.setProperty('--story-shade', Math.max(introOpacity, endingOpacity));
      if (animated && visible) sequenceRef.current?.seek(index);
    }
    const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };
    const observer = new ResizeObserver(schedule);
    observer.observe(stage);
    observer.observe(section);
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sequenceRef.current?.setActive(visible && document.visibilityState !== 'hidden');
      if (visible) schedule();
    }, { rootMargin: '150px' });
    intersection.observe(section);
    const visibility = () => {
      sequenceRef.current?.setActive(visible && document.visibilityState !== 'hidden');
      if (visible) schedule();
    };
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('pageshow', schedule);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      cancelAnimationFrame(raf); observer.disconnect(); intersection.disconnect();
      window.removeEventListener('scroll', schedule); window.removeEventListener('pageshow', schedule);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [animated, sectionRef, stageRef, sequenceRef]);
}
