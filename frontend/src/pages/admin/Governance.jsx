import { useState } from 'react';
import ResourcePage from '../../components/admin/ResourcePage';
import { PageHeader, Panel } from '../../components/common/Layout';
import Table from '../../components/common/Table';
import StatusBadge from '../../components/common/StatusBadge';
import Button from '../../components/common/Button';
import FormModal from '../../components/common/FormModal';
import { JsonEditor } from './Engine';
import { useFetch } from '../../hooks/usePagination';
import { adminService as A } from '../../services/adminService';
import { fmtDateTime, run } from '../../utils/formatters';

export function AdminCms() {
  const { data, reload } = useFetch(() => A.get('/cms'), []);
  const [edit, setEdit] = useState(null);
  return (<div><PageHeader title="CMS" subtitle="Every public page, testimonial, FAQ, stat, logo, legal page and banner is edited here. Changes go live instantly and are audit-logged." actions={<Button onClick={() => setEdit({ slug: prompt('New page slug (e.g. blog-launch)') || '', title: 'New page', type: 'page', content: { heading: '', body: '' }, published: true })} data-testid="new-cms-page">New page</Button>} />
    <Panel><Table rows={data} model="CMSPage" testId="cms-table" columns={[{ title: 'Slug', render: (r) => <span className="font-mono">{r.slug}</span> }, { title: 'Title', key: 'title' }, { title: 'Type', key: 'type' }, { title: 'Updated', render: (r) => fmtDateTime(r.updatedAt) }, { title: 'Published', render: (r) => <StatusBadge status={r.published ? 'published' : 'draft'} /> }, { title: '', render: (r) => <Button size="sm" variant="secondary" onClick={() => setEdit(r)} data-testid={`edit-cms-${r.slug}`}>Edit</Button> }]} /></Panel>
    {edit && <JsonEditor open onClose={() => setEdit(null)} title={`Edit /${edit.slug}`} testId="cms-editor" value={{ title: edit.title, type: edit.type, published: edit.published, seo: edit.seo, content: edit.content }} onSave={(v) => run(A.put(`/cms/${edit.slug}`, v)).then(reload)} />}
  </div>);
}

export function AdminRoles() {
  const { data, reload } = useFetch(() => A.get('/roles'), []);
  const [newAdmin, setNewAdmin] = useState(false);
  const toggle = (role, perm) => run(A.put(`/roles/${role._id}`, { permissions: role.permissions.includes(perm) ? role.permissions.filter((p) => p !== perm) : [...role.permissions, perm] }), 'Permissions updated').then(reload);
  return (<div><PageHeader title="Roles & permissions" subtitle="Permission matrix is stored in the database. Super Admin has all permissions. Admin 2FA is mandatory." actions={<><Button variant="secondary" onClick={() => { const name = prompt('Role name'); if (name) run(A.post('/roles', { name, permissions: ['dashboard.view'] })).then(reload); }} data-testid="new-role">New role</Button><Button onClick={() => setNewAdmin(true)} data-testid="new-admin">New admin</Button></>} />
    <Panel className="mb-6"><div className="overflow-x-auto"><table className="table-base"><thead><tr><th>Permission</th>{data?.roles.map((r) => <th key={r._id}>{r.name}</th>)}</tr></thead><tbody>{data?.permissions.map((p) => <tr key={p}><td className="font-mono text-xs">{p}</td>{data.roles.map((r) => <td key={r._id}><input type="checkbox" data-testid={`perm-${r.name}-${p}`} className="accent-[#D7141A]" checked={r.permissions.includes('*') || r.permissions.includes(p)} disabled={r.permissions.includes('*')} onChange={() => toggle(r, p)} /></td>)}</tr>)}</tbody></table></div></Panel>
    <Panel title="Admins"><Table rows={data?.admins} model="User" testId="admins-table" columns={[{ title: 'Name', key: 'name' }, { title: 'Email', key: 'email' }, { title: 'Role', render: (u) => <select className="input py-1" value={u.adminRoleId || ''} onChange={(e) => run(A.put(`/admins/${u._id}/role`, { adminRoleId: e.target.value })).then(reload)}>{data.roles.map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}</select> }, { title: 'Last login', render: (u) => fmtDateTime(u.lastLogin) }]} /></Panel>
    <FormModal open={newAdmin} onClose={() => setNewAdmin(false)} title="Create admin" fields={[{ name: 'name', label: 'Name', required: true }, { name: 'email', label: 'Email', type: 'email', required: true }, { name: 'password', label: 'Temporary password', type: 'password', required: true }, { name: 'adminRoleId', label: 'Role', type: 'select', required: true, options: (data?.roles || []).map((r) => ({ value: r._id, label: r.name })) }]} onSubmit={(f) => run(A.post('/users/admins', f)).then(reload)} />
  </div>);
}

export function AdminAudit() {
  const [ledger, setLedger] = useState(null);
  return (<ResourcePage title="Audit & compliance" subtitle="Immutable audit log of every admin and sensitive action. Verify the SHA-256 hash-chained ledger on demand." path="/audit-logs" testId="audit-table" actions={() => <Button onClick={async () => setLedger((await run(A.get('/ledger/verify'), 'Integrity check complete')))} data-testid="verify-ledger">Verify ledger integrity</Button>}
    columns={() => [{ title: 'When', render: (r) => fmtDateTime(r.createdAt) }, { title: 'Actor', render: (r) => r.actorId?.email || 'system' }, { title: 'Action', render: (r) => <span className="font-mono text-xs">{r.action}</span> }, { title: 'Entity', render: (r) => `${r.entityType || ''} ${r.entityId || ''}` }, { title: 'IP', key: 'ip' }]}>
    {() => ledger && <div data-testid="ledger-result" className={`card mb-6 p-5 ${ledger.valid ? 'ring-2 ring-emerald-200' : 'ring-2 ring-red-300'}`}><b>{ledger.valid ? 'Ledger valid' : 'Ledger BROKEN'}</b> · {ledger.entries} entries · head <span className="font-mono text-xs">{ledger.headHash?.slice(0, 24)}…</span>{ledger.breaks.map((b) => <div key={b.seq} className="text-sm text-brand">#{b.seq}: {b.reason}</div>)}</div>}
  </ResourcePage>);
}

export function AdminSettings() {
  const { data, reload } = useFetch(() => A.get('/settings'), []);
  const { data: health } = useFetch(() => A.get('/health'), []);
  const save = (k, raw) => { let v = raw; try { v = JSON.parse(raw); } catch { /* keep string */ } return run(A.put(`/settings/${k}`, { value: v })).then(reload); };
  return (<div><PageHeader title="System settings" subtitle="Feature flags, consent mode, review windows, maintenance mode and announcement banner. Section 16 open decisions use the recommended defaults and are configurable here." />
    {health && <Panel title="Health & providers" className="mb-6"><div className="flex flex-wrap gap-3 p-5 text-sm">Mongo <StatusBadge status={health.mongo === 'up' ? 'active' : 'failed'}>{health.mongo}</StatusBadge> Queue <b>{health.queueMode}</b> · uptime {health.uptimeSec}s · {Object.entries(health.providers).map(([k, v]) => <StatusBadge key={k} status={v === 'mock' ? 'pending' : 'active'}>{k}: {v}</StatusBadge>)}</div></Panel>}
    <Panel><Table rows={data} model="Setting" testId="settings-table" columns={[{ title: 'Key', render: (r) => <div><span className="font-mono text-xs font-bold">{r.key}</span><div className="text-xs text-slate-400">{r.description}</div></div> }, { title: 'Group', key: 'group' }, { title: 'Value', render: (r) => <input data-testid={`setting-${r.key}`} className="input py-1.5 font-mono text-xs" defaultValue={typeof r.value === 'string' ? r.value : JSON.stringify(r.value)} onBlur={(e) => e.target.value !== (typeof r.value === 'string' ? r.value : JSON.stringify(r.value)) && save(r.key, e.target.value)} /> }]} /></Panel>
    <p className="mt-3 text-xs text-slate-400">Score-related windows (review window 7d, exit submission 15d, no-show dispute window, decay 36 months) live in the versioned Score Engine config.</p></div>);
}

export function AdminTickets() {
  const [reply, setReply] = useState(null);
  return (<><ResourcePage title="Support tickets" path="/tickets" testId="admin-tickets" filters={[{ name: 'f_status', label: 'Status', options: ['open', 'pending', 'resolved', 'closed'] }]} columns={(reload) => [{ title: 'Ticket', key: 'ticketNo' }, { title: 'Subject', render: (r) => <div><b>{r.subject}</b><div className="text-xs text-slate-400">{r.messages?.[r.messages.length - 1]?.text}</div></div> }, { title: 'From', key: 'email' }, { title: 'Status', render: (r) => <StatusBadge status={r.status} /> }, { title: 'SLA', render: (r) => fmtDateTime(r.slaDueAt) }, { title: '', render: (r) => <Button size="sm" variant="secondary" onClick={() => setReply({ id: r._id, reload })}>Reply</Button> }]} />
    <FormModal open={Boolean(reply)} onClose={() => setReply(null)} title="Reply / internal note" fields={[{ name: 'text', label: 'Message', type: 'textarea', required: true }, { name: 'status', label: 'Set status', type: 'select', options: ['open', 'pending', 'resolved', 'closed'] }, { name: 'internal', label: 'Internal note (not visible to user)', type: 'checkbox' }]} onSubmit={(f) => run(A.post(`/tickets/${reply.id}/reply`, f)).then(reply.reload)} /></>);
}

export function AdminBroadcasts() {
  const [open, setOpen] = useState(false);
  return (<><ResourcePage title="Communications" subtitle="Broadcast in-app notifications (and email) by segment." path="/broadcasts" testId="admin-broadcasts" search={false} actions={() => <Button onClick={() => setOpen(true)} data-testid="new-broadcast">New broadcast</Button>} columns={() => [{ title: 'Sent', render: (r) => fmtDateTime(r.createdAt) }, { title: 'Segment', key: 'segment' }, { title: 'Title', key: 'title' }, { title: 'Delivered', key: 'delivered' }]} />
    <FormModal open={open} onClose={() => setOpen(false)} title="New broadcast" testId="broadcast-modal" fields={[{ name: 'segment', label: 'Segment', type: 'select', required: true, options: ['all', 'employees', 'employers', 'admins'] }, { name: 'title', label: 'Title', required: true }, { name: 'body', label: 'Message', type: 'textarea', required: true }, { name: 'sendEmail', label: 'Also send email', type: 'checkbox' }]} onSubmit={(f) => run(A.post('/broadcasts', f))} /></>);
}
