import { useEffect, useMemo, useState } from 'react';
import { resolveParticipantUserId } from '../utils/tournamentParticipants';

function participantName(p) {
  const uid = resolveParticipantUserId(p);
  const name = [p?.firstName, p?.lastName].filter(Boolean).join(' ').trim();
  return name || (uid ? `User #${uid}` : 'User');
}

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

const fieldClass =
  'w-full rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-600 dark:bg-slate-800/90 dark:text-white';

export default function MatchGoalEventsForm({
  participants = [],
  homeUserId,
  awayUserId,
  initialEvents = [],
  onChange,
  variant = 'light',
}) {
  const [events, setEvents] = useState(initialEvents.length ? initialEvents : []);
  const options = useMemo(() => participants.filter(Boolean), [participants]);
  const isDark = variant === 'dark';

  useEffect(() => {
    setEvents(initialEvents.length ? initialEvents : []);
  }, [initialEvents]);

  const emit = (next) => {
    setEvents(next);
    onChange?.(next);
  };

  const addEvent = () => {
    emit([...events, { userId: '', minute: '', assistUserId: '', side: '' }]);
  };

  const updateEvent = (index, patch) => {
    emit(events.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const removeEvent = (index) => {
    emit(events.filter((_, i) => i !== index));
  };

  const inferSide = (userId) => {
    if (String(userId) === String(homeUserId)) return 'home';
    if (String(userId) === String(awayUserId)) return 'away';
    return '';
  };

  const labelClass = isDark
    ? 'text-[10px] font-bold uppercase tracking-wider text-slate-400'
    : 'text-[10px] font-bold uppercase tracking-wider text-slate-500';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className={`text-sm font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>⚽ Golat & asistet</p>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Regjistro çdo gol me minutë dhe asist</p>
        </div>
        <button
          type="button"
          onClick={addEvent}
          className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:brightness-110"
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
          {events.map((ev, index) => (
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
                  <label className={labelClass}>Golashënuesi</label>
                  <select
                    value={ev.userId}
                    onChange={(e) => {
                      const userId = e.target.value;
                      updateEvent(index, { userId, side: inferSide(userId) || ev.side });
                    }}
                    className={fieldClass}
                  >
                    <option value="">Zgjidh lojtarin</option>
                    {options.map((p) => {
                      const uid = resolveParticipantUserId(p);
                      if (!uid) return null;
                      return (
                        <option key={uid} value={uid}>
                          {participantName(p)}
                        </option>
                      );
                    })}
                  </select>
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
                <div>
                  <label className={labelClass}>Ekipi</label>
                  <select
                    value={ev.side || inferSide(ev.userId)}
                    onChange={(e) => updateEvent(index, { side: e.target.value })}
                    className={fieldClass}
                  >
                    <option value="">Auto</option>
                    <option value="home">🏠 Vendas</option>
                    <option value="away">✈️ Mysafir</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>Asist (opsional)</label>
                  <select
                    value={ev.assistUserId}
                    onChange={(e) => updateEvent(index, { assistUserId: e.target.value })}
                    className={fieldClass}
                  >
                    <option value="">Pa asist</option>
                    {options.map((p) => {
                      const uid = resolveParticipantUserId(p);
                      if (!uid) return null;
                      return (
                        <option key={`assist-${uid}`} value={uid}>
                          {participantName(p)}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export { eventsFromMatchData, participantName };
