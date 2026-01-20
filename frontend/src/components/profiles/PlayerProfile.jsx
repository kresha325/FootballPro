import React from 'react';
import PlayerProfileHeader from './PlayerProfileHeader';

const PlayerProfile = ({ profile, stats, isOwner }) => {
  const playerStats = profile.stats || {};
  return (
    <div>
      <PlayerProfileHeader profile={profile} stats={playerStats} />
    </div>
  );
};

export default PlayerProfile;
