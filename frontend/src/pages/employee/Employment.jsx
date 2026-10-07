import { useState } from 'react';
import { Plus } from 'lucide-react';
import { PageHeader, Panel } from '../../components/common/Layout';
import Table from '../../components/common/Table';
import StatusBadge from '../../components/common/StatusBadge';
import Button from '../../components/common/Button';
import FormModal from '../../components/common/FormModal';
import { DisputeButton } from './Records';
import { useFetch } from '../../hooks/usePagination';
import { employeeService } from '../../services/employeeService';
import { fmtDate, run } from '../../utils/formatters';

export default function Employment() {
  const { data, loading, reload } = useFetch(() => employeeService.employments(), []);
  const { data: employers } = useFetch(() => employeeService.employers(), []);
  const [open, setOpen] = useState(false);
  const fields = [
    { name: 'employerId', label: 'Employer on EIBIL (optional)', type: 'select', options: (employers || []).map((e) => ({ value: e._id, label: e.companyName })) },
    { name: 'companyName', label: 'Company name (if not listed)' }, { name: 'designation', label: 'Designation', required: true }, { name: 'department', label: 'Department' },
    { name: 'startDate', label: 'Start date', type: 'date', required: true }, { name: 'endDate', label: 'End date (blank if current)', type: 'date' },
  ];
  const submit = (f) => run(employeeService.addEmployment({ ...f, employerId: f.employerId || null, endDate: f.endDate || null, companyName: f.companyName || undefined })).then(reload);
  return (<div>
    <PageHeader title="Employment history" subtitle="Verified records are sealed with the employer's signature hash and cannot be edited. Corrections go through disputes." actions={<Button onClick={() => setOpen(true)} data-testid="declare-employment"><Plus className="h-4 w-4" />Declare employment</Button>} />
    <Panel><Table loading={loading} rows={data} testId="employment-table" columns={[
      { title: 'Company', render: (r) => <b className="text-ink">{r.employerId?.companyName || r.companyName}</b> }, { title: 'Designation', key: 'designation' },
      { title: 'Period', render: (r) => `${fmtDate(r.startDate)} – ${r.endDate ? fmtDate(r.endDate) : 'Present'}` }, { title: 'Status', render: (r) => <StatusBadge status={r.status} /> },
      { title: 'Seal', render: (r) => r.signatureHash ? <span className="font-mono text-[11px] text-slate-400">{r.signatureHash.slice(0, 12)}…</span> : '—' },
      { title: '', render: (r) => (<div className="flex gap-2">
        {r.status === 'pending_employee' && <><Button size="sm" onClick={() => run(employeeService.confirmEmployment(r._id, true)).then(reload)} data-testid={`confirm-employment-${r._id}`}>Confirm</Button><Button size="sm" variant="secondary" onClick={() => run(employeeService.confirmEmployment(r._id, false)).then(reload)}>Reject</Button></>}
        {r.status === 'declared' && <Button size="sm" variant="ghost" onClick={() => run(employeeService.removeEmployment(r._id)).then(reload)}>Remove</Button>}
        {r.status === 'verified' && <DisputeButton targetType="employment" targetId={r._id} onDone={reload} />}
      </div>) },
    ]} /></Panel>
    <FormModal open={open} onClose={() => setOpen(false)} title="Declare employment" fields={fields} onSubmit={submit} testId="employment-modal" />
  </div>);
}
