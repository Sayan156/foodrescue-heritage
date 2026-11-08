import { useState } from 'react';
import Modal from './Modal.jsx';
import Notice from './Notice.jsx';

export default function ConfirmAction({ label, title = label, message, onConfirm, className = 'outline-btn' }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const close = () => { if (!busy) setOpen(false); };
  return <><button className={className} onClick={() => { setError(''); setOpen(true); }}>{label}</button>
    <Modal open={open} onClose={close} label={title}><div className="form-stack">
      <h2>{title}</h2><p>{message}</p><Notice message={error}/><div className="action-row">
        <button className="outline-btn" disabled={busy} onClick={close}>Go back</button>
        <button className="button" disabled={busy} onClick={async () => {
          if (busy) return;
          setError(''); setBusy(true);
          try { await onConfirm(); setOpen(false); } catch (error) { setError(error.message); }
          finally { setBusy(false); }
        }}>{busy ? 'Saving...' : label}</button>
      </div>
    </div></Modal>
  </>;
}

