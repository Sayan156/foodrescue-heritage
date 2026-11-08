import { useEffect, useState } from 'react';
import { api } from '../../services/api.js';
import { Empty, Notice } from '../../components/ui/index.js';

export default function SimpleData({ path, token, render, tick }) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true);
    setError('');
    api(path, { token, signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setItems(data.items || []); })
      .catch(error => { if (!controller.signal.aborted) setError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [path, token, tick, retry]);
  return <div className="record-list" aria-busy={busy}>
    {busy ? <p role="status">Loading records...</p> : error ? <div>
      <Notice message={error}/><button className="outline-btn" onClick={() => setRetry(value => value + 1)}>Try again</button>
    </div> : items.length ? items.map((record, index) => <article key={record._id || index} className="record">{render(record)}</article>)
      : <Empty title="Nothing here yet" message="New records will appear when activity begins."/>}
  </div>;
}
