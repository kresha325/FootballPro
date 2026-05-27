/**
 * Pas krijimit të stream-it në API, hap faqen e transmetimit me LiveKit + ndërrim kamere.
 */
export function navigateToEmbedGoLive(navigate, { streamId, title, description }) {
  const q = new URLSearchParams({
    streamId: String(streamId),
    confirmed: '1',
    livekit: '1',
  });
  if (title) q.set('title', title);
  if (description) q.set('description', description);
  navigate(`/embed-go-live?${q.toString()}`);
}
