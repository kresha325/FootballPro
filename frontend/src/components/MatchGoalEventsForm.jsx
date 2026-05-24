import { useEffect, useMemo, useState } from 'react';

function participantName(p) {
  return [p?.firstName, p?.lastName].filter(Boolean).join(' ').trim() || `User #${p?.id}`;
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

export default function MatchGoalEventsForm({
  participants = [],
  homeUserId,
  awayUserId,
  initialEvents = [],
  onChange,
}) {
  const [events, setEvents] = useState(initialEvents.length ? initialEvents : []);

  const options = useMemo(() => participants.filter(Boolean), [participants]);

  useEffect(() => {
    setEvents(initialEvents.length ? initialEvents : []);
  }, [initialEvents]);

  const emit = (next) => {
    setEvents(next);
    onChange?.(next);
  };

  const addEvent = () => {
    emit([
      ...events,
      {
        userId: '',
        minute: '',
        assistUserId: '',
        side: '',
      },
    ]);
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-bold text-gray-900 dark:text-white">Golat & asistet (minuta)</h4>
        <button
          type="button"
          onClick={addEvent}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
        >
          + Shto gol
        </button>
      </div>

      {events.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 px-3 py-4 text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
          Shto çdo gol me golashënuesin, minutën dhe asistin (opsional).
        </p>
      ) : (
        <ul className="space-y-2">
          {events.map((ev, index) => (
            <li
              key={index}
              className="grid grid-cols-1 gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-900/40 sm:grid-cols-[1fr_80px_1fr_100px_auto]"
            >
              <select
                value={ev.userId}
                onChange={(e) => {
                  const userId = e.target.value;
                  updateEvent(index, { userId, side: inferSide(userId) || ev.side });
                }}
                className="rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800"
              >
                <option value="">Golashënuesi</option>
                {options.map((p) => (
                  <option key={p.id} value={p.id}>
                    {participantName(p)}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                max="130"
                placeholder="Min"
                value={ev.minute}
                onChange={(e) => updateEvent(index, { minute: e.target.value })}
                className="rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800"
              />
              <select
                value={ev.assistUserId}
                onChange={(e) => updateEvent(index, { assistUserId: e.target.value })}
                className="rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800"
              >
                <option value="">Asist (opsional)</option>
                {options.map((p) => (
                  <option key={`assist-${p.id}`} value={p.id}>
                    {participantName(p)}
                  </option>
                ))}
              </select>
              <select
                value={ev.side || inferSide(ev.userId)}
                onChange={(e) => updateEvent(index, { side: e.target.value })}
                className="rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800"
              >
                <option value="">Ekipi</option>
                <option value="home">Vendas</option>
                <option value="away">Mysafir</option>
              </select>
              <button
                type="button"
                onClick={() => removeEvent(index)}
                className="rounded bg-red-100 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300"
              >
                Fshi
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export { eventsFromMatchData, participantName };
