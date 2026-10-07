import { useState } from 'react';
import { PageHeader, Panel } from '../../../components/common/Layout';
import StatusBadge from '../../../components/common/StatusBadge';
import Button from '../../../components/common/Button';
import FormModal from '../../../components/common/FormModal';
import { useFetch } from '../../../hooks/usePagination';
import { employeeService } from '../../../services/employeeService';
import { fmtDate, label, run } from '../../../utils/formatters';
import { REASON_CATEGORIES } from '../../../constants';

function CaseCard({ c, reload }) {
  const [respond, setRespond] = useState(null);
  const a = c.assessment;
  return (
    <div data-testid={`separation-case-${c._id}`} className="card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><b className="text-ink">{c.employerId?.companyName}</b> <span className="text-sm text-slate-500">· {label(c.separationType)} · LWD {fmtDate(c.lastWorkingDay)}</span></div>
        <StatusBadge status={c.status} />
      </div>
      {a?.submittedAt && (
        <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-4">
          <div>Notice: <b>{a.noticeServedDays}/{a.noticeRequiredDays}d</b></div><div>Buyout: <b>{label(a.buyoutStatus)}</b></div><div>Handover: <b>{label(a.handoverStatus)}</b></div><div>Rehire: <b>{label(a.rehireEligibility)}</b></div>
          {a.comment && <div className="sm:col-span-4 text-slate-600">“{a.comment}”</div>}
        </div>
      )}
      {c.rebuttals?.map((r) => <div key={r._id} className="mt-3 rounded-xl border-l-4 border-brand bg-brand-light/50 p-3 text-sm text-slate-700"><b>Your rebuttal:</b> {r.statement}</div>)}
      <div className="mt-4 flex flex-wrap gap-2">
        {c.status === 'awaiting_confirmation' && c.initiatedBy === 'employer' && <Button size="sm" onClick={() => run(employeeService.confirmSeparation(c._id, { agree: true })).then(reload)} data-testid="confirm-separation">Confirm dates</Button>}
        {['review_window', 'admin_review', 'published'].includes(c.status) && (<>
          {c.status === 'review_window' && <Button size="sm" onClick={() => run(employeeService.respondSeparation(c._id, { action: 'accept' })).then(reload)} data-testid="accept-assessment">Accept</Button>}
          <Button size="sm" variant="secondary" onClick={() => setRespond('rebut')} data-testid="rebut-assessment">Add rebuttal</Button>
          <Button size="sm" variant="secondary" onClick={() => setRespond('dispute')} data-testid="dispute-assessment">Dispute</Button>
        </>)}
        {c.status === 'review_window' && <span className="self-center text-xs text-slate-400">Review window ends {fmtDate(c.reviewWindowEndsAt)}</span>}
      </div>
      <FormModal open={Boolean(respond)} onClose={() => setRespond(null)} title={respond === 'rebut' ? 'Written rebuttal (always shown beside the assessment)' : 'Dispute exit assessment'} testId="separation-respond-modal" fields={[{ name: 'statement', label: 'Statement', type: 'textarea', required: true }]} onSubmit={(f) => run(employeeService.respondSeparation(c._id, { action: respond, statement: f.statement })).then(reload)} />
    </div>
  );
}

export default function Exit() {
  const { data, reload } = useFetch(() => employeeService.separations(), []);
  const { data: emps } = useFetch(() => employeeService.employments(), []);
  const [open, setOpen] = useState(false);
  const current = (emps || []).filter((e) => e.status === 'verified' && e.isCurrent);
  return (<div>
    <PageHeader title="Resignation & exit" subtitle="Log a resignation; your employer confirms and submits an exit assessment. You get a review window to accept, rebut or dispute before it is published." actions={<Button onClick={() => setOpen(true)} disabled={!current.length} data-testid="log-resignation">Log resignation</Button>} />
    <div className="space-y-4">{(data || []).map((c) => <CaseCard key={c._id} c={c} reload={reload} />)}{!data?.length && <Panel><p className="p-10 text-center text-sm text-slate-400">No separation cases.</p></Panel>}</div>
    <FormModal open={open} onClose={() => setOpen(false)} title="Log resignation" testId="resignation-modal" fields={[
      { name: 'employmentRecordId', label: 'Employment', type: 'select', required: true, options: current.map((e) => ({ value: e._id, label: `${e.employerId?.companyName || e.companyName} – ${e.designation}` })) },
      { name: 'reasonCategory', label: 'Reason', type: 'select', required: true, options: REASON_CATEGORIES },
      { name: 'resignationDate', label: 'Resignation date', type: 'date', required: true }, { name: 'lastWorkingDay', label: 'Last working day', type: 'date', required: true },
    ]} onSubmit={(f) => run(employeeService.logResignation({ ...f, separationType: 'resignation' })).then(reload)} />
  </div>);
}
