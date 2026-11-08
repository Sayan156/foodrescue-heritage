import { useState } from 'react';
import { api } from '../../services/api.js';
import SimpleData from '../dashboard/SimpleData.jsx';
import { Notice } from '../../components/ui/index.js';
import ConfirmAction from '../../components/ui/ConfirmAction.jsx';

export default function MyRequests({ token, tick, refresh }) {
  const [message, setMessage] = useState('');
  return <><Notice message={message} kind="success"/><SimpleData path="/requests/mine" token={token} tick={tick} render={r => <>
    <h3>{r.donation?.title || 'Food listing'}</h3><p>Requested {r.requestedQuantity}; approved {r.approvedQuantity}. Status: <b>{r.status.replaceAll('_', ' ')}</b></p>
    {r.status === 'assigned' && <p className="hint">See Confirm receipt for your assigned pickups. Cancellation is available until collection.</p>}
    {['pending', 'approved', 'partially_approved', 'assigned'].includes(r.status) && <ConfirmAction label="Cancel request" title={`Cancel request for ${r.donation?.title || 'food'}?`} message="Any uncollected reserved quantity will become available to other organizations. An active pickup will also be cancelled." onConfirm={async () => {
      setMessage('');
      await api(`/requests/${r._id}/cancel`, { method: 'PATCH', token, body: {} });
      setMessage(`Request for ${r.donation?.title || 'food'} cancelled.`); refresh();
    }}/>}
  </>}/></>;
}
