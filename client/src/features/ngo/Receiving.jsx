import { useState } from 'react';
import { api } from '../../services/api.js';
import SimpleData from '../dashboard/SimpleData.jsx';
import { Field, Notice } from '../../components/ui/index.js';

export default function Receiving({ token, tick, refresh }) {
  const [error, setError] = useState(''), [success, setSuccess] = useState('');
  const [form, setForm] = useState({}), [busy, setBusy] = useState(false);
  const change = (id, key, value) => setForm(current => ({ ...current, [id]: { ...current[id], [key]: value } }));
  async function confirm(event, assignment) {
    event.preventDefault();
    if (busy) return;
    setError(''); setSuccess(''); setBusy(true);
    const data = form[assignment._id] || {};
    try {
      await api(`/assignments/${assignment._id}/confirmation`, { method: 'POST', token, body: {
        deliveredQuantity: Number(data.deliveredQuantity ?? assignment.collectedQuantity),
        ...(data.distributedQuantity !== undefined && data.distributedQuantity !== '' ? { distributedQuantity: Number(data.distributedQuantity) } : {}),
        beneficiaries: Number(data.beneficiaries ?? 0), conditionNotes: data.conditionNotes || '',
      } });
      setSuccess(`Receipt confirmed for ${assignment.request?.donation?.title || 'food pickup'}.`);
      setForm(current => { const next = { ...current }; delete next[assignment._id]; return next; });
      refresh();
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  return <><Notice message={error}/><Notice message={success} kind="success"/>
    <SimpleData path="/assignments/receiving" token={token} tick={tick} render={a => <div>
      <div className="eyebrow">{a.status.toUpperCase()}</div><h3>{a.request?.donation?.title}</h3>
      <p>Collected: {a.collectedQuantity ?? 'Pending pickup'} · Approved: {a.request?.approvedQuantity}</p>
      {a.status === 'collected' && <form className="form-stack" onSubmit={event => confirm(event, a)}>
        <Field label="Quantity received"><input type="number" min="0" step="any" max={a.collectedQuantity} required value={form[a._id]?.deliveredQuantity ?? a.collectedQuantity} onChange={e => change(a._id, 'deliveredQuantity', e.target.value)}/></Field>
        <Field label="Quantity distributed (optional)"><input type="number" min="0" step="any" max={form[a._id]?.deliveredQuantity ?? a.collectedQuantity} value={form[a._id]?.distributedQuantity ?? ''} onChange={e => change(a._id, 'distributedQuantity', e.target.value)}/></Field>
        <Field label="Beneficiary count"><input type="number" min="0" value={form[a._id]?.beneficiaries ?? 0} onChange={e => change(a._id, 'beneficiaries', e.target.value)}/></Field>
        <Field label="Condition notes"><textarea maxLength={1000} value={form[a._id]?.conditionNotes ?? ''} onChange={e => change(a._id, 'conditionNotes', e.target.value)}/></Field>
        <button className="button small" disabled={busy}>{busy ? 'Confirming...' : 'Confirm food received'}</button>
      </form>}
    </div>}/>
  </>;
}

