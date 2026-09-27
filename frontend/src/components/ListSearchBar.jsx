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
        <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--xt-color-text-subtle)]" />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="input pl-10 pr-4"
          aria-label="Kërko në listë"
        />
      </div>
      {showGlobalLink ? (
        <Link
          to={globalHref}
          className="btn btn-quiet shrink-0 text-sm"
        >
          <MagnifyingGlassIcon className="h-4 w-4" />
          Kërkim global
        </Link>
      ) : null}
    </div>
  );
}
