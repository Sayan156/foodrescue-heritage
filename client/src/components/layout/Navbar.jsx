import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ArrowUpRight, Leaf, Menu, Moon, Sun, X } from 'lucide-react';
import { useAuth } from '../../features/auth/useAuth.js';
import { useTheme } from '../../hooks/useTheme.js';
import Button from '../ui/Button.jsx';
import './Navbar.css';

export default function Navbar() {
  const { user, token } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [menu, setMenu] = useState(false);
  const location = useLocation();
  const isHome = location.pathname === '/';
  const menuButton = useRef(null);
  const headerRef = useRef(null);
  const [pastStory, setPastStory] = useState(false);
  useEffect(() => { setMenu(false); }, [location.pathname]);
  useEffect(() => {
    if (!isHome) return;
    const story = document.querySelector('.scroll-story');
    let frame;
    const update = () => {
      frame = undefined;
      setPastStory(!story || story.getBoundingClientRect().bottom <= (headerRef.current?.offsetHeight || 64));
    };
    const schedule = () => { if (frame === undefined) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('pageshow', schedule);
    window.addEventListener('resize', schedule);
    const observer = new ResizeObserver(schedule);
    if (story) observer.observe(story);
    if (headerRef.current) observer.observe(headerRef.current);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('pageshow', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [isHome]);
  useEffect(() => {
    if (!menu) return;
    const close = event => { if (event.key === 'Escape') { setMenu(false); menuButton.current?.focus(); } };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [menu]);
  function home(event) {
    setMenu(false);
    if (isHome && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) window.scrollTo({ top: 0, behavior: 'instant' });
  }
  return <header ref={headerRef} className={`topbar heritage-nav${isHome ? ' heritage-nav-home' : ''}${isHome && !pastStory ? ' heritage-nav-overlay' : ''}`}>
    <Link className="brand" to="/" onClick={home}><span className="brand-icon"><Leaf size={22}/></span><span>foodrescue<span className="brand-dot">.</span></span></Link>
    <nav id="main-navigation" aria-label="Main navigation" className={menu ? 'main-nav open' : 'main-nav'}>
      <NavLink to="/" onClick={home}>Home</NavLink>
      <NavLink to="/explore" onClick={() => setMenu(false)}>Explore food</NavLink>
      <NavLink to="/about" onClick={() => setMenu(false)}>Our purpose</NavLink>
      <NavLink to="/support" onClick={() => setMenu(false)}>Contribute</NavLink>
    </nav>
    <div className="nav-right">
      <Button variant="icon" aria-label="Toggle theme" onClick={toggleTheme}>{theme === 'light' ? <Moon size={19}/> : <Sun size={19}/>}</Button>
      {user || token ? <Link className="button small" to="/dashboard">Dashboard <ArrowUpRight size={15}/></Link> : <Link className="button small" to="/login">Sign in <ArrowUpRight size={15}/></Link>}
      <button ref={menuButton} className="icon-btn mobile-menu" aria-label={menu ? "Close menu" : "Open menu"} aria-expanded={menu} aria-controls="main-navigation" onClick={() => setMenu(!menu)}>{menu ? <X/> : <Menu/>}</button>
    </div>
  </header>;
}
