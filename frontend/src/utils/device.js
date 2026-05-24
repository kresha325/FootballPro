/** Mobile browser ose WebView RN — prefero LiveKit mbi YouTube embed. */
export function isReactNativeWebView() {
  return typeof window !== 'undefined' && !!window.ReactNativeWebView;
}

export function isMobileWeb() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 768px)').matches;
}

export function preferLiveKitBroadcast() {
  return isReactNativeWebView() || isMobileWeb();
}
