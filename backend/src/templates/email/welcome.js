const { wrap } = require('./generic');

module.exports = ({ name, role }) => ({
  subject: 'Welcome to EIBIL',
  html: wrap('Welcome to EIBIL', `<p>Hi ${name}, your ${role} account is ready. ${role === 'employee' ? 'Verify your PAN to activate your EIBIL score.' : 'Our team will review your company KYC shortly.'}</p>`),
  text: `Welcome to EIBIL, ${name}.`,
});
