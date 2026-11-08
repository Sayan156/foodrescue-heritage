import manifest from './sequenceManifest.json';

export const sequence = manifest;
export const mobileSequenceQuery = '(max-width: 767px) and (orientation: portrait)';
export const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
export const progressToFrame = progress => Math.round(clamp(progress) * (sequence.frameCount - 1));
export const frameUrl = (index, variant = 'desktop') => `${import.meta.env.BASE_URL}${sequence.basePath}/${variant}/${sequence.prefix}${String(index + 1).padStart(sequence.digits, '0')}${variant === 'mobile' ? sequence.mobileExtension || sequence.extension : sequence.extension}${sequence.version ? `?v=${encodeURIComponent(sequence.version)}` : ''}`;

export function sequenceOptions() {
  const mobile = window.matchMedia('(max-width: 767px)').matches;
  const constrained = mobile || navigator.connection?.saveData || (navigator.deviceMemory && navigator.deviceMemory <= 4);
  const variant = window.matchMedia(mobileSequenceQuery).matches ? 'mobile' : 'desktop';
  const width = variant === 'mobile' ? sequence.mobileWidth : sequence.desktopWidth;
  const height = variant === 'mobile' ? sequence.mobileHeight : Math.round(sequence.height * width / sequence.width);
  return {
    variant,
    frameBytes: width * height * 4,
    radius: constrained ? 6 : 10,
    concurrency: navigator.connection?.saveData ? 2 : constrained ? 3 : 4,
    maxFrames: constrained ? 10 : 20,
    maxBytes: (navigator.connection?.saveData ? 16 : constrained ? 24 : 64) * 1024 * 1024,
  };
}
