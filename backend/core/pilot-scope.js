function safeLabel(value) { return String(value || '').replace(/[\p{Cc}\p{Cf}]/gu, ' ').slice(0, 80); }

function pilotScopeReport({ categoryRoot, teacherRoleId, includeHiddenCourses = false, rows }) {
  const lines = []; let ok = rows.length > 0; let hiddenBlocked = false;
  if (!rows.length) lines.push('Diagnóstico sem resultados. Confira os IDs da amostra.');
  for (const row of rows) {
    const reasons = [];
    if (!row.course_exists) reasons.push('ID não encontrado no banco selecionado.');
    else {
      if (!row.root_exists) reasons.push(`Categoria raiz ${categoryRoot} não existe neste banco.`);
      if (!row.category_exists) reasons.push('A categoria da disciplina não foi encontrada.');
      else if (row.root_exists && !row.category_in_scope) reasons.push(`Categoria ${row.category_id} fora da raiz ${categoryRoot} e de suas subcategorias.`);
      if (Number(row.course_visible) !== 1 && !includeHiddenCourses) { reasons.push('Disciplina oculta no Moodle (visible diferente de 1).'); hiddenBlocked = true; }
      if (!row.context_count) reasons.push('Sem contexto de disciplina (contextlevel 50).');
      if (!row.teacher_role_exists && !row.teacher_count) reasons.push(`Papel docente configurado (${teacherRoleId}) não existe neste banco.`);
      else if (row.context_count && !row.teacher_count) reasons.push(`Nenhum usuário não excluído com papel ${teacherRoleId} atribuído diretamente à disciplina.`);
    }
    if (reasons.length) ok = false;
    lines.push(`Disciplina ${row.course_id}: ${reasons.length ? 'BLOQUEADA' : 'FILTROS DE ENTRADA OK'}`);
    if (row.course_exists) {
      lines.push(`  Categoria atual: ${row.category_id ?? 'ausente'}; raiz configurada: ${categoryRoot}; visível: ${Number(row.course_visible) === 1 ? 'sim' : 'não'}.`);
      if (Number(row.course_visible) !== 1 && includeHiddenCourses) lines.push('  Oculta no Moodle; inclusão habilitada somente para os IDs selecionados no piloto local.');
      lines.push(`  Papel docente configurado: ${teacherRoleId}; usuários não excluídos nesse papel: ${row.teacher_count}.`);
      const roles = JSON.parse(row.roles_json || '[]');
      lines.push('  Papéis diretos encontrados (até 20): ' + (roles.map((role) => `${role.id} (${safeLabel(role.shortname) || 'sem nome'}): ${role.users} usuário(s)`).join('; ') || 'nenhum') + '.');
    }
    for (const reason of reasons) lines.push('  Motivo: ' + reason);
  }
  lines.push('A consulta atual usa papéis atribuídos diretamente à disciplina; vínculos herdados não entram.');
  lines.push(ok
    ? 'Filtros de entrada OK. Execute npm run piloto para validar também atividades, logs e prazos.'
    : 'Revise os motivos acima. Categoria e papel só precisam ser corrigidos quando houver bloqueio correspondente. O diagnóstico não modifica configurações nem dados.');
  if (hiddenBlocked) lines.push('Para incluir disciplinas ocultas selecionadas no teste local, adicione PILOT_INCLUDE_HIDDEN_COURSES=true em .env.piloto. A visibilidade no Moodle permanece igual.');
  return { ok, lines };
}

module.exports = { pilotScopeReport };
