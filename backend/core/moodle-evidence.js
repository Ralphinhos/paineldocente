const { saoPauloDate } = require('./timing');

const technicalEvents = {
  '\\painel\\metadata\\module_added': ['MOODLE_MODULE_ADDED', 'Data de inclusão da atividade no curso. Inclusão não comprova que o preparo estava completo.'],
  '\\painel\\metadata\\activity_modified': ['MOODLE_ACTIVITY_MODIFIED', 'Última alteração da instância no Moodle. Pode ser um ajuste posterior; não é a data de entrega.'],
  '\\painel\\metadata\\module_update_log': ['MOODLE_MODULE_UPDATE_LOG', 'Último registro de alteração do módulo na janela consultada, por qualquer usuário. Não comprova entrega pelo docente.'],
};

function timestamp(value, generatedAt) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) return null;
  const date = new Date(number * 1000);
  return Number.isFinite(date.getTime()) && date <= new Date(generatedAt) ? date.toISOString() : null;
}
function count(value) { return value != null && Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : null; }

function activityFacts(row, generatedAt) {
  return {
    moduleId: String(row.cm_id), module: row.module_name, teacherId: String(row.teacher_id),
    visible: row.activity_visible == null ? null : Number(row.activity_visible) === 1,
    addedAt: timestamp(row.cm_created_at, generatedAt), modifiedAt: timestamp(row.activity_modified_at, generatedAt),
    descriptionPresent: row.activity_description_present == null ? null : Number(row.activity_description_present) === 1,
    questionSlots: count(row.question_slot_count), discussions: count(row.discussion_count),
    creationLogAt: timestamp(row.creation_log_at, generatedAt), firstUpdateLogAt: timestamp(row.first_update_log_at, generatedAt),
    lastUpdateLogAt: timestamp(row.last_update_log_at, generatedAt),
    teacherUpdateLogAt: timestamp(row.module_updated_at, generatedAt),
    teacherCompletionLogAt: timestamp(row.completion_updated_at, generatedAt), teacherViewLogAt: timestamp(row.module_viewed_at, generatedAt),
  };
}

function metadataEvents(facts) {
  return [
    ['\\painel\\metadata\\module_added', facts.addedAt],
    ['\\painel\\metadata\\activity_modified', facts.modifiedAt],
    ['\\painel\\metadata\\module_update_log', facts.lastUpdateLogAt],
  ].filter(([, occurredAt]) => occurredAt).map(([name, occurredAt]) => ({ name, occurredAt, moduleId: facts.moduleId }));
}

function technicalEvidence(event) {
  const rule = technicalEvents[event.name];
  return rule ? { type: rule[0], occurredAt: event.occurredAt, supports: 'CONTEXT_ONLY', note: (event.moduleId ? `Módulo ${event.moduleId}: ` : '') + rule[1] } : null;
}

function pilotEvidenceReport(raw, queryWindowDays) {
  const date = (value) => value ? saoPauloDate(value) + ' (São Paulo)' : 'sem registro';
  const lines = [`EVIDÊNCIAS MOODLE · ${raw.courses.length} disciplina(s) · logs dos últimos ${queryWindowDays} dias.`,
    'Datas técnicas são contexto. Criação, edição, visualização e conclusão isoladas não comprovam entrega.'];
  for (const course of raw.courses) {
    const facts = (course.moodleActivityFacts || []).filter((item) => !['unidades_aprendizagem', 'videos', 'substitutiva'].includes(item.requirementId));
    lines.push(`Disciplina ${course.id}: ${facts.length} vínculo(s) de atividade/docente identificado(s).`);
    for (const fact of facts.slice(0, 20)) {
      lines.push(`  ${fact.requirementId} · módulo ${fact.moduleId} (${fact.module}) · docente ID ${fact.teacherId}`,
        `    Visível: ${fact.visible === null ? 'desconhecido' : fact.visible ? 'sim' : 'não'}; descrição preenchida no banco: ${fact.descriptionPresent === null ? 'não consultada' : fact.descriptionPresent ? 'sim' : 'não'}.`,
        `    Incluída no curso: ${date(fact.addedAt)}; última alteração da instância: ${date(fact.modifiedAt)}.`,
        `    Logs de estrutura (qualquer autor): criação ${date(fact.creationLogAt)}; primeira edição na janela ${date(fact.firstUpdateLogAt)}; última edição ${date(fact.lastUpdateLogAt)}.`,
        `    Logs do docente: primeira edição na janela ${date(fact.teacherUpdateLogAt)}; conclusão ${date(fact.teacherCompletionLogAt)}; visualização ${date(fact.teacherViewLogAt)}.`);
      if (fact.questionSlots !== null) lines.push(`    Posições de questões no questionário: ${fact.questionSlots}. A contagem não valida o conteúdo das questões.`);
      if (fact.discussions !== null) lines.push(`    Tópicos no fórum: ${fact.discussions} (qualquer autor). A contagem não comprova autoria ou preparo docente.`);
    }
    if (facts.length > 20) lines.push(`  Mais ${facts.length - 20} vínculo(s) omitido(s) deste resumo.`);
  }
  lines.push('Conferir esta amostra com o histórico do Moodle antes de homologar a data de entrega automática.');
  return lines;
}

module.exports = { activityFacts, metadataEvents, technicalEvidence, pilotEvidenceReport };
