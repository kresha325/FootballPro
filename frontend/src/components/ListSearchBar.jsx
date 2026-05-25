import { Link } from 'react-router-dom';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

/**
 * Reusable search bar for list screens.
 * @param {string} value
 * @param {(v: string) => void} onChange
 * @param {string} [placeholder]
 * @param {string} [className]
 * @param {boolean} [showGlobalLink] — link to /search with current query
 */
export default function ListSearchBar({
  value,
  onChange,
  placeholder = 'Kërko…',
  className = '',
  showGlobalLink = true,
}) {
  const q = (value || '').trim();
  const globalHref = q ? `/search?q=${encodeURIComponent(q)}` : '/search';

  return (
    <div className={`flex flex-col sm:flex-row gap-2 mb-6 ${className}`}>
      <div className="relative flex-1">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          aria-label="Kërko në listë"
        />
      </div>
      {showGlobalLink ? (
        <Link
          to={globalHref}
          className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <MagnifyingGlassIcon className="h-4 w-4" />
          Kërkim global
        </Link>
      ) : null}
    </div>
  );
}
