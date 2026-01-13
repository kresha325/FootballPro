import React from 'react';
import PlayerProfile from './PlayerProfile';
import CoachProfile from './CoachProfile';
import ScoutProfile from './ScoutProfile';
import ManagerProfile from './ManagerProfile';
import ClubProfile from './ClubProfile';
import BusinessProfile from './BusinessProfile';
import LigaProfile from './LigaProfile';
import FederationProfile from './FederationProfile';

const ProfileSelector = ({ user, profile }) => {
  switch (user.role) {
    case 'athlete':
      return <PlayerProfile profile={profile} />;
    case 'coach':
      return <CoachProfile coach={profile} />;
    case 'scout':
      return <ScoutProfile scout={profile} />;
    case 'manager':
      return <ManagerProfile manager={profile} />;
    case 'club':
      return <ClubProfile club={profile} />;
    case 'business':
      return <BusinessProfile profile={profile} />;
    case 'liga':
      return <LigaProfile liga={profile} />;
    case 'federation':
      return <FederationProfile federation={profile} />;
    default:
      return <div>Unknown role or profile type.</div>;
  }
};

export default ProfileSelector;
