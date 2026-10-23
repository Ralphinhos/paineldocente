SET NOCOUNT ON;
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;

-- Diagnóstico somente dos IDs da amostra. Não altera os filtros da coleta.
WITH selected_courses AS (
  SELECT CONVERT(bigint, [value]) AS id FROM OPENJSON(@courseIds)
),
category_tree AS (
  SELECT id FROM dbo.mdl_course_categories WHERE id = @categoryRoot
  UNION ALL
  SELECT child.id FROM dbo.mdl_course_categories child
  INNER JOIN category_tree parent ON child.parent = parent.id
),
course_contexts AS (
  SELECT selected.id AS course_id, ctx.id AS context_id
  FROM selected_courses selected
  INNER JOIN dbo.mdl_context ctx ON ctx.contextlevel = 50 AND ctx.instanceid = selected.id
),
role_totals AS (
  SELECT contexts.course_id, ra.roleid AS role_id, COUNT(DISTINCT u.id) AS user_count
  FROM course_contexts contexts
  INNER JOIN dbo.mdl_role_assignments ra ON ra.contextid = contexts.context_id
  INNER JOIN dbo.mdl_user u ON u.id = ra.userid AND u.deleted = 0
  GROUP BY contexts.course_id, ra.roleid
)
SELECT CONVERT(varchar(20), selected.id) AS course_id,
  CAST(CASE WHEN c.id IS NULL THEN 0 ELSE 1 END AS bit) AS course_exists,
  CONVERT(varchar(20), c.category) AS category_id,
  CAST(CASE WHEN cc.id IS NULL THEN 0 ELSE 1 END AS bit) AS category_exists,
  CAST(CASE WHEN EXISTS (SELECT 1 FROM dbo.mdl_course_categories WHERE id = @categoryRoot) THEN 1 ELSE 0 END AS bit) AS root_exists,
  CAST(CASE WHEN EXISTS (SELECT 1 FROM category_tree WHERE id = c.category) THEN 1 ELSE 0 END AS bit) AS category_in_scope,
  c.visible AS course_visible,
  (SELECT COUNT(*) FROM course_contexts WHERE course_id = selected.id) AS context_count,
  CAST(CASE WHEN EXISTS (SELECT 1 FROM dbo.mdl_role WHERE id = @teacherRoleId) THEN 1 ELSE 0 END AS bit) AS teacher_role_exists,
  COALESCE(teachers.user_count, 0) AS teacher_count,
  (SELECT TOP (20) CONVERT(varchar(20), totals.role_id) AS id, roles.shortname, totals.user_count AS users
    FROM role_totals totals
    LEFT JOIN dbo.mdl_role roles ON roles.id = totals.role_id
    WHERE totals.course_id = selected.id
    ORDER BY totals.role_id
    FOR JSON PATH) AS roles_json
FROM selected_courses selected
LEFT JOIN dbo.mdl_course c ON c.id = selected.id
LEFT JOIN dbo.mdl_course_categories cc ON cc.id = c.category
LEFT JOIN role_totals teachers ON teachers.course_id = selected.id AND teachers.role_id = @teacherRoleId
ORDER BY selected.id
OPTION (MAXRECURSION 100);
