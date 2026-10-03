import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { ProfileImage } from '../components/ProfileImage.jsx';
import { ProfileForm } from '../components/ProfileForm.jsx';
import { ImageUpload } from '../components/ImageUpload.jsx';
import { Connections } from '../components/Connections.jsx';
import { PasswordForm } from '../components/PasswordForm.jsx';
import { SetPasswordForm } from '../components/SetPasswordForm.jsx';
import { api } from '../lib/runtime.js';

export function AccountPage() {
  const { profile, revision } = useAuth();
  const [friends, setFriends] = useState([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [friendsError, setFriendsError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadFriends() {
      setFriendsLoading(true);
      setFriendsError('');
      try {
        const data = await api.request('/social/friendships');
        if (!active) return;
        setFriends(Array.isArray(data) ? data : []);
      } catch (error) {
        if (!active) return;
        setFriends([]);
        setFriendsError(error.message || 'Unable to load your friends.');
      } finally {
        if (active) setFriendsLoading(false);
      }
    }

    if (profile?.id) void loadFriends();
    return () => {
      active = false;
    };
  }, [profile?.id]);

  return (
    <div className="settings-stack" key={profile.id}>
      <section className="card profile-card" aria-labelledby="profile-heading">
        <ProfileImage user={profile} banner revision={revision} />
        <div className="profile-summary">
          <ProfileImage user={profile} revision={revision} />
          <div className="profile-identity">
            <h2 id="profile-heading">
              {profile.displayName || profile.username}
            </h2>
            <p className="muted">@{profile.username}</p>
            <span className="badge">
              {profile.role === 'SUPERADMIN' ? 'Superadmin' : 'Member'}
            </span>
          </div>
        </div>
        <div className="profile-meta">
          <span>
            Joined{' '}
            {new Date(profile.createdAt).toLocaleDateString(undefined, {
              month: 'long',
              year: 'numeric',
            })}
          </span>
          <span className="verification">
            {profile.emailVerifiedAt ? 'Email verified' : 'Email not verified'}
          </span>
        </div>
      </section>
      <ProfileForm />
      <section className="card settings-card" aria-labelledby="friends-heading">
        <div className="section-heading">
          <div>
            <h2 id="friends-heading">Friends</h2>
            <p className="muted">People you’re already connected with.</p>
          </div>
          <span className="stat-badge">{friends.length}</span>
        </div>

        {friendsLoading ? (
          <p className="muted">Loading friends…</p>
        ) : friendsError ? (
          <p className="muted error-text">{friendsError}</p>
        ) : friends.length === 0 ? (
          <p className="muted">No friends yet.</p>
        ) : (
          <ul className="friend-list">
            {friends.map((friend) => (
              <li key={friend.id} className="friend-item">
                <span className="friend-name">
                  {friend.displayName || friend.username}
                </span>
                <span className="friend-handle">@{friend.username}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card settings-card" aria-labelledby="photos-heading">
        <div className="section-heading">
          <div>
            <h2 id="photos-heading">Profile photos</h2>
            <p className="muted">Update each image when it looks right.</p>
          </div>
        </div>
        <div className="upload-grid">
          <ImageUpload kind="avatar" />
          <ImageUpload kind="banner" />
        </div>
      </section>
      <Connections />
      {profile.hasPassword ? <PasswordForm /> : <SetPasswordForm />}
    </div>
  );
}
