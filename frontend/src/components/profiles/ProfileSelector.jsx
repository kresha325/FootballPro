import React from 'react';
import PlayerProfile from './PlayerProfile';
import RoleProfileOverview from './RoleProfileOverview';
import ClubProfile from './ClubProfile';
import LigaProfile from './LigaProfile';
import FederationProfile from './FederationProfile';

function GeneralProfileOverview({ profile = {}, role }) {
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim() || profile.club || '';
  const location = [profile.city, profile.country].filter(Boolean).join(', ');

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <section className="xt-card p-4 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--xt-color-gold-bright)]">Përmbledhje profili</p>
        <h2 className="mt-1 text-xl font-semibold text-[var(--xt-color-text)]">Rreth {name || 'profilit'}</h2>
        {profile.bio ? (
          <p className="mt-4 whitespace-pre-wrap leading-relaxed text-[var(--xt-color-text-muted)]">{profile.bio}</p>
        ) : (
          <p className="mt-4 text-sm text-[var(--xt-color-text-muted)]">Nuk është shtuar ende një përshkrim për këtë profil.</p>
        )}
        {location && (
          <dl className="mt-5 border-t border-[var(--xt-color-border)] pt-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--xt-color-text-subtle)]">Vendndodhja</dt>
            <dd className="mt-1 font-medium text-[var(--xt-color-text)]">{location}</dd>
          </dl>
        )}
        {role !== 'admin' && (
          <p className="mt-5 border-t border-[var(--xt-color-border)] pt-4 text-xs text-[var(--xt-color-text-subtle)]">
            Pamja e specializuar për këtë rol nuk është e disponueshme.
          </p>
        )}
      </section>
    </div>
  );
}

const ProfileSelector = ({ user, profile, isOwner, onEdit, tournamentSummary, gallery, onShowVideos, onShowGallery }) => {
  const role = String(user?.role || '').trim().toLowerCase();
  switch (role) {
    case 'athlete':
      return <PlayerProfile profile={profile} tournamentSummary={tournamentSummary} gallery={gallery} onShowVideos={onShowVideos} onShowGallery={onShowGallery} />;
    case 'coach':
    case 'trajner':
      return <RoleProfileOverview profile={profile} role={role} />;
    case 'scout':
      return <RoleProfileOverview profile={profile} role={role} />;
    case 'manager':
      return <RoleProfileOverview profile={profile} role={role} />;
    case 'referee':
      return <RoleProfileOverview profile={profile} role={role} />;
    case 'club':
      return <ClubProfile profile={profile} isOwner={isOwner} />;
    case 'business':
    case 'media':
      return <RoleProfileOverview profile={profile} role={role} />;
    case 'liga':
      return (
        <LigaProfile
          liga={null}
          profile={profile}
          userId={user?.id || profile?.userId || profile?.User?.id}
          isOwner={isOwner}
          onEdit={onEdit}
        />
      );
    case 'federation':
      return <RoleProfileOverview profile={profile} role={role} />;
    case 'admin':
      return <GeneralProfileOverview profile={profile} role={role} />;
    default:
      return <GeneralProfileOverview profile={profile} role={role} />;
  }
};

export default ProfileSelector;
