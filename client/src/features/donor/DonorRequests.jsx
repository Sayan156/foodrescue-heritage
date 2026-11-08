import { useEffect, useState } from 'react';
import { api } from '../../services/api.js';
import { Empty, Notice } from '../../components/ui/index.js';

export default function DonorRequests({ token, tick, onDone, onStart }) {
  const [requests, setRequests] = useState([]), [volunteers, setVolunteers] = useState([]);
  const [error, setError] = useState(''), [qty, setQty] = useState({}), [vol, setVol] = useState({});
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      try {
        const options = { token, signal: controller.signal };
        const first = await api('/donations?mine=true&limit=30', options);
        const rest = await Promise.all(Array.from({ length: Math.max(0, first.pages - 1) }, (_, i) => api(`/donations?mine=true&limit=30&page=${i + 2}`, options)));
        const donations = [first, ...rest].flatMap(page => page.items);
        const all = await Promise.all(donations.map(d => api(`/donations/${d._id}/requests`, options)));
        const v = await api('/volunteers', options);
        if (controller.signal.aborted) return;
        setRequests(all.flatMap((result, i) => result.items.map(r => ({ ...r, food: donations[i] }))));
        setVolunteers(v.items);
      } catch (error) { if (!controller.signal.aborted) setError(error.message); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    load(); return () => controller.abort();
  }, [token, tick]);
  async function act(r, decision) {
    if (busy) return;
    setError(''); onStart?.(); setBusy(true);
    try {
      if (decision === 'assign') {
        if (!vol[r._id]) throw new Error(`Choose a volunteer for ${r.food.title} before assigning pickup.`);
        await api(`/requests/${r._id}/assignments`, { method: 'POST', token, body: { volunteerId: vol[r._id] } });
        onDone(`Pickup for ${r.food.title} assigned to ${volunteers.find(v => v._id === vol[r._id])?.name || 'the selected volunteer'}.`);
      } else {
        await api(`/requests/${r._id}/decision`, { method: 'PATCH', token, body: { decision, ...(decision === 'approve' ? { approvedQuantity: Number(qty[r._id] ?? r.requestedQuantity) } : {}) } });
        onDone(`Request for ${r.food.title} ${decision === 'approve' ? 'approved' : 'rejected'}.`);
      }
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  return <div className="record-list"><Notice message={error}/>{loading ? <p role="status">Loading requests...</p> : requests.length ? requests.map(r => <article className="record" key={r._id}>
    <div className="eyebrow">{r.status.toUpperCase().replaceAll('_', ' ')}</div><h3>{r.food.title}</h3>
    <p>{r.ngo?.name} requests {r.requestedQuantity} {r.food.unit} · {r.collectionPlan}</p>
    {r.status === 'pending' && <div className="action-row">
      <input className="compact-input" type="number" min="1" max={Math.min(r.requestedQuantity, r.food.quantityAvailable)} aria-label="Approved quantity" value={qty[r._id] ?? r.requestedQuantity} onChange={e => setQty(x => ({ ...x, [r._id]: e.target.value }))}/>
      <button className="button small" disabled={busy} onClick={() => act(r, 'approve')}>Approve</button>
      <button className="outline-btn" disabled={busy} onClick={() => act(r, 'reject')}>Reject</button>
    </div>}
    {['approved', 'partially_approved'].includes(r.status) && <>
      <div className="action-row"><select aria-label={`Volunteer for ${r.food.title}`} value={vol[r._id] || ''} onChange={e => { setError(''); setVol(x => ({ ...x, [r._id]: e.target.value })); }}>
        <option value="">Choose volunteer</option>{volunteers.map(v => <option key={v._id} value={v._id}>{v.name}</option>)}
      </select><button className="button small" disabled={busy} onClick={() => act(r, 'assign')}>Assign pickup</button></div>
      {!volunteers.length && <p className="hint">No verified volunteers are available yet.</p>}
    </>}
  </article>) : <Empty title="No food requests" message="Requests from verified NGOs will appear here."/>}</div>;
}
