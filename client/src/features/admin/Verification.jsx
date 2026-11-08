import { useState } from 'react';
import { api } from '../../services/api.js';
import SimpleData from '../dashboard/SimpleData.jsx';
import { Notice } from '../../components/ui/index.js';
import ConfirmAction from '../../components/ui/ConfirmAction.jsx';

export default function Verification({ token, tick, refresh }) {
  const [message, setMessage] = useState('');
  async function update(user, status) {
    setMessage('');
    await api(`/admin/users/${user.id}/status`, { method: 'PATCH', token, body: { status } });
    setMessage(`${user.name} has been ${status}.`); refresh();
  }
  return <><Notice message={message} kind="success"/><SimpleData path="/admin/users" token={token} tick={tick} render={u => <div className="flex-between">
    <div><div className="eyebrow">{u.role.toUpperCase()} · {u.status.toUpperCase()}</div><h3>{u.name}</h3><p>{u.email}</p></div>
    {u.role !== 'admin' && <div className="action-row">
      {u.status !== 'verified' && <ConfirmAction label="Verify" title={`Verify ${u.name}?`} message={`Allow ${u.name} (${u.email}) to perform the protected actions for their ${u.role} role?`} onConfirm={() => update(u, 'verified')} className="button small"/>}
      {u.status !== 'suspended' && <ConfirmAction label="Suspend" title={`Suspend ${u.name}?`} message={`This will block ${u.name} (${u.email}) from accessing their account until it is verified again.`} onConfirm={() => update(u, 'suspended')}/>}
    </div>}
  </div>}/></>;
}

