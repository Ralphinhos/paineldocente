const crypto = require('node:crypto');
const fs = require('node:fs');
const { z } = require('zod');
const { HttpError } = require('../core/http');
const { civilDateToIso, civilDates, officialDeadline, validCivilDate } = require('../core/deadlines');
const { expectedQuantity } = require('../core/rules');
const { calendarGroups, calendarGroupLabel, courseCalendarGroup, calendarRequirements, referenceDates } = require('../core/academic-calendar');

const changeSchema = z.object({
  snapshotId: z.string().uuid(), expectedVersionId: z.string().uuid().nullable(),
  period: z.string().min(1).max(50), modality: z.enum(['SEMESTRAL', 'MODULAR', 'GRADUACAO_EAD']),
  calendarGroup: z.enum(['M1', 'M2', 'COM_EGI', 'SEM_EGI']).optional(), bimester: z.enum(['1', '2']).optional(),
  courseIds: z.array(z.string().min(1).max(50)).min(1).max(1000),
  changes: z.array(z.object({ requirementId: z.string().min(1).max(100), dates: z.array(z.string().refine(validCivilDate, 'Data inválida.')).min(1).max(100) }).strict()).max(20),
  reason: z.string().trim().min(3).max(500),
}).strict();
const versionInfo = (value) => value ? { id: value.id, revision: value.revision, createdAt: value.createdAt, createdBy: value.createdBy, reason: value.reason, courseCount: value.courseCount, changeCount: value.changeCount } : null;

class DeadlineService {
  constructor({ store, snapshotService, catalog, config }) {
    Object.assign(this, { store, snapshotService, catalog });
    this.secret = config.auth.jwtSecret;
    this.fallback = JSON.parse(fs.readFileSync(config.moodle.deadlineCatalogPath, 'utf8'));
  }
  async context() {
    const [snapshot, version] = await Promise.all([this.store.latestSnapshot(), this.store.latestDeadlineCatalog()]);
    if (!snapshot) throw new HttpError(503, 'SNAPSHOT_UNAVAILABLE', 'Atualize a coleta para carregar as disciplinas.');
    const courses = [...new Map(snapshot.rows.map((row) => [row.course.id, row.course])).values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    const byRequirement = new Map();
    for (const row of snapshot.rows) {
      const key = row.course.id + ':' + row.requirement.baseId;
      const group = byRequirement.get(key) || [];
      group.push(row); byRequirement.set(key, group);
    }
    return { snapshot, version, courses, byRequirement, calendar: version?.catalog || this.fallback };
  }
  datesFor(context, course, requirement) {
    const configured = officialDeadline(context.calendar, course.period, course.modality, course.id, requirement.id);
    if (configured) return civilDates(configured);
    // Demo dates are fixtures only. Real deadlines come exclusively from the NED calendar.
    if (!context.snapshot.isDemo) return [];
    const rows = (context.byRequirement.get(course.id + ':' + requirement.id) || []).filter((row) => row.deadlineSource === 'DEMO_SCHEDULE');
    const unique = [...new Map(rows.map((row) => [row.requirement.itemNumber || 1, row])).values()].sort((a, b) => (a.requirement.itemNumber || 1) - (b.requirement.itemNumber || 1));
    const dates = unique.filter((row) => row.deadlineAt).map((row) => civilDates(row.deadlineAt)[0]);
    return new Set(dates).size === 1 ? [dates[0]] : dates;
  }
  async view(query = {}) {
    const context = await this.context();
    this.validateCalendarScope(query);
    const scope = context.courses.filter((course) => (!query.period || course.period === query.period) && (!query.modality || course.modality === query.modality)
      && (query.courseId ? course.id === query.courseId : !query.calendarGroup || courseCalendarGroup(context.calendar, course) === query.calendarGroup));
    const requirements = calendarRequirements(this.catalog, query.modality, query.calendarGroup, query.bimester).map((item) => {
      const values = scope.map((course) => this.datesFor(context, course, item));
      const first = values[0] || [];
      const mixed = values.some((dates) => JSON.stringify(dates) !== JSON.stringify(first));
      const videoQuantity = scope.length === 1 ? expectedQuantity(item, scope[0].workloadHours) : null;
      return { id: item.id, label: item.label, agendaOnly: item.agendaOnly, dates: mixed ? [] : first, mixed, individualCount: item.id === 'videos' && scope.length === 1 ? videoQuantity : null };
    });
    return {
      meta: { snapshotId: context.snapshot.id, version: versionInfo(context.version), pendingCollection: (context.snapshot.deadlineVersionId || null) !== (context.version?.id || null), isDemo: context.snapshot.isDemo },
      filters: { periods: [...new Set(context.courses.map((course) => course.period))].sort().reverse(), modalities: Object.entries(this.catalog.modalities).map(([value, item]) => ({ value, label: item.label })), calendarGroups: calendarGroups(query.modality), courses: context.courses.map((course) => ({ ...course, calendarGroup: courseCalendarGroup(context.calendar, course) })) },
      scope: scope.map(({ id, name, shortName, workloadHours }) => ({ id, name, shortName, workloadHours })), requirements,
      referenceDates: Object.fromEntries(Object.entries(referenceDates(query.period, query.modality, query.calendarGroup, query.bimester)).filter(([id]) => requirements.some((item) => item.id === id))),
      history: (await this.store.listDeadlineCatalogs(20)).map(versionInfo),
    };
  }
  normalize(input) {
    const parsed = changeSchema.safeParse(input);
    if (!parsed.success) throw new HttpError(400, 'DEADLINES_INVALID', 'Confira o recorte, as datas e o motivo da alteração.');
    const value = parsed.data;
    this.validateCalendarScope(value);
    if (!value.changes.length && !value.calendarGroup) throw new HttpError(400, 'DEADLINES_INVALID', 'Informe ao menos uma alteração.');
    if (new Set(value.courseIds).size !== value.courseIds.length || new Set(value.changes.map((item) => item.requirementId)).size !== value.changes.length) throw new HttpError(400, 'DEADLINES_DUPLICATE', 'A mesma disciplina ou atividade foi enviada mais de uma vez.');
    return { ...value, courseIds: [...value.courseIds].sort(), changes: [...value.changes].sort((a, b) => a.requirementId.localeCompare(b.requirementId)) };
  }
  validateCalendarScope(value) {
    if (value.calendarGroup && (!value.modality || !calendarGroups(value.modality).some((item) => item.value === value.calendarGroup)
      || value.modality === 'SEMESTRAL' && !value.bimester) || value.bimester && (value.modality !== 'SEMESTRAL' || !value.calendarGroup)) {
      throw new HttpError(400, 'DEADLINES_CALENDAR_INVALID', 'Selecione o módulo ou o modelo e bimestre corretos para a modalidade.');
    }
  }
  token(input, actorId, timestamp) {
    return crypto.createHmac('sha256', this.secret).update(JSON.stringify({ input, actorId, timestamp })).digest('base64url');
  }
  async prepare(input) {
    const context = await this.context();
    if (context.snapshot.id !== input.snapshotId || (context.version?.id || null) !== input.expectedVersionId) throw new HttpError(409, 'DEADLINES_STALE', 'A coleta ou os prazos mudaram. Descarte e recarregue antes de conferir novamente.');
    const allowed = new Map(context.courses.filter((course) => course.period === input.period && course.modality === input.modality).map((course) => [course.id, course]));
    const courses = input.courseIds.map((id) => allowed.get(id));
    if (courses.some((course) => !course)) throw new HttpError(400, 'DEADLINES_SCOPE_INVALID', 'Uma ou mais disciplinas não pertencem ao período e à modalidade selecionados.');
    const requirements = calendarRequirements(this.catalog, input.modality, input.calendarGroup, input.bimester);
    const catalog = structuredClone(context.calendar); catalog.periods ||= {};
    catalog.periods[input.period] ||= {};
    const scope = catalog.periods[input.period][input.modality] ||= {};
    scope.courses ||= {};
    const impact = [];
    if (input.calendarGroup) {
      scope.courseGroups ||= {};
      for (const course of courses) {
        const before = scope.courseGroups[course.id] || null;
        if (before === input.calendarGroup) continue;
        scope.courseGroups[course.id] = input.calendarGroup;
        impact.push({ courseId: course.id, courseName: course.name, shortName: course.shortName, requirementId: '__calendar_group', kind: 'GROUP', label: 'Vínculo ao calendário',
          before: [calendarGroupLabel(input.modality, before)], after: [calendarGroupLabel(input.modality, input.calendarGroup)], hasOwnRevisionDeadline: false });
      }
    }
    for (const change of input.changes) {
      const requirement = requirements.find((item) => item.id === change.requirementId);
      if (!requirement) throw new HttpError(400, 'DEADLINES_REQUIREMENT_INVALID', 'Atividade fora dos critérios desta modalidade.');
      for (const course of courses) {
        const quantity = expectedQuantity(requirement, course.workloadHours);
        if (quantity == null || quantity > 100 || change.dates.length !== 1 && (requirement.id !== 'videos' || courses.length !== 1 || change.dates.length !== quantity)) throw new HttpError(400, 'DEADLINES_QUANTITY_INVALID', 'Use uma data comum ou selecione uma disciplina e informe a data de cada videoaula prevista.');
        const before = this.datesFor(context, course, requirement);
        const after = change.dates;
        if (JSON.stringify(before) === JSON.stringify(after)) continue;
        scope.courses[course.id] ||= {};
        const iso = after.map(civilDateToIso);
        scope.courses[course.id][requirement.id] = iso.length === 1 ? iso[0] : iso;
        const revisions = (context.byRequirement.get(course.id + ':' + requirement.id) || []).filter((row) => (Number(row.manualVersion) || 1) > 1).length;
        impact.push({ courseId: course.id, courseName: course.name, shortName: course.shortName, requirementId: requirement.id, label: requirement.label, before, after, hasOwnRevisionDeadline: revisions > 0 });
      }
    }
    if (!impact.length) throw new HttpError(400, 'DEADLINES_UNCHANGED', 'Nenhuma data foi alterada neste recorte.');
    return { catalog, impact };
  }
  async preview(raw, actor) {
    const input = this.normalize(raw);
    const { impact } = await this.prepare(input);
    const timestamp = Date.now();
    return { impact, courseCount: new Set(impact.map((row) => row.courseId)).size, changeCount: impact.length, reviewToken: timestamp + '.' + this.token(input, actor.id, timestamp) };
  }
  async save(raw, reviewToken, actor, requestId) {
    const input = this.normalize(raw);
    const [time, signature] = String(reviewToken || '').split('.');
    const timestamp = Number(time);
    const expected = this.token(input, actor.id, timestamp);
    const actualBytes = Buffer.from(signature || ''); const expectedBytes = Buffer.from(expected);
    if (!Number.isSafeInteger(timestamp) || timestamp > Date.now() || Date.now() - timestamp > 15 * 60000 || actualBytes.length !== expectedBytes.length || !crypto.timingSafeEqual(actualBytes, expectedBytes)) throw new HttpError(409, 'DEADLINES_REVIEW_REQUIRED', 'Abra uma nova conferência das datas antes de salvar.');
    const { catalog, impact } = await this.prepare(input);
    const id = crypto.randomUUID();
    catalog.version = 'NED:' + id;
    const version = await this.store.saveDeadlineCatalog({ id, catalog, createdAt: new Date().toISOString(), createdBy: actor.name, actorId: actor.id, reason: input.reason, sourceSnapshotId: input.snapshotId, courseCount: new Set(impact.map((row) => row.courseId)).size, changeCount: impact.length, impact, requestId }, input.expectedVersionId);
    try {
      const snapshot = await this.snapshotService.run();
      return { version: versionInfo(version), collected: true, snapshotId: snapshot.id, message: 'Prazos salvos. Confira os indicadores e abra uma nova prévia dos relatórios.' };
    } catch {
      return { version: versionInfo(version), collected: false, snapshotId: null, message: 'Prazos salvos. A coleta não terminou; atualize os dados antes de enviar relatórios.' };
    }
  }
}

module.exports = { changeSchema, DeadlineService };
