const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

class MemoryStore {
  constructor() { this.snapshots = []; this.reportRuns = []; this.auditEvents = []; this.manualDeliveries = []; }
  async init() {}
  async saveSnapshot(snapshot) { if (this.snapshots.some((item) => item.id === snapshot.id)) throw new Error('Snapshot duplicado.'); this.snapshots.push(structuredClone(snapshot)); this.snapshots.sort((a, b) => new Date(a.generatedAt) - new Date(b.generatedAt)); return snapshot; }
  async latestSnapshot() { return this.snapshots.length ? structuredClone(this.snapshots.at(-1)) : null; }
  async listSnapshots(limit = 12) { return structuredClone(this.snapshots.slice(-limit).reverse()); }
  async listManualDeliveries() { return structuredClone(this.manualDeliveries); }
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
  async recordReportRun(run) { this.reportRuns.push(structuredClone(run)); return run; }
  async updateReportRun(id, changes) { const index = this.reportRuns.findIndex((run) => run.id === id); if (index < 0) return null; this.reportRuns[index] = { ...this.reportRuns[index], ...structuredClone(changes) }; return this.reportRuns[index]; }
  async addAudit(event) { this.auditEvents.push({ id: this.auditEvents.length + 1, ...structuredClone(event) }); }
  async close() {}
}
function rowToSnapshot(meta, rows) { return { id: meta.id, generatedAt: new Date(meta.generated_at).toISOString(), source: meta.source, rulesVersion: meta.rules_version, rulesStatus: meta.rules_status, qualityStatus: meta.quality_status, publishAllowed: meta.publish_allowed, isDemo: meta.is_demo, qualityIssues: meta.quality_issues, rows: rows.map((row) => row.payload) }; }
function databaseDate(value) { if (!value) return null; return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10); }
function rowToManualDelivery(row) { return { courseId: row.course_id, teacherId: row.teacher_id, requirementId: row.requirement_id, itemNumber: row.item_number, revision: row.revision || 1, disposition: row.disposition, evidenceDate: databaseDate(row.evidence_date), publishedDate: databaseDate(row.published_date), justification: row.justification || null, replacementReason: row.replacement_reason || null, revisionDeadlineDate: databaseDate(row.revision_deadline_date), updatedBy: row.updated_by, updatedAt: new Date(row.updated_at).toISOString() }; }
class PostgresStore {
  constructor(connectionString) { this.pool = new Pool({ connectionString, max: 8, idleTimeoutMillis: 30000 }); }
  async init() { await this.pool.query(fs.readFileSync(path.join(__dirname, '..', 'sql', 'app-schema.sql'), 'utf8')); }
  async saveSnapshot(snapshot) {
    const client = await this.pool.connect();
    try { await client.query('BEGIN'); await client.query(`INSERT INTO pd_snapshots (id,generated_at,source,rules_version,rules_status,quality_status,publish_allowed,is_demo,quality_issues) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`, [snapshot.id, snapshot.generatedAt, snapshot.source, snapshot.rulesVersion, snapshot.rulesStatus, snapshot.qualityStatus, snapshot.publishAllowed, snapshot.isDemo, JSON.stringify(snapshot.qualityIssues)]); for (const row of snapshot.rows) await client.query(`INSERT INTO pd_snapshot_rows (snapshot_id,course_id,teacher_id,requirement_id,payload) VALUES ($1,$2,$3,$4,$5::jsonb)`, [snapshot.id, row.course.id, row.teacher.id, row.requirement.id, JSON.stringify(row)]); await client.query('COMMIT'); return snapshot; }
    catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
  async latestSnapshot() { const meta = await this.pool.query('SELECT * FROM pd_snapshots ORDER BY generated_at DESC LIMIT 1'); if (!meta.rowCount) return null; const rows = await this.pool.query('SELECT payload FROM pd_snapshot_rows WHERE snapshot_id=$1', [meta.rows[0].id]); return rowToSnapshot(meta.rows[0], rows.rows); }
  async listSnapshots(limit = 12) { const metas = await this.pool.query('SELECT * FROM pd_snapshots ORDER BY generated_at DESC LIMIT $1', [Math.max(1, Math.min(Number(limit) || 12, 52))]); const snapshots = []; for (const meta of metas.rows) { const rows = await this.pool.query('SELECT payload FROM pd_snapshot_rows WHERE snapshot_id=$1', [meta.id]); snapshots.push(rowToSnapshot(meta, rows.rows)); } return snapshots; }
  async listManualDeliveries() { const result = await this.pool.query('SELECT * FROM pd_manual_deliveries ORDER BY course_id,teacher_id,requirement_id,item_number,revision'); return result.rows.map(rowToManualDelivery); }
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
  async recordReportRun(run) { await this.pool.query(`INSERT INTO pd_report_runs (id,snapshot_id,audience,status,idempotency_key,recipients,error_message,sent_at) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8)`, [run.id, run.snapshotId, run.audience, run.status, run.idempotencyKey, JSON.stringify(run.recipients), run.errorMessage || null, run.sentAt || null]); return run; }
  async updateReportRun(id, changes) { const result = await this.pool.query(`UPDATE pd_report_runs SET status=COALESCE($2,status),error_message=$3,sent_at=$4 WHERE id=$1 RETURNING *`, [id, changes.status || null, changes.errorMessage || null, changes.sentAt || null]); return result.rows[0] || null; }
  async addAudit(event) { await this.pool.query(`INSERT INTO pd_audit_events (actor_id,action,target_id,request_id,metadata) VALUES ($1,$2,$3,$4,$5::jsonb)`, [event.actorId, event.action, event.targetId || null, event.requestId || null, JSON.stringify(event.metadata || {})]); }
  async close() { await this.pool.end(); }
}
function createReportRun({ snapshotId, audience, idempotencyKey, recipients, status }) { return { id: crypto.randomUUID(), snapshotId, audience, idempotencyKey, recipients, status, errorMessage: null, sentAt: null }; }
module.exports = { MemoryStore, PostgresStore, createReportRun };
