const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const { HttpError } = require('./http');
const COOKIE_NAME = 'painel_docente_session';
const SESSION_SECONDS = 8 * 60 * 60;

function parseCookies(header = '') { return header.split(';').reduce((cookies, pair) => { const i = pair.indexOf('='); if (i > 0) cookies[pair.slice(0, i).trim()] = decodeURIComponent(pair.slice(i + 1).trim()); return cookies; }, {}); }
function safeEqual(left, right) { if (typeof left !== 'string' || typeof right !== 'string') return false; const a = Buffer.from(left); const b = Buffer.from(right); return a.length === b.length && crypto.timingSafeEqual(a, b); }
function publicUser(user) { return { id: user.id, email: user.email, name: user.name, role: user.role }; }

function createAuth(config) {
  const baseCookie = ['Path=/', 'HttpOnly', 'SameSite=Strict', ...(config.auth.cookieSecure ? ['Secure'] : [])];
  const findMappedUser = (email) => {
    const normalized = String(email || '').trim().toLowerCase();
    const found = config.auth.users.find((user) => user.email.toLowerCase() === normalized);
    return found ? { id: `sso:${normalized}`, ...found, email: normalized, courseIds: found.courseIds.map(String) } : null;
  };
  const issueToken = (user) => jwt.sign({ sub: user.id, email: user.email, name: user.name, role: user.role, courseIds: user.courseIds.map(String), csrfToken: crypto.randomBytes(24).toString('base64url') }, config.auth.jwtSecret, { algorithm: 'HS256', expiresIn: SESSION_SECONDS, issuer: 'painel-docente', audience: 'painel-docente-web' });
  const setSessionCookie = (response, token) => response.setHeader('Set-Cookie', [`${COOKIE_NAME}=${encodeURIComponent(token)}`, ...baseCookie, `Max-Age=${SESSION_SECONDS}`].join('; '));
  const clearSessionCookie = (response) => response.setHeader('Set-Cookie', [`${COOKIE_NAME}=`, ...baseCookie, 'Max-Age=0'].join('; '));
  const readSession = (request) => {
    const token = parseCookies(request.headers.cookie)[COOKIE_NAME]; if (!token) return null;
    try { const d = jwt.verify(token, config.auth.jwtSecret, { algorithms: ['HS256'], issuer: 'painel-docente', audience: 'painel-docente-web' }); return { id: d.sub, email: d.email, name: d.name, role: d.role, courseIds: Array.isArray(d.courseIds) ? d.courseIds.map(String) : [], csrfToken: d.csrfToken }; } catch { return null; }
  };
  const optional = (request, response, next) => {
    const session = readSession(request); if (session) { request.user = session; return next(); }
    if (config.auth.mode === 'proxy' && safeEqual(request.get('x-panel-auth-secret'), config.auth.proxySharedSecret)) {
      const email = request.get('x-auth-request-email'); if (!email) return next();
      const user = findMappedUser(email);
      if (!user) return next(new HttpError(403, 'USER_NOT_AUTHORIZED', 'Conta institucional sem acesso ao Painel Docente.'));
      if (user) { const token = issueToken(user); const d = jwt.decode(token); setSessionCookie(response, token); request.user = { ...user, csrfToken: d.csrfToken }; }
    }
    return next();
  };
  const required = (request, _response, next) => request.user ? next() : next(new HttpError(401, 'AUTH_REQUIRED', 'Autenticação necessária.'));
  const requireRole = (...roles) => (request, _response, next) => !request.user ? next(new HttpError(401, 'AUTH_REQUIRED', 'Autenticação necessária.')) : roles.includes(request.user.role) ? next() : next(new HttpError(403, 'ROLE_FORBIDDEN', 'Perfil sem permissão para esta ação.'));
  const requireCsrf = (request, _response, next) => request.user && safeEqual(request.get('x-csrf-token'), request.user.csrfToken) ? next() : next(new HttpError(403, 'CSRF_REJECTED', 'Token de proteção inválido.'));
  return { optional, required, requireRole, requireCsrf, issueToken, setSessionCookie, clearSessionCookie, publicUser };
}
module.exports = { createAuth };
