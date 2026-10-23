const express = require('express');
const { z } = require('zod');
const { HttpError, asyncHandler } = require('../core/http');
const sendSchema = z.object({ audience: z.enum(['coordinators', 'executive']), snapshotId: z.string().uuid(), recipientEmails: z.array(z.string().email()).min(1).max(1000).optional() });
function parseAudience(value) {
  const result = z.enum(['coordinators', 'executive']).safeParse(value);
  if (!result.success) throw new HttpError(400, 'INVALID_AUDIENCE', 'Público inválido.');
  return result.data;
}
function reportRoutes({ auth, reportService }) {
  const router = express.Router();
  router.use(auth.required);
  router.get('/preview', auth.requireRole('ned_admin'), asyncHandler(async (request, response) => {
    let audience = parseAudience(request.query.audience || (request.user.role === 'executive' ? 'executive' : 'coordinators'));
    response.set('Cache-Control', 'private, no-store');
    response.json({ audience, reports: await reportService.preview(audience, request.user) });
  }));
  router.post('/send', auth.requireRole('ned_admin'), auth.requireCsrf, asyncHandler(async (request, response) => {
    const parsed = sendSchema.safeParse(request.body);
    if (!parsed.success) throw new HttpError(400, 'INVALID_REPORT_SEND', 'Abra a prévia e confira o destinatário antes do envio.');
    const body = parsed.data;
    response.status(202).json(await reportService.send(body.audience, request.user, request.requestId, body.snapshotId, body.recipientEmails));
  }));
  return router;
}
module.exports = { reportRoutes };
