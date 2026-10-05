import { useEffect, useState } from 'react';
import { notificationsAPI } from '../services/api';

const LABELS = {
  SOCIAL: 'Shoqërore',
  FOOTBALL: 'Futboll',
  SCOUTING: 'Skautim',
  VIDEO: 'Video',
  MARKETPLACE: 'Tregu',
  WALLET: 'Wallet',
  SYSTEM: 'Sistem',
};

export default function NotificationPreferences() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    notificationsAPI.getPreferences()
      .then((res) => {
        if (!cancelled) setRows(res.data?.preferences || []);
      })
      .catch(() => {
        if (!cancelled) setError('Preferencat e njoftimeve nuk u ngarkuan.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = async (category, channel) => {
    const next = rows.map((row) => (
      row.category === category ? { ...row, [channel]: !row[channel] } : row
    ));
    setRows(next);
    setSaving(true);
    setError('');
    try {
      const res = await notificationsAPI.updatePreferences(next);
      setRows(res.data?.preferences || next);
    } catch (_err) {
      setError('Nuk u ruajtën preferencat.');
    } finally {
      setSaving(false);
    }
  };

  if (!rows.length && !error) {
    return <p className="text-sm text-[var(--xt-color-text-muted)]">Po ngarkohen preferencat…</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--xt-color-text-muted)]">
        Njoftimet e sigurisë (fjalëkalimi dhe verifikimi) mbeten të aktivizuara edhe nëse sistemi fiket.
      </p>
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
      {rows.map((row) => (
        <div key={row.category} className="rounded-lg border border-[var(--xt-color-border)] p-3">
          <p className="mb-2 font-semibold">{LABELS[row.category] || row.category}</p>
          <div className="flex flex-wrap gap-3 text-sm">
            {['inApp', 'push', 'email'].map((channel) => (
              <label key={channel} className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={channel === 'inApp' ? row.inApp : channel === 'push' ? row.push : row.email}
                  disabled={saving}
                  onChange={() => toggle(row.category, channel)}
                />
                {channel === 'inApp' ? 'Në app' : channel === 'push' ? 'Push' : 'Email'}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
