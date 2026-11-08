import { BrowserRouter } from 'react-router-dom';
import AppProviders from './AppProviders.jsx';
import AppRoutes from './AppRoutes.jsx';
import Navbar from '../components/layout/Navbar.jsx';
import Footer from '../components/layout/Footer.jsx';
import '../styles/themes.css';
import '../styles/components.css';
import '../styles/globals.css';
import '../styles/responsive.css';

export default function App() {
  return <AppProviders><BrowserRouter><div className="site"><Navbar/><main><AppRoutes/></main><Footer/></div></BrowserRouter></AppProviders>;
}
