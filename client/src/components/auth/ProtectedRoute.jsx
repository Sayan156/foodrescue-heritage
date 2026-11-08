import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth/useAuth.js';
import Notice from '../ui/Notice.jsx';

export default function ProtectedRoute({ children }) {
  const { user, token, loading, sessionError, retrySession, logout } = useAuth();
  const location = useLocation();
  if (loading) return <div className="container page-main" role="status">Checking your session...</div>;
  if (token && sessionError) return <div className="container page-main">
    <h2>We could not load your account</h2><Notice message={sessionError}/>
    <div className="action-row"><button className="button" onClick={retrySession}>Try again</button>
      <button className="outline-btn" onClick={logout}>Sign out</button></div>
  </div>;
  return user ? children : <Navigate to="/login" replace state={{ from: location.pathname + location.search }}/>;
}
