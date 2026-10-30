import { useEffect, useMemo, useState } from 'react';
import API, { clubStaffAPI, extractApiMessage, managedAthletesAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useLocale } from '../contexts/LocaleContext';

const COACHING_ROLES = new Set(['head_coach', 'assistant_coach', 'fitness_coach', 'goalkeeper_coach', 'technical_coach', 'tactical_coach', 'academy_director', 'youth_director']);
const CATEGORIES = ['open', 'senior', 'u23', 'u21', 'u19', 'u17', 'u15', 'u13', 'u11', 'u10', 'u9'];
const TEAM_TYPES = ['first_team', 'youth', 'women', 'men', 'u23', 'u21', 'u19', 'u17', 'u15', 'u13', 'u11', 'u9'];

function isMinorDob(value) {
  if (!value) return false;
  const dob = new Date(`${value}T12:00:00`);
  if (!Number.isFinite(dob.getTime())) return false;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  if (now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())) age -= 1;
  return age < 18;
}

const fieldClass = 'w-full rounded-lg border border-[var(--xt-color-border)] bg-[var(--xt-color-surface-raised)] px-3 py-2.5 text-sm text-[var(--xt-color-text)]';

export default function ManagedAthleteRegistrationForm({ mode = 'club', onSuccess, onCancel }) {
  const { user } = useAuth();
  const { t } = useLocale();
  const [clubs, setClubs] = useState([]);
  const [clubId, setClubId] = useState('');
  const [loadingClubs, setLoadingClubs] = useState(mode !== 'club');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({ firstName: '', lastName: '', dateOfBirth: '', teamType: '', competitionCategory: 'open', squadGroup: '', position: '', jerseyNumber: '', parentEmail: '' });
  const minor = useMemo(() => isMinorDob(form.dateOfBirth), [form.dateOfBirth]);

  useEffect(() => {
    let cancelled = false;
    if (mode === 'club') return undefined;
    setLoadingClubs(true);
    const request = mode === 'admin'
      ? API.get('/admin/ops/clubs', { params: { limit: 100 } }).then((res) => (res.data?.rows || []).filter((club) => club.adminVerified && !club.suspended).map((club) => ({ id: club.id, label: club.name })))
      : clubStaffAPI.getStaffAssignments(user?.id).then((res) => (Array.isArray(res.data) ? res.data : [])
        .filter((assignment) => assignment.status === 'active' && !assignment.leftAt && COACHING_ROLES.has(String(assignment.staffRole || '').toLowerCase()))
        .filter((assignment) => assignment.club?.adminVerified && !assignment.club?.bannedAt && !assignment.club?.deletedAt)
        .filter((assignment) => !assignment.contractUntil || (Number.isFinite(new Date(assignment.contractUntil).getTime()) && new Date(assignment.contractUntil) >= new Date()))
        .map((assignment) => ({ id: assignment.clubId, label: assignment.club?.Profile?.club || [assignment.club?.firstName, assignment.club?.lastName].filter(Boolean).join(' ') || `Klubi #${assignment.clubId}` })));
    request.then((rows) => {
      if (!cancelled) {
        const unique = [...new Map(rows.map((item) => [String(item.id), item])).values()];
        setClubs(unique);
        if (unique.length === 1) setClubId(String(unique[0].id));
      }
    }).catch((err) => { if (!cancelled) setError(extractApiMessage(err, 'Nuk u ngarkuan klubet e autorizuara.')); })
      .finally(() => { if (!cancelled) setLoadingClubs(false); });
    return () => { cancelled = true; };
  }, [mode, user?.id]);

  const setField = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    const payload = {
      firstName: form.firstName,
      lastName: form.lastName,
      dateOfBirth: form.dateOfBirth,
      teamType: form.teamType || undefined,
      competitionCategory: form.competitionCategory,
      squadGroup: form.squadGroup || undefined,
      position: form.position || undefined,
      jerseyNumber: form.jerseyNumber || undefined,
      parentEmail: minor ? form.parentEmail : undefined,
    };
    if (mode !== 'club') payload.clubId = Number(clubId);
    try {
      const result = mode === 'admin'
        ? await managedAthletesAPI.createAsAdmin(payload)
        : await managedAthletesAPI.create(payload);
      setSuccess(result.data?.msg || 'Atleti u regjistrua.');
      setForm({ firstName: '', lastName: '', dateOfBirth: '', teamType: '', competitionCategory: 'open', squadGroup: '', position: '', jerseyNumber: '', parentEmail: '' });
      onSuccess?.(result.data);
    } catch (err) {
      setError(extractApiMessage(err, 'Regjistrimi dështoi.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-[var(--xt-color-border)] bg-[var(--xt-color-surface)] p-4 sm:p-5">
      <div>
        <h2 className="text-lg font-bold text-[var(--xt-color-text)]">{t('Regjistro atlet')}</h2>
        <p className="mt-1 text-sm text-[var(--xt-color-text-muted)]">Llogaria krijohet pa fjalëkalim ose kredenciale hyrjeje.</p>
      </div>
      {mode !== 'club' ? (
        <label className="block space-y-1.5 text-sm font-medium">{t('Klubi')}
          <select className={fieldClass} value={clubId} onChange={(e) => setClubId(e.target.value)} required disabled={loadingClubs || saving}>
            <option value="">{loadingClubs ? t('Duke ngarkuar…') : t('Zgjidh klubin')}</option>
            {clubs.map((club) => <option key={club.id} value={club.id}>{club.label}</option>)}
          </select>
          {!loadingClubs && clubs.length === 0 ? <span className="block text-xs text-amber-700">Nuk u gjet klub i verifikuar ose caktim aktiv si trajner.</span> : null}
        </label>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm font-medium">{t('Emri')}<input className={fieldClass} value={form.firstName} onChange={setField('firstName')} autoComplete="given-name" maxLength={100} required /></label>
        <label className="space-y-1.5 text-sm font-medium">{t('Mbiemri')}<input className={fieldClass} value={form.lastName} onChange={setField('lastName')} autoComplete="family-name" maxLength={100} required /></label>
        <label className="space-y-1.5 text-sm font-medium">{t('Datëlindja')}<input className={fieldClass} type="date" value={form.dateOfBirth} onChange={setField('dateOfBirth')} max={new Date().toISOString().slice(0, 10)} required /></label>
        <label className="space-y-1.5 text-sm font-medium">{t('Ekipi')}
          <select className={fieldClass} value={form.teamType} onChange={setField('teamType')}>
            <option value="">{t('Automatikisht sipas grupmoshës')}</option>
            {TEAM_TYPES.map((team) => <option key={team} value={team}>{t(team.replaceAll('_', ' '))}</option>)}
          </select>
        </label>
        <label className="space-y-1.5 text-sm font-medium">{t('Grupmosha / kategoria e garës')}
          <select className={fieldClass} value={form.competitionCategory} onChange={(e) => setForm((prev) => ({ ...prev, competitionCategory: e.target.value, squadGroup: e.target.value.startsWith('u') ? prev.squadGroup : '' }))}>
            {CATEGORIES.map((category) => <option key={category} value={category}>{category === 'open' ? 'Open' : category.toUpperCase()}</option>)}
          </select>
        </label>
        {form.competitionCategory.startsWith('u') ? (
          <label className="space-y-1.5 text-sm font-medium">{t('Grupi A/B/C')}
            <select className={fieldClass} value={form.squadGroup} onChange={setField('squadGroup')} required>
              <option value="">{t('Zgjidh grupin')}</option><option value="A">A</option><option value="B">B</option><option value="C">C</option>
            </select>
          </label>
        ) : null}
        <label className="space-y-1.5 text-sm font-medium">{t('Pozicioni')}<input className={fieldClass} value={form.position} onChange={setField('position')} maxLength={80} /></label>
        <label className="space-y-1.5 text-sm font-medium">{t('Numri i fanellës')}<input className={fieldClass} type="number" min="1" max="99" value={form.jerseyNumber} onChange={setField('jerseyNumber')} /></label>
        {minor ? <label className="space-y-1.5 text-sm font-medium sm:col-span-2">{t('Kontakti i kujdestarit')}<input className={fieldClass} type="email" autoComplete="email" value={form.parentEmail} onChange={setField('parentEmail')} required /><span className="block text-xs font-normal text-[var(--xt-color-text-muted)]">Emaili i autorizimit dërgohet drejtpërdrejt te kujdestari. Regjistrimi i klubit nuk jep pëlqim prindëror.</span></label> : null}
      </div>
      {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p> : null}
      {success ? <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800" role="status">{success}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary" type="submit" disabled={saving || (mode !== 'club' && !clubId)}>{saving ? t('Duke ruajtur…') : t('Regjistro atlet')}</button>
        {onCancel ? <button className="btn btn-outline" type="button" onClick={onCancel} disabled={saving}>{t('Anulo')}</button> : null}
      </div>
    </form>
  );
}
