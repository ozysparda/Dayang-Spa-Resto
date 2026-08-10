import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch((err) => {
    console.warn('Service worker registration failed:', err);
  });
}

/**
 * Inner component that registers the global auth-logout listener
 * and renders <App />.  Kept separate from App so we have access
 * to the Navigate function from react-router without needing a
 * top-level Router inside App.
 */
function Root() {
  const navigate = useNavigate();

  React.useEffect(() => {
    const handleAuthLogout = () => {
      // Only navigate to login if we're not already there. This prevents
      // navigation conflicts when the user presses back/exit during a
      // 401-triggered logout.
      const currentPath = window.location.pathname;
      if (currentPath === '/login') {
        return;
      }
      
      // Use replace to avoid adding the logout navigation to browser history,
      // which would cause the user to go back to a protected page after login.
      navigate('/login', { replace: true });
    };

    window.addEventListener('auth:logout', handleAuthLogout);
    return () => {
      window.removeEventListener('auth:logout', handleAuthLogout);
    };
  }, [navigate]);

  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <Toaster position="top-right" />
        <Root />
      </ErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>
);