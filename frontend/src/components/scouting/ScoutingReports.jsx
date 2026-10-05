import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { scoutingAPI } from '../../services/api';
import { EmptyBlock, ErrorBlock, LoadingBlock } from './ScoutingLayout';
import { apiError } from './scoutingState';

const GROUPS = [
  ['technical', 'Teknike'],
  ['physical', 'Fizike'],
  ['tactical', 'Taktike'],
  ['mental', 'Mendore'],
];

const EMPTY_FORM = {
  playerId: '',
  reportDate: '',
  tournamentId: '',
  matchId: '',
  status: 'draft',
  recommendation: '',
  potentialRating: '',
  strengths: '',
  weaknesses: '',
  potential: '',
  notes: '',
  technical: {},
  physical: {},
  tactical: {},
  mental: {},
  positionSpecific: {},
};

export default function ScoutingReports() {
  const [params] = useSearchParams();
  const [meta, setMeta] = useState(null);
  const [reports, setReports] = useState([]);
  const [form, setForm] = useState({ ...EMPTY_FORM, playerId: params.get('playerId') || '' });
  const [editingId, setEditingId] = useState(null);
  const [criteria, setCriteria] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [metaResponse, reportResponse] = await Promise.all([
        scoutingAPI.getMeta(),
        scoutingAPI.getReports({ limit: 30 }),
      ]);
      setMeta(metaResponse.data);
      setReports(reportResponse.data?.reports || []);
    } catch (err) {
      setError(apiError(err, 'Raportet nuk u ngarkuan.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => load());
  }, [load, reloadKey]);

  useEffect(() => {
    const playerId = params.get('playerId');
    if (!playerId) return undefined;
    let ignore = false;
    scoutingAPI.getPlayer(playerId).then((response) => {
      if (ignore) return;
      setCriteria(response.data?.positionCriteria?.keys || []);
      setForm((current) => ({ ...current, playerId }));
    }).catch(() => {
      if (!ignore) setCriteria(meta?.criteria?.positionSpecific?.other || []);
    });
    return () => { ignore = true; };
  }, [params, meta]);

  const specificKeys = useMemo(() => criteria, [criteria]);

  function setScore(group, key, value) {
    setForm((current) => ({ ...current, [group]: { ...current[group], [key]: value } }));
  }

  function edit(report) {
    setEditingId(report.id);
    setForm({
      playerId: report.playerId,
      reportDate: report.reportDate || '',
      tournamentId: report.tournamentId || '',
      matchId: report.matchId || '',
      status: report.status,
      recommendation: report.recommendation || '',
      potentialRating: report.potentialRating ?? '',
      strengths: report.strengths || '',
      weaknesses: report.weaknesses || '',
      potential: report.potential || '',
      notes: report.notes || '',
      technical: report.technical || {},
      physical: report.physical || {},
      tactical: report.tactical || {},
      mental: report.mental || {},
      positionSpecific: report.positionSpecific || {},
    });
    setCriteria(meta?.criteria?.positionSpecific?.[report.positionGroup] || []);
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const payload = {
      ...form,
      playerId: Number(form.playerId),
      tournamentId: form.tournamentId || null,
      matchId: form.matchId || null,
      potentialRating: form.potentialRating === '' ? null : Number(form.potentialRating),
    };
    try {
      if (editingId) await scoutingAPI.updateReport(editingId, payload);
      else await scoutingAPI.createReport(payload);
      setEditingId(null);
      setForm({ ...EMPTY_FORM });
      setReloadKey((value) => value + 1);
    } catch (err) {
      setError(apiError(err, 'Raporti nuk u ruajt.'));
    } finally {
      setSaving(false);
    }
  }

  async function remove(report) {
    try {
      await scoutingAPI.removeReport(report.id);
      setReloadKey((value) => value + 1);
    } catch (err) {
      setError(apiError(err, 'Fshirja dështoi.'));
    }
  }

  if (loading) return <LoadingBlock />;

  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
      <form className="xt-card space-y-4 p-4" onSubmit={submit}>
        <h2 className="text-xl font-semibold">{editingId ? 'Ndrysho raportin' : 'Raport i ri'}</h2>
        {error ? <ErrorBlock message={error} /> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <label><span className="label">ID e lojtarit</span><input className="input" required value={form.playerId} onChange={(event) => setForm({ ...form, playerId: event.target.value })} /></label>
          <label><span className="label">Data</span><input className="input" type="date" value={form.reportDate} onChange={(event) => setForm({ ...form, reportDate: event.target.value })} /></label>
          <label><span className="label">ID e kompeticionit</span><input className="input" value={form.tournamentId} onChange={(event) => setForm({ ...form, tournamentId: event.target.value })} /></label>
          <label><span className="label">ID e ndeshjes</span><input className="input" value={form.matchId} onChange={(event) => setForm({ ...form, matchId: event.target.value })} /></label>
          <label><span className="label">Statusi</span>
            <select className="select" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
              <option value="draft">Draft</option>
              <option value="completed">I përfunduar</option>
            </select>
          </label>
          <label><span className="label">Rekomandimi</span>
            <select className="select" value={form.recommendation} onChange={(event) => setForm({ ...form, recommendation: event.target.value })}>
              <option value="">—</option>
              {(meta?.recommendationOptions || []).map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label><span className="label">Potenciali (1–10)</span><input className="input" type="number" min="1" max="10" step="0.1" value={form.potentialRating} onChange={(event) => setForm({ ...form, potentialRating: event.target.value })} /></label>
        </div>
        {GROUPS.map(([group, label]) => (
          <fieldset key={group} className="grid gap-2 sm:grid-cols-2">
            <legend className="text-sm font-semibold">{label}</legend>
            {(meta?.criteria?.[group] || []).map((key) => (
              <label key={key}><span className="label">{key}</span>
                <input className="input" type="number" min="1" max="10" step="0.1" value={form[group][key] ?? ''} onChange={(event) => setScore(group, key, event.target.value)} />
              </label>
            ))}
          </fieldset>
        ))}
        {specificKeys.length > 0 ? (
          <fieldset className="grid gap-2 sm:grid-cols-2">
            <legend className="text-sm font-semibold">Sipas pozicionit</legend>
            {specificKeys.map((key) => (
              <label key={key}><span className="label">{key}</span>
                <input className="input" type="number" min="1" max="10" step="0.1" value={form.positionSpecific[key] ?? ''} onChange={(event) => setScore('positionSpecific', key, event.target.value)} />
              </label>
            ))}
          </fieldset>
        ) : null}
        {['strengths', 'weaknesses', 'potential', 'notes'].map((key) => (
          <label key={key}><span className="label">{key}</span>
            <textarea className="input min-h-20" value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />
          </label>
        ))}
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Po ruhet…' : 'Ruaj raportin'}</button>
      </form>
      <section className="space-y-3">
        {reports.length === 0 ? <EmptyBlock title="Nuk ka raporte" text="Raportet e tua mbeten private për skautët e tjerë." /> : reports.map((report) => (
          <article className="xt-card p-4" key={report.id}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold">{report.player?.playerName || `Lojtari ${report.playerId}`}</h3>
                <p className="text-sm text-[var(--xt-color-text-muted)]">{report.status} · {report.reportDate} · {report.recommendation || 'pa rekomandim'}</p>
                <p className="mt-2 text-sm">
                  {report.overallRating == null ? 'Pa mesatare, sepse kriteret janë bosh.' : `Nota e përgjithshme ${Number(report.overallRating).toFixed(1)}`}
                  {report.technicalRating != null ? ` · Teknike ${Number(report.technicalRating).toFixed(1)}` : ''}
                  {report.physicalRating != null ? ` · Fizike ${Number(report.physicalRating).toFixed(1)}` : ''}
                  {report.tacticalRating != null ? ` · Taktike ${Number(report.tacticalRating).toFixed(1)}` : ''}
                  {report.mentalRating != null ? ` · Mendore ${Number(report.mentalRating).toFixed(1)}` : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn btn-outline" onClick={() => edit(report)}>Ndrysho</button>
                <button type="button" className="btn btn-quiet" onClick={() => remove(report)}>Fshi</button>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
