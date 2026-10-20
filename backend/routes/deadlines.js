const express = require('express');
const { z } = require('zod');
const { HttpError, asyncHandler } = require('../core/http');
const { changeSchema } = require('../services/deadlineService');

const querySchema = z.object({ period: z.string().max(50).optional(), modality: z.enum(['SEMESTRAL', 'MODULAR', 'GRADUACAO_EAD']).optional(), courseId: z.string().max(50).optional() }).strict();
const saveSchema = changeSchema.extend({ reviewToken: z.string().regex(/^\d{13}\.[A-Za-z0-9_-]{43}$/) });

function deadlineRoutes({ auth, deadlineService }) {
  const router = express.Router();
  router.use(auth.required, auth.requireRole('ned_admin', 'auditor'));
  router.use((_request, response, next) => { response.set('Cache-Control', 'private, no-store'); next(); });
  router.get('/', asyncHandler(async (request, response) => {
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) throw new HttpError(400, 'DEADLINES_QUERY_INVALID', 'Selecione um período e uma modalidade válidos.');
    response.json(await deadlineService.view(parsed.data));
  }));
  router.post('/preview', auth.requireRole('ned_admin'), auth.requireCsrf, asyncHandler(async (request, response) => {
    response.json(await deadlineService.preview(request.body, request.user));
  }));
  router.post('/', auth.requireRole('ned_admin'), auth.requireCsrf, asyncHandler(async (request, response) => {
    const parsed = saveSchema.safeParse(request.body);
    if (!parsed.success) throw new HttpError(400, 'DEADLINES_INVALID', 'Confira os campos e abra a revisão antes de salvar.');
    const { reviewToken, ...input } = parsed.data;
    response.status(201).json(await deadlineService.save(input, reviewToken, request.user, request.requestId));
  }));
  return router;
}

module.exports = { deadlineRoutes };
