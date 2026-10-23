const moduleGroups = [{ value: 'M1', label: 'Módulo 1 · M1' }, { value: 'M2', label: 'Módulo 2 · M2' }];
const semesterGroups = [{ value: 'COM_EGI', label: 'Com EGI' }, { value: 'SEM_EGI', label: 'Sem EGI' }];
const calendarGroups = (modality) => modality === 'SEMESTRAL' ? semesterGroups : moduleGroups;
const calendarGroupLabel = (modality, value) => calendarGroups(modality).find((item) => item.value === value)?.label || 'Sem classificação';
const courseCalendarGroup = (calendar, course) => calendar?.periods?.[course.period]?.[course.modality]?.courseGroups?.[course.id] || null;

function calendarRequirements(catalog, modality, group, bimester) {
  const required = (catalog.modalities[modality]?.requirements || []).filter((item) => item.required).map((item) => ({ ...item, agendaOnly: false }));
  if (!group) return required;
  const agenda = (id, label) => ({ id, label, quantity: 1, agendaOnly: true });
  if (modality === 'SEMESTRAL') {
    const ids = bimester === '1' ? ['unidades_aprendizagem', 'videos', 'forum', 'avaliacao_bimestral_1'] : ['desafio', 'avaliacao_bimestral_2'];
    return [...required.filter((item) => ids.includes(item.id)),
      ...(group === 'SEM_EGI' ? [agenda('agenda_quiz_' + bimester, 'Quiz · ' + bimester + 'º bimestre')] : []),
      ...(bimester === '2' ? [agenda('substitutiva', 'Avaliação substitutiva')] : []),
      agenda('agenda_fechamento_' + bimester, 'Lançamento de notas · ' + bimester + 'º bimestre')];
  }
  return [...required, ...(modality === 'GRADUACAO_EAD'
    ? [agenda('tarefa_bonus', 'Tarefa bônus'), agenda('agenda_exame_final', 'Exame final')]
    : [agenda('substitutiva', 'Avaliação substitutiva')]), agenda('agenda_fechamento', 'Fechamento de notas')];
}

// Reference only: NED must choose the courses, review and save before these dates apply.
function referenceDates(period, modality, group, bimester) {
  if (period !== '2026/2' || !group) return {};
  if (modality === 'SEMESTRAL') return bimester === '1'
    ? { unidades_aprendizagem: '2026-08-10', forum: '2026-08-10', avaliacao_bimestral_1: '2026-09-21', agenda_quiz_1: '2026-08-10', agenda_fechamento_1: '2026-10-09' }
    : { desafio: '2026-10-13', avaliacao_bimestral_2: '2026-10-26', agenda_quiz_2: '2026-09-28', substitutiva: '2026-11-25', agenda_fechamento_2: '2026-12-04' };
  if (modality === 'GRADUACAO_EAD') return group === 'M1'
    ? { unidades_aprendizagem: '2026-08-10', forum_diagnostico: '2026-08-10', desafio: '2026-08-24', tarefa_bonus: '2026-08-31', avaliacao_final: '2026-09-21', agenda_exame_final: '2026-12-07', agenda_fechamento: '2026-10-09' }
    : { unidades_aprendizagem: '2026-09-21', forum_diagnostico: '2026-09-28', desafio: '2026-10-19', tarefa_bonus: '2026-10-26', avaliacao_final: '2026-11-09', agenda_exame_final: '2026-12-07', agenda_fechamento: '2026-12-04' };
  return group === 'M1'
    ? { unidades_aprendizagem: '2026-08-10', forum_avaliativo: '2026-08-10', desafio: '2026-08-24', avaliacao_final: '2026-08-31', substitutiva: '2026-09-29', agenda_fechamento: '2026-10-09' }
    : { unidades_aprendizagem: '2026-09-21', forum_avaliativo: '2026-10-13', desafio: '2026-10-19', avaliacao_final: '2026-11-03', substitutiva: '2026-11-27', agenda_fechamento: '2026-12-04' };
}

module.exports = { calendarGroups, calendarGroupLabel, courseCalendarGroup, calendarRequirements, referenceDates };
