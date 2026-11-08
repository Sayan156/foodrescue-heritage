import { useState } from 'react';
import { api } from '../../services/api.js';
import SimpleData from '../dashboard/SimpleData.jsx';
import { Field, Modal, Notice } from '../../components/ui/index.js';

export default function Assignments({ token, tick, refresh }) {
  const [error, setError] = useState(''), [message, setMessage] = useState('');
  const [dialog, setDialog] = useState(null), [quantity, setQuantity] = useState(''), [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  function open(assignment, status) {
    setError(''); setMessage(''); setNotes('');
    setQuantity(assignment.request?.approvedQuantity ?? ''); setDialog({ assignment, status });
  }
  function close() {
    if (busy) return;
    setDialog(null); setError(''); setMessage('Action cancelled. Pickup status was not changed.');
  }
  async function update(assignment, status) {
    if (busy) return;
    setError(''); setMessage(''); setBusy(true);
    try {
      await api(`/assignments/${assignment._id}/status`, { method: 'PATCH', token, body: {
        status, ...(status === 'collected' ? { collectedQuantity: Number(quantity) } : {}),
        ...(status === 'failed' ? { notes: notes.trim() } : {}),
      } });
      setMessage(`${assignment.request?.donation?.title || 'Pickup'}: ${status === 'collected' ? 'collection confirmed' : status === 'failed' ? 'pickup marked as failed' : status.replaceAll('_', ' ')}.`);
      setDialog(null); refresh();
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  return <>{!dialog && <Notice message={error}/>}<Notice message={message} kind="success"/>
    <SimpleData path="/assignments/mine" token={token} tick={tick} render={a => <>
      <div className="eyebrow">{a.status.toUpperCase().replaceAll('_', ' ')}</div><h3>{a.request?.donation?.title}</h3>
      <p>{a.request?.donation?.address}</p><p>Approved: {a.request?.approvedQuantity} · Deadline: {new Date(a.request?.donation?.pickupDeadline).toLocaleString()}</p>
      <p>{a.request?.donation?.handlingInstructions}</p>{a.notes && <p>Notes: {a.notes}</p>}
      {['assigned', 'accepted', 'en_route'].includes(a.status) && <div className="action-row">
        <button className="button small" disabled={busy} onClick={() => a.status === 'en_route' ? open(a, 'collected') : update(a, a.status === 'assigned' ? 'accepted' : 'en_route')}>
          {a.status === 'assigned' ? 'Accept assignment' : a.status === 'accepted' ? 'Mark en route' : 'Confirm collected'}
        </button><button className="outline-btn" disabled={busy} onClick={() => open(a, 'failed')}>Mark pickup failed</button>
      </div>}
    </>}/>
    <Modal open={!!dialog} onClose={close} label={dialog?.status === 'failed' ? 'Mark pickup failed' : 'Confirm collection'}>
      {dialog && <form className="form-stack" onSubmit={e => { e.preventDefault(); update(dialog.assignment, dialog.status); }}>
        <h2>{dialog.status === 'failed' ? 'Mark pickup failed' : 'Confirm collection'}</h2><p>{dialog.assignment.request?.donation?.title}</p>
        {dialog.status === 'collected' ? <Field label={`Actual quantity collected (maximum ${dialog.assignment.request?.approvedQuantity})`}><input autoFocus type="number" min="0.01" step="any" max={dialog.assignment.request?.approvedQuantity} required value={quantity} onChange={e => setQuantity(e.target.value)}/></Field>
          : <Field label="Reason for failed pickup"><textarea required maxLength={500} value={notes} onChange={e => setNotes(e.target.value)}/></Field>}
        <Notice message={error}/><div className="action-row"><button className="button" disabled={busy}>{busy ? 'Saving...' : 'Confirm'}</button><button type="button" className="outline-btn" disabled={busy} onClick={close}>Cancel</button></div>
      </form>}
    </Modal>
  </>;
}

