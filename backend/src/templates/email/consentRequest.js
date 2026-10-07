const { wrap } = require('./generic');

module.exports = ({ name, company, code }) => ({
  subject: `${company} requests access to your EIBIL report`,
  html: wrap('Report access request', `<p>Hi ${name}, <b>${company}</b> has requested consent to view your EIBIL report.</p>${code ? `<p>If you agree, share this consent code with them: <b style="font-size:24px;letter-spacing:6px">${code}</b></p>` : ''}<p>You can also approve or deny from your Career Hub &gt; Consent manager.</p>`),
  text: `${company} requests access to your EIBIL report.`,
});
