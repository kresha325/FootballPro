import { useState } from 'react';
import api from '../../services/api';
import { apiError, displayMetric } from './opsFormat';

const TONE = {
  ONLINE: 'bg-emerald-100 text-emerald-800',
  DEGRADED: 'bg-amber-100 text-amber-900',
  ERROR: 'bg-red-100 text-red-800',
  UNKNOWN: 'bg-gray-100 text-gray-600',
  CRITICAL: 'bg-red-100 text-red-800',
  HIGH: 'bg-orange-100 text-orange-900',
  MEDIUM: 'bg-amber-100 text-amber-900',
  LOW: 'bg-sky-100 text-sky-800',
  'NOT CONNECTED': 'bg-gray-100 text-gray-700',
};

export function Pill({ value }) {
  const label = value || 'UNKNOWN';
  return (
    <span className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ${TONE[label] || TONE.UNKNOWN}`}>
      {label}
    </span>
  );
}

export function Metric({ label, value }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{displayMetric(value)}</p>
    </div>
  );
}

export function DangerConfirm({ open, title, warning, busy, fields = [], onCancel, onConfirm }) {
  if (!open) return null;
  return (
    <DangerForm
      title={title}
      warning={warning}
      busy={busy}
      fields={fields}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}

function DangerForm({ title, warning, busy, fields, onCancel, onConfirm }) {
  const [reason, setReason] = useState('');
  const [extra, setExtra] = useState({});
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl"
        onSubmit={(event) => {
          event.preventDefault();
          if (reason.trim().length < 3) return;
          onConfirm(reason.trim(), extra);
        }}
      >
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <p className="mt-2 text-sm text-gray-600">{warning}</p>
        {fields.map((field) => (
          <label key={field.name} className="mt-3 block text-sm text-gray-700">
            {field.label}
            <input
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
              type={field.type || 'text'}
              required={field.required}
              value={extra[field.name] || ''}
              onChange={(event) => setExtra((prev) => ({ ...prev, [field.name]: event.target.value }))}
            />
          </label>
        ))}
        <label className="mt-3 block text-sm text-gray-700">
          Reason
          <textarea
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
            minLength={3}
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="rounded border px-3 py-2 text-sm" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="submit"
            className="rounded bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={busy || reason.trim().length < 3}
          >
            {busy ? 'Working…' : 'Confirm'}
          </button>
        </div>
      </form>
    </div>
  );
}

export function ExportButton({ kind, label = 'Export CSV' }) {
  const [message, setMessage] = useState('');
  return (
    <button
      type="button"
      className="rounded border px-3 py-2 text-sm"
      onClick={async () => {
        try {
          const res = await api.get(`/admin/ops/export/${kind}`, { responseType: 'blob' });
          const url = URL.createObjectURL(res.data);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${kind}.csv`;
          link.click();
          URL.revokeObjectURL(url);
          setMessage('');
        } catch (error) {
          setMessage(apiError(error, 'Export failed'));
        }
      }}
    >
      {message || label}
    </button>
  );
}

export function Pager({ page = 1, pages = 1, onPage }) {
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
      <span>Page {page} of {pages || 1}</span>
      <div className="flex gap-2">
        <button type="button" className="rounded border px-3 py-1 disabled:opacity-40" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
        <button type="button" className="rounded border px-3 py-1 disabled:opacity-40" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </div>
  );
}
