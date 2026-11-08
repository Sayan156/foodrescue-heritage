import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { useAuth } from '../auth/useAuth.js';

export default function HomeActions({ contributionTo, volunteer = false }) {
  const { user, token } = useAuth();
  const signedIn = !!(user || token);
  const contributionPath = contributionTo || (user?.role === 'donor' ? '/dashboard?tab=create' : signedIn ? '/dashboard' : '/register');
  return <div className="home-actions">
    <Link className="home-button" to="/explore">Explore food <ArrowUpRight size={17} aria-hidden="true"/></Link>
    <Link className="home-button home-button-secondary" to={contributionPath}>Contribute food <ArrowUpRight size={17} aria-hidden="true"/></Link>
    {volunteer && <Link className="home-volunteer-link" to={signedIn ? '/dashboard' : '/register'}>{signedIn ? 'Your dashboard' : 'Join as a volunteer'} <ArrowUpRight size={15} aria-hidden="true"/></Link>}
  </div>;
}
