import { useEffect, useRef } from 'react';

export default function Modal({ open, onClose, children, className = '', label = 'Food request' }) {
  const dialog = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const selector = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]';
    const elements = () => [...dialog.current.querySelectorAll(selector)];
    (elements()[0] || dialog.current)?.focus();
    const keydown = event => {
      if (event.key === 'Escape') close.current();
      if (event.key !== 'Tab') return;
      const controls = elements();
      const first = controls[0], last = controls.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', keydown);
      previous?.focus();
    };
  }, [open]);
  if (!open) return null;
  return <div className="modal-backdrop" onClick={onClose}>
    <div ref={dialog} tabIndex={-1} className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={label} onClick={event => event.stopPropagation()}>{children}</div>
  </div>;
}
