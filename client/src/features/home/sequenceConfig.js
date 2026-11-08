import manifest from './sequenceManifest.json';

export const sequence = manifest;
export const mobileSequenceQuery = '(max-width: 767px) and (orientation: portrait)';
export const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
export const progressToFrame = progress => Math.round(clamp(progress) * (sequence.frameCount - 1));
export const frameUrl = (index, variant = 'desktop') => `${import.meta.env.BASE_URL}${sequence.basePath}/${variant}/${sequence.prefix}${String(index + 1).padStart(sequence.digits, '0')}${variant === 'mobile' ? sequence.mobileExtension || sequence.extension : sequence.extension}${sequence.version ? `?v=${encodeURIComponent(sequence.version)}` : ''}`;

export function sequenceOptions() {
  const mobile = window.matchMedia('(max-width: 767px)').matches;
  const constrained = mobile || navigator.connection?.saveData || (navigator.deviceMemory && navigator.deviceMemory <= 4);
  return {
    variant: window.matchMedia(mobileSequenceQuery).matches ? 'mobile' : 'desktop',
    radius: mobile ? 4 : constrained ? 3 : 5,
    concurrency: constrained ? 2 : 3,
    maxFrames: mobile ? 10 : constrained ? 8 : 12,
    maxBytes: (mobile ? 16 : constrained ? 32 : 48) * 1024 * 1024,
  };
}
