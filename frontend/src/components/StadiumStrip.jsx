import { useEffect, useState } from 'react';
import { stadiumsAPI } from '../services/api';
import { getFullUrl } from '../utils/mediaUrl';
import StadiumModal from './StadiumModal';

export default function StadiumStrip() {
  const [stadiums, setStadiums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await stadiumsAPI.getFeatured();
        if (!cancelled) setStadiums(Array.isArray(res.data) ? res.data : []);
      } catch {
        if (!cancelled) setStadiums([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (stadiums.length <= 1) return undefined;
    const id = setInterval(() => {
      setActive((prev) => (prev + 1) % stadiums.length);
    }, 3000);
    return () => clearInterval(id);
  }, [stadiums.length]);

  if (loading || stadiums.length === 0) return null;

  const current = stadiums[Math.min(active, stadiums.length - 1)];
  const photo = getFullUrl(current?.photo);

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 border border-gray-200 dark:border-gray-700">
        <h3 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <span>🏟️</span> Stadiume
        </h3>
        <button
          type="button"
          onClick={() => setSelected(current)}
          className="w-full text-left group"
        >
          {photo ? (
            <img
              src={photo}
              alt=""
              className="w-full h-28 object-cover rounded-md border border-gray-200 dark:border-gray-600 mb-2 group-hover:opacity-95"
            />
          ) : (
            <div className="w-full h-28 rounded-md bg-slate-100 dark:bg-gray-700 flex items-center justify-center text-3xl mb-2">
              🏟️
            </div>
          )}
          <div className="text-sm font-semibold text-gray-900 dark:text-white truncate group-hover:text-blue-600">
            {current.name}
          </div>
          {(current.city || current.country) && (
            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {[current.city, current.country].filter(Boolean).join(' • ')}
            </div>
          )}
        </button>
        {stadiums.length > 1 ? (
          <div className="flex justify-center gap-1.5 mt-3">
            {stadiums.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={s.name}
                onClick={() => setActive(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === active ? 'w-4 bg-blue-600' : 'w-1.5 bg-gray-300 dark:bg-gray-600'
                }`}
              />
            ))}
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => setSelected(current)}
          className="w-full mt-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 py-2 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition text-sm"
        >
          Shiko detajet
        </button>
      </div>
      {selected ? <StadiumModal stadium={selected} onClose={() => setSelected(null)} /> : null}
    </>
  );
}
