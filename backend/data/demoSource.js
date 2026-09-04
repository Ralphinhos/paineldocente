function shift(date, days) { return new Date(date.getTime() + days * 86400000).toISOString(); }
function activity(asOf, id, requirementId, label, options = {}) {
  const deadlineDays = options.deadlineDays ?? -7; const configuredDays = options.configuredDays ?? -10;
  const configuredAt = options.configuredAt === null ? null : shift(asOf, configuredDays);
  return { id, requirementId, label, observedQuantity: options.observedQuantity ?? 1, visible: options.visible ?? true, configuredAt, configurationTimeSource: configuredAt ? 'DEMO_TRUSTED' : null, deadlineAt: options.deadlineAt === null ? null : shift(asOf, deadlineDays), deadlineSource: options.deadlineAt === null ? null : 'DEMO_SCHEDULE', mappingConfidence: options.mappingConfidence ?? 'EXACT', events: options.noEvent ? [] : [{ name: options.eventName ?? '\\core\\event\\course_module_updated', occurredAt: shift(asOf, options.eventDays ?? configuredDays), actorId: options.actorId ?? '501', relatedUserId: options.relatedUserId, origin: 'web' }] };
}
function createDemoSource(input = new Date(), phase = 3) {
  const at = new Date(input); const dates = { startsAt: shift(at, -45), endsAt: shift(at, 45) }; const alfaReady = phase >= 2; const deltaReady = phase >= 3;
  return { source: 'demo', generatedAt: at.toISOString(), sourceIssues: [], courses: [
    { id: '1101', name: 'Gestão de Projetos — Demonstração', shortName: 'GP-EAD-40 (demo)', period: '2026/2', modality: 'GRADUACAO_EAD', workloadHours: 40, ...dates, originalCourseId: null, restoredAt: null,
      teachers: [{ id: '501', name: 'Docente Alfa (demo)', email: 'docente.alfa@example.invalid', assignedAt: shift(at, -42), lastAccessAt: shift(at, -1), accessEvents: [] }],
      activities: [
        activity(at, '2101', 'unidades_aprendizagem', 'Unidades de aprendizagem', { observedQuantity: alfaReady ? 4 : 3, actorId: '501' }),
        activity(at, '2102', 'videos', 'Videoaulas', { observedQuantity: 4, actorId: '501' }),
        activity(at, '2103', 'forum_diagnostico', 'Fórum diagnóstico', { actorId: '501', configuredDays: -4, deadlineDays: -7 }),
        activity(at, '2104', 'desafio', 'Tarefa — Desafio', { actorId: '501', visible: false, configuredAt: null, eventDays: -2, eventName: '\\core\\event\\course_module_completion_updated', relatedUserId: '501' }),
        activity(at, '2105', 'avaliacao_final', 'Avaliação final', { actorId: '501', deadlineDays: 5, configuredAt: null, visible: false, noEvent: true }),
      ] },
    { id: '1102', name: 'Sistemas de Informação — Demonstração', shortName: 'SI-MOD-40 (demo)', period: '2026/2', modality: 'MODULAR', workloadHours: 40, ...dates, originalCourseId: '902', restoredAt: shift(at, -50),
      teachers: [{ id: '502', name: 'Docente Beta (demo)', email: 'docente.beta@example.invalid', assignedAt: shift(at, -43), lastAccessAt: shift(at, -9), accessEvents: [] }],
      activities: [activity(at, '2201', 'unidades_aprendizagem', 'Unidades herdadas', { observedQuantity: 4, actorId: '900', configuredDays: -60 }), activity(at, '2202', 'videos', 'Videoaulas herdadas', { observedQuantity: 4, actorId: '900', configuredDays: -60 }), activity(at, '2203', 'forum_avaliativo', 'Fórum herdado', { actorId: '900', configuredDays: -60 }), activity(at, '2204', 'desafio', 'Desafio herdado', { actorId: '900', configuredDays: -60 }), activity(at, '2205', 'avaliacao_final', 'Avaliação herdada', { actorId: '900', configuredDays: -60 })] },
    { id: '1103', name: 'Direito Digital — Demonstração', shortName: 'DD-SEM-40 (demo)', period: '2026/2', modality: 'SEMESTRAL', workloadHours: 40, ...dates, originalCourseId: null, restoredAt: null,
      teachers: [{ id: '503', name: 'Docente Gama (demo)', email: 'docente.gama@example.invalid', assignedAt: shift(at, -40), lastAccessAt: null, accessEvents: [] }],
      activities: [activity(at, '2301', 'unidades_aprendizagem', 'Unidades', { observedQuantity: 4, actorId: '503' }), activity(at, '2302', 'videos', 'Videoaulas', { observedQuantity: 4, actorId: '503' }), activity(at, '2303', 'forum', 'Fórum', { actorId: '503' }), activity(at, '2304', 'desafio', 'Desafio', { actorId: '503', deadlineAt: null }), activity(at, '2305', 'avaliacao_bimestral_1', 'Avaliação bimestral 1', { actorId: '503' }), activity(at, '2306', 'avaliacao_bimestral_2', 'Avaliação bimestral 2', { actorId: '503', configuredAt: null, visible: false, deadlineDays: 8, noEvent: true }), activity(at, '2307', 'substitutiva', 'Substitutiva', { actorId: '503', configuredAt: null, visible: false, deadlineDays: 18, noEvent: true })] },
    { id: '1104', name: 'Metodologias Ativas — Demonstração', shortName: 'MA-MOD-80 (demo)', period: '2026/2', modality: 'MODULAR', workloadHours: 80, ...dates, originalCourseId: null, restoredAt: null,
      teachers: [{ id: '504', name: 'Docente Delta (demo)', email: 'docente.delta@example.invalid', assignedAt: shift(at, -39), lastAccessAt: shift(at, -5), accessEvents: [] }, { id: '505', name: 'Docente Épsilon (demo)', email: 'docente.epsilon@example.invalid', assignedAt: shift(at, -39), lastAccessAt: shift(at, -2), accessEvents: [] }],
      activities: [activity(at, '2401', 'unidades_aprendizagem', 'Unidades', { observedQuantity: deltaReady ? 8 : 6, actorId: '504' }), activity(at, '2402', 'videos', 'Videoaulas', { observedQuantity: 8, actorId: '505' }), activity(at, '2403', 'forum_avaliativo', 'Fórum', { actorId: '504' }), activity(at, '2404', 'desafio', 'Desafio', { actorId: '505' }), activity(at, '2405', 'avaliacao_final', 'Avaliação final', { actorId: '504', configuredDays: -2, deadlineDays: -6 })] },
    { id: '1105', name: 'Educação Contemporânea — Demonstração', shortName: 'EC-EAD-40 (demo)', period: '2026/2', modality: 'GRADUACAO_EAD', workloadHours: 40, ...dates, originalCourseId: null, restoredAt: null,
      teachers: [{ id: '506', name: 'Docente Zeta (demo)', email: 'docente.zeta@example.invalid', assignedAt: shift(at, -41), lastAccessAt: shift(at, 0), accessEvents: [] }],
      activities: [activity(at, '2501', 'unidades_aprendizagem', 'Unidades', { observedQuantity: 4, actorId: '506' }), activity(at, '2502', 'videos', 'Videoaulas', { observedQuantity: 4, actorId: '506' }), activity(at, '2503', 'forum_diagnostico', 'Fórum', { actorId: '506' }), activity(at, '2504', 'desafio', 'Desafio', { actorId: '506' }), activity(at, '2505', 'avaliacao_final', 'Avaliação final', { actorId: '506' })] },
  ] };
}
module.exports = { createDemoSource };
