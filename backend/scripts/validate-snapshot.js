const { createRuntime } = require('../runtime');
const { calendarDays } = require('../core/timing');

function validateSnapshot(snapshot) {
  const errors = [];
  if (!snapshot || !Array.isArray(snapshot.rows) || snapshot.rows.length === 0) return ['SNAPSHOT_EMPTY'];
  const keys = new Set();
  const accessByAssignment = new Map();
  const environmentByTeacher = new Map();
  for (const row of snapshot.rows) {
    const key = `${row.course.id}:${row.teacher.id}:${row.requirement.id}`;
    if (keys.has(key)) errors.push(`DUPLICATE_KEY:${key}`);
    keys.add(key);
    if (row.snapshotId !== snapshot.id) errors.push(`SNAPSHOT_ID_MISMATCH:${key}`);
    const assignment = `${row.course.id}:${row.teacher.id}`;
    const access = JSON.stringify([row.accessStatus, row.lastAccessAt, row.daysSinceAccess]);
    if (accessByAssignment.has(assignment) && accessByAssignment.get(assignment) !== access) errors.push(`ACCESS_INCONSISTENT:${assignment}`);
    accessByAssignment.set(assignment, access);
    const environment = row.environmentAccess;
    if (!environment) errors.push(`ENVIRONMENT_ACCESS_MISSING:${row.teacher.id}`);
    else {
      const fact = JSON.stringify([environment.status, environment.lastAccessAt, environment.daysSinceAccess]);
      if (environmentByTeacher.has(row.teacher.id) && environmentByTeacher.get(row.teacher.id) !== fact) errors.push(`ENVIRONMENT_ACCESS_INCONSISTENT:${row.teacher.id}`);
      environmentByTeacher.set(row.teacher.id, fact);
      if (['CURRENT', 'ATTENTION', 'CRITICAL'].includes(environment.status)) {
        const last = new Date(environment.lastAccessAt);
        if (!environment.lastAccessAt || Number.isNaN(last.getTime()) || last > new Date(snapshot.generatedAt)) errors.push(`ENVIRONMENT_ACCESS_DATE_INVALID:${row.teacher.id}`);
        else {
          const days = calendarDays(snapshot.generatedAt, environment.lastAccessAt);
          const expected = days <= 7 ? 'CURRENT' : days <= 14 ? 'ATTENTION' : 'CRITICAL';
          if (environment.daysSinceAccess !== days || environment.status !== expected) errors.push(`ENVIRONMENT_ACCESS_BAND_INVALID:${row.teacher.id}`);
        }
      } else if (!['NEVER', 'NOT_VERIFIABLE'].includes(environment.status) || environment.lastAccessAt !== null || environment.daysSinceAccess !== null) errors.push(`ENVIRONMENT_ACCESS_STATE_INVALID:${row.teacher.id}`);
      if (environment.status === 'NOT_VERIFIABLE' && snapshot.publishAllowed) errors.push(`ENVIRONMENT_ACCESS_UNVERIFIED_PUBLISHED:${row.teacher.id}`);
    }
    const activeRevision = row.requirement.manualControl && (Number(row.manualVersion) || 1) > 1;
    if (row.provenance === 'INHERITED_VERIFIED' && row.structureStatus !== 'INHERITED_READY' && !activeRevision) errors.push(`INHERITED_STATUS_INVALID:${key}`);
    if (snapshot.source === 'moodle' && row.deadlineSource && row.deadlineSource !== 'OFFICIAL_CATALOG' && !(activeRevision && row.deadlineSource === 'MANUAL_REVISION')) errors.push(`DEADLINE_SOURCE_INVALID:${key}`);
    if (snapshot.source === 'moodle' && ['DELIVERED_ON_TIME', 'DELIVERED_LATE'].includes(row.structureStatus) && !['SNAPSHOT_OBSERVED', 'MANUAL_NED'].includes(row.timingSource)) errors.push(`TIMING_SOURCE_INVALID:${key}`);
    if (row.requirement.manualControl) {
      if (!row.requirement.baseId || !row.requirement.itemNumber) errors.push(`MANUAL_ITEM_KEY_INVALID:${key}`);
      if (['DELIVERED_ON_TIME', 'DELIVERED_LATE'].includes(row.structureStatus) && (!row.manualEvidenceDate || row.timingSource !== 'MANUAL_NED')) errors.push(`MANUAL_EVIDENCE_INVALID:${key}`);
      if (row.structureStatus === 'NOT_APPLICABLE' && !row.manualJustification?.trim()) errors.push(`NOT_APPLICABLE_REASON_MISSING:${key}`);
      if (activeRevision && (!row.manualReplacementReason?.trim() || !row.manualRevisionDeadlineDate)) errors.push(`MATERIAL_REVISION_INVALID:${key}`);
    }
    for (const evidence of row.evidence || []) {
      if (evidence.type === 'COMPLETION_CHANGED' && evidence.supports !== 'ACCESS_ONLY') errors.push(`COMPLETION_MISCLASSIFIED:${key}`);
      if (evidence.type === 'MODULE_VIEWED' && !['ACCESS_ONLY', 'TEACHER_INTERACTION'].includes(evidence.supports)) errors.push(`VIEW_MISCLASSIFIED:${key}`);
    }
  }
  if (snapshot.publishAllowed && (snapshot.isDemo || snapshot.qualityStatus === 'BLOCKED')) errors.push('PUBLISH_GATE_INVALID');
  return [...new Set(errors)];
}

async function main() {
  const runtime = await createRuntime();
  try {
    const fresh = process.argv.includes('--fresh');
    const requirePublishable = process.argv.includes('--require-publishable');
    const snapshot = fresh ? await runtime.services.snapshotService.run() : await runtime.services.store.latestSnapshot();
    const invariantErrors = validateSnapshot(snapshot);
    const deadlineVersion = await runtime.services.store.latestDeadlineCatalog();
    const pendingDeadlineCollection = (deadlineVersion?.id || null) !== (snapshot?.deadlineVersionId || null);
    const result = {
      valid: invariantErrors.length === 0,
      publishAllowed: Boolean(snapshot?.publishAllowed && !pendingDeadlineCollection),
      pendingDeadlineCollection,
      snapshotId: snapshot?.id || null,
      source: snapshot?.source || null,
      rows: snapshot?.rows?.length || 0,
      qualityStatus: snapshot?.qualityStatus || 'UNAVAILABLE',
      qualityIssues: snapshot?.qualityIssues || [],
      invariantErrors,
    };
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (invariantErrors.length) process.exitCode = 1;
    else if (requirePublishable && !result.publishAllowed) process.exitCode = 2;
  } finally {
    await runtime.close();
  }
}

if (require.main === module) main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ valid: false, error: error.message })}\n`);
  process.exitCode = 1;
});

module.exports = { validateSnapshot };
