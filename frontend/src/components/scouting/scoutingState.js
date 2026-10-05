export function apiError(err, fallback) {
  return err?.response?.data?.msg || err?.response?.data?.error || fallback;
}
