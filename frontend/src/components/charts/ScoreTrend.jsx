import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function ScoreTrend({ data }) {
  const rows = (data || []).map((d) => ({ ...d, label: new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) }));
  return (
    <div data-testid="score-trend-chart" className="h-56 w-full">
      <ResponsiveContainer>
        <LineChart data={rows} margin={{ top: 10, right: 16, left: -16, bottom: 0 }}>
          <CartesianGrid stroke="#F1F5F9" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
          <YAxis domain={[300, 950]} tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }} />
          <Line type="monotone" dataKey="score" stroke="#D7141A" strokeWidth={2.5} dot={{ r: 3, fill: '#D7141A' }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
