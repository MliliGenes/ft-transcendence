import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { api, sessionStore } from '../lib/runtime.js';
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
  const sessionChannel = useRef(null);

  const restore = useCallback(async () => {
    load.current.controller?.abort();
    const controller = new AbortController();
    const sequence = ++load.current.sequence;
    load.current.controller = controller;
    let session = sessionStore.read();
    let hadSession = Boolean(session);
    setLoadError(null);
    setProfile(null);
    setStatus('loading');
    try {
      if (!session) {
        session = await api.restoreSession();
        hadSession = Boolean(session);
      }
      if (!session) {
        setStatus('anonymous');
        return;
      }
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
        if (hadSession)
          setNotice({ type: 'error', text: error.message });
        setStatus('anonymous');
      } else {
        setLoadError(error);
        setStatus('error'); // An outage or missing account is not a request to refresh.
      }
    }
  }, []);

  useEffect(() => {
    const unsubscribe = sessionStore.subscribe((session, reason) => {
      if (reason) setNotice({ type: 'error', text: reason });
      if (!session) {
        setProfile(null);
        setStatus('anonymous');
      }
    });
    const channel =
      typeof BroadcastChannel === 'undefined'
        ? null
        : new BroadcastChannel('fieldnote-auth-session');
    sessionChannel.current = channel;
    const sync = (event) => {
      if (event.data === 'signed-out') sessionStore.clear();
      if (event.data === 'signed-in') {
        void api
          .restoreSession(true)
          .then(() => restore())
          .catch((error) => {
            if (error.status === 401) sessionStore.clear();
            else {
              setLoadError(error);
              setStatus('error');
            }
          });
      }
    };
    channel?.addEventListener('message', sync);
    void restore();
    return () => {
      unsubscribe();
      channel?.removeEventListener('message', sync);
      channel?.close();
      sessionChannel.current = null;
      load.current.controller?.abort();
      load.current.sequence++;
    };
  }, [restore]);

  const signIn = async (mode, values) => {
    const tokens = await api.request(`/auth/${mode}`, {
      auth: false,
      cookieSession: true,
      method: 'POST',
      json: values,
    });
    setNotice(null);
    sessionStore.replace(tokens);
    sessionChannel.current?.postMessage('signed-in');
    void restore();
    navigate('/account', { replace: true });
  };

  const signOut = async () => {
    sessionStore.clear();
    sessionChannel.current?.postMessage('signed-out');
    setNotice(null);
    navigate('/login', { replace: true });
    try {
      await api.request('/auth/logout', {
        auth: false,
        cookieSession: true,
        method: 'POST',
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

  // Merge a server-confirmed admin edit of the current account into shared auth state.
  const applyAccount = (user) => {
    setProfile((current) => current?.id === user.id ? { ...current, ...user } : current);
    setRevision((value) => value + 1);
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
        applyAccount,
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
