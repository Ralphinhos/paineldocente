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

function hasContent(value) {
  if (typeof value !== 'string') return false;
  const text = value.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  if (/<(?:img|audio|video|iframe|object|embed)\b[^>]*\b(?:src|data)\s*=/i.test(text)) return true;
  return text.replace(/<[^>]*>/g, '').replace(/&#(x[0-9a-f]+|\d+);/gi, (_match, value) => {
    const code = value[0].toLowerCase() === 'x' ? parseInt(value.slice(1), 16) : Number(value);
    return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
  }).replace(/&(?:nbsp|ensp|emsp|thinsp|zwnj|zwj|shy|Tab|NewLine);/gi, '').replace(/[\s\p{Cc}\p{Cf}]/gu, '').length > 0;
}

function expectedModuleFor(requirementId) {
  if (requirementId === 'desafio') return 'assign';
  if (requirementId.startsWith('forum')) return 'forum';
  if (requirementId.startsWith('avaliacao_')) return 'quiz';
  return null;
}

function activityFacts(row, generatedAt) {
  return {
    moduleId: String(row.cm_id), module: row.module_name, teacherId: String(row.teacher_id),
    visible: row.activity_visible == null ? null : Number(row.activity_visible) === 1,
    addedAt: timestamp(row.cm_created_at, generatedAt), modifiedAt: timestamp(row.activity_modified_at, generatedAt),
    descriptionPresent: row.activity_description_present == null ? null : Number(row.activity_description_present) === 1,
    contentPresent: hasContent(row.activity_content), contentAvailable: row.activity_content != null,
    questionSlots: count(row.question_slot_count), discussions: count(row.discussion_count),
    creationLogAt: timestamp(row.creation_log_at, generatedAt), firstUpdateLogAt: timestamp(row.first_update_log_at, generatedAt),
    lastUpdateLogAt: timestamp(row.last_update_log_at, generatedAt),
    teacherUpdateLogAt: timestamp(row.module_updated_at, generatedAt),
    teacherCompletionLogAt: timestamp(row.completion_updated_at, generatedAt), teacherViewLogAt: timestamp(row.module_viewed_at, generatedAt),
    forumStarterId: row.forum_starter_id == null ? null : String(row.forum_starter_id),
    forumStarterByTeacher: row.forum_starter_author_id != null && String(row.forum_starter_author_id) === String(row.teacher_id),
    forumStarterCreatedAt: timestamp(row.forum_starter_created_at, generatedAt), forumStarterModifiedAt: timestamp(row.forum_starter_modified_at, generatedAt),
    forumStarterContentPresent: hasContent(row.forum_starter_content),
    quizCompletedAttempts: row.module_name === 'quiz' ? count(row.quiz_completed_attempts) : null,
    quizFirstFinishedAt: timestamp(row.quiz_first_finished_at, generatedAt),
    courseStartsAt: timestamp(row.startdate, generatedAt),
  };
}

function readinessConfirmed(facts) {
  if (facts.module === 'assign') return facts.contentAvailable ? facts.contentPresent : null;
  if (facts.module === 'forum') return facts.contentAvailable || facts.forumStarterId ? facts.contentPresent || facts.forumStarterByTeacher && facts.forumStarterContentPresent : null;
  if (facts.module === 'quiz') return facts.questionSlots === null ? null : facts.questionSlots > 0;
  return null;
}

// An upper bound can confirm "on time"; it must never fabricate the first delivery date or a late delivery.
function readyBy(facts) {
  if (!facts.visible || !facts.addedAt) return null;
  let kind; let dates;
  if (facts.module === 'assign' && facts.contentPresent && facts.modifiedAt && facts.lastUpdateLogAt && facts.lastUpdateLogAt >= facts.modifiedAt) {
    kind = 'ASSIGN_STATE'; dates = [facts.addedAt, facts.modifiedAt, facts.lastUpdateLogAt];
  } else if (facts.module === 'forum' && facts.forumStarterByTeacher && facts.forumStarterContentPresent && facts.forumStarterCreatedAt && facts.forumStarterModifiedAt && facts.modifiedAt) {
    if (facts.forumStarterCreatedAt < facts.addedAt || facts.forumStarterModifiedAt < facts.forumStarterCreatedAt) return null;
    kind = 'FORUM_STARTER'; dates = [facts.addedAt, facts.modifiedAt, facts.lastUpdateLogAt, facts.forumStarterCreatedAt, facts.forumStarterModifiedAt].filter(Boolean);
  } else if (facts.module === 'quiz' && facts.questionSlots > 0 && facts.quizCompletedAttempts > 0 && facts.quizFirstFinishedAt && facts.courseStartsAt && facts.quizFirstFinishedAt >= facts.addedAt && facts.quizFirstFinishedAt >= facts.courseStartsAt) {
    kind = 'QUIZ_FINISHED_ATTEMPT'; dates = [facts.quizFirstFinishedAt];
  } else return null;
  return { at: dates.sort().at(-1), kind, moduleId: facts.moduleId };
}

function readyByEvidence(proof) {
  const notes = {
    ASSIGN_STATE: 'Descrição com conteúdo e alteração de estrutura compatível com a atualização da Tarefa.',
    FORUM_STARTER: 'Tópico inicial com conteúdo de docente vinculado; consideradas também suas alterações e as do módulo.',
    QUIZ_FINISHED_ATTEMPT: 'Há uso concluído do questionário sem prévia, fora dos docentes vinculados. Não é a data de preparo pelo professor.',
  };
  return { type: 'MOODLE_READY_BY_' + proof.kind, occurredAt: proof.at, supports: 'READY_BY_BOUND', note: `Módulo ${proof.moduleId}: ${notes[proof.kind]} Comprova preparo até esta data, sem identificar a entrega inicial.` };
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
      lines.push(`    Seleção: ${fact.selection === 'excluded' ? 'excluído: há atividade do tipo esperado' : fact.selection === 'unsupported' ? 'tipo não homologado para este requisito' : 'selecionado'}.`);
      if (fact.questionSlots !== null) lines.push(`    Posições de questões no questionário: ${fact.questionSlots}. A contagem não valida o conteúdo das questões.`);
      if (fact.discussions !== null) lines.push(`    Tópicos no fórum: ${fact.discussions} (qualquer autor). A contagem não comprova autoria ou preparo docente.`);
      if (fact.module === 'forum') lines.push(`    Tópico inicial analisado: ${fact.forumStarterId || 'ausente'}; autor é o docente deste vínculo: ${fact.forumStarterByTeacher ? 'sim' : 'não'}; conteúdo identificado: ${fact.forumStarterContentPresent ? 'sim' : 'não'}; criação ${date(fact.forumStarterCreatedAt)}; alteração ${date(fact.forumStarterModifiedAt)}.`);
      if (fact.module === 'quiz') lines.push(`    Usos concluídos sem prévia e fora dos docentes vinculados: ${fact.quizCompletedAttempts ?? 'não consultado'}; primeiro término ${date(fact.quizFirstFinishedAt)}.`);
      const proof = fact.selection === 'selected' ? readyBy(fact) : null;
      lines.push(proof ? `    Evidência de preparo até ${date(proof.at)} (${proof.kind}); comparar com o prazo do NED.` : '    Sem comprovação suficiente de preparo por data nesta leitura.');
    }
    if (facts.length > 20) lines.push(`  Mais ${facts.length - 20} vínculo(s) omitido(s) deste resumo.`);
  }
  lines.push('Conferir esta amostra com o histórico do Moodle antes de homologar a data de entrega automática.');
  return lines;
}

module.exports = { activityFacts, metadataEvents, technicalEvidence, pilotEvidenceReport, expectedModuleFor, readyBy, readyByEvidence, readinessConfirmed };
