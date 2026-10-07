import { useState } from 'react';
import { PageHeader, Panel } from '../../../components/common/Layout';
import Table from '../../../components/common/Table';
import StatusBadge from '../../../components/common/StatusBadge';
import Button from '../../../components/common/Button';
import FormModal from '../../../components/common/FormModal';
import { useFetch } from '../../../hooks/usePagination';
import { employerService } from '../../../services/employerService';
import { fmtDate, run } from '../../../utils/formatters';

const QUESTIONS = ['Employment dates', 'Notice period served', 'Overall performance', 'Eligible for rehire', 'Conduct'];

export default function References() {
  const { data, reload } = useFetch(() => employerService.references(), []);
  const { data: consents } = useFetch(() => employerService.consents(), []);
  const [open, setOpen] = useState(false);
  const [respond, setRespond] = useState(null);
  const [view, setView] = useState(null);
  const granted = (consents || []).filter((c) => c.status === 'granted');
  return (<div><PageHeader title="Reference checks" subtitle="With candidate consent, request a reference from a previous employer. If a sealed exit assessment exists, the answer is served instantly." actions={<Button onClick={() => setOpen(true)} data-testid="new-reference">New request</Button>} />
    <Panel title="Outgoing" className="mb-6"><Table rows={data?.outgoing} testId="outgoing-references" columns={[{ title: 'Candidate', render: (r) => r.employeeId?.fullName }, { title: 'Previous employer', render: (r) => r.previousEmployerId?.companyName }, { title: 'Due', render: (r) => fmtDate(r.dueAt) }, { title: 'Status', render: (r) => <StatusBadge status={r.status}>{r.autoFilled ? 'Instant (sealed record)' : undefined}</StatusBadge> }, { title: '', render: (r) => r.response && <Button size="sm" variant="secondary" onClick={() => setView(r)}>View</Button> }]} /></Panel>
    <Panel title="Incoming (you are the previous employer)"><Table rows={data?.incoming} testId="incoming-references" columns={[{ title: 'Requester', render: (r) => r.requesterEmployerId?.companyName }, { title: 'Candidate', render: (r) => r.employeeId?.fullName }, { title: 'Due', render: (r) => fmtDate(r.dueAt) }, { title: 'Status', render: (r) => <StatusBadge status={r.status} /> }, { title: '', render: (r) => r.status !== 'completed' && <Button size="sm" onClick={() => setRespond(r)} data-testid={`respond-ref-${r._id}`}>Respond</Button> }]} /></Panel>
    <FormModal open={open} onClose={() => setOpen(false)} title="Reference request" testId="reference-modal" fields={[{ name: 'employeeId', label: 'Consented candidate', type: 'select', required: true, options: granted.map((c) => ({ value: c.employeeId?._id, label: c.employeeId?.fullName })) }, { name: 'previousEmployerId', label: 'Previous employer ID (from candidate report)', required: true }]} onSubmit={(f) => run(employerService.createReference(f)).then(reload)} />
    <FormModal open={Boolean(respond)} onClose={() => setRespond(null)} title="Reference questionnaire" testId="reference-respond-modal" fields={QUESTIONS.map((q) => ({ name: q, label: q, required: true }))} onSubmit={(f) => run(employerService.respondReference(respond._id, f)).then(reload)} />
    {view && <FormModal open onClose={() => setView(null)} title="Reference response" fields={[]} onSubmit={async () => {}} submitLabel="Close"><dl className="space-y-2 text-sm">{Object.entries(view.response).map(([k, v]) => <div key={k} className="flex justify-between gap-4"><dt className="text-slate-500">{k}</dt><dd className="font-semibold text-ink">{v}</dd></div>)}</dl></FormModal>}
  </div>);
}
