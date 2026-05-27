import React from 'react';
import PlayerProfileHeader from './PlayerProfileHeader';

const PlayerProfile = ({ profile }) => {
  const playerStats = profile.stats || {};
  return (
    <div>
      <PlayerProfileHeader profile={profile} stats={playerStats} />
    </div>
  );
};

export default PlayerProfile;
