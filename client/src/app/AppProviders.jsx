import { AuthProvider } from '../features/auth/AuthProvider.jsx';
import { ThemeProvider } from '../providers/ThemeProvider.jsx';

export default function AppProviders({ children }) {
  return <ThemeProvider><AuthProvider>{children}</AuthProvider></ThemeProvider>;
}
