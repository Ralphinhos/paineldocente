const express = require('express');
const { z } = require('zod');
const { HttpError, asyncHandler } = require('../core/http');
const { manualDeliveryKey, saoPauloDate } = require('../core/rules');

function validDate(value) {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(validDate, 'Data inválida.');
const deliverySchema = z.object({
  courseId: z.union([z.string(), z.number()]).transform(String),
  teacherId: z.union([z.string(), z.number()]).transform(String),
  requirementId: z.enum(['unidades_aprendizagem', 'videos']),
  itemNumber: z.number().int().positive().max(100),
  disposition: z.enum(['PENDING', 'DELIVERED', 'NOT_APPLICABLE']),
  evidenceDate: dateSchema.nullable().default(null),
  publishedDate: dateSchema.nullable().default(null),
  justification: z.string().trim().max(500).nullable().default(null),
}).superRefine((value, context) => {
  if (value.disposition === 'DELIVERED' && !value.evidenceDate) context.addIssue({ code: 'custom', path: ['evidenceDate'], message: 'Informe a data encaminhada pelo docente.' });
  if (value.disposition === 'NOT_APPLICABLE' && (!value.justification || value.justification.length < 3)) context.addIssue({ code: 'custom', path: ['justification'], message: 'Justificativa obrigatória para não aplicável.' });
});
const batchSchema = z.object({ snapshotId: z.string().uuid(), deliveries: z.array(deliverySchema).min(1).max(100) });

function manualItem(row) {
  return {
    id: manualDeliveryKey(row.course.id, row.teacher.id, row.requirement.baseId, row.requirement.itemNumber),
    course: row.course,
    teacher: row.teacher,
    requirement: row.requirement,
    status: row.structureStatus,
    overdue: row.overdue,
    deadlineAt: row.deadlineAt,
    disposition: row.manualDisposition || 'PENDING',
    evidenceDate: row.manualEvidenceDate || null,
    publishedDate: row.publishedDate || null,
    justification: row.manualJustification || null,
    updatedBy: row.manualUpdatedBy || null,
    updatedAt: row.manualUpdatedAt || null,
    editable: row.structureStatus !== 'INHERITED_READY',
  };
}

function listManualItems(snapshot, query) {
  const all = snapshot.rows.filter((row) => row.requirement.manualControl).map(manualItem);
  const options = {
    periods: [...new Set(all.map((item) => item.course.period))].sort(),
    courses: [...new Map(all.map((item) => [item.course.id, { value: item.course.id, label: item.course.shortName }])).values()].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')),
  };
  const text = String(query.query || '').trim().toLocaleLowerCase('pt-BR');
  const filtered = all.filter((item) =>
    !(query.period && item.course.period !== query.period)
    && !(query.courseId && item.course.id !== String(query.courseId))
    && !(query.requirementId && item.requirement.baseId !== query.requirementId)
    && !(query.status && item.status !== query.status)
    && !(text && !`${item.course.name} ${item.course.shortName} ${item.teacher.name} ${item.requirement.label}`.toLocaleLowerCase('pt-BR').includes(text))
  ).sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.course.shortName.localeCompare(b.course.shortName, 'pt-BR') || a.teacher.name.localeCompare(b.teacher.name, 'pt-BR') || a.requirement.baseId.localeCompare(b.requirement.baseId) || a.requirement.itemNumber - b.requirement.itemNumber);
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.max(5, Math.min(Number(query.pageSize) || 20, 50));
  return { meta: { snapshotId: snapshot.id, generatedAt: snapshot.generatedAt }, items: filtered.slice((page - 1) * pageSize, page * pageSize), filters: options, pagination: { page, pageSize, total: filtered.length, pages: Math.max(1, Math.ceil(filtered.length / pageSize)) } };
}

function operationsRoutes({ auth, store, snapshotService }) {
  const router = express.Router();
  router.use(auth.required, auth.requireRole('ned_admin', 'auditor'));
  router.get('/snapshots', asyncHandler(async (_request, response) => {
    const snapshots = await store.listSnapshots(12);
    response.json({ snapshots: snapshots.map((snapshot) => ({ id: snapshot.id, generatedAt: snapshot.generatedAt, source: snapshot.source, rulesVersion: snapshot.rulesVersion, qualityStatus: snapshot.qualityStatus, publishAllowed: snapshot.publishAllowed, rows: snapshot.rows.length })) });
  }));
  router.get('/manual-deliveries', asyncHandler(async (request, response) => {
    const snapshot = await store.latestSnapshot();
    if (!snapshot) throw new HttpError(503, 'SNAPSHOT_UNAVAILABLE', 'Ainda não há coleta disponível.');
    response.set('Cache-Control', 'private, no-store');
    response.json(listManualItems(snapshot, request.query));
  }));
  router.post('/manual-deliveries', auth.requireRole('ned_admin'), auth.requireCsrf, asyncHandler(async (request, response) => {
    const parsed = batchSchema.safeParse(request.body);
    if (!parsed.success) throw new HttpError(400, 'MANUAL_DELIVERY_INVALID', 'Revise as datas e justificativas informadas.', parsed.error.flatten());
    const latest = await store.latestSnapshot();
    if (!latest) throw new HttpError(503, 'SNAPSHOT_UNAVAILABLE', 'Ainda não há coleta disponível.');
    if (latest.id !== parsed.data.snapshotId) throw new HttpError(409, 'STALE_SNAPSHOT', 'Os dados foram atualizados por outra operação. Recarregue o controle manual.');
    const allowed = new Map(latest.rows.filter((row) => row.requirement.manualControl).map((row) => [manualDeliveryKey(row.course.id, row.teacher.id, row.requirement.baseId, row.requirement.itemNumber), row]));
    const seen = new Set();
    const updatedAt = new Date().toISOString();
    const records = parsed.data.deliveries.map((delivery) => {
      const key = manualDeliveryKey(delivery.courseId, delivery.teacherId, delivery.requirementId, delivery.itemNumber);
      if (seen.has(key)) throw new HttpError(400, 'MANUAL_DELIVERY_DUPLICATE', 'O mesmo item foi enviado mais de uma vez.');
      seen.add(key);
      const row = allowed.get(key);
      if (!row) throw new HttpError(400, 'MANUAL_DELIVERY_UNKNOWN', 'Item manual não pertence à fotografia atual.');
      if (row.structureStatus === 'INHERITED_READY') throw new HttpError(409, 'INHERITED_ITEM_LOCKED', 'Estrutura herdada não exige registro de entrega do docente.');
      const today = saoPauloDate(new Date());
      if ((delivery.evidenceDate && delivery.evidenceDate > today) || (delivery.publishedDate && delivery.publishedDate > today)) throw new HttpError(400, 'MANUAL_FUTURE_DATE', 'Datas futuras não podem ser registradas como fatos concluídos.');
      return {
        ...delivery,
        evidenceDate: delivery.disposition === 'DELIVERED' ? delivery.evidenceDate : null,
        publishedDate: delivery.disposition === 'NOT_APPLICABLE' ? null : delivery.publishedDate,
        justification: delivery.disposition === 'NOT_APPLICABLE' ? delivery.justification : null,
        updatedBy: request.user.name,
        updatedAt,
      };
    });
    await store.upsertManualDeliveries(records);
    await store.addAudit({ actorId: request.user.id, action: 'MANUAL_DELIVERY_UPSERT', targetId: latest.id, requestId: request.requestId, metadata: { count: records.length, keys: [...seen] } });
    const snapshot = await snapshotService.run();
    await store.addAudit({ actorId: request.user.id, action: 'SNAPSHOT_RUN_AFTER_MANUAL_DELIVERY', targetId: snapshot.id, requestId: request.requestId, metadata: { previousSnapshotId: latest.id, count: records.length } });
    response.status(201).json({ saved: records.length, snapshotId: snapshot.id, generatedAt: snapshot.generatedAt, qualityStatus: snapshot.qualityStatus });
  }));
  router.post('/snapshots', auth.requireRole('ned_admin'), auth.requireCsrf, asyncHandler(async (request, response) => {
    const snapshot = await snapshotService.run();
    await store.addAudit({ actorId: request.user.id, action: 'SNAPSHOT_RUN', targetId: snapshot.id, requestId: request.requestId, metadata: { source: snapshot.source, qualityStatus: snapshot.qualityStatus } });
    response.status(201).json({ id: snapshot.id, generatedAt: snapshot.generatedAt, qualityStatus: snapshot.qualityStatus, publishAllowed: snapshot.publishAllowed });
  }));
  return router;
}

module.exports = { batchSchema, listManualItems, operationsRoutes };
