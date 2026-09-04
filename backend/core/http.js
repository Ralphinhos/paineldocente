const crypto = require('node:crypto');

class HttpError extends Error {
  constructor(status, code, message, details) { super(message); this.name = 'HttpError'; this.status = status; this.code = code; this.details = details; }
}
const asyncHandler = (handler) => (request, response, next) => Promise.resolve(handler(request, response, next)).catch(next);
function requestIdMiddleware(request, response, next) {
  const supplied = request.get('x-request-id');
  request.requestId = supplied && /^[a-zA-Z0-9._-]{8,100}$/.test(supplied) ? supplied : crypto.randomUUID();
  response.set('x-request-id', request.requestId); next();
}
function originGuard(allowedOrigin) {
  return (request, _response, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return next();
    if (request.get('origin') !== allowedOrigin) return next(new HttpError(403, 'ORIGIN_REJECTED', 'Origem da solicitação não autorizada.'));
    return next();
  };
}
function errorHandler(error, request, response, _next) {
  const status = Number.isInteger(error.status) ? error.status : 500;
  const code = error.code || 'INTERNAL_ERROR';
  if (status >= 500) console.error(JSON.stringify({ level: 'error', requestId: request.requestId, code, message: error.message }));
  response.status(status).json({ error: { code, message: status >= 500 ? 'Não foi possível concluir a operação.' : error.message, requestId: request.requestId, ...(status < 500 && error.details ? { details: error.details } : {}) } });
}
module.exports = { HttpError, asyncHandler, requestIdMiddleware, originGuard, errorHandler };
