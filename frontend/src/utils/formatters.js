import { toast } from 'sonner';
import { errorMessage } from '../services/api';

export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
export const fmtInr = (n) => (n == null ? '—' : `₹${Number(n).toLocaleString('en-IN')}`);
export const label = (s) => String(s ?? '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
export const toInputDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

export async function run(promise, success) {
  try {
    const r = await promise;
    toast.success(success || r?.message || 'Done');
    return r;
  } catch (e) {
    toast.error(errorMessage(e));
    throw e;
  }
}

export const bandColor = (score) => {
  if (score == null) return '#94A3B8';
  if (score >= 900) return '#15803D';
  if (score >= 850) return '#0D9488';
  if (score >= 750) return '#2563EB';
  if (score >= 600) return '#D97706';
  return '#DC2626';
};
