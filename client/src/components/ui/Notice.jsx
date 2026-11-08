import { useEffect, useRef } from 'react';

export default function Notice({ message, kind = 'error' }) {
  const element = useRef(null);
  useEffect(() => {
    if (message) element.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  }, [message]);
  return message ? <div ref={element} role={kind === 'error' ? 'alert' : 'status'} className={`notice ${kind}`}>{message}</div> : null;
}
