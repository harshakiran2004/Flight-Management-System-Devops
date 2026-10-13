function notFound(req, res) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  const status = error.name === 'ValidationError' ? 400 : error.name === 'CastError' ? 400 : error.code === 11000 ? 409 : 500;
  const message = status === 500 ? 'Internal server error' : error.message;
  console.error(error);
  res.status(status).json({ success: false, message });
}

module.exports = { notFound, errorHandler };
