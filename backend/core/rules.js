const fs = require('node:fs');
const crypto = require('node:crypto');
const { z } = require('zod');
const { calendarDays, delayFacts, saoPauloDate } = require('./timing');

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
const deadlineValueSchema = z.union([z.string().datetime(), z.array(z.string().datetime())]);
const courseSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String), name: z.string(), shortName: z.string(), period: z.string(), modality: z.string(), workloadHours: z.number().int().positive(),
  startsAt: z.string().datetime(), endsAt: z.string().datetime(), originalCourseId: z.union([z.string(), z.number()]).transform(String).nullable().default(null), restoredAt: z.string().datetime().nullable().default(null),
  requirementOwners: z.record(z.string(), z.union([z.string(), z.number()]).transform(String)).default({}),
  teachers: z.array(teacherSchema).min(1), activities: z.array(activitySchema), requirementDeadlines: z.record(z.string(), deadlineValueSchema).default({}),
});
const sourceSchema = z.object({ source: z.enum(['demo', 'moodle']), generatedAt: z.string().datetime(), courses: z.array(courseSchema), sourceIssues: z.array(z.object({ code: z.string(), message: z.string(), severity: z.enum(['INFO', 'WARNING', 'CRITICAL']), courseId: z.string().optional() })).default([]) });

function loadCatalog(catalogPath) { const raw = JSON.parse(fs.readFileSync(catalogPath, 'utf8')); if (!raw.version || !raw.modalities || !raw.accessThresholds) throw new Error('Catálogo de regras incompleto.'); return Object.freeze(raw); }
function expectedQuantity(requirement, workload) {
  if (requirement.quantityByWorkload) return requirement.quantityByWorkload[String(workload)] ?? null;
  if (requirement.quantityPerWorkloadHours) {
    const unit = Number(requirement.quantityPerWorkloadHours);
    return Number.isInteger(unit) && unit > 0 && workload % unit === 0 ? workload / unit : null;
  }
  return requirement.quantity ?? 1;
}
function manualDeliveryKey(courseId, teacherId, requirementId, itemNumber) { return `${courseId}:${teacherId}:${requirementId}:${itemNumber}`; }
function manualDeliveryRevisionKey(record) { return `${manualDeliveryKey(record.courseId, record.teacherId, record.requirementId, record.itemNumber)}:${Number(record.revision) || 1}`; }
function manualDateToIso(value) { return value ? `${value}T12:00:00.000Z` : null; }
function requirementDeadline(course, activity, requirementId, itemNumber = 1) {
  const configured = course.requirementDeadlines?.[requirementId];
  if (Array.isArray(configured)) return { deadlineAt: configured[itemNumber - 1] || null, deadlineSource: configured[itemNumber - 1] ? 'OFFICIAL_CATALOG' : null };
  if (configured) return { deadlineAt: configured, deadlineSource: 'OFFICIAL_CATALOG' };
  return { deadlineAt: activity?.deadlineAt ?? null, deadlineSource: activity?.deadlineSource ?? null };
}
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
function result(status, reasonCode, reason, activity, quantity, evidence, overdue = false, extras = {}) {
  const timingTrusted = Boolean(activity?.configuredAt && activity?.configurationTimeSource);
  return { status, reasonCode, reason, overdue, deadlineAt: activity?.deadlineAt ?? null, deadlineSource: activity?.deadlineSource ?? null, configuredAt: timingTrusted ? activity.configuredAt : null, timingSource: timingTrusted ? activity.configurationTimeSource : null, expectedQuantity: quantity, observedQuantity: activity?.observedQuantity ?? 0, evidence, ...extras };
}
function evaluateRequirement({ requirement, activity, course, teacher, inheritedReady, generatedAt }) {
  const quantity = expectedQuantity(requirement, course.workloadHours);
  const evidence = evidenceFor(activity, teacher.id);
  if (quantity === null) return result('NOT_VERIFIABLE', 'WORKLOAD_RULE_MISSING', `Carga horária ${course.workloadHours}h sem quantidade homologada.`, activity, null, evidence);
  if (activity?.mappingConfidence === 'AMBIGUOUS') return result('NOT_VERIFIABLE', 'AMBIGUOUS_MAPPING', 'Mais de uma atividade pode representar este requisito.', activity, quantity, evidence);
  if (!activity?.deadlineAt || activity.deadlineSource !== 'OFFICIAL_CATALOG' && activity.deadlineSource !== 'DEMO_SCHEDULE') return result('NOT_VERIFIABLE', 'DEADLINE_MISSING', 'Prazo oficial ausente; atraso não pode ser calculado com segurança.', activity, quantity, evidence);
  const ready = Boolean(activity.visible && activity.observedQuantity >= quantity);
  if (inheritedReady && ready) return result('INHERITED_READY', 'RESTORED_STRUCTURE_READY', 'Estrutura herdada estava pronta antes da responsabilidade deste docente.', activity, quantity, evidence);
  if (!ready) { const overdue = calendarDays(generatedAt, activity.deadlineAt) > 0; return result('PENDING', overdue ? 'REQUIREMENT_OVERDUE' : 'REQUIREMENT_OPEN', overdue ? 'Requisito incompleto após o prazo.' : 'Requisito incompleto, ainda dentro do prazo.', activity, quantity, evidence, overdue); }
  if (!activity.configuredAt || !activity.configurationTimeSource) return result('NOT_VERIFIABLE', 'CONFIGURATION_DATE_UNKNOWN', 'Estado atual está pronto, mas não há fotografia confiável para classificar o prazo.', activity, quantity, evidence);
  const late = calendarDays(activity.configuredAt, activity.deadlineAt) > 0;
  return result(late ? 'DELIVERED_LATE' : 'DELIVERED_ON_TIME', late ? 'CONFIGURED_AFTER_DEADLINE' : 'CONFIGURED_BY_DEADLINE', late ? 'Configuração válida concluída após o prazo.' : 'Configuração válida concluída até o prazo.', activity, quantity, evidence);
}

function evaluateManualRequirement({ requirement, activity, course, inheritedReady, generatedAt, record, itemNumber }) {
  const quantity = expectedQuantity(requirement, course.workloadHours);
  const version = Number(record?.revision) || 1;
  const replacementActive = version > 1 || Boolean(record?.replacementReason);
  const catalogDeadline = requirementDeadline(course, activity, requirement.id, itemNumber);
  const deadline = version > 1 && record?.revisionDeadlineDate
    ? { deadlineAt: manualDateToIso(record.revisionDeadlineDate), deadlineSource: 'MANUAL_REVISION' }
    : catalogDeadline;
  const evidenceDate = record?.evidenceDate || null;
  const configuredAt = manualDateToIso(evidenceDate);
  const manualActivity = {
    configuredAt,
    configurationTimeSource: configuredAt ? 'MANUAL_NED' : null,
    deadlineAt: deadline.deadlineAt,
    deadlineSource: deadline.deadlineSource,
    observedQuantity: record?.disposition === 'DELIVERED' ? 1 : 0,
  };
  const extras = {
    manualControl: true,
    manualDisposition: record?.disposition || 'PENDING',
    manualEvidenceDate: evidenceDate,
    publishedDate: record?.publishedDate || null,
    manualJustification: record?.justification || null,
    manualUpdatedBy: record?.updatedBy || null,
    manualUpdatedAt: record?.updatedAt || null,
    manualVersion: version,
    manualReplacementReason: record?.replacementReason || null,
    manualRevisionDeadlineDate: record?.revisionDeadlineDate || null,
  };
  if (quantity === null) return result('NOT_VERIFIABLE', 'WORKLOAD_RULE_MISSING', `Carga horária ${course.workloadHours}h sem quantidade homologada.`, manualActivity, null, [], false, extras);
  if (inheritedReady && !replacementActive) return result('INHERITED_READY', 'RESTORED_STRUCTURE_READY', 'Estrutura herdada estava pronta antes da responsabilidade deste docente.', manualActivity, 1, [], false, extras);
  if (version > 1 && !record?.revisionDeadlineDate) return result('NOT_VERIFIABLE', 'REVISION_DEADLINE_MISSING', 'Nova versão sem prazo próprio; avaliação bloqueada.', manualActivity, 1, [], false, extras);
  if (record?.disposition === 'NOT_APPLICABLE') {
    if (!record.justification?.trim()) return result('NOT_VERIFIABLE', 'NOT_APPLICABLE_REASON_MISSING', 'Item marcado como não aplicável sem justificativa.', manualActivity, 1, [], false, extras);
    return result('NOT_APPLICABLE', 'MANUAL_NOT_APPLICABLE', 'Item dispensado pelo NED com justificativa registrada.', manualActivity, 1, [], false, extras);
  }
  if (!deadline.deadlineAt || !['OFFICIAL_CATALOG', 'DEMO_SCHEDULE', 'MANUAL_REVISION'].includes(deadline.deadlineSource)) return result('NOT_VERIFIABLE', 'DEADLINE_MISSING', 'Prazo oficial ausente; atraso não pode ser calculado com segurança.', manualActivity, 1, [], false, extras);
  if (record?.disposition === 'DELIVERED') {
    if (!evidenceDate) return result('NOT_VERIFIABLE', 'MANUAL_EVIDENCE_DATE_MISSING', 'Entrega manual sem a data informada pelo docente.', manualActivity, 1, [], false, extras);
    const late = evidenceDate > saoPauloDate(deadline.deadlineAt);
    const evidenceType = requirement.evidenceType === 'SENT_BY_TEACHER' ? 'UA_SENT_BY_TEACHER' : 'VIDEO_RECORDED_BY_TEACHER';
    const note = requirement.evidenceType === 'SENT_BY_TEACHER' ? 'Data em que o docente encaminhou o pacote de UAs ao NED.' : 'Data em que o docente gravou a videoaula.';
    const evidence = [{ type: evidenceType, occurredAt: configuredAt, supports: 'DELIVERY_DATE', note }];
    return result(late ? 'DELIVERED_LATE' : 'DELIVERED_ON_TIME', late ? 'MANUAL_DATE_AFTER_DEADLINE' : 'MANUAL_DATE_BY_DEADLINE', late ? 'Data informada pelo docente posterior ao prazo oficial.' : 'Data informada pelo docente dentro do prazo oficial.', manualActivity, 1, evidence, false, extras);
  }
  const overdue = calendarDays(generatedAt, deadline.deadlineAt) > 0;
  const missing = requirement.evidenceType === 'SENT_BY_TEACHER' ? 'Data de envio do pacote de UAs ainda não registrada.' : 'Data de gravação da videoaula ainda não registrada.';
  return result('PENDING', overdue ? 'MANUAL_ITEM_OVERDUE' : 'MANUAL_ITEM_OPEN', overdue ? `${missing} Prazo vencido.` : missing, manualActivity, 1, [], overdue, extras);
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
    if (calendarDays(observedAt, deadline) <= 0) {
      Object.assign(row, { structureStatus: 'DELIVERED_ON_TIME', reasonCode: 'READY_OBSERVED_BY_DEADLINE', reason: 'Estrutura observada pronta até o prazo.', configuredAt: source.generatedAt, timingSource: 'SNAPSHOT_OBSERVED' });
      continue;
    }
    if (previous?.structureStatus === 'PENDING' && calendarDays(previous.calculatedAt, deadline) > 0) {
      Object.assign(row, { structureStatus: 'DELIVERED_LATE', reasonCode: 'READY_OBSERVED_AFTER_OVERDUE', reason: 'Estrutura permaneceu pendente após o prazo e foi observada pronta depois.', configuredAt: source.generatedAt, timingSource: 'SNAPSHOT_OBSERVED' });
    }
  }
}

function buildSnapshot(rawSource, catalog, options = {}) {
  const source = sourceSchema.parse(rawSource); const generatedAt = new Date(source.generatedAt); const qualityIssues = [...source.sourceIssues]; const rows = [];
  const manualDeliveries = new Map();
  for (const record of options.manualDeliveries || []) {
    const key = manualDeliveryKey(record.courseId, record.teacherId, record.requirementId, record.itemNumber);
    const current = manualDeliveries.get(key);
    if (!current || (Number(record.revision) || 1) >= (Number(current.revision) || 1)) manualDeliveries.set(key, record);
  }
  for (const course of source.courses) {
    const modality = catalog.modalities[course.modality];
    if (!modality) { qualityIssues.push({ code: 'UNKNOWN_MODALITY', message: `Modalidade não mapeada: ${course.modality}.`, severity: 'CRITICAL', courseId: course.id }); continue; }
    const required = modality.requirements.filter((requirement) => requirement.required);
    for (const requirement of required) {
      const matches = course.activities.filter((activity) => activity.requirementId === requirement.id);
      if (requirement.control === 'MANUAL_ITEM') {
        const quantity = expectedQuantity(requirement, course.workloadHours) ?? 1;
        const missingDeadline = Array.from({ length: quantity }, (_value, index) => requirementDeadline(course, matches[0], requirement.id, index + 1)).some((deadline) => !deadline.deadlineAt);
        if (missingDeadline) qualityIssues.push({ code: 'DEADLINE_MISSING', message: `${course.shortName}: prazo oficial ausente para um ou mais itens de ${requirement.label}.`, severity: 'CRITICAL', courseId: course.id });
        continue;
      }
      if (matches.length > 1) qualityIssues.push({ code: 'DUPLICATE_REQUIREMENT_MAPPING', message: `${course.shortName}: múltiplas atividades para ${requirement.label}.`, severity: 'CRITICAL', courseId: course.id });
      if (!matches.length) qualityIssues.push({ code: 'REQUIREMENT_NOT_MAPPED', message: `${course.shortName}: requisito não localizado (${requirement.label}).`, severity: 'CRITICAL', courseId: course.id });
      if (matches[0] && !matches[0].deadlineAt) qualityIssues.push({ code: 'DEADLINE_MISSING', message: `${course.shortName}: prazo oficial ausente para ${requirement.label}.`, severity: 'CRITICAL', courseId: course.id });
    }
    for (const teacher of course.teachers) {
      const access = calculateAccess(teacher, course, generatedAt, catalog.accessThresholds);
      const currentReady = required.every((requirement) => { const activity = course.activities.find((candidate) => candidate.requirementId === requirement.id); const quantity = expectedQuantity(requirement, course.workloadHours); return quantity !== null && activity?.mappingConfidence === 'EXACT' && activity.visible && activity.observedQuantity >= quantity; });
      const inheritedReady = Boolean(course.originalCourseId && course.restoredAt && teacher.assignedAt && new Date(course.restoredAt) <= new Date(teacher.assignedAt) && currentReady);
      for (const requirement of required) {
        const activity = course.activities.find((candidate) => candidate.requirementId === requirement.id);
        const count = requirement.control === 'MANUAL_ITEM' ? expectedQuantity(requirement, course.workloadHours) ?? 1 : 1;
        for (let itemNumber = 1; itemNumber <= count; itemNumber += 1) {
          const manual = requirement.control === 'MANUAL_ITEM';
          const evaluation = manual
            ? evaluateManualRequirement({ requirement, activity, course, teacher, inheritedReady, generatedAt, itemNumber, record: manualDeliveries.get(manualDeliveryKey(course.id, teacher.id, requirement.id, itemNumber)) })
            : evaluateRequirement({ requirement, activity, course, teacher, inheritedReady, generatedAt });
          const requirementKey = manual ? `${requirement.id}:${itemNumber}` : requirement.id;
          const requirementLabel = manual ? count === 1 ? requirement.itemLabel || requirement.label : `${requirement.itemLabel || requirement.label} ${itemNumber}` : requirement.label;
          const explicitOwner = course.requirementOwners[requirementKey] || course.requirementOwners[requirement.id];
          const manualOwners = manual ? course.teachers.filter((candidate) => {
            const entry = manualDeliveries.get(manualDeliveryKey(course.id, candidate.id, requirement.id, itemNumber));
            return entry && entry.disposition !== 'NOT_APPLICABLE';
          }) : [];
          const owner = explicitOwner || (course.teachers.length === 1 ? teacher.id : manualOwners.length === 1 ? manualOwners[0].id : null);
          const validOwner = owner && course.teachers.some((candidate) => candidate.id === owner) ? owner : null;
          rows.push({ rankingPolicy: catalog.ranking || null, snapshotId: null, course: { id: course.id, name: course.name, shortName: course.shortName, period: course.period, modality: course.modality, modalityLabel: modality.label, workloadHours: course.workloadHours, startsAt: course.startsAt, endsAt: course.endsAt }, teacher: { id: teacher.id, name: teacher.name, email: teacher.email }, requirement: { id: requirementKey, baseId: requirement.id, label: requirementLabel, manualControl: manual, responsibleTeacherId: validOwner, responsibility: validOwner ? validOwner === teacher.id ? 'ASSIGNED' : 'OTHER_TEACHER' : 'UNCONFIRMED', itemNumber: manual ? itemNumber : null, evidenceType: manual ? requirement.evidenceType : null }, structureStatus: evaluation.status, accessStatus: access.status, lastAccessAt: access.lastAccessAt, daysSinceAccess: access.daysSinceAccess, provenance: inheritedReady ? 'INHERITED_VERIFIED' : course.originalCourseId ? 'RESTORED_NOT_EXEMPT' : 'CREATED_FOR_PERIOD', calculatedAt: source.generatedAt, rulesVersion: catalog.version, ...evaluation });
        }
      }
    }
  }
  reconcileObservedTiming(rows, { generatedAt: source.generatedAt, rulesVersion: catalog.version }, options.previousSnapshot);
  for (const row of rows) Object.assign(row, delayFacts(row, source.generatedAt));
  const unverifiable = rows.filter((row) => row.structureStatus === 'NOT_VERIFIABLE');
  if (unverifiable.length) qualityIssues.push({ code: 'UNVERIFIABLE_RESULTS', message: `${unverifiable.length} resultado(s) sem evidência suficiente para publicação.`, severity: 'CRITICAL' });
  const keys = new Set();
  for (const row of rows) { const key = `${row.course.id}:${row.teacher.id}:${row.requirement.id}`; if (keys.has(key)) qualityIssues.push({ code: 'DUPLICATE_SNAPSHOT_KEY', message: `Chave duplicada: ${key}.`, severity: 'CRITICAL', courseId: row.course.id }); keys.add(key); }
  if (!options.rulesApproved) qualityIssues.push({ code: 'RULES_NOT_APPROVED', message: 'Catálogo piloto ainda não homologado pelo NED.', severity: 'CRITICAL' });
  const snapshotId = crypto.randomUUID(); rows.forEach((row) => { row.snapshotId = snapshotId; });
  const critical = qualityIssues.some((issue) => issue.severity === 'CRITICAL');
  return { id: snapshotId, generatedAt: source.generatedAt, source: source.source, rulesVersion: catalog.version, rulesStatus: catalog.status, qualityStatus: critical ? 'BLOCKED' : qualityIssues.length ? 'WARNING' : 'VALID', publishAllowed: !critical && Boolean(options.rulesApproved) && source.source !== 'demo', isDemo: source.source === 'demo', qualityIssues, rows };
}
module.exports = { buildSnapshot, calculateAccess, expectedQuantity, loadCatalog, manualDeliveryKey, manualDeliveryRevisionKey, reconcileObservedTiming, saoPauloDate };
