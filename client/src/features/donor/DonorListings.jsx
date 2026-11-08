import { useState } from 'react';
import { api } from '../../services/api.js';
import SimpleData from '../dashboard/SimpleData.jsx';
import { Field, Modal, Notice } from '../../components/ui/index.js';
import ConfirmAction from '../../components/ui/ConfirmAction.jsx';

export default function DonorListings({ token, onSelect, tick, refresh }) {
  const [editing, setEditing] = useState(null), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function save(event) {
    event.preventDefault(); if (busy) return;
    setError(''); setBusy(true);
    try {
      await api(`/donations/${editing._id}`, { method: 'PATCH', token, body: { description: editing.description, handlingInstructions: editing.handlingInstructions } });
      setMessage(`${editing.title} updated.`); setEditing(null); refresh();
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  return <><Notice message={message} kind="success"/>
    <SimpleData path="/donations?mine=true" token={token} tick={tick} render={r => <div>
      <div className="eyebrow">{r.status.toUpperCase()}</div><h3>{r.title}</h3>
      <p>{r.quantityAvailable} of {r.quantityTotal} {r.unit} available · Deadline {new Date(r.pickupDeadline).toLocaleString()}</p>
      <div className="action-row"><button className="outline-btn" onClick={onSelect}>Review requests</button>
        {!['cancelled', 'expired', 'completed'].includes(r.status) && <>
          <button className="outline-btn" onClick={() => { setError(''); setMessage(''); setEditing({ ...r, description: r.description || '', handlingInstructions: r.handlingInstructions || '' }); }}>Edit listing</button>
          <ConfirmAction label="Cancel listing" title={`Cancel ${r.title}?`} message="This listing will no longer accept requests. Listings with reserved donations cannot be cancelled." onConfirm={async () => {
            setMessage('');
            await api(`/donations/${r._id}`, { method: 'PATCH', token, body: { status: 'cancelled' } });
            setMessage(`${r.title} cancelled.`); refresh();
          }}/>
        </>}
      </div>
    </div>}/>
    <Modal open={!!editing} onClose={() => { if (!busy) setEditing(null); }} label="Edit listing">
      {editing && <form className="form-stack" onSubmit={save}><h2>Edit {editing.title}</h2>
        <p>Update the description and handling instructions. Quantities and pickup times stay fixed for existing requests.</p>
        <Field label="Description"><textarea maxLength={2000} value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })}/></Field>
        <Field label="Handling instructions"><textarea maxLength={500} value={editing.handlingInstructions} onChange={e => setEditing({ ...editing, handlingInstructions: e.target.value })}/></Field>
        <Notice message={error}/><div className="action-row"><button className="button" disabled={busy}>{busy ? 'Saving...' : 'Save changes'}</button><button type="button" className="outline-btn" disabled={busy} onClick={() => setEditing(null)}>Cancel</button></div>
      </form>}
    </Modal>
  </>;
}
