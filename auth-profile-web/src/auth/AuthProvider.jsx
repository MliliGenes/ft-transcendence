import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { api, authClient, sessionStore } from '../lib/runtime.js';
import { ApiError } from '../lib/api-client.js';
import { navigate } from '../lib/navigation.js';

const AuthContext = createContext(null);
const EXPIRED_NOTICE = 'Your session expired. Please sign in again.';

export function AuthProvider({ children, initialNotice }) {
  const [profile, setProfile] = useState(null);
  const [status, setStatus] = useState('loading');
  const [loadError, setLoadError] = useState(null);
  const [notice, setNotice] = useState(initialNotice);
  const [mutating, setMutating] = useState(false);
  const [revision, setRevision] = useState(0);
  const load = useRef({ sequence: 0 });
  const mutation = useRef(false);
  const signingOut = useRef(false);
  const wasAuthenticated = useRef(false);

  const restore = useCallback(async () => {
    const sequence = ++load.current.sequence;
    const hadSession = authClient.getAccessToken() !== null;
    setLoadError(null);
    setProfile(null);
    setStatus('loading');
    try {
      const snapshot = await authClient.restore();
      if (sequence !== load.current.sequence) return;
      if (snapshot.status === 'authenticated') {
        wasAuthenticated.current = true;
        setProfile(snapshot.profile);
        setStatus('authenticated');
      } else {
        wasAuthenticated.current = false;
        if (hadSession) setNotice({ type: 'error', text: EXPIRED_NOTICE });
        setStatus('anonymous');
      }
    } catch (error) {
      if (sequence !== load.current.sequence) return;
      if (error.code === 'SESSION_CHANGED') return;
      if (error.code === 'LOGOUT_PENDING') {
        wasAuthenticated.current = false;
        setNotice({ type: 'error', text: error.message });
        setStatus('anonymous');
      } else {
        setLoadError(error);
        setStatus('error'); // An outage or missing account is not a request to refresh.
      }
    }
  }, []);

  useEffect(() => {
    // Session-control (logout/renewal fan-out) lives in the shared client;
    // here we only mirror its snapshot into React state.
    const unsubscribe = authClient.subscribe((snapshot) => {
      if (snapshot.logoutPending)
        setNotice({
          type: 'warning',
          text: 'You are signed out on this browser. The service could not confirm the session was closed.',
        });
      if (snapshot.status === 'authenticated') {
        wasAuthenticated.current = true;
        setProfile(snapshot.profile);
        setStatus('authenticated');
        setLoadError(null);
        setNotice((current) => current?.text === EXPIRED_NOTICE ? null : current);
      } else if (snapshot.status === 'unavailable') {
        setProfile(snapshot.profile);
        setLoadError(new ApiError('Authentication is unavailable. Please try again.', 503));
        setStatus('error');
      } else if (snapshot.status === 'loading') {
        // A remote sign-in replaces the identity. Retire the old profile
        // until the shared client verifies the replacement account.
        setProfile(null);
        setStatus('loading');
      }
      if (snapshot.status === 'anonymous') {
        if (wasAuthenticated.current && !signingOut.current)
          setNotice({ type: 'error', text: EXPIRED_NOTICE });
        wasAuthenticated.current = false;
        setProfile(null);
        setStatus('anonymous');
      }
    });
    const stopStore = sessionStore.subscribe((session, reason) => {
      if (reason) setNotice({ type: 'error', text: reason });
    });
    void restore();
    return () => {
      unsubscribe();
      stopStore();
      load.current.sequence++;
    };
  }, [restore]);

  const signIn = async (mode, values) => {
    await authClient.login(mode, values);
    setNotice(null);
    void restore();
    navigate('/account', { replace: true });
  };

  const signOut = async () => {
    signingOut.current = true;
    try {
      const { serverConfirmed } = await authClient.logout();
      setNotice(null);
      navigate('/login', { replace: true });
      if (!serverConfirmed)
        setNotice({
          type: 'warning',
          text: 'You are signed out on this browser. The service could not confirm the session was closed.',
        });
    } finally {
      signingOut.current = false;
    }
  };

  const guard = () => authClient.getSnapshot().sessionGeneration;
  const changed = (key) => {
    if (!key || authClient.getSnapshot().sessionGeneration !== key)
      throw new ApiError('Your session changed. Please sign in again.', 401);
  };

  const changePassword = async (values) => {
    if (mutation.current)
      throw new Error('Please wait for your current change to finish.');
    mutation.current = true;
    setMutating(true);
    const key = guard();
    try {
      await api.request('/accounts/me/password', {
        method: 'PATCH',
        json: values,
      });
      changed(key);
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
    const key = guard();
    try {
      await api.request('/accounts/me/password', {
        method: 'POST',
        json: values,
      });
      changed(key);
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
    const key = guard();
    try {
      await api.request('/auth/discord/link', { method: 'DELETE' });
      changed(key);
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
    const key = guard();
    try {
      await api.request('/auth/github/link', { method: 'DELETE' });
      changed(key);
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
    const key = guard();
    try {
      const user = await api.request(path, options);
      changed(key);
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
