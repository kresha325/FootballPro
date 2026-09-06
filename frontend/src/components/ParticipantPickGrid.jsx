import { resolveParticipantUserId } from '../utils/tournamentParticipants';
import { getFullUrl } from '../utils/mediaUrl';

function participantName(p) {
  const uid = resolveParticipantUserId(p);
  const name = [p?.firstName, p?.lastName].filter(Boolean).join(' ').trim();
  return name || (uid ? `User #${uid}` : 'User');
}

function participantMeta(p) {
  const club = p?.Profile?.club;
  const uid = resolveParticipantUserId(p);
  const parts = [];
  if (club) parts.push(club);
  if (uid) parts.push(`#${uid}`);
  return parts.join(' · ');
}

function participantPhoto(p) {
  return getFullUrl(p?.Profile?.profilePhoto || p?.profilePhoto);
}

function initials(p) {
  const first = p?.firstName?.[0] || '';
  const last = p?.lastName?.[0] || '';
  return `${first}${last}`.toUpperCase() || '?';
}

/** Zgjedhës pjesëmarrësish me avatar (jo <select> nativ). */
export default function ParticipantPickGrid({
  options = [],
  value,
  onSelect,
  allowEmpty = false,
  emptyLabel = 'Pa zgjedhje',
}) {
  return (
    <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
      {allowEmpty ? (
        <button
          type="button"
          onClick={() => onSelect('')}
          className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-sm transition ${
            !value
              ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-500/30 dark:border-emerald-400/60 dark:bg-emerald-500/15 dark:text-emerald-200'
              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-300 dark:hover:border-slate-500'
          }`}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-500/30 text-xs font-bold">
            —
          </span>
          <span className="min-w-0 truncate font-medium">{emptyLabel}</span>
        </button>
      ) : null}
      {options.map((p) => {
        const uid = resolveParticipantUserId(p);
        if (!uid) return null;
        const selected = String(value) === String(uid);
        const photo = participantPhoto(p);
        const meta = participantMeta(p);
        return (
          <button
            key={uid}
            type="button"
            onClick={() => onSelect(String(uid))}
            className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition ${
              selected
                ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500/30 dark:border-emerald-400/60 dark:bg-emerald-500/15 dark:ring-emerald-400/40'
                : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-600 dark:bg-slate-800/50 dark:hover:border-slate-500'
            }`}
          >
            {photo ? (
              <img
                src={photo}
                alt=""
                className="h-9 w-9 shrink-0 rounded-full object-cover bg-slate-200"
              />
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white dark:bg-emerald-700">
                {initials(p)}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">
                {participantName(p)}
              </span>
              {meta ? (
                <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">
                  {meta}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
