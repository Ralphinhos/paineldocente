const fs = require('node:fs');
const crypto = require('node:crypto');
const { z } = require('zod');

const eventSchema = z.object({ name: z.string(), occurredAt: z.string().datetime(), actorId: z.union([z.string(), z.number()]).transform(String).optional(), relatedUserId: z.union([z.string(), z.number()]).transform(String).optional(), origin: z.string().optional() });
const activitySchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String), requirementId: z.string(), label: z.string(),
  observedQuantity: z.number().int().nonnegative().default(1), visible: z.boolean(),
  configuredAt: z.string().datetime().nullable(), deadlineAt: z.string().datetime().nullable(),
  configurationTimeSource: z.enum(['DEMO_TRUSTED', 'SNAPSHOT_OBSERVED']).nullable().default(null),
  deadlineSource: z.enum(['DEMO_SCHEDULE', 'OFFICIAL_CATALOG']).nullable().default(null),
  mappingConfidence: z.enum(['EXACT', 'AMBIGUOUS']).default('EXACT'), events: z.array(eventSchema).default([]),
});
const teacherSchema = z.object({ id: z.union([z.string(), z.number()]).transform(String), name: z.string(), email: z.string().email().nullable().default(null), assignedAt: z.string().datetime().nullable(), lastAccessAt: z.string().datetime().nullable(), accessEvents: z.array(eventSchema).default([]) });
const courseSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String), name: z.string(), shortName: z.string(), period: z.string(), modality: z.string(), workloadHours: z.number().int().positive(),
  startsAt: z.string().datetime(), endsAt: z.string().datetime(), originalCourseId: z.union([z.string(), z.number()]).transform(String).nullable().default(null), restoredAt: z.string().datetime().nullable().default(null),
  teachers: z.array(teacherSchema).min(1), activities: z.array(activitySchema),
});
const sourceSchema = z.object({ source: z.enum(['demo', 'moodle']), generatedAt: z.string().datetime(), courses: z.array(courseSchema), sourceIssues: z.array(z.object({ code: z.string(), message: z.string(), severity: z.enum(['INFO', 'WARNING', 'CRITICAL']), courseId: z.string().optional() })).default([]) });

function loadCatalog(catalogPath) { const raw = JSON.parse(fs.readFileSync(catalogPath, 'utf8')); if (!raw.version || !raw.modalities || !raw.accessThresholds) throw new Error('Catálogo de regras incompleto.'); return Object.freeze(raw); }
function expectedQuantity(requirement, workload) { return requirement.quantityByWorkload ? requirement.quantityByWorkload[String(workload)] ?? null : requirement.quantity ?? 1; }
function latestIso(values) { const valid = values.filter(Boolean).map((value) => new Date(value)); return valid.length ? new Date(Math.max(...valid.map(Number))).toISOString() : null; }
function calculateAccess(teacher, course, asOf, thresholds) {
  const active = new Date(course.startsAt) <= asOf && asOf <= new Date(course.endsAt);
  const lastAccessAt = latestIso([teacher.lastAccessAt, ...teacher.accessEvents.map((event) => event.occurredAt)]);
  if (!active) return { status: 'OUTSIDE_WINDOW', lastAccessAt, daysSinceAccess: null };
  if (!lastAccessAt) return { status: 'NEVER', lastAccessAt: null, daysSinceAccess: null };
  const days = Math.max(0, Math.floor((asOf - new Date(lastAccessAt)) / 86400000));
  if (days <= thresholds.currentMaxDays) return { status: 'CURRENT', lastAccessAt, daysSinceAccess: days };
  if (days <= thresholds.attentionMaxDays) return { status: 'ATTENTION', lastAccessAt, daysSinceAccess: days };
  return { status: 'CRITICAL', lastAccessAt, daysSinceAccess: days };
}
function evidenceFor(activity, teacherId) {
  if (!activity) return [];
  return activity.events.map((event) => {
    const actorMatches = event.actorId === teacherId;
    if (event.name === '\\core\\event\\course_module_updated') return { type: 'MODULE_UPDATED', occurredAt: event.occurredAt, supports: actorMatches ? 'TEACHER_INTERACTION' : 'MODULE_CHANGE', note: 'Confirma alteração; o estado atual continua sendo a prova da configuração.' };
    if (event.name === '\\core\\event\\course_module_completion_updated') return { type: 'COMPLETION_CHANGED', occurredAt: event.occurredAt, supports: 'ACCESS_ONLY', note: 'Conclusão alterada não comprova entrega/configuração docente.' };
    if (event.name.endsWith('course_module_viewed')) return { type: 'MODULE_VIEWED', occurredAt: event.occurredAt, supports: actorMatches ? 'TEACHER_INTERACTION' : 'ACCESS_ONLY', note: 'Visualização comprova interação, não entrega.' };
    return { type: 'OTHER_EVENT', occurredAt: event.occurredAt, supports: 'CONTEXT_ONLY', note: 'Evento preservado apenas como contexto.' };
  });
}
function result(status, reasonCode, reason, activity, quantity, evidence, overdue = false) {
  const timingTrusted = Boolean(activity?.configuredAt && activity?.configurationTimeSource);
  return { status, reasonCode, reason, overdue, deadlineAt: activity?.deadlineAt ?? null, deadlineSource: activity?.deadlineSource ?? null, configuredAt: timingTrusted ? activity.configuredAt : null, timingSource: timingTrusted ? activity.configurationTimeSource : null, expectedQuantity: quantity, observedQuantity: activity?.observedQuantity ?? 0, evidence };
}
function evaluateRequirement({ requirement, activity, course, teacher, inheritedReady, generatedAt }) {
  const quantity = expectedQuantity(requirement, course.workloadHours);
  const evidence = evidenceFor(activity, teacher.id);
  if (quantity === null) return result('NOT_VERIFIABLE', 'WORKLOAD_RULE_MISSING', `Carga horária ${course.workloadHours}h sem quantidade homologada.`, activity, null, evidence);
  if (activity?.mappingConfidence === 'AMBIGUOUS') return result('NOT_VERIFIABLE', 'AMBIGUOUS_MAPPING', 'Mais de uma atividade pode representar este requisito.', activity, quantity, evidence);
  if (!activity?.deadlineAt || activity.deadlineSource !== 'OFFICIAL_CATALOG' && activity.deadlineSource !== 'DEMO_SCHEDULE') return result('NOT_VERIFIABLE', 'DEADLINE_MISSING', 'Prazo oficial ausente; atraso não pode ser calculado com segurança.', activity, quantity, evidence);
  const ready = Boolean(activity.visible && activity.observedQuantity >= quantity);
  if (inheritedReady && ready) return result('INHERITED_READY', 'RESTORED_STRUCTURE_READY', 'Estrutura herdada estava pronta antes da responsabilidade deste docente.', activity, quantity, evidence);
  if (!ready) { const overdue = new Date(activity.deadlineAt) < generatedAt; return result('PENDING', overdue ? 'REQUIREMENT_OVERDUE' : 'REQUIREMENT_OPEN', overdue ? 'Requisito incompleto após o prazo.' : 'Requisito incompleto, ainda dentro do prazo.', activity, quantity, evidence, overdue); }
  if (!activity.configuredAt || !activity.configurationTimeSource) return result('NOT_VERIFIABLE', 'CONFIGURATION_DATE_UNKNOWN', 'Estado atual está pronto, mas não há fotografia confiável para classificar o prazo.', activity, quantity, evidence);
  const late = new Date(activity.configuredAt) > new Date(activity.deadlineAt);
  return result(late ? 'DELIVERED_LATE' : 'DELIVERED_ON_TIME', late ? 'CONFIGURED_AFTER_DEADLINE' : 'CONFIGURED_BY_DEADLINE', late ? 'Configuração válida concluída após o prazo.' : 'Configuração válida concluída até o prazo.', activity, quantity, evidence);
}

function reconcileObservedTiming(rows, source, previousSnapshot) {
  const prior = previousSnapshot?.rulesVersion === source.rulesVersion ? new Map(previousSnapshot.rows.map((row) => [`${row.course.id}:${row.teacher.id}:${row.requirement.id}`, row])) : new Map();
  for (const row of rows) {
    if (row.reasonCode !== 'CONFIGURATION_DATE_UNKNOWN' || !row.deadlineAt) continue;
    const key = `${row.course.id}:${row.teacher.id}:${row.requirement.id}`;
    const previous = prior.get(key);
    if (previous && ['DELIVERED_ON_TIME', 'DELIVERED_LATE'].includes(previous.structureStatus)) {
      Object.assign(row, { structureStatus: previous.structureStatus, reasonCode: previous.reasonCode, reason: previous.reason, configuredAt: previous.configuredAt, timingSource: previous.timingSource });
      continue;
    }
    const deadline = new Date(row.deadlineAt);
    const observedAt = new Date(source.generatedAt);
    if (observedAt <= deadline) {
      Object.assign(row, { structureStatus: 'DELIVERED_ON_TIME', reasonCode: 'READY_OBSERVED_BY_DEADLINE', reason: 'Estrutura observada pronta até o prazo.', configuredAt: source.generatedAt, timingSource: 'SNAPSHOT_OBSERVED' });
      continue;
    }
    if (previous?.structureStatus === 'PENDING' && new Date(previous.calculatedAt) >= deadline) {
      Object.assign(row, { structureStatus: 'DELIVERED_LATE', reasonCode: 'READY_OBSERVED_AFTER_OVERDUE', reason: 'Estrutura permaneceu pendente após o prazo e foi observada pronta depois.', configuredAt: source.generatedAt, timingSource: 'SNAPSHOT_OBSERVED' });
    }
  }
}

function buildSnapshot(rawSource, catalog, options = {}) {
  const source = sourceSchema.parse(rawSource); const generatedAt = new Date(source.generatedAt); const qualityIssues = [...source.sourceIssues]; const rows = [];
  for (const course of source.courses) {
    const modality = catalog.modalities[course.modality];
    if (!modality) { qualityIssues.push({ code: 'UNKNOWN_MODALITY', message: `Modalidade não mapeada: ${course.modality}.`, severity: 'CRITICAL', courseId: course.id }); continue; }
    const required = modality.requirements.filter((requirement) => requirement.required);
    for (const requirement of required) {
      const matches = course.activities.filter((activity) => activity.requirementId === requirement.id);
      if (matches.length > 1) qualityIssues.push({ code: 'DUPLICATE_REQUIREMENT_MAPPING', message: `${course.shortName}: múltiplas atividades para ${requirement.label}.`, severity: 'CRITICAL', courseId: course.id });
      if (!matches.length) qualityIssues.push({ code: 'REQUIREMENT_NOT_MAPPED', message: `${course.shortName}: requisito não localizado (${requirement.label}).`, severity: 'CRITICAL', courseId: course.id });
      if (matches[0] && !matches[0].deadlineAt) qualityIssues.push({ code: 'DEADLINE_MISSING', message: `${course.shortName}: prazo oficial ausente para ${requirement.label}.`, severity: 'CRITICAL', courseId: course.id });
    }
    for (const teacher of course.teachers) {
      const access = calculateAccess(teacher, course, generatedAt, catalog.accessThresholds);
      const currentReady = required.every((requirement) => { const activity = course.activities.find((candidate) => candidate.requirementId === requirement.id); const quantity = expectedQuantity(requirement, course.workloadHours); return quantity !== null && activity?.mappingConfidence === 'EXACT' && activity.visible && activity.observedQuantity >= quantity; });
      const inheritedReady = Boolean(course.originalCourseId && course.restoredAt && teacher.assignedAt && new Date(course.restoredAt) <= new Date(teacher.assignedAt) && currentReady);
      for (const requirement of required) {
        const evaluation = evaluateRequirement({ requirement, activity: course.activities.find((candidate) => candidate.requirementId === requirement.id), course, teacher, inheritedReady, generatedAt });
        rows.push({ snapshotId: null, course: { id: course.id, name: course.name, shortName: course.shortName, period: course.period, modality: course.modality, modalityLabel: modality.label, workloadHours: course.workloadHours, startsAt: course.startsAt, endsAt: course.endsAt }, teacher: { id: teacher.id, name: teacher.name, email: teacher.email }, requirement: { id: requirement.id, label: requirement.label }, structureStatus: evaluation.status, accessStatus: access.status, lastAccessAt: access.lastAccessAt, daysSinceAccess: access.daysSinceAccess, provenance: inheritedReady ? 'INHERITED_VERIFIED' : course.originalCourseId ? 'RESTORED_NOT_EXEMPT' : 'CREATED_FOR_PERIOD', calculatedAt: source.generatedAt, rulesVersion: catalog.version, ...evaluation });
      }
    }
  }
  reconcileObservedTiming(rows, { generatedAt: source.generatedAt, rulesVersion: catalog.version }, options.previousSnapshot);
  const unverifiable = rows.filter((row) => row.structureStatus === 'NOT_VERIFIABLE');
  if (unverifiable.length) qualityIssues.push({ code: 'UNVERIFIABLE_RESULTS', message: `${unverifiable.length} resultado(s) sem evidência suficiente para publicação.`, severity: 'CRITICAL' });
  const keys = new Set();
  for (const row of rows) { const key = `${row.course.id}:${row.teacher.id}:${row.requirement.id}`; if (keys.has(key)) qualityIssues.push({ code: 'DUPLICATE_SNAPSHOT_KEY', message: `Chave duplicada: ${key}.`, severity: 'CRITICAL', courseId: row.course.id }); keys.add(key); }
  if (!options.rulesApproved) qualityIssues.push({ code: 'RULES_NOT_APPROVED', message: 'Catálogo piloto ainda não homologado pelo NED.', severity: 'CRITICAL' });
  const snapshotId = crypto.randomUUID(); rows.forEach((row) => { row.snapshotId = snapshotId; });
  const critical = qualityIssues.some((issue) => issue.severity === 'CRITICAL');
  return { id: snapshotId, generatedAt: source.generatedAt, source: source.source, rulesVersion: catalog.version, rulesStatus: catalog.status, qualityStatus: critical ? 'BLOCKED' : qualityIssues.length ? 'WARNING' : 'VALID', publishAllowed: !critical && Boolean(options.rulesApproved) && source.source !== 'demo', isDemo: source.source === 'demo', qualityIssues, rows };
}
module.exports = { buildSnapshot, calculateAccess, expectedQuantity, loadCatalog, reconcileObservedTiming };
