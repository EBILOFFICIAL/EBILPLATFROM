const wrap = (title, body) => `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden"><div style="background:#D7141A;color:#fff;padding:16px 24px;font-weight:800;font-size:20px">EIBIL</div><div style="padding:24px;color:#1e293b"><h2 style="margin-top:0">${title}</h2>${body}</div><div style="padding:12px 24px;background:#f8fafc;color:#64748b;font-size:12px">Employment Integrity &amp; Background Intelligence League</div></div>`;

module.exports = ({ name, title, body }) => ({ subject: title, html: wrap(title, `<p>Hi ${name || 'there'},</p><p>${body}</p>`), text: `${title}\n\n${body}` });
module.exports.wrap = wrap;
