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
      // The store has already been cleared in the interceptor,
      // we just need to navigate to /login without a hard page reload.
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