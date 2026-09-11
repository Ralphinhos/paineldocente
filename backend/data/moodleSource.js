const fs = require('node:fs');
const path = require('node:path');
const sql = require('mssql');

function fromUnix(value) { const n = Number(value); return n > 0 ? new Date(n * 1000).toISOString() : null; }
function normalize(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
function classifyModality(value, category, shortName) {
  const text = normalize(`${value} ${category} ${shortName}`);
  if (text.includes('modular')) return 'MODULAR';
  if (text.includes('semestral')) return 'SEMESTRAL';
  if (text.includes('ead') || text.includes('graduacao')) return 'GRADUACAO_EAD';
  return null;
}
function classifyRequirement(name, modality) {
  const text = normalize(name);
  if (/unidade(s)? de aprendizagem|\bua\s*\d/.test(text)) return 'unidades_aprendizagem';
  if (/videoaula|video aula|\bvideo\b/.test(text)) return 'videos';
  if (text.includes('desafio')) return 'desafio';
  if (text.includes('substitutiva')) return 'substitutiva';
  if (/avaliacao.*bimestral.*1|avaliacao.*1.*bimestre/.test(text)) return 'avaliacao_bimestral_1';
  if (/avaliacao.*bimestral.*2|avaliacao.*2.*bimestre/.test(text)) return 'avaliacao_bimestral_2';
  if (/avaliacao.*final/.test(text)) return 'avaliacao_final';
  if (text.includes('forum') && text.includes('diagnostico')) return 'forum_diagnostico';
  if (text.includes('forum') && text.includes('avaliativo')) return 'forum_avaliativo';
  if (text.includes('forum') && modality === 'SEMESTRAL') return 'forum';
  return null;
}
function derivePeriod(shortName, startsAt) { const match = String(shortName || '').match(/(20\d{2})[^0-9]?([12])/); if (match) return `${match[1]}/${match[2]}`; const date = new Date(startsAt); return Number.isNaN(date.getTime()) ? null : `${date.getUTCFullYear()}/${date.getUTCMonth() < 6 ? 1 : 2}`; }
function deriveWorkload(value, shortName, courseName) { const match = `${value || ''} ${shortName} ${courseName}`.match(/(?:^|\D)(20|40|60|80)\s*h?(?:\D|$)/i); return match ? Number(match[1]) : null; }
function officialDeadline(catalog, period, modality, courseId, requirementId) {
  const scope = catalog?.periods?.[period]?.[modality];
  return scope?.courses?.[courseId]?.[requirementId] || scope?.defaults?.[requirementId] || null;
}
function buildEvents(row, teacherId) { return [row.module_updated_at && { name: '\\core\\event\\course_module_updated', occurredAt: fromUnix(row.module_updated_at), actorId: teacherId, origin: 'web' }, row.completion_updated_at && { name: '\\core\\event\\course_module_completion_updated', occurredAt: fromUnix(row.completion_updated_at), actorId: teacherId, relatedUserId: row.completion_related_user_id ? String(row.completion_related_user_id) : undefined, origin: 'web' }, row.module_viewed_at && { name: `\\mod_${row.module_name}\\event\\course_module_viewed`, occurredAt: fromUnix(row.module_viewed_at), actorId: teacherId, origin: 'web' }].filter(Boolean); }

function normalizeRows(recordset, generatedAt, deadlineCatalog = { periods: {} }) {
  const courses = new Map(); const sourceIssues = [];
  if (!deadlineCatalog.version || deadlineCatalog.version === 'NAO_HOMOLOGADO') sourceIssues.push({ code: 'DEADLINE_CATALOG_NOT_APPROVED', message: 'Catálogo oficial de prazos ainda não foi preenchido.', severity: 'CRITICAL' });
  for (const row of recordset) {
    const courseId = String(row.course_id); const teacherId = String(row.teacher_id); let course = courses.get(courseId);
    if (!course) {
      const startsAt = fromUnix(row.startdate) || generatedAt; const endsAt = fromUnix(row.enddate) || new Date(new Date(startsAt).getTime() + 180 * 86400000).toISOString();
      const explicitModality = classifyModality(row.modality_field_value, '', '');
      const fallbackModality = classifyModality(row.category_field_value, row.category_name, row.course_shortname);
      const modality = explicitModality || fallbackModality;
      if (explicitModality && fallbackModality && explicitModality !== fallbackModality) sourceIssues.push({ code: 'MODALITY_CONFLICT', message: `${row.course_shortname}: campo modalidade conflita com categoria/nome.`, severity: 'CRITICAL', courseId });
      const fieldWorkload = deriveWorkload(row.workload_value, '', ''); const namedWorkload = deriveWorkload(null, row.course_shortname, row.course_name); const workload = fieldWorkload || namedWorkload; const period = derivePeriod(row.course_shortname, startsAt) || 'NÃO IDENTIFICADO';
      if (row.workload_value && !fieldWorkload) sourceIssues.push({ code: 'WORKLOAD_FIELD_INVALID', message: `${row.course_shortname}: campo de carga horária não reconhecido.`, severity: 'CRITICAL', courseId });
      if (fieldWorkload && namedWorkload && fieldWorkload !== namedWorkload) sourceIssues.push({ code: 'WORKLOAD_CONFLICT', message: `${row.course_shortname}: carga horária do campo conflita com o nome.`, severity: 'CRITICAL', courseId });
      if (!modality) sourceIssues.push({ code: 'MODALITY_UNMAPPED', message: `${row.course_shortname}: modalidade não reconhecida.`, severity: 'CRITICAL', courseId });
      if (!workload) sourceIssues.push({ code: 'WORKLOAD_UNMAPPED', message: `${row.course_shortname}: carga horária não reconhecida.`, severity: 'CRITICAL', courseId });
      const requirementDeadlines = {};
      for (const requirementId of ['unidades_aprendizagem', 'videos']) {
        const value = officialDeadline(deadlineCatalog, period, modality, courseId, requirementId);
        if (value) requirementDeadlines[requirementId] = value;
      }
      course = { id: courseId, name: row.course_name, shortName: row.course_shortname, period, modality: modality || 'NAO_MAPEADA', workloadHours: workload || 1, startsAt, endsAt, originalCourseId: row.originalcourseid ? String(row.originalcourseid) : null, restoredAt: row.originalcourseid ? fromUnix(row.course_created_at) : null, requirementDeadlines, requirementOwners: deadlineCatalog?.periods?.[period]?.[modality]?.responsibleTeachers?.[courseId] || {}, teachers: new Map(), groups: new Map() }; courses.set(courseId, course);
    }
    if (!course.teachers.has(teacherId)) course.teachers.set(teacherId, { id: teacherId, name: row.teacher_name, email: row.teacher_email || null, assignedAt: fromUnix(row.assigned_at), lastAccessAt: fromUnix(row.last_access_at), accessEvents: [] });
    const teacher = course.teachers.get(teacherId);
    if (!row.cm_id) continue;
    const requirementId = classifyRequirement(row.activity_name, course.modality); if (!requirementId) continue;
    const configuredDeadline = officialDeadline(deadlineCatalog, course.period, course.modality, courseId, requirementId);
    const group = course.groups.get(requirementId) || { id: `${courseId}:${requirementId}`, requirementId, label: row.activity_name, observedQuantity: 0, visible: false, configuredAt: null, configurationTimeSource: null, deadlineAt: Array.isArray(configuredDeadline) ? configuredDeadline[0] || null : configuredDeadline, deadlineSource: null, mappingConfidence: 'EXACT', events: [], moduleIds: new Set() };
    if (group.deadlineAt) group.deadlineSource = 'OFFICIAL_CATALOG';
    const moduleId = String(row.cm_id); if (!group.moduleIds.has(moduleId)) { group.observedQuantity += row.activity_visible ? 1 : 0; group.moduleIds.add(moduleId); }
    group.visible = group.observedQuantity > 0;
    const events = buildEvents(row, teacherId); group.events.push(...events); teacher.accessEvents.push(...events); course.groups.set(requirementId, group);
  }
  return { source: 'moodle', generatedAt, sourceIssues, courses: [...courses.values()].map((course) => ({ ...course, teachers: [...course.teachers.values()], activities: [...course.groups.values()].map(({ moduleIds, ...group }) => ({ ...group, mappingConfidence: !['unidades_aprendizagem', 'videos'].includes(group.requirementId) && moduleIds.size > 1 ? 'AMBIGUOUS' : group.mappingConfidence })), groups: undefined })) };
}

class MoodleSource {
  constructor(config) { this.config = config; this.pool = null; this.deadlines = JSON.parse(fs.readFileSync(config.deadlineCatalogPath, 'utf8')); }
  async connect() {
    if (this.pool) return this.pool; const ca = this.config.caFile ? fs.readFileSync(this.config.caFile, 'utf8') : undefined;
    this.pool = await new sql.ConnectionPool({ server: this.config.server, port: this.config.port, database: this.config.database, user: this.config.user, password: this.config.password, connectionTimeout: this.config.requestTimeoutMs, requestTimeout: this.config.requestTimeoutMs, pool: { max: 2, min: 0, idleTimeoutMillis: 30000 }, options: { encrypt: true, trustServerCertificate: false, enableArithAbort: true, ...(ca ? { cryptoCredentialsDetails: { ca } } : {}) } }).connect(); return this.pool;
  }
  async fetch() { const generatedAt = new Date().toISOString(); const pool = await this.connect(); const query = fs.readFileSync(path.join(__dirname, '..', 'sql', 'moodle-snapshot.sql'), 'utf8'); const result = await pool.request().input('categoryRoot', sql.Int, this.config.categoryRoot).input('teacherRoleId', sql.Int, this.config.teacherRoleId).input('logFrom', sql.BigInt, Math.floor((Date.now() - this.config.queryWindowDays * 86400000) / 1000)).query(query); return normalizeRows(result.recordset, generatedAt, this.deadlines); }
  async close() { if (this.pool) await this.pool.close(); this.pool = null; }
}
module.exports = { MoodleSource, classifyRequirement, normalizeRows, officialDeadline };
