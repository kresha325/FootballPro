import { useEffect, useMemo, useState } from 'react';
import { getFullUrl } from '../utils/mediaUrl';
import { stadiumsAPI } from '../services/api';

function todayKey() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function addDaysKey(baseKey, days) {
  const d = new Date(`${baseKey}T12:00:00`);
  d.setDate(d.getDate() + days);
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
}

export default function StadiumModal({ stadium, onClose }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState('');
  const [quick, setQuick] = useState('all'); // all | today | tomorrow

  useEffect(() => {
    if (!stadium?.id) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const params = {};
        if (filterDate) params.date = filterDate;
        const res = await stadiumsAPI.getMatches(stadium.id, params);
        if (!cancelled) setMatches(Array.isArray(res.data?.matches) ? res.data.matches : []);
      } catch {
        if (!cancelled) setMatches([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stadium?.id, filterDate]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const m of matches) {
      const key = m.dateKey || 'unknown';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(m);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [matches]);

  if (!stadium) return null;

  const photo = getFullUrl(stadium.photo);
  const place = [stadium.city, stadium.country].filter(Boolean).join(', ');

  const applyQuick = (key) => {
    setQuick(key);
    if (key === 'all') {
      setFilterDate('');
      return;
    }
    const today = todayKey();
    if (key === 'today') setFilterDate(today);
    if (key === 'tomorrow') setFilterDate(addDaysKey(today, 1));
  };

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

          <div className="rounded-lg border border-gray-200 dark:border-gray-600 bg-slate-50 dark:bg-gray-900/40 p-4 space-y-3">
            <h3 className="font-semibold text-gray-900 dark:text-white">Orari i ndeshjeve</h3>

            <div className="flex flex-wrap gap-2">
              {[
                { key: 'all', label: 'Të gjitha' },
                { key: 'today', label: 'Sot' },
                { key: 'tomorrow', label: 'Nesër' },
              ].map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => applyQuick(chip.key)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border ${
                    quick === chip.key
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Filtro sipas datës</label>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => {
                  setFilterDate(e.target.value);
                  setQuick(e.target.value ? 'date' : 'all');
                }}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
              />
            </div>

            {loading ? (
              <p className="text-sm text-gray-500">Duke ngarkuar orarin…</p>
            ) : matches.length === 0 ? (
              <p className="text-sm text-gray-500">Nuk ka ndeshje për këtë filtër.</p>
            ) : (
              <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
                {grouped.map(([dateKey, list]) => (
                  <div key={dateKey}>
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">
                      {list[0]?.day ? `${list[0].day}, ` : ''}
                      {list[0]?.dateLabel || dateKey}
                    </div>
                    <ul className="space-y-2">
                      {list.map((m) => (
                        <li
                          key={m.id}
                          className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                        >
                          <div className="font-medium text-blue-700 dark:text-blue-300 truncate">
                            {m.tournamentName || 'Turne'}
                          </div>
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {m.homeTeam} <span className="text-gray-400 font-normal">vs</span> {m.awayTeam}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {m.timeLabel || '—'}
                            {m.status === 'finished' && m.scoreHome != null
                              ? ` · ${m.scoreHome}:${m.scoreAway}`
                              : m.status
                                ? ` · ${m.status}`
                                : ''}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
