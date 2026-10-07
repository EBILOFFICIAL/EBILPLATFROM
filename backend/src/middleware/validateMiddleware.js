const AppError = require('../utils/AppError');

const validate = (schema, source = 'body') => (req, res, next) => {
  const { value, error } = schema.validate(req[source], { abortEarly: false, stripUnknown: true, convert: true });
  if (error) return next(AppError.badRequest('Validation failed', error.details.map((d) => ({ field: d.path.join('.'), message: d.message.replace(/"/g, '') }))));
  if (source === 'query') Object.defineProperty(req, 'query', { value, writable: true });
  else req[source] = value;
  return next();
};

module.exports = { validate };
