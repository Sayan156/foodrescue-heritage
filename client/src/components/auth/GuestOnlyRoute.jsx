import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../features/auth/useAuth.js';

export default function GuestOnlyRoute() {
  const { user, token, loading } = useAuth();
  if (loading) return <div className="container page-main" role="status">Checking your session...</div>;
  // The protected dashboard also handles sessions awaiting recovery after an API error.
  if (user || token) return <Navigate to="/dashboard" replace/>;
  return <Outlet/>;
}
