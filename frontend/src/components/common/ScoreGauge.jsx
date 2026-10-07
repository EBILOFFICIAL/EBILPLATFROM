import { bandColor } from '../../utils/formatters';

const MIN = 300;
const MAX = 950;
const SEGMENTS = [[300, 600, '#EF4444'], [600, 750, '#F59E0B'], [750, 850, '#3B82F6'], [850, 900, '#14B8A6'], [900, 950, '#16A34A']];

const polar = (v, r) => {
  const a = Math.PI * (1 - (v - MIN) / (MAX - MIN));
  return [100 + r * Math.cos(a), 100 - r * Math.sin(a)];
};
const arc = (from, to, r) => {
  const [x1, y1] = polar(from, r);
  const [x2, y2] = polar(to, r);
  return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
};

export default function ScoreGauge({ score, band, size = 260, asOf }) {
  const s = score ?? MIN;
  const [nx, ny] = polar(Math.min(MAX, Math.max(MIN, s)), 62);
  return (
    <div data-testid="score-gauge" className="flex flex-col items-center" style={{ width: size }}>
      <svg viewBox="0 0 200 115" width={size}>
        {SEGMENTS.map(([a, b, c]) => <path key={a} d={arc(a + 1, b - 1, 80)} stroke={c} strokeWidth="14" fill="none" strokeLinecap="round" opacity="0.9" />)}
        <line x1="100" y1="100" x2={nx} y2={ny} stroke="#0F172A" strokeWidth="3.5" strokeLinecap="round" style={{ transition: 'all .8s cubic-bezier(.2,.7,.2,1)' }} />
        <circle cx="100" cy="100" r="6" fill="#0F172A" />
        <text x="18" y="114" fontSize="8" fill="#94A3B8">300</text>
        <text x="168" y="114" fontSize="8" fill="#94A3B8">950</text>
      </svg>
      <div className="-mt-2 text-center">
        <div data-testid="score-value" className="font-display text-5xl font-extrabold tracking-tight" style={{ color: bandColor(score) }}>{score ?? '—'}</div>
        {band && <div data-testid="score-band" className="mt-1 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-700">{band}</div>}
        {asOf && <div className="mt-2 text-[11px] text-slate-400">As of {new Date(asOf).toLocaleString('en-IN')}</div>}
      </div>
    </div>
  );
}
