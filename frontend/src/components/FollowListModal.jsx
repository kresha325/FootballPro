import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { profileAPI } from '../services/api';
import { getFullUrl } from '../utils/mediaUrl';
import UserAvatarLink from './UserAvatarLink';

function normalizeFollowRows(data, mode) {
  const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
  return list
    .map((row) => {
      const u = mode === 'followers' ? row.follower || row : row.following || row;
      if (!u?.id) return null;
      return {
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        profilePhoto: u.Profile?.profilePhoto || u.profilePhoto || null,
        bio: u.Profile?.bio || u.bio || '',
      };
    })
    .filter(Boolean);
}

/**
 * Modal me listën e ndjekësve ose të ndjekurve.
 * mode: 'followers' | 'following'
 */
export default function FollowListModal({ userId, mode, onClose }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  const title = mode === 'followers' ? 'Ndjekës' : 'Duke ndjekur';

  useEffect(() => {
    if (!userId || !mode) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res =
          mode === 'followers'
            ? await profileAPI.getFollowers(userId)
            : await profileAPI.getFollowing(userId);
        if (!cancelled) setRows(normalizeFollowRows(res.data, mode));
      } catch (err) {
        if (!cancelled) {
          setRows([]);
          setError(err.response?.data?.msg || 'Nuk u ngarkua lista');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, mode]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-white dark:bg-gray-800 w-full max-w-md rounded-t-2xl sm:rounded-xl shadow-xl max-h-[80dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-2xl leading-none text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
            aria-label="Mbyll"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-3">
          {loading ? (
            <p className="text-center text-sm text-gray-500 py-8">Duke ngarkuar…</p>
          ) : error ? (
            <p className="text-center text-sm text-red-600 py-8">{error}</p>
          ) : rows.length === 0 ? (
            <p className="text-center text-sm text-gray-500 py-8">
              {mode === 'followers' ? 'Nuk ka ndjekës ende.' : 'Nuk po ndjek askënd ende.'}
            </p>
          ) : (
            <ul className="space-y-1">
              {rows.map((u) => {
                const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || `User #${u.id}`;
                return (
                  <li key={u.id}>
                    <Link
                      to={`/profile/${u.id}`}
                      onClick={onClose}
                      className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/60"
                    >
                      <UserAvatarLink
                        user={u}
                        userId={u.id}
                        photoUrl={u.profilePhoto ? getFullUrl(u.profilePhoto) : null}
                        name={name}
                        size={40}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-gray-900 dark:text-white truncate">
                          {name}
                        </span>
                        {u.bio ? (
                          <span className="block text-xs text-gray-500 dark:text-gray-400 truncate">
                            {u.bio}
                          </span>
                        ) : null}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
