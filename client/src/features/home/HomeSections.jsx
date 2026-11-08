import { Link } from 'react-router-dom';
import { ArrowUpRight, HeartHandshake, PackagePlus, Truck } from 'lucide-react';
import { frameUrl } from './sequenceConfig.js';
import { useAuth } from '../auth/useAuth.js';

const steps = [
  { title: 'Share.', Icon: PackagePlus, text: 'Approved donors offer wholesome surplus food with clear pickup and handling details.' },
  { title: 'Connect.', Icon: HeartHandshake, text: 'Verified organizations request the food they can receive and distribute.' },
  { title: 'Care.', Icon: Truck, text: 'Volunteers help it reach its next destination. Recipients confirm its arrival.' },
];

export default function HomeSections() {
  const { user, token } = useAuth();
  const signedIn = !!(user || token);
  return <>
    <section id="our-purpose" className="home-section home-purpose" tabIndex={-1} aria-labelledby="purpose-title">
      <div className="home-purpose-copy">
        <h2 id="purpose-title">An abundant table.<br/><em>A wider circle.</em></h2>
        <p>FoodRescue connects those with food to share with organizations serving their communities. Because good food deserves to bring people together.</p>
        <Link className="home-link" to="/about">Our purpose <ArrowUpRight size={17}/></Link>
      </div>
      <picture className="home-purpose-image"><img src={frameUrl(179)} width={1280} height={720} loading="lazy" decoding="async" alt="A donor and a recipient sharing a basket of fresh food."/></picture>
    </section>
    <section className="home-section home-process" aria-label="How FoodRescue works">
      <div className="home-steps">{steps.map(({ title, Icon, text }) => <article key={title}><Icon size={25} strokeWidth={1.2} aria-hidden="true"/><h3>{title}</h3><p>{text}</p></article>)}</div>
    </section>
    <section className="home-invitation" aria-labelledby="invitation-title"><h2 id="invitation-title">Generosity, <em>in good company.</em></h2><div><Link className="home-link" to={signedIn ? '/dashboard' : '/register'}>{signedIn ? 'Your dashboard' : 'Join the community'} <ArrowUpRight size={17}/></Link><Link className="home-link" to="/support">Support the mission <ArrowUpRight size={17}/></Link></div></section>
  </>;
}
