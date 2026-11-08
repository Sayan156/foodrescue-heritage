import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Leaf } from 'lucide-react';
import { api } from '../../../services/api.js';
import { useAuth } from '../useAuth.js';
import { Field, Notice, PasswordField } from '../../../components/ui/index.js';

export default function AuthPage({ mode }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isRegistration = mode === 'register';
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'donor', organizationName: '', organizationType: 'restaurant' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const change = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    const credentials = { email: form.email.trim(), password: form.password };
    const body = isRegistration ? {
      ...credentials, name: form.name.trim(), role: form.role,
      ...(form.role !== 'volunteer' ? { organizationName: form.organizationName.trim(), organizationType: form.organizationType } : {}),
    } : credentials;
    try {
      login(await api(`/auth/${isRegistration ? 'register' : 'login'}`, { method: 'POST', body }));
      const destination = location.state?.from;
      navigate(destination?.startsWith('/dashboard') ? destination : '/dashboard', { replace: true });
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }

  return <div className="auth-wrap">
    <aside className="auth-aside">
      <div className="eyebrow">FOODRESCUE COMMUNITY</div>
      <h2>Good food.<br/><em>Better shared.</em></h2>
      <p>Connect surplus food with local organizations and the volunteers who help it reach them.</p>
      <div className="auth-leaf"><Leaf size={90} strokeWidth={0.6}/></div>
    </aside>
    <section className="auth-panel">
      <div className="eyebrow">{isRegistration ? 'GET STARTED' : 'WELCOME BACK'}</div>
      <h1>{isRegistration ? 'Create your account' : 'Sign in'}</h1>
      <p>{isRegistration ? 'Choose your role to get started.' : 'Donors, NGOs, volunteers and administrators sign in here. Your account opens the right workspace.'}</p>
      <form onSubmit={submit} className="form-stack" aria-busy={busy}>
        {isRegistration && <>
          <Field label="Full name"><input name="name" autoComplete="name" value={form.name} onChange={change} required minLength={2} maxLength={100}/></Field>
          <Field label="Join as"><select name="role" value={form.role} onChange={change}>
            <option value="donor">Food donor</option><option value="ngo">NGO / recipient</option><option value="volunteer">Volunteer</option>
          </select></Field>
          {form.role !== 'volunteer' && <>
            <Field label="Organization name"><input name="organizationName" autoComplete="organization" value={form.organizationName} onChange={change} required maxLength={150}/></Field>
            {form.role === 'donor' && <Field label="Organization type"><select name="organizationType" value={form.organizationType} onChange={change}>
              {['restaurant', 'hotel', 'grocery', 'caterer', 'other'].map(type => <option key={type} value={type}>{type[0].toUpperCase() + type.slice(1)}</option>)}
            </select></Field>}
          </>}
        </>}
        <Field label="Email address"><input type="email" name="email" autoComplete="email" autoCapitalize="none" spellCheck={false} value={form.email} onChange={change} required maxLength={200}/></Field>
        <PasswordField label="Password" name="password" autoComplete={isRegistration ? 'new-password' : 'current-password'} value={form.password} onChange={change} minLength={isRegistration ? 10 : 1} maxLength={128} required placeholder={isRegistration ? 'At least 10 characters' : ''}/>
        {!isRegistration && <Link className="text-link" to="/forgot-password">Forgot password?</Link>}
        <Notice message={error}/>
        <button className="button wide" disabled={busy}>{busy ? 'Please wait...' : isRegistration ? 'Create account' : 'Sign in'}<ArrowRight size={18}/></button>
      </form>
      <p className="switch-auth">{isRegistration ? 'Already have an account?' : 'New to FoodRescue?'} <Link to={isRegistration ? '/login' : '/register'}>{isRegistration ? 'Sign in' : 'Create an account'}</Link></p>
      {isRegistration && <p className="hint">An administrator reviews donor and NGO accounts before they can publish or request food.</p>}
    </section>
  </div>;
}
