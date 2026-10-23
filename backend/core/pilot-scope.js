function safeLabel(value) { return String(value || '').replace(/[\p{Cc}\p{Cf}]/gu, ' ').slice(0, 80); }

function pilotScopeReport({ categoryRoot, teacherRoleId, rows }) {
  const lines = []; let ok = rows.length > 0;
  if (!rows.length) lines.push('Diagnóstico sem resultados. Confira os IDs da amostra.');
  for (const row of rows) {
    const reasons = [];
    if (!row.course_exists) reasons.push('ID não encontrado no banco selecionado.');
    else {
      if (!row.root_exists) reasons.push(`Categoria raiz ${categoryRoot} não existe neste banco.`);
      if (!row.category_exists) reasons.push('A categoria da disciplina não foi encontrada.');
      else if (row.root_exists && !row.category_in_scope) reasons.push(`Categoria ${row.category_id} fora da raiz ${categoryRoot} e de suas subcategorias.`);
      if (Number(row.course_visible) !== 1) reasons.push('Disciplina oculta no Moodle (visible diferente de 1).');
      if (!row.context_count) reasons.push('Sem contexto de disciplina (contextlevel 50).');
      if (!row.teacher_role_exists && !row.teacher_count) reasons.push(`Papel docente configurado (${teacherRoleId}) não existe neste banco.`);
      else if (row.context_count && !row.teacher_count) reasons.push(`Nenhum usuário não excluído com papel ${teacherRoleId} atribuído diretamente à disciplina.`);
    }
    if (reasons.length) ok = false;
    lines.push(`Disciplina ${row.course_id}: ${reasons.length ? 'BLOQUEADA' : 'FILTROS DE ENTRADA OK'}`);
    if (row.course_exists) {
      lines.push(`  Categoria atual: ${row.category_id ?? 'ausente'}; raiz configurada: ${categoryRoot}; visível: ${Number(row.course_visible) === 1 ? 'sim' : 'não'}.`);
      lines.push(`  Papel docente configurado: ${teacherRoleId}; usuários não excluídos nesse papel: ${row.teacher_count}.`);
      const roles = JSON.parse(row.roles_json || '[]');
      lines.push('  Papéis diretos encontrados (até 20): ' + (roles.map((role) => `${role.id} (${safeLabel(role.shortname) || 'sem nome'}): ${role.users} usuário(s)`).join('; ') || 'nenhum') + '.');
    }
    for (const reason of reasons) lines.push('  Motivo: ' + reason);
  }
  lines.push('A consulta atual usa papéis atribuídos diretamente à disciplina; vínculos herdados não entram.');
  lines.push(ok
    ? 'Filtros de entrada OK. Execute npm run piloto para validar também atividades, logs e prazos.'
    : 'Confira MOODLE_CATEGORY_ROOT e MOODLE_TEACHER_ROLE_ID com o vínculo real no Moodle. O diagnóstico não modifica esses valores nem os dados.');
  return { ok, lines };
}

module.exports = { pilotScopeReport };
