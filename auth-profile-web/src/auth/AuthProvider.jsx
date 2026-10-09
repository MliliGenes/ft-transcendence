import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { api, sessionStore } from '../lib/runtime.js';
import { TOKEN_KEY } from '../lib/session.js';
import { ApiError } from '../lib/api-client.js';
import { navigate } from '../lib/navigation.js';

const AuthContext = createContext(null);

export function AuthProvider({ children, initialNotice }) {
  const [profile, setProfile] = useState(null);
  const [status, setStatus] = useState('loading');
  const [loadError, setLoadError] = useState(null);
  const [notice, setNotice] = useState(initialNotice);
  const [mutating, setMutating] = useState(false);
  const [revision, setRevision] = useState(0);
  const load = useRef({ sequence: 0, controller: null });
  const mutation = useRef(false);

  const restore = useCallback(async () => {
    load.current.controller?.abort();
    const controller = new AbortController();
    const sequence = ++load.current.sequence;
    load.current.controller = controller;
    const session = sessionStore.read();
    setLoadError(null);
    setProfile(null);
    if (!session) {
      setStatus('anonymous');
      return;
    }
    setStatus('loading');
    try {
      const user = await api.request('/accounts/me', {
        signal: controller.signal,
      });
      if (
        sequence !== load.current.sequence ||
        sessionStore.read()?.sessionKey !== session.sessionKey
      )
        return;
      setProfile(user);
      setStatus('authenticated');
    } catch (error) {
      if (controller.signal.aborted || sequence !== load.current.sequence)
        return;
      if (error.status === 401) {
        setNotice({ type: 'error', text: error.message });
        setStatus('anonymous');
      } else {
        setLoadError(error);
        setStatus('error'); // An outage or missing account is not a request to refresh.
      }
    }
  }, []);

  useEffect(() => {
    let sessionKey = sessionStore.read()?.sessionKey;
    const unsubscribe = sessionStore.subscribe((session, reason) => {
      if (reason) setNotice({ type: 'error', text: reason });
      if (session?.sessionKey === sessionKey) return; // Rotation keeps the current profile.
      sessionKey = session?.sessionKey;
      void restore();
    });
    const sync = (event) => {
      if (event.key === TOKEN_KEY || event.key === null) sessionStore.sync();
    };
    window.addEventListener('storage', sync);
    void restore();
    return () => {
      unsubscribe();
      window.removeEventListener('storage', sync);
      load.current.controller?.abort();
      load.current.sequence++;
    };
  }, [restore]);

  const signIn = async (mode, values) => {
    const tokens = await api.request(`/auth/${mode}`, {
      auth: false,
      method: 'POST',
      json: values,
    });
    setNotice(null);
    sessionStore.replace(tokens);
    navigate('/account', { replace: true });
  };

  const signOut = async () => {
    const session = sessionStore.read();
    sessionStore.clear();
    setNotice(null);
    navigate('/login', { replace: true });
    if (!session) return;
    try {
      await api.request('/auth/logout', {
        auth: false,
        method: 'POST',
        json: { refreshToken: session.refreshToken },
      });
    } catch {
      if (!sessionStore.read())
        setNotice({
          type: 'warning',
          text: 'You are signed out on this browser. The service could not confirm the session was closed.',
        });
    }
  };

  const changePassword = async (values) => {
    if (mutation.current)
      throw new Error('Please wait for your current change to finish.');
    mutation.current = true;
    setMutating(true);
    const key = sessionStore.read()?.sessionKey;
    try {
      await api.request('/accounts/me/password', {
        method: 'PATCH',
        json: values,
      });
      if (!key || sessionStore.read()?.sessionKey !== key)
        throw new ApiError('Your session changed. Please sign in again.', 401);
    } finally {
      mutation.current = false;
      setMutating(false);
    }
  };

  const setPassword = async (values) => {
    if (mutation.current)
      throw new Error('Please wait for your current change to finish.');
    mutation.current = true;
    setMutating(true);
    const key = sessionStore.read()?.sessionKey;
    try {
      await api.request('/accounts/me/password', {
        method: 'POST',
        json: values,
      });
      if (!key || sessionStore.read()?.sessionKey !== key)
        throw new ApiError('Your session changed. Please sign in again.', 401);
      setProfile((current) => current && { ...current, hasPassword: true });
    } finally {
      mutation.current = false;
      setMutating(false);
    }
  };

  const unlinkDiscord = async () => {
    if (mutation.current)
      throw new Error('Please wait for your current change to finish.');
    mutation.current = true;
    setMutating(true);
    const key = sessionStore.read()?.sessionKey;
    try {
      await api.request('/auth/discord/link', { method: 'DELETE' });
      if (!key || sessionStore.read()?.sessionKey !== key)
        throw new ApiError('Your session changed. Please sign in again.', 401);
      setProfile((current) => current && { ...current, hasDiscord: false });
    } finally {
      mutation.current = false;
      setMutating(false);
    }
  };

  const unlinkGithub = async () => {
    if (mutation.current)
      throw new Error('Please wait for your current change to finish.');
    mutation.current = true;
    setMutating(true);
    const key = sessionStore.read()?.sessionKey;
    try {
      await api.request('/auth/github/link', { method: 'DELETE' });
      if (!key || sessionStore.read()?.sessionKey !== key)
        throw new ApiError('Your session changed. Please sign in again.', 401);
      setProfile((current) => current && { ...current, hasGithub: false });
    } finally {
      mutation.current = false;
      setMutating(false);
    }
  };

  const updateAccount = async (path, options) => {
    if (mutation.current)
      throw new Error('Please wait for your current change to finish.');
    mutation.current = true;
    setMutating(true);
    const key = sessionStore.read()?.sessionKey;
    try {
      const user = await api.request(path, options);
      if (!key || sessionStore.read()?.sessionKey !== key)
        throw new ApiError('Your session changed. Please sign in again.', 401);
      setProfile(user);
      setRevision((value) => value + 1);
      return user;
    } finally {
      mutation.current = false;
      setMutating(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        profile,
        status,
        loadError,
        notice,
        setNotice,
        signIn,
        signOut,
        restore,
        updateAccount,
        changePassword,
        setPassword,
        unlinkDiscord,
        unlinkGithub,
        mutating,
        revision,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth requires AuthProvider');
  return value;
}
