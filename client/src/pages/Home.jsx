import { useAuth } from '../features/auth/useAuth.js';
import ScrollStory from '../features/home/ScrollStory.jsx';
import HomeSections from '../features/home/HomeSections.jsx';
import '../features/home/scrollStory.css';

export default function Home() {
  const { user, token } = useAuth();
  const contributionTo = user?.role === 'donor' ? '/dashboard?tab=create' : user || token ? '/dashboard' : '/register';
  return <div className="home-page">
    <ScrollStory contributionTo={contributionTo}/>
    <HomeSections/>
  </div>;
}
