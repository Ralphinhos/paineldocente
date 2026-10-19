const express = require('express');
const { z } = require('zod');
const { HttpError, asyncHandler } = require('../core/http');

const filtersSchema = z.object({
  period: z.string().max(50).optional(), modality: z.string().max(50).optional(),
  courseId: z.string().max(100).optional(), teacherId: z.string().max(100).optional(), query: z.string().max(200).optional(),
  activityKey: z.string().max(200).optional(),
  accessStatus: z.enum(['ISSUES', 'ALL', 'CURRENT', 'ATTENTION', 'CRITICAL', 'NEVER', 'NOT_VERIFIABLE']).optional(),
  deliveryStatus: z.enum(['ALL', 'COMPLIANT', 'ON_TIME_OR_INHERITED', 'OVERDUE', 'PENDING', 'EARLY', 'ON_TIME', 'DELIVERED_LATE', 'INHERITED_READY', 'NOT_APPLICABLE', 'NOT_VERIFIABLE']).optional(),
  page: z.coerce.number().int().positive().max(100000).optional(), pageSize: z.coerce.number().int().min(5).max(50).optional(),
});
function monitoringRoutes({ auth, monitoringService }) {
  const router = express.Router();
  router.use(auth.required);
  router.get('/', asyncHandler(async (request, response) => {
    const parsed = filtersSchema.safeParse(request.query);
    if (!parsed.success) throw new HttpError(400, 'INVALID_FILTERS', 'Confira os filtros do acompanhamento.');
    response.set('Cache-Control', 'private, no-store');
    response.json(await monitoringService.getMonitoring(request.user, parsed.data));
  }));
  return router;
}
module.exports = { monitoringRoutes };
