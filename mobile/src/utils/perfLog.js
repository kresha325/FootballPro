/** Development-only timing. No output in release builds. */
export function perfStart(label) {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return () => {};
  const started = Date.now();
  return () => {
    console.log(`[PERF] ${label}: ${Date.now() - started}ms`);
  };
}
