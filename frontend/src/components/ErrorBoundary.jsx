import React from 'react';
import { isChunkLoadError } from '../utils/lazyWithReload';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, reloading: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);

    // After deploy, stale tab requests old chunk hashes → 404. Auto-refresh once.
    if (isChunkLoadError(error) && typeof window !== 'undefined') {
      const key = 'fp_chunk_reload';
      const last = Number(sessionStorage.getItem(key) || 0);
      if (!last || Date.now() - last > 15_000) {
        sessionStorage.setItem(key, String(Date.now()));
        this.setState({ reloading: true });
        window.location.reload();
      }
    }
  }

  render() {
    if (this.state.reloading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
          <p className="text-gray-600 dark:text-gray-300 text-sm">Duke përditësuar aplikacionin…</p>
        </div>
      );
    }

    if (this.state.hasError) {
      const chunkFail = isChunkLoadError(this.state.error);
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
          <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md">
            <h2 className="text-2xl font-bold text-red-600 mb-4">
              {chunkFail ? 'Versioni u përditësua' : 'Oops! Something went wrong'}
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              {chunkFail
                ? 'Ka dalë një version i ri i faqes. Rifresko për të vazhduar.'
                : "We're sorry, but something unexpected happened. Please try refreshing the page."}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
