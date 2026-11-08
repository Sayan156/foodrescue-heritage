import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { Leaf } from 'lucide-react';
import useImageSequence from './useImageSequence.js';
import { frameUrl, mobileSequenceQuery, sequence } from './sequenceConfig.js';

const ImageSequenceCanvas = forwardRef(function ImageSequenceCanvas({ animated, onStatus }, ref) {
  const canvasRef = useRef(null), posterRef = useRef(null), imageRef = useRef(null), raf = useRef(0);
  const draw = useCallback(() => {
    raf.current = 0;
    const canvas = canvasRef.current, frame = imageRef.current;
    if (!canvas || !frame) return;
    const image = frame.image, imageWidth = image.naturalWidth || image.width, imageHeight = image.naturalHeight || image.height;
    if (!imageWidth || !imageHeight) return;
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    // Cap total pixels, rather than portrait height, to keep the sharp scene legible on phones.
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt((sequence.width * sequence.height) / (width * height)));
    const pixelWidth = Math.max(1, Math.round(width * ratio)), pixelHeight = Math.max(1, Math.round(height * ratio));
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) { canvas.width = pixelWidth; canvas.height = pixelHeight; }
    const context = canvas.getContext('2d');
    if (!context) return;
    const cover = Math.max(pixelWidth / imageWidth, pixelHeight / imageHeight);
    const portrait = width / height < 1.35 && imageWidth > imageHeight;
    context.clearRect(0, 0, pixelWidth, pixelHeight);
    if (portrait) {
      // Extend this same frame to the edges; keep both people in the sharp foreground.
      // The low-resolution backing store bounds the cost of the soft background pass.
      const w = imageWidth * cover * 1.12, h = imageHeight * cover * 1.12;
      context.save();
      context.filter = `blur(${18 * ratio}px)`;
      context.drawImage(image, (pixelWidth - w) / 2, (pixelHeight - h) / 2, w, h);
      context.restore();
      context.fillStyle = 'rgba(35, 31, 22, 0.22)';
      context.fillRect(0, 0, pixelWidth, pixelHeight);
      const scale = pixelWidth / imageWidth;
      const foregroundHeight = imageHeight * scale;
      const y = (pixelHeight - foregroundHeight) * 0.43;
      // Feather only the outer strips; the basket and people remain sharp.
      const edge = Math.min(20 * ratio, foregroundHeight * 0.06), sourceEdge = edge / scale;
      context.drawImage(image, 0, sourceEdge, imageWidth, imageHeight - sourceEdge * 2, 0, y + edge, pixelWidth, foregroundHeight - edge * 2);
      for (let strip = 0; strip < 8; strip++) {
        const offset = strip * edge / 8, sourceOffset = offset / scale;
        context.globalAlpha = (strip + 0.5) / 8;
        context.drawImage(image, 0, sourceOffset, imageWidth, sourceEdge / 8, 0, y + offset, pixelWidth, edge / 8);
        context.drawImage(image, 0, imageHeight - sourceOffset - sourceEdge / 8, imageWidth, sourceEdge / 8, 0, y + foregroundHeight - offset - edge / 8, pixelWidth, edge / 8);
      }
      context.globalAlpha = 1;
    } else {
      const w = imageWidth * cover, h = imageHeight * cover;
      context.drawImage(image, (pixelWidth - w) / 2, (pixelHeight - h) / 2, w, h);
    }
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
    const observer = new ResizeObserver(scheduleDraw);
    observer.observe(canvas);
    return () => { observer.disconnect(); cancelAnimationFrame(raf.current); raf.current = 0; imageRef.current = null; };
  }, [scheduleDraw]);

  return <div className="story-visual" data-status={status} data-mobile-portrait={sequence.mobileHeight > sequence.mobileWidth} style={{ '--story-poster': `url("${frameUrl(0)}")`, '--story-mobile-poster': `url("${frameUrl(0, 'mobile')}")` }}>
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
