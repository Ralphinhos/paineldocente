const express = require('express');
const { z } = require('zod');
const { asyncHandler, HttpError } = require('../core/http');
const filtersSchema = z.object({
  period: z.string().max(50).optional(), modality: z.enum(['', 'SEMESTRAL', 'MODULAR', 'GRADUACAO_EAD']).optional(),
  bimester: z.enum(['', '1', '2']).optional(), snapshotId: z.string().uuid().optional(),
  query: z.string().max(200).optional(), page: z.coerce.number().int().positive().max(100000).optional(),
  sort: z.enum(['late', 'name', 'access', 'ontime']).optional(),
}).strict();
function executiveRoutes({ auth, executiveService }) {
  const router = express.Router();
  router.use(auth.required, auth.requireRole('ned_admin', 'executive'));
  const parse = (query) => { const result = filtersSchema.safeParse(query); if (!result.success) throw new HttpError(400, 'INVALID_EXECUTIVE_FILTERS', 'Confira o semestre e os filtros da análise.'); return result.data; };
  router.get('/', asyncHandler(async (request, response) => { response.set('Cache-Control', 'private, no-store'); response.json(await executiveService.getOverview(parse(request.query))); }));
  router.get('/history', asyncHandler(async (request, response) => { const filters = parse(request.query); if (!filters.snapshotId) throw new HttpError(400, 'SNAPSHOT_REQUIRED', 'Selecione a referência da análise.'); response.set('Cache-Control', 'private, no-store'); response.json(await executiveService.getHistory(filters)); }));
  return router;
}
module.exports = { executiveRoutes };
