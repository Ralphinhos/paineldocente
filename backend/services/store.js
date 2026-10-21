const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const { saoPauloDate } = require('../core/timing');

function snapshotMeta(snapshot) { const { rows, ...meta } = snapshot; return structuredClone(meta); }
function semesterWeek(generatedAt) {
  const day = new Date(saoPauloDate(generatedAt) + 'T12:00:00Z');
  day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7);
  return day.toISOString().slice(0, 10);
}

class MemoryStore {
  constructor() { this.snapshots = []; this.reportRuns = []; this.auditEvents = []; this.manualDeliveries = []; this.deadlineCatalogs = []; }
  async init() {}
  async saveSnapshot(snapshot) { if ((snapshot.deadlineVersionId || null) !== (this.deadlineCatalogs.at(-1)?.id || null)) throw deadlineConflict(); if (this.snapshots.some((item) => item.id === snapshot.id)) throw new Error('Snapshot duplicado.'); this.snapshots.push(structuredClone(snapshot)); this.snapshots.sort((a, b) => new Date(a.generatedAt) - new Date(b.generatedAt)); return snapshot; }
  async latestSnapshot() { return this.snapshots.length ? structuredClone(this.snapshots.at(-1)) : null; }
  async getSnapshot(id, period) {
    const found = this.snapshots.find((snapshot) => snapshot.id === id);
    return found ? { ...snapshotMeta(found), rows: structuredClone(found.rows.filter((row) => !period || row.course.period === period)) } : null;
  }
  async listSemesterPeriods() { return [...new Set(this.snapshots.flatMap((snapshot) => snapshot.rows.map((row) => row.course.period)))].filter(Boolean).sort().reverse(); }
  async listSemesterSnapshotMetas(period, options = {}) {
    const weeks = new Map();
    for (const snapshot of [...this.snapshots].sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt) || b.id.localeCompare(a.id))) {
      if (!snapshot.rows.some((row) => row.course.period === period)) continue;
      const day = saoPauloDate(snapshot.generatedAt);
      if (options.dateFrom && day < options.dateFrom || options.dateTo && day > options.dateTo) continue;
      if (options.asOf && new Date(snapshot.generatedAt) > new Date(options.asOf)) continue;
      if (options.rulesVersion && snapshot.rulesVersion !== options.rulesVersion || options.source && snapshot.source !== options.source) continue;
      if ('deadlineVersionId' in options && (snapshot.deadlineVersionId || null) !== (options.deadlineVersionId || null)) continue;
      const week = semesterWeek(snapshot.generatedAt);
      if (!weeks.has(week)) weeks.set(week, snapshotMeta(snapshot));
    }
    return [...weeks.values()].slice(0, 26);
  }
  async listSnapshots(limit = 12) { return structuredClone(this.snapshots.slice(-limit).reverse()); }
  async listManualDeliveries() { return structuredClone(this.manualDeliveries); }
  async latestDeadlineCatalog() { return structuredClone(this.deadlineCatalogs.at(-1) || null); }
  async listDeadlineCatalogs(limit = 20) { return structuredClone(this.deadlineCatalogs.slice(-limit).reverse().map(({ catalog, impact, ...item }) => item)); }
  async saveDeadlineCatalog(entry, expectedId) {
    if ((this.deadlineCatalogs.at(-1)?.id || null) !== expectedId || this.snapshots.at(-1)?.id !== entry.sourceSnapshotId) throw deadlineConflict();
    const version = { ...structuredClone(entry), revision: this.deadlineCatalogs.length + 1 };
    this.deadlineCatalogs.push(version);
    this.auditEvents.push({ actorId: entry.actorId, action: 'DEADLINE_CATALOG_SAVED', targetId: entry.id, requestId: entry.requestId, metadata: { reason: entry.reason, impact: structuredClone(entry.impact) } });
    return structuredClone(version);
  }
  async upsertManualDeliveries(records) {
    for (const record of records) {
      const revision = Number(record.revision) || 1;
      const normalized = { ...record, revision };
      const index = this.manualDeliveries.findIndex((item) => item.courseId === record.courseId && item.teacherId === record.teacherId && item.requirementId === record.requirementId && item.itemNumber === record.itemNumber && (Number(item.revision) || 1) === revision);
      if (index >= 0) this.manualDeliveries[index] = structuredClone(normalized); else this.manualDeliveries.push(structuredClone(normalized));
    }
    return structuredClone(records);
  }
  async appendManualDeliveryRevisions(records) {
    for (const record of records) {
      const exists = this.manualDeliveries.some((item) => item.courseId === record.courseId && item.teacherId === record.teacherId && item.requirementId === record.requirementId && item.itemNumber === record.itemNumber && (Number(item.revision) || 1) === record.revision);
      if (exists) throw Object.assign(new Error('A versão já foi criada por outra operação.'), { code: 'MATERIAL_REVISION_CONFLICT', status: 409 });
    }
    this.manualDeliveries.push(...structuredClone(records));
    return structuredClone(records);
  }
  async findReportRun(key) { return this.reportRuns.find((run) => run.idempotencyKey === key) || null; }
  async claimReportRun(run) {
    const existing = this.reportRuns.find((item) => item.idempotencyKey === run.idempotencyKey);
    if (existing && existing.status !== 'FAILED') return { claimed: false, run: structuredClone(existing) };
    if (existing) Object.assign(existing, { status: 'PROCESSING', errorMessage: null, sentAt: null });
    else this.reportRuns.push(structuredClone(run));
    return { claimed: true, run: structuredClone(existing || run) };
  }
  async recordReportRun(run) { this.reportRuns.push(structuredClone(run)); return run; }
  async updateReportRun(id, changes) { const index = this.reportRuns.findIndex((run) => run.id === id); if (index < 0) return null; this.reportRuns[index] = { ...this.reportRuns[index], ...structuredClone(changes) }; return this.reportRuns[index]; }
  async addAudit(event) { this.auditEvents.push({ id: this.auditEvents.length + 1, ...structuredClone(event) }); }
  async close() {}
}
function deadlineConflict() { return Object.assign(new Error('A coleta ou os prazos mudaram. Recarregue e confira as datas novamente.'), { code: 'DEADLINES_STALE', status: 409 }); }
function rowToDeadlineVersion(row) { return row ? { id: row.id, revision: Number(row.revision), catalog: row.catalog, createdAt: new Date(row.created_at).toISOString(), createdBy: row.created_by, actorId: row.actor_id, reason: row.reason, sourceSnapshotId: row.source_snapshot_id, courseCount: row.course_count, changeCount: row.change_count } : null; }
function rowToSnapshot(meta, rows) { return { id: meta.id, generatedAt: new Date(meta.generated_at).toISOString(), source: meta.source, rulesVersion: meta.rules_version, rulesStatus: meta.rules_status, qualityStatus: meta.quality_status, publishAllowed: meta.publish_allowed, isDemo: meta.is_demo, qualityIssues: meta.quality_issues, deadlineVersionId: meta.deadline_version_id || null, rows: rows.map((row) => row.payload) }; }
function databaseDate(value) { if (!value) return null; return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10); }
function rowToManualDelivery(row) { return { courseId: row.course_id, teacherId: row.teacher_id, requirementId: row.requirement_id, itemNumber: row.item_number, revision: row.revision || 1, disposition: row.disposition, evidenceDate: databaseDate(row.evidence_date), publishedDate: databaseDate(row.published_date), justification: row.justification || null, replacementReason: row.replacement_reason || null, revisionDeadlineDate: databaseDate(row.revision_deadline_date), updatedBy: row.updated_by, updatedAt: new Date(row.updated_at).toISOString() }; }
class PostgresStore {
  constructor(connectionString) { this.pool = new Pool({ connectionString, max: 8, idleTimeoutMillis: 30000 }); }
  async init() { await this.pool.query(fs.readFileSync(path.join(__dirname, '..', 'sql', 'app-schema.sql'), 'utf8')); }
  async saveSnapshot(snapshot) {
    const client = await this.pool.connect();
    try { await client.query('BEGIN'); await client.query("SELECT pg_advisory_xact_lock(hashtext('paineldocente:deadlines'))"); const current = await client.query('SELECT id FROM pd_deadline_catalogs ORDER BY revision DESC LIMIT 1'); if ((current.rows[0]?.id || null) !== (snapshot.deadlineVersionId || null)) throw deadlineConflict(); await client.query(`INSERT INTO pd_snapshots (id,generated_at,source,rules_version,rules_status,quality_status,publish_allowed,is_demo,quality_issues,deadline_version_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)`, [snapshot.id, snapshot.generatedAt, snapshot.source, snapshot.rulesVersion, snapshot.rulesStatus, snapshot.qualityStatus, snapshot.publishAllowed, snapshot.isDemo, JSON.stringify(snapshot.qualityIssues), snapshot.deadlineVersionId || null]); for (const row of snapshot.rows) await client.query(`INSERT INTO pd_snapshot_rows (snapshot_id,course_id,teacher_id,requirement_id,payload) VALUES ($1,$2,$3,$4,$5::jsonb)`, [snapshot.id, row.course.id, row.teacher.id, row.requirement.id, JSON.stringify(row)]); await client.query('COMMIT'); return snapshot; }
    catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
  async latestSnapshot() { const meta = await this.pool.query('SELECT * FROM pd_snapshots ORDER BY generated_at DESC LIMIT 1'); if (!meta.rowCount) return null; const rows = await this.pool.query('SELECT payload FROM pd_snapshot_rows WHERE snapshot_id=$1', [meta.rows[0].id]); return rowToSnapshot(meta.rows[0], rows.rows); }
  async getSnapshot(id, period) {
    const meta = await this.pool.query('SELECT * FROM pd_snapshots WHERE id=$1', [id]);
    if (!meta.rowCount) return null;
    const rows = await this.pool.query("SELECT payload FROM pd_snapshot_rows WHERE snapshot_id=$1 AND ($2::text IS NULL OR payload->'course'->>'period'=$2)", [id, period || null]);
    return rowToSnapshot(meta.rows[0], rows.rows);
  }
  async listSemesterPeriods() {
    const result = await this.pool.query("SELECT DISTINCT payload->'course'->>'period' AS period FROM pd_snapshot_rows WHERE payload->'course'->>'period' IS NOT NULL ORDER BY period DESC");
    return result.rows.map((row) => row.period).filter(Boolean);
  }
  async listSemesterSnapshotMetas(period, options = {}) {
    const result = await this.pool.query(`SELECT * FROM (
      SELECT DISTINCT ON (date_trunc('week', s.generated_at AT TIME ZONE 'America/Sao_Paulo')) s.*
      FROM pd_snapshots s WHERE
        ($2::date IS NULL OR s.generated_at >= ($2::date::timestamp AT TIME ZONE 'America/Sao_Paulo'))
        AND ($3::date IS NULL OR s.generated_at < (($3::date + INTERVAL '1 day') AT TIME ZONE 'America/Sao_Paulo'))
        AND ($4::timestamptz IS NULL OR s.generated_at <= $4)
        AND ($5::text IS NULL OR s.rules_version=$5)
        AND ($6::text IS NULL OR s.source=$6)
        AND (NOT $7::boolean OR s.deadline_version_id IS NOT DISTINCT FROM $8::uuid)
        AND EXISTS (
        SELECT 1 FROM pd_snapshot_rows r WHERE r.snapshot_id=s.id AND r.payload->'course'->>'period'=$1
      ) ORDER BY date_trunc('week', s.generated_at AT TIME ZONE 'America/Sao_Paulo') DESC, s.generated_at DESC, s.id DESC
    ) weekly ORDER BY generated_at DESC LIMIT 26`, [period, options.dateFrom || null, options.dateTo || null, options.asOf || null,
      options.rulesVersion || null, options.source || null, 'deadlineVersionId' in options, options.deadlineVersionId || null]);
    return result.rows.map((row) => snapshotMeta(rowToSnapshot(row, [])));
  }
  async listSnapshots(limit = 12) { const metas = await this.pool.query('SELECT * FROM pd_snapshots ORDER BY generated_at DESC LIMIT $1', [Math.max(1, Math.min(Number(limit) || 12, 52))]); const snapshots = []; for (const meta of metas.rows) { const rows = await this.pool.query('SELECT payload FROM pd_snapshot_rows WHERE snapshot_id=$1', [meta.id]); snapshots.push(rowToSnapshot(meta, rows.rows)); } return snapshots; }
  async listManualDeliveries() { const result = await this.pool.query('SELECT * FROM pd_manual_deliveries ORDER BY course_id,teacher_id,requirement_id,item_number,revision'); return result.rows.map(rowToManualDelivery); }
  async latestDeadlineCatalog() { const result = await this.pool.query('SELECT * FROM pd_deadline_catalogs ORDER BY revision DESC LIMIT 1'); return rowToDeadlineVersion(result.rows[0]); }
  async listDeadlineCatalogs(limit = 20) { const result = await this.pool.query('SELECT id,revision,created_at,created_by,actor_id,reason,source_snapshot_id,course_count,change_count FROM pd_deadline_catalogs ORDER BY revision DESC LIMIT $1', [Math.max(1, Math.min(Number(limit) || 20, 50))]); return result.rows.map(rowToDeadlineVersion); }
  async saveDeadlineCatalog(entry, expectedId) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT pg_advisory_xact_lock(hashtext('paineldocente:deadlines'))");
      const current = await client.query('SELECT id FROM pd_deadline_catalogs ORDER BY revision DESC LIMIT 1');
      const latest = await client.query('SELECT id FROM pd_snapshots ORDER BY generated_at DESC LIMIT 1');
      if ((current.rows[0]?.id || null) !== expectedId || latest.rows[0]?.id !== entry.sourceSnapshotId) throw deadlineConflict();
      const result = await client.query('INSERT INTO pd_deadline_catalogs (id,catalog,created_at,created_by,actor_id,reason,source_snapshot_id,course_count,change_count) VALUES ($1,$2::jsonb,$3,$4,$5,$6,$7,$8,$9) RETURNING *', [entry.id, JSON.stringify(entry.catalog), entry.createdAt, entry.createdBy, entry.actorId, entry.reason, entry.sourceSnapshotId, entry.courseCount, entry.changeCount]);
      await client.query('INSERT INTO pd_audit_events (actor_id,action,target_id,request_id,metadata) VALUES ($1,$2,$3,$4,$5::jsonb)', [entry.actorId, 'DEADLINE_CATALOG_SAVED', entry.id, entry.requestId || null, JSON.stringify({ reason: entry.reason, impact: entry.impact })]);
      await client.query('COMMIT');
      return rowToDeadlineVersion(result.rows[0]);
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
  async upsertManualDeliveries(records) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const record of records) await client.query(`INSERT INTO pd_manual_deliveries (course_id,teacher_id,requirement_id,item_number,revision,disposition,evidence_date,published_date,justification,replacement_reason,revision_deadline_date,updated_by,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (course_id,teacher_id,requirement_id,item_number,revision) DO UPDATE SET disposition=EXCLUDED.disposition,evidence_date=EXCLUDED.evidence_date,published_date=EXCLUDED.published_date,justification=EXCLUDED.justification,replacement_reason=EXCLUDED.replacement_reason,revision_deadline_date=EXCLUDED.revision_deadline_date,updated_by=EXCLUDED.updated_by,updated_at=EXCLUDED.updated_at`, [record.courseId, record.teacherId, record.requirementId, record.itemNumber, record.revision || 1, record.disposition, record.evidenceDate, record.publishedDate, record.justification, record.replacementReason || null, record.revisionDeadlineDate || null, record.updatedBy, record.updatedAt]);
      await client.query('COMMIT');
      return records;
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
  async appendManualDeliveryRevisions(records) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const record of records) {
        const result = await client.query(`INSERT INTO pd_manual_deliveries (course_id,teacher_id,requirement_id,item_number,revision,disposition,evidence_date,published_date,justification,replacement_reason,revision_deadline_date,updated_by,updated_at) VALUES ($1,$2,$3,$4,$5,'PENDING',NULL,NULL,NULL,$6,$7,$8,$9) ON CONFLICT DO NOTHING`, [record.courseId, record.teacherId, record.requirementId, record.itemNumber, record.revision, record.replacementReason, record.revisionDeadlineDate, record.updatedBy, record.updatedAt]);
        if (result.rowCount !== 1) throw Object.assign(new Error('A versão já foi criada por outra operação.'), { code: 'MATERIAL_REVISION_CONFLICT', status: 409 });
      }
      await client.query('COMMIT');
      return records;
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
  async findReportRun(key) { const result = await this.pool.query('SELECT * FROM pd_report_runs WHERE idempotency_key=$1', [key]); return result.rows[0] || null; }
  async claimReportRun(run) {
    const result = await this.pool.query(`INSERT INTO pd_report_runs (id,snapshot_id,audience,status,idempotency_key,recipients,error_message,sent_at) VALUES ($1,$2,$3,'PROCESSING',$4,$5::jsonb,NULL,NULL) ON CONFLICT (idempotency_key) DO UPDATE SET status='PROCESSING',error_message=NULL,sent_at=NULL WHERE pd_report_runs.status='FAILED' RETURNING *`, [run.id, run.snapshotId, run.audience, run.idempotencyKey, JSON.stringify(run.recipients)]);
    if (result.rowCount) return { claimed: true, run: result.rows[0] };
    return { claimed: false, run: await this.findReportRun(run.idempotencyKey) };
  }
  async recordReportRun(run) { await this.pool.query(`INSERT INTO pd_report_runs (id,snapshot_id,audience,status,idempotency_key,recipients,error_message,sent_at) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8)`, [run.id, run.snapshotId, run.audience, run.status, run.idempotencyKey, JSON.stringify(run.recipients), run.errorMessage || null, run.sentAt || null]); return run; }
  async updateReportRun(id, changes) { const result = await this.pool.query(`UPDATE pd_report_runs SET status=COALESCE($2,status),error_message=$3,sent_at=$4 WHERE id=$1 RETURNING *`, [id, changes.status || null, changes.errorMessage || null, changes.sentAt || null]); return result.rows[0] || null; }
  async addAudit(event) { await this.pool.query(`INSERT INTO pd_audit_events (actor_id,action,target_id,request_id,metadata) VALUES ($1,$2,$3,$4,$5::jsonb)`, [event.actorId, event.action, event.targetId || null, event.requestId || null, JSON.stringify(event.metadata || {})]); }
  async close() { await this.pool.end(); }
}
function createReportRun({ snapshotId, audience, idempotencyKey, recipients, status }) { return { id: crypto.randomUUID(), snapshotId, audience, idempotencyKey, recipients, status, errorMessage: null, sentAt: null }; }
module.exports = { MemoryStore, PostgresStore, createReportRun };
