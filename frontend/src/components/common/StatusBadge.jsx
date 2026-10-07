import { label } from '../../utils/formatters';

const TONES = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  blue: 'bg-blue-50 text-blue-700 ring-blue-200',
  slate: 'bg-slate-100 text-slate-600 ring-slate-200',
};
const MAP = {
  green: ['verified', 'approved', 'accepted', 'active', 'granted', 'paid', 'completed', 'published', 'joined', 'hired', 'resolved', 'resolved_employee', 'yes', 'pass'],
  red: ['rejected', 'banned', 'suspended', 'denied', 'withdrawn', 'no_show', 'failed', 'removed', 'invalid', 'critical', 'high', 'taken_down', 'date_conflict', 'not_submitted', 'no'],
  amber: ['pending', 'pending_review', 'held', 'disputed', 'open', 'issued', 'declared', 'pending_employee', 'under_review', 'review_window', 'admin_review', 'awaiting_confirmation', 'pending_approval', 'medium', 'overdue', 'draft', 'conditional'],
  blue: ['submitted', 'notice_running', 'assessment_pending', 'shortlisted', 'interview', 'offer', 'investigating', 'running', 'modified'],
};
const toneFor = (s) => Object.keys(MAP).find((k) => MAP[k].includes(String(s))) || 'slate';

export default function StatusBadge({ status, tone, children }) {
  return (
    <span data-testid={`status-${status}`} className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${TONES[tone || toneFor(status)]}`}>
      {children || label(status)}
    </span>
  );
}
