import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';
import { AuthProvider } from './auth/AuthProvider.jsx';
import { consumeOAuthReturn } from './lib/session.js';
import { sessionStore } from './lib/runtime.js';
import './styles.css';

const initialNotice = consumeOAuthReturn(
  window.location,
  window.history,
  sessionStore,
);

createRoot(document.getElementById('root')).render(
  <AuthProvider initialNotice={initialNotice}>
    <App />
  </AuthProvider>,
);
