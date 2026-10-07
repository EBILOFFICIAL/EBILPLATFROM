const { wrap } = require('./generic');

module.exports = ({ company, count, period }) => ({
  subject: `${count} EIBIL evaluations due for ${period}`,
  html: wrap('Evaluations due', `<p>${company}: ${count} employee evaluation(s) are due for ${period}. Please submit them from the Employer Console.</p>`),
  text: `${count} evaluations due for ${period}.`,
});
