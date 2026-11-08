import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../../../services/api.js';
import { Field, Notice, PasswordField } from '../../../components/ui/index.js';

export default function PasswordRecovery({ reset = false }) {
  const location = useLocation();
  const token = new URLSearchParams(location.hash.slice(1)).get('token') || '';
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); if (busy) return;
    setError(''); setMessage('');
    if (reset && password !== confirmation) { setError('The passwords do not match.'); return; }
    setBusy(true);
    try {
      const data = await api(`/auth/${reset ? 'reset-password' : 'forgot-password'}`, { method: 'POST', body: reset ? { token, password } : { email: email.trim() } });
      setMessage(data.message); setPassword(''); setConfirmation('');
      if (reset) window.history.replaceState(window.history.state, '', location.pathname);
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  return <div className="auth-panel"><h1>{reset ? 'Reset password' : 'Forgot password?'}</h1>
    <p>{reset ? 'Choose a new password with at least 10 characters.' : 'Enter your account email to receive a password reset link.'}</p>
    <Notice message={message} kind="success"/><Notice message={error}/>
    {reset && !token && !message ? <><Notice message="This reset link is missing its token. Request a new link."/><Link className="text-link" to="/forgot-password">Request another link</Link></> : !message && <form className="form-stack" onSubmit={submit}>
      {reset ? <>
        <PasswordField label="New password" autoComplete="new-password" minLength={10} maxLength={128} required value={password} onChange={e => setPassword(e.target.value)}/>
        <PasswordField label="Confirm new password" autoComplete="new-password" minLength={10} maxLength={128} required value={confirmation} onChange={e => setConfirmation(e.target.value)}/>
      </> : <Field label="Email address"><input type="email" autoComplete="email" maxLength={200} required value={email} onChange={e => setEmail(e.target.value)}/></Field>}
      <button className="button" disabled={busy}>{busy ? 'Please wait...' : reset ? 'Reset password' : 'Send reset link'}</button>
    </form>}
    <p className="switch-auth"><Link to="/login">Back to sign in</Link></p>
    {reset && error && <Link className="text-link" to="/forgot-password">Request a new reset link</Link>}
  </div>;
}
