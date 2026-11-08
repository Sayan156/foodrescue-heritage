import { useState } from 'react';
import { ArrowUpRight, Leaf, ShieldCheck } from 'lucide-react';
import { useAuth } from '../auth/useAuth.js';
import { Button, Field, Notice } from '../../components/ui/index.js';
import { createPaymentOrder } from './paymentApi.js';
import { openRazorpayCheckout } from './RazorpayCheckout.js';

export default function Support() {
  const { user,token } = useAuth();
  const [amount, setAmount] = useState(500);
  const [custom, setCustom] = useState('');
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [purpose, setPurpose] = useState('general');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  async function pay() {
    if (!token || !user) {
    setNotice("Please Sign-in to contribute.");
    return;
}
    setBusy(true);
    setNotice('');
    try {
      const amountRupees = Number(custom || amount);
      if (!Number.isInteger(amountRupees) || amountRupees < 1) {
        throw new Error('Enter a whole-rupee contribution.');
      }
      const order = await createPaymentOrder({
  amountRupees,
  sponsorName: name,
  sponsorEmail: email,
  purpose
}, token);
      await openRazorpayCheckout({
        order,
        name,
        token,
        email,
        onVerified: (response) => setNotice(response.status === 'paid'
          ? 'Thank you. Your contribution is confirmed.'
          : 'Payment authorized; awaiting capture confirmation.'),
        onVerificationError: (error) => setNotice(`Checkout completed. Verification pending: ${error.message}`),
        onFailure: () => setNotice('Payment did not complete. No contribution has been confirmed.'),
      });
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  }

  return <div className="support-page"><div className="container support-grid">
    <div>
      <div className="eyebrow">SUPPORT THE MISSION</div>
      <h1>Generosity is <em>always in season.</em></h1>
      <p>Your sponsorship can help support the coordination and logistics behind local food rescue. Food donations remain free to recipient organizations.</p>
      <div className="support-art"><Leaf size={90} strokeWidth={.7}/><div>THE BEAUTY OF<br/> GIVING BACK</div></div>
      <p className="hint">Financial contributions are an optional extension of the FoodRescue prototype. Only use live payments with an authorized organization and appropriate provider onboarding.</p>
    </div>
    <div className="support-form">
      <div className="eyebrow">A MEANINGFUL CONTRIBUTION</div>
      <h2>Choose your support</h2>
      <div className="amount-grid">{[100, 500, 1000, 2500].map(value => <button key={value} className={`amount ${!custom && amount === value ? 'active' : ''}`} onClick={() => { setCustom(''); setAmount(value); }}>₹{value.toLocaleString('en-IN')}</button>)}</div>
      <Field label="Or enter an amount (INR)"><input type="number" min="1" step="1" value={custom} placeholder="Custom amount" onChange={event => setCustom(event.target.value)}/></Field>
      <Field label="Support toward"><select value={purpose} onChange={event => setPurpose(event.target.value)}><option value="general">General food rescue operations</option><option value="logistics">Pickup & delivery logistics</option></select></Field>
      <Field label="Your name"><input value={name} onChange={event => setName(event.target.value)} required placeholder="Full name"/></Field>
      <Field label="Email address"><input type="email" value={email} onChange={event => setEmail(event.target.value)} required placeholder="name@example.com"/></Field>
      <Button className="wide" disabled={busy || !name.trim() || !email.includes('@')} onClick={pay}>{busy ? 'Opening checkout…' : `Contribute ₹${Number(custom || amount).toLocaleString('en-IN')}`} <ArrowUpRight size={17}/></Button>
      <Notice message={notice} kind="info"/>
      <p className="secure-note"><ShieldCheck size={15}/> Secure checkout via Razorpay • Test-mode credentials recommended</p>
    </div>
  </div></div>;
}
