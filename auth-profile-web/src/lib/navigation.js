import { useEffect, useState } from 'react';

export function navigate(path, { replace = false } = {}) {
  if (!['/', '/login', '/register', '/account', '/verify-email', '/forgot-password', '/reset-password'].includes(path))
    path = '/account';
  window.history[replace ? 'replaceState' : 'pushState'](null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo({ top: 0, behavior: 'instant' });
}

export function useRoute() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const update = () => setPath(window.location.pathname);
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);
  return path;
}
