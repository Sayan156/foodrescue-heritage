import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { Leaf } from 'lucide-react';
import useImageSequence from './useImageSequence.js';
import { frameUrl, mobileSequenceQuery, sequence } from './sequenceConfig.js';

const ImageSequenceCanvas = forwardRef(function ImageSequenceCanvas({ animated, onStatus }, ref) {
  const canvasRef = useRef(null), posterRef = useRef(null), imageRef = useRef(null), raf = useRef(0);
  const sizeRef = useRef({ width: 0, height: 0 });
  const draw = useCallback(() => {
    raf.current = 0;
    const canvas = canvasRef.current, frame = imageRef.current;
    if (!canvas || !frame) return;
    const image = frame.image, imageWidth = image.naturalWidth || image.width, imageHeight = image.naturalHeight || image.height;
    if (!imageWidth || !imageHeight) return;
    const { width, height } = sizeRef.current;
    if (!width || !height) return;
    // Cap total pixels, rather than portrait height, to keep the sharp scene legible on phones.
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt((sequence.width * sequence.height) / (width * height)));
    const pixelWidth = Math.max(1, Math.round(width * ratio)), pixelHeight = Math.max(1, Math.round(height * ratio));
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) { canvas.width = pixelWidth; canvas.height = pixelHeight; }
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) return;
    const cover = Math.max(pixelWidth / imageWidth, pixelHeight / imageHeight);
    // Fill the viewport directly with the selected portrait or widescreen frame.
    // Preserve proportions, with no blurred duplicate layers or letterbox bands.
    const w = imageWidth * cover, h = imageHeight * cover;
    context.drawImage(image, (pixelWidth - w) / 2, (pixelHeight - h) / 2, w, h);
    canvas.dataset.frame = String(frame.index + 1);
    canvas.dataset.painted = 'true';
  }, []);
  const scheduleDraw = useCallback(() => { if (!raf.current) raf.current = requestAnimationFrame(draw); }, [draw]);
  const onFrame = useCallback((image, index) => { imageRef.current = { image, index }; scheduleDraw(); }, [scheduleDraw]);
  const onReset = useCallback(() => {
    // Keep the painted canvas visible until the replacement variant is decoded.
    cancelAnimationFrame(raf.current);
    raf.current = 0;
    imageRef.current = null;
  }, []);
  const { status, seed, fail, seek, setActive } = useImageSequence({ posterRef, enabled: animated, onFrame, onReset });
  useImperativeHandle(ref, () => ({ seek, setActive }), [seek, setActive]);
  useEffect(() => { onStatus(status); }, [status, onStatus]);
  useEffect(() => {
    const canvas = canvasRef.current;
    const observer = new ResizeObserver(([entry]) => {
      sizeRef.current = { width: entry.contentRect.width, height: entry.contentRect.height };
      scheduleDraw();
    });
    observer.observe(canvas);
    return () => { observer.disconnect(); cancelAnimationFrame(raf.current); raf.current = 0; imageRef.current = null; };
  }, [scheduleDraw]);

  return <div className="story-visual" data-status={status}>
    <div className="story-image-fallback" aria-hidden="true"><Leaf size={100} strokeWidth={0.6}/></div>
    <picture className="story-poster">
      <source media={mobileSequenceQuery} srcSet={frameUrl(0, 'mobile')} width={sequence.mobileWidth} height={sequence.mobileHeight}/>
      <img ref={posterRef} src={frameUrl(0)} width={sequence.width} height={sequence.height}
        alt="A woven basket filled with fresh bread and vegetables on a sunlit heritage dining table."
        fetchPriority="high" loading="eager" decoding="async"
        onLoad={event => { event.currentTarget.style.visibility = ''; seed(); }}
        onError={event => { event.currentTarget.style.visibility = 'hidden'; fail(); }}/>
    </picture>
    <canvas ref={canvasRef} className="story-canvas" aria-hidden="true"/>
    <div className="story-image-shade" aria-hidden="true"/>
  </div>;
});

export default ImageSequenceCanvas;
