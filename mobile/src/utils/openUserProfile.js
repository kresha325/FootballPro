/**
 * Navigate to a user's public profile from any navigator / stack.
 */
export function openUserProfile(navigation, userId) {
  if (!navigation || userId == null || userId === '') return;

  const id = userId;
  const state = navigation.getState?.();
  const routeNames = state?.routeNames || [];

  if (routeNames.includes('PublicProfile')) {
    navigation.navigate('PublicProfile', { userId: id });
    return;
  }

  const parent = navigation.getParent?.();
  if (parent?.navigate) {
    parent.navigate('Profile', { screen: 'PublicProfile', params: { userId: id } });
  }
}

export function openTournamentDetail(navigation, tournamentId) {
  if (!navigation || tournamentId == null || tournamentId === '') return;

  const state = navigation.getState?.();
  const routeNames = state?.routeNames || [];

  if (routeNames.includes('TournamentDetail')) {
    navigation.navigate('TournamentDetail', { tournamentId });
    return;
  }

  const parent = navigation.getParent?.();
  if (parent?.navigate) {
    parent.navigate('More', { screen: 'TournamentDetail', params: { tournamentId } });
  }
}
