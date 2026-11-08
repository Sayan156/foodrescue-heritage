import { Routes, Route } from 'react-router-dom';
import Home from '../pages/Home.jsx';
import About from '../pages/About.jsx';
import Explore from '../features/donor/Explore.jsx';
import Support from '../features/payments/Support.jsx';
import PasswordRecovery from '../features/auth/pages/PasswordRecovery.jsx';
import Login from '../features/auth/pages/Login.jsx';
import Register from '../features/auth/pages/Register.jsx';
import Dashboard from '../features/dashboard/Dashboard.jsx';
import ProtectedRoute from '../components/auth/ProtectedRoute.jsx';
import GuestOnlyRoute from '../components/auth/GuestOnlyRoute.jsx';
import NotFound from '../pages/NotFound.jsx';

export default function AppRoutes() {
  return <Routes>
    <Route path="/" element={<Home/>}/>
    <Route path="/about" element={<About/>}/>
    <Route path="/explore" element={<Explore/>}/>
    <Route path="/support" element={<Support/>}/>
    <Route element={<GuestOnlyRoute/>}>
      <Route path="/forgot-password" element={<PasswordRecovery/>}/>
      <Route path="/reset-password" element={<PasswordRecovery reset/>}/>
      <Route path="/login" element={<Login/>}/>
      <Route path="/register" element={<Register/>}/>
    </Route>
    <Route path="/dashboard/*" element={<ProtectedRoute><Dashboard/></ProtectedRoute>}/>
    <Route path="*" element={<NotFound/>}/>
  </Routes>;
}
