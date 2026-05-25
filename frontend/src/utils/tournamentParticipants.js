/** ID i user-it nga objekti pjesëmarrës (Sequelize through mund të mbulojë User.id). */
export function resolveParticipantUserId(participant) {
  if (!participant) return null;
  const through = participant.TournamentParticipant || participant.tournament_participant;
  const raw = Number(through?.userId ?? participant.userId ?? participant.id);
  return Number.isFinite(raw) && raw > 0 ? raw : null;
}
