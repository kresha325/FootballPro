import { useEffect, useMemo, useState } from 'react';
import ParticipantPickGrid from './ParticipantPickGrid';
import { resolveParticipantUserId } from '../utils/tournamentParticipants';

function eventsFromMatchData(data) {
  const all = [
    ...(data?.scorersBySide?.home || []).map((row) => ({ ...row, side: 'home' })),
    ...(data?.scorersBySide?.away || []).map((row) => ({ ...row, side: 'away' })),
  ];
  return all.map((row) => ({
    userId: String(row.userId),
    minute: row.minute != null ? String(row.minute) : '',
    assistUserId: row.assistUserId ? String(row.assistUserId) : '',
    side: row.side || '',
  }));
}

/** Athletes nominated for a club in this tournament; falls back to the participant for individual matches. */
export function squadMembersForSide(participants, clubOrUserId) {
  if (clubOrUserId == null || clubOrUserId === '') return [];
  const list = Array.isArray(participants) ? participants : [];
  const club = list.find((p) => String(resolveParticipantUserId(p)) === String(clubOrUserId));
  if (!club) return [];
  const squad = Array.isArray(club.squadAthletes) ? club.squadAthletes.filter(Boolean) : [];
  if (squad.length > 0) return squad;
  // Individual / mixed athlete side: the participant themselves scores
  if (String(club.role || '').toLowerCase() !== 'club') return [club];
  return [];
}

export function countGoalsBySide(events) {
  let home = 0;
  let away = 0;
  (Array.isArray(events) ? events : []).forEach((ev) => {
    if (!ev?.userId) return;
    if (ev.side === 'home') home += 1;
    else if (ev.side === 'away') away += 1;
  });
  return { home, away };
}

const fieldClass =
  'w-full min-w-0 rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-600 dark:bg-slate-800/90 dark:text-white';

export default function MatchGoalEventsForm({
  participants = [],
  homeUserId,
  awayUserId,
  initialEvents = [],
  onChange,
  onScoreChange,
  variant = 'light',
}) {
  const [events, setEvents] = useState(initialEvents.length ? initialEvents : []);
  const isDark = variant === 'dark';

  const homeMembers = useMemo(
    () => squadMembersForSide(participants, homeUserId),
    [participants, homeUserId]
  );
  const awayMembers = useMemo(
    () => squadMembersForSide(participants, awayUserId),
    [participants, awayUserId]
  );

  useEffect(() => {
    setEvents(initialEvents.length ? initialEvents : []);
  }, [initialEvents]);

  const emit = (next) => {
    setEvents(next);
    onChange?.(next);
    if (onScoreChange) {
      const { home, away } = countGoalsBySide(next);
      onScoreChange({ scoreHome: home, scoreAway: away, events: next });
    }
  };

  const membersForSide = (side) => {
    if (side === 'home') return homeMembers;
    if (side === 'away') return awayMembers;
    return [];
  };

  const addEvent = () => {
    emit([...events, { userId: '', minute: '', assistUserId: '', side: 'home' }]);
  };

  const updateEvent = (index, patch) => {
    emit(
      events.map((row, i) => {
        if (i !== index) return row;
        const next = { ...row, ...patch };
        if (patch.side != null && patch.side !== row.side) {
          const allowed = new Set(
            membersForSide(patch.side).map((p) => String(resolveParticipantUserId(p) || p.id || p.userId))
          );
          if (next.userId && !allowed.has(String(next.userId))) next.userId = '';
          if (next.assistUserId && !allowed.has(String(next.assistUserId))) next.assistUserId = '';
        }
        return next;
      })
    );
  };

  const removeEvent = (index) => {
    emit(events.filter((_, i) => i !== index));
  };

  const labelClass = isDark
    ? 'text-[10px] font-bold uppercase tracking-wider text-slate-400'
    : 'text-[10px] font-bold uppercase tracking-wider text-slate-500';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-col sm:flex-row sm:items-start">
        <div className="w-full sm:w-auto">
          <p className={`text-sm font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>⚽ Golat & asistet</p>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Zgjidh ekipin — pastaj anëtarët e skuadrës së turneut (gol + asist)
          </p>
        </div>
        <button
          type="button"
          onClick={addEvent}
          className="shrink-0 self-stretch sm:self-auto rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:brightness-110"
        >
          + Shto gol
        </button>
      </div>

      {events.length === 0 ? (
        <div
          className={`rounded-2xl border border-dashed px-4 py-8 text-center ${
            isDark ? 'border-slate-600 bg-slate-800/40 text-slate-400' : 'border-slate-300 bg-slate-50 text-slate-500'
          }`}
        >
          <p className="text-3xl mb-2">🎯</p>
          <p className="text-sm font-medium">Ende pa gola të regjistruar</p>
          <p className="text-xs mt-1 opacity-80">Shto golashënuesin, minutën dhe asistin për statistika në profil</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {events.map((ev, index) => {
            const side = ev.side === 'away' ? 'away' : ev.side === 'home' ? 'home' : '';
            const sideMembers = membersForSide(side);
            const scorerOptions = sideMembers;
            const assistOptions = sideMembers.filter(
              (p) => String(resolveParticipantUserId(p) || p.id || p.userId) !== String(ev.userId)
            );
            return (
              <li
                key={index}
                className={`relative overflow-hidden rounded-2xl border p-4 shadow-sm ${
                  isDark
                    ? 'border-slate-700/80 bg-slate-900/60 ring-1 ring-white/5'
                    : 'border-slate-200 bg-gradient-to-br from-white to-slate-50'
                }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest ${
                      isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    Goli #{index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeEvent(index)}
                    className="rounded-lg px-2 py-1 text-xs font-bold text-red-500 hover:bg-red-500/10"
                  >
                    Fshi
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Ekipi</label>
                    <select
                      value={side}
                      onChange={(e) => updateEvent(index, { side: e.target.value })}
                      className={fieldClass}
                    >
                      <option value="">Zgjidh ekipin…</option>
                      <option value="home">🏠 Vendas</option>
                      <option value="away">✈️ Mysafir</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Golashënuesi</label>
                    {!side ? (
                      <p className={`mt-1.5 text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                        Zgjidh fillimisht Vendas ose Mysafir.
                      </p>
                    ) : sideMembers.length === 0 ? (
                      <p className={`mt-1.5 text-xs ${isDark ? 'text-amber-300/90' : 'text-amber-700'}`}>
                        Ky klub nuk ka lojtarë të caktuar në skuadrën e turneut.
                      </p>
                    ) : (
                      <ParticipantPickGrid
                        options={scorerOptions}
                        value={ev.userId}
                        onSelect={(userId) => updateEvent(index, { userId, side })}
                      />
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>Minuta</label>
                    <input
                      type="number"
                      min="0"
                      max="130"
                      placeholder="p.sh. 67"
                      value={ev.minute}
                      onChange={(e) => updateEvent(index, { minute: e.target.value })}
                      className={fieldClass}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Asist (opsional)</label>
                    {!side ? (
                      <p className={`mt-1.5 text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                        Zgjidh ekipin për të parë anëtarët.
                      </p>
                    ) : (
                      <ParticipantPickGrid
                        options={assistOptions}
                        value={ev.assistUserId}
                        allowEmpty
                        emptyLabel="Pa asist"
                        onSelect={(assistUserId) => updateEvent(index, { assistUserId })}
                      />
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export { eventsFromMatchData };
