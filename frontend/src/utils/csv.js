const NAME_KEYS = ['fullName', 'companyName', 'title', 'name', 'email', 'eibilId', 'code', 'slug'];
const SKIP = /^(__v|passwordHash|snapshot|data|answers|history|notes|options|content|payload)$/;

const cellOf = (v) => {
  if (v == null) return '';
  if (Array.isArray(v)) return v.every((x) => typeof x !== 'object') ? v.join('; ') : `${v.length} items`;
  if (typeof v === 'object') {
    const k = NAME_KEYS.find((n) => v[n] != null);
    return k ? v[k] : JSON.stringify(v);
  }
  return v;
};

export function toCsv(rows) {
  const keys = [];
  rows.forEach((r) => Object.keys(r || {}).forEach((k) => { if (!SKIP.test(k) && !keys.includes(k)) keys.push(k); }));
  const esc = (v) => { const t = String(cellOf(v)); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  return `\uFEFF${[keys.join(','), ...rows.map((r) => keys.map((k) => esc(r[k])).join(','))].join('\n')}`;
}

export function downloadCsv(rows, name = 'export') {
  const url = URL.createObjectURL(new Blob([toCsv(rows || [])], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `${name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv` });
  a.click();
  URL.revokeObjectURL(url);
}

export const inRange = (rows, from, to) => (rows || []).filter((r) => {
  if (!r?.createdAt || (!from && !to)) return true;
  const t = new Date(r.createdAt).getTime();
  return (!from || t >= new Date(from).getTime()) && (!to || t <= new Date(`${to}T23:59:59.999`).getTime());
});
