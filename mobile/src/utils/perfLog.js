import { useRef } from 'react';

/** Development-only timing. No output in release builds. */
export function perfStart(label) {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return () => {};
  const started = Date.now();
  return () => {
    console.log(`[PERF] ${label}: ${Date.now() - started}ms`);
  };
}

/** Logs the first render, then every 25th. Silent in release builds. */
export function useRenderLog(name) {
  const count = useRef(0);
  count.current += 1;
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;
  const n = count.current;
  if (n === 1 || n % 25 === 0) {
    console.log(`[RENDER] ${name} #${n}`);
  }
}

let lastNavMark = 0;

/** Measures time spent inside a navigation handler. Silent in release builds. */
export function logNav(label, startedAt) {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;
  const now = Date.now();
  const handlerMs = startedAt != null ? now - startedAt : 0;
  const sinceLast = lastNavMark ? now - lastNavMark : 0;
  lastNavMark = now;
  console.log(
    `[NAV PERF] ${label}: ${handlerMs}ms${sinceLast ? ` | ${sinceLast}ms since previous nav` : ''}`
  );
}
