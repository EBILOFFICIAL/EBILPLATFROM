class AppError extends Error {
  constructor(message, status = 400, errors) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

AppError.badRequest = (m, e) => new AppError(m, 400, e);
AppError.unauthorized = (m = 'Not authenticated') => new AppError(m, 401);
AppError.forbidden = (m = 'Forbidden') => new AppError(m, 403);
AppError.notFound = (m = 'Not found') => new AppError(m, 404);
AppError.conflict = (m) => new AppError(m, 409);
AppError.tooMany = (m = 'Too many attempts') => new AppError(m, 429);

module.exports = AppError;
