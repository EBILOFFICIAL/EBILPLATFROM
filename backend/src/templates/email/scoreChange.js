const { wrap } = require('./generic');

module.exports = ({ name, oldScore, newScore, delta, reason, link }) => {
  const up = delta > 0;
  const sign = up ? '+' : '';
  const title = `Your EIBIL score ${up ? 'increased' : 'decreased'} by ${Math.abs(delta)} points`;
  const body = `<p>Hi ${name || 'there'},</p><p>A verified event has updated your EIBIL score.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0"><tr>
<td style="padding:12px;background:#f8fafc;border-radius:8px;text-align:center"><div style="font-size:12px;color:#64748b">Previous</div><div style="font-size:24px;font-weight:800">${oldScore}</div></td>
<td style="padding:12px;text-align:center;font-size:20px;font-weight:800;color:${up ? '#059669' : '#D7141A'}">${sign}${delta}</td>
<td style="padding:12px;background:#f8fafc;border-radius:8px;text-align:center"><div style="font-size:12px;color:#64748b">New</div><div style="font-size:24px;font-weight:800">${newScore}</div></td>
</tr></table><p><b>Reason:</b> ${reason}</p><p><a href="${link}" style="color:#D7141A;font-weight:700">See what moved your score</a>. If you believe this is incorrect, you can raise a dispute.</p>`;
  return { subject: title, html: wrap(title, body), text: `${title}\n\n${oldScore} -> ${newScore}\nReason: ${reason}\n${link}` };
};
