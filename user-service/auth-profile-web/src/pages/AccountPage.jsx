import { useAuth } from '../auth/AuthProvider.jsx';
import { ProfileImage } from '../components/ProfileImage.jsx';
import { ProfileForm } from '../components/ProfileForm.jsx';
import { ImageUpload } from '../components/ImageUpload.jsx';
import { Connections } from '../components/Connections.jsx';

export function AccountPage() {
  const { profile, revision } = useAuth();
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
    </div>
  );
}
