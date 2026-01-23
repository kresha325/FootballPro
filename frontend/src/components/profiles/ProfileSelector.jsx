import React from 'react';
import PlayerProfile from './PlayerProfile';
import CoachProfile from './CoachProfile';
import ScoutProfile from './ScoutProfile';
import ManagerProfile from './ManagerProfile';
import RefereeProfile from './RefereeProfile';
import ClubProfile from './ClubProfile';
import BusinessProfile from './BusinessProfile';
import LigaProfile from './LigaProfile';
import FederationProfile from './FederationProfile';

const ProfileSelector = ({ user, profile, isOwner }) => {
  switch (user.role) {
    case 'athlete':
      return <PlayerProfile profile={profile} />;
    case 'coach':
      return <CoachProfile profile={profile} />;
    case 'scout':
      return <ScoutProfile profile={profile} />;
    case 'manager':
      return <ManagerProfile profile={profile} />;
    case 'referee':
      return <RefereeProfile profile={profile} />;
    case 'club':
      return <ClubProfile profile={profile} isOwner={isOwner} />;
    case 'business':
      return <BusinessProfile profile={profile} />;
    case 'liga':
      return <LigaProfile profile={profile} />;
    case 'federation':
      return <FederationProfile profile={profile} />;
    default:
      return <div>Unknown role or profile type.</div>;
  }
};

export default ProfileSelector;
