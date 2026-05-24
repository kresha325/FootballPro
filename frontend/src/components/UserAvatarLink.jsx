import { Link } from 'react-router-dom';

function resolvePhotoUrl(photo) {
  if (!photo) return null;
  if (photo.startsWith('http')) return photo;
  const base = (import.meta.env.VITE_API_URL || '').replace(/\/api$/, '');
  return `${base}${photo.startsWith('/') ? '' : '/'}${photo}`;
}

function initialsFromUser(user) {
  const first = user?.firstName || '';
  const last = user?.lastName || '';
  const fromName = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
  if (fromName.trim()) return fromName;
  return '?';
}

export default function UserAvatarLink({
  user,
  userId,
  photoUrl,
  name,
  size = 40,
  className = '',
  onClick,
}) {
  const id = userId ?? user?.id ?? user?.userId;
  const uri = photoUrl || user?.profilePhoto || user?.Profile?.profilePhoto;
  const resolved = uri ? resolvePhotoUrl(uri) : null;
  const label = name || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Profile';
  const dim = { width: size, height: size };

  const avatar = resolved ? (
    <img
      src={resolved}
      alt={label}
      className={`rounded-full object-cover bg-gray-200 ${className}`}
      style={dim}
      loading="lazy"
      decoding="async"
    />
  ) : (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-emerald-700 text-white font-bold ${className}`}
      style={{ ...dim, fontSize: Math.max(12, Math.round(size * 0.38)) }}
      aria-hidden
    >
      {initialsFromUser(user)}
    </span>
  );

  if (!id) return avatar;

  if (onClick) {
    return (
      <button type="button" onClick={() => onClick(id)} className="inline-flex shrink-0" aria-label={`Open ${label} profile`}>
        {avatar}
      </button>
    );
  }

  return (
    <Link to={`/profile/${id}`} className="inline-flex shrink-0 hover:opacity-90" aria-label={`Open ${label} profile`}>
      {avatar}
    </Link>
  );
}
