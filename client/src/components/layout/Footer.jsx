import { Link } from 'react-router-dom';
import { useAuth } from '../../features/auth/useAuth.js';

export default function Footer() {
  const { user, token } = useAuth();
  return <footer>
    <div className="container footer-inner">
      <div><div className="footer-logo">foodrescue.</div><p>Thoughtfully connecting surplus with purpose.</p></div>
      <div><span>THE PLATFORM</span><Link to="/explore">Discover food</Link><Link to="/about">Our mission</Link><Link to="/support">Support the cause</Link></div>
      <div><span>PARTICIPATE</span>{user || token ? <><Link to="/dashboard">Your dashboard</Link>{user?.role === 'donor' && <Link to="/dashboard?tab=create">Contribute food</Link>}</> : <><Link to="/register">Become a donor</Link><Link to="/register">Join as NGO</Link><Link to="/register">Volunteer</Link></>}</div>
    </div>
    <div className="container footer-bottom">© {new Date().getFullYear()} FoodRescue. Built for compassionate communities. <span>Food safety requires qualified local oversight.</span></div>
  </footer>;
}
