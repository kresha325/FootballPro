import { useEffect, useMemo, useState } from 'react';
import YouTubePlayer from './YouTubePlayer';
import { mediaAPI, extractApiMessage } from '../../services/api';
import {
  MEDIA_CATEGORIES,
  MEDIA_VISIBILITIES,
  parseYouTubeUrl,
} from '../../utils/youtubeVideo';

const emptyForm = {
  title: '',
  description: '',
  youtubeUrl: '',
  category: 'other',
  visibility: 'public',
  season: '',
  featured: false,
};

/**
 * @param {{
 *  open: boolean,
 *  onClose: () => void,
 *  onSaved?: (item: object) => void,
 *  defaults?: { playerId?: number, clubId?: number, matchId?: number, teamId?: number, tournamentId?: number, category?: string, season?: string },
 *  lockFields?: string[],
 * }} props
 */
export default function AddMediaModal({
  open,
  onClose,
  onSaved,
  defaults = {},
  lockFields = [],
}) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setForm({
      ...emptyForm,
      category: defaults.category || (defaults.matchId ? 'match' : 'other'),
      season: defaults.season || '',
    });
    setError('');
  }, [open, defaults.category, defaults.matchId, defaults.season]);

  const preview = useMemo(() => parseYouTubeUrl(form.youtubeUrl), [form.youtubeUrl]);

  if (!open) return null;

  const locked = (key) => lockFields.includes(key);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!preview.ok) {
      setError(preview.error || 'URL e pavlefshme');
      return;
    }
    if (!form.title.trim()) {
      setError('Titulli është i detyrueshëm');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        youtubeUrl: form.youtubeUrl.trim(),
        category: form.category,
        visibility: form.visibility,
        season: form.season.trim() || undefined,
        featured: Boolean(form.featured),
      };
      if (defaults.playerId) payload.playerId = defaults.playerId;
      if (defaults.clubId) payload.clubId = defaults.clubId;
      if (defaults.matchId) payload.matchId = defaults.matchId;
      if (defaults.teamId) payload.teamId = defaults.teamId;
      if (defaults.tournamentId) payload.tournamentId = defaults.tournamentId;

      const { data } = await mediaAPI.create(payload);
      onSaved?.(data);
      onClose?.();
    } catch (err) {
      setError(extractApiMessage(err, 'Nuk u ruajt videoja'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Shto video YouTube"
      onClick={onClose}
    >
      <form
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-[var(--xt-color-surface,#fff)] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={onSubmit}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--xt-color-text,#0f172a)]">Shto video YouTube</h2>
          <button type="button" className="btn btn-quiet min-h-9 px-3" onClick={onClose} aria-label="Mbyll">
            ✕
          </button>
        </div>

        <p className="mb-4 text-xs text-[var(--xt-color-text-muted,#64748b)]">
          Ngarko ndeshjen në YouTube, pastaj ngjit linkun këtu. X TALENTI nuk ruan video 90-minutëshe.
        </p>

        <label className="mb-3 block text-sm font-medium">
          YouTube URL
          <input
            type="url"
            className="mt-1 w-full rounded border border-[var(--xt-color-border,#e2e8f0)] p-2"
            value={form.youtubeUrl}
            onChange={(e) => setForm((f) => ({ ...f, youtubeUrl: e.target.value }))}
            placeholder="https://www.youtube.com/watch?v=…"
            required
          />
        </label>

        {form.youtubeUrl ? (
          <div className="mb-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--xt-color-text-muted,#64748b)]">
              Preview
            </p>
            {preview.ok ? (
              <YouTubePlayer videoId={preview.videoId} title="Preview" />
            ) : (
              <p className="text-sm text-red-500">{preview.error}</p>
            )}
          </div>
        ) : null}

        <label className="mb-3 block text-sm font-medium">
          Titulli
          <input
            type="text"
            className="mt-1 w-full rounded border border-[var(--xt-color-border,#e2e8f0)] p-2"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            required
            maxLength={255}
          />
        </label>

        <label className="mb-3 block text-sm font-medium">
          Përshkrimi
          <textarea
            className="mt-1 w-full rounded border border-[var(--xt-color-border,#e2e8f0)] p-2"
            rows={3}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </label>

        <div className="mb-3 grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium">
            Kategoria
            <select
              className="mt-1 w-full rounded border border-[var(--xt-color-border,#e2e8f0)] p-2"
              value={form.category}
              disabled={locked('category')}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            >
              {MEDIA_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium">
            Visibility
            <select
              className="mt-1 w-full rounded border border-[var(--xt-color-border,#e2e8f0)] p-2"
              value={form.visibility}
              onChange={(e) => setForm((f) => ({ ...f, visibility: e.target.value }))}
            >
              {MEDIA_VISIBILITIES.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="mb-4 flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={Boolean(form.featured)}
            onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))}
          />
          Shfaqe si highlight të veçuar
        </label>

        <label className="mb-4 block text-sm font-medium">
          Sezoni (opsionale)
          <input
            type="text"
            className="mt-1 w-full rounded border border-[var(--xt-color-border,#e2e8f0)] p-2"
            value={form.season}
            onChange={(e) => setForm((f) => ({ ...f, season: e.target.value }))}
            placeholder="p.sh. 2025/26"
          />
        </label>

        {(defaults.playerId || defaults.clubId || defaults.matchId) && (
          <p className="mb-3 text-xs text-[var(--xt-color-text-muted,#64748b)]">
            {defaults.playerId ? `Lojtari #${defaults.playerId}` : ''}
            {defaults.clubId ? ` · Klubi #${defaults.clubId}` : ''}
            {defaults.matchId ? ` · Ndeshja #${defaults.matchId}` : ''}
          </p>
        )}

        {error ? <p className="mb-3 text-sm text-red-500">{error}</p> : null}

        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary flex-1 min-h-11" disabled={saving}>
            {saving ? 'Duke ruajtur…' : 'Ruaj videon'}
          </button>
          <button type="button" className="btn btn-quiet flex-1 min-h-11" onClick={onClose} disabled={saving}>
            Anulo
          </button>
        </div>
      </form>
    </div>
  );
}
