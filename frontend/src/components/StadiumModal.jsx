import { getFullUrl } from '../utils/mediaUrl';

export default function StadiumModal({ stadium, onClose }) {
  if (!stadium) return null;

  const photo = getFullUrl(stadium.photo);
  const place = [stadium.city, stadium.country].filter(Boolean).join(', ');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={stadium.name}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {photo ? (
          <img src={photo} alt="" className="w-full h-48 object-cover rounded-t-xl" />
        ) : (
          <div className="w-full h-36 bg-slate-100 dark:bg-gray-700 rounded-t-xl flex items-center justify-center text-4xl">
            🏟️
          </div>
        )}
        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{stadium.name}</h2>
              {place ? <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{place}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl leading-none"
              aria-label="Mbyll"
            >
              ×
            </button>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-gray-500 dark:text-gray-400">Kapaciteti</dt>
              <dd className="font-semibold text-gray-900 dark:text-white">
                {stadium.capacity != null ? Number(stadium.capacity).toLocaleString() : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-gray-400">Adresa</dt>
              <dd className="font-semibold text-gray-900 dark:text-white">{stadium.address || '—'}</dd>
            </div>
          </dl>

          <div className="rounded-lg border border-gray-200 dark:border-gray-600 bg-slate-50 dark:bg-gray-900/40 p-4">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Orari i ndeshjeve</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Së shpejti — ndeshjet e këtij stadiumi do të shfaqen këtu.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
