const { wrap } = require('./generic');

const LABELS = { email_verify: 'verify your email', login_2fa: 'complete your sign-in', password_reset: 'reset your password', mobile_verify: 'verify your mobile', offer_accept: 'accept your offer', consent: 'grant report consent' };

module.exports = ({ name, code, purpose }) => ({
  subject: `Your EIBIL code: ${code}`,
  html: wrap('Your verification code', `<p>Hi ${name || 'there'}, use this code to ${LABELS[purpose] || 'continue'}:</p><p style="font-size:32px;letter-spacing:8px;font-weight:800">${code}</p><p>It expires in 10 minutes. Never share it with anyone.</p>`),
  text: `Your EIBIL code is ${code}. It expires in 10 minutes.`,
});
