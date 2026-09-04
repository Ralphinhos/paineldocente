SET NOCOUNT ON;
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;

WITH category_tree AS (
  SELECT id FROM dbo.mdl_course_categories WHERE id = @categoryRoot
  UNION ALL
  SELECT child.id FROM dbo.mdl_course_categories child
  INNER JOIN category_tree parent ON child.parent = parent.id
),
field_option_source AS (
  SELECT f.id AS field_id, f.shortname,
    LTRIM(RTRIM(REPLACE(JSON_VALUE(f.configdata, '$.options'), CHAR(13), ''))) AS option_text
  FROM dbo.mdl_customfield_field f
  WHERE f.shortname IN ('modalidade', 'categoria', 'ch')
),
field_option_lines AS (
  SELECT field_id, shortname, 1 AS line_number,
    LTRIM(RTRIM(LEFT(option_text, CHARINDEX(CHAR(10), option_text + CHAR(10)) - 1))) AS option_value,
    STUFF(option_text, 1, CHARINDEX(CHAR(10), option_text + CHAR(10)), '') AS remaining
  FROM field_option_source
  WHERE option_text <> ''
  UNION ALL
  SELECT field_id, shortname, line_number + 1,
    LTRIM(RTRIM(LEFT(remaining, CHARINDEX(CHAR(10), remaining + CHAR(10)) - 1))),
    STUFF(remaining, 1, CHARINDEX(CHAR(10), remaining + CHAR(10)), '')
  FROM field_option_lines
  WHERE remaining <> ''
),
field_options AS (
  SELECT field_id, shortname,
    ROW_NUMBER() OVER (PARTITION BY field_id ORDER BY line_number) AS ordinal,
    option_value
  FROM field_option_lines
  WHERE option_value <> ''
),
course_fields AS (
  SELECT d.instanceid AS course_id,
    MAX(CASE WHEN f.shortname = 'modalidade' THEN COALESCE(o.option_value, NULLIF(d.charvalue,''), NULLIF(d.shortcharvalue,''), NULLIF(d.value,'')) END) AS modality_field_value,
    MAX(CASE WHEN f.shortname = 'categoria' THEN COALESCE(o.option_value, NULLIF(d.charvalue,''), NULLIF(d.shortcharvalue,''), NULLIF(d.value,'')) END) AS category_field_value,
    MAX(CASE WHEN f.shortname = 'ch' THEN COALESCE(o.option_value, NULLIF(d.charvalue,''), NULLIF(d.shortcharvalue,''), NULLIF(d.value,''), CONVERT(varchar(30), d.intvalue)) END) AS workload_value
  FROM dbo.mdl_customfield_data d
  INNER JOIN dbo.mdl_customfield_field f ON f.id = d.fieldid AND f.shortname IN ('modalidade','categoria','ch')
  LEFT JOIN field_options o ON o.field_id = f.id AND o.ordinal = TRY_CONVERT(int, d.intvalue)
  GROUP BY d.instanceid
),
teacher_courses AS (
  SELECT c.id AS course_id, c.fullname AS course_name, c.shortname AS course_shortname,
    c.startdate, c.enddate, c.originalcourseid, c.timecreated AS course_created_at,
    cc.name AS category_name, cf.modality_field_value, cf.category_field_value,
    COALESCE(cf.modality_field_value, cf.category_field_value) AS modality_value, cf.workload_value,
    u.id AS teacher_id, CONCAT(u.firstname, ' ', u.lastname) AS teacher_name, u.email AS teacher_email,
    MIN(ra.timemodified) AS assigned_at
  FROM dbo.mdl_course c
  INNER JOIN category_tree ct ON ct.id = c.category
  INNER JOIN dbo.mdl_course_categories cc ON cc.id = c.category
  INNER JOIN dbo.mdl_context ctx ON ctx.contextlevel = 50 AND ctx.instanceid = c.id
  INNER JOIN dbo.mdl_role_assignments ra ON ra.contextid = ctx.id AND ra.roleid = @teacherRoleId
  INNER JOIN dbo.mdl_user u ON u.id = ra.userid AND u.deleted = 0
  LEFT JOIN course_fields cf ON cf.course_id = c.id
  WHERE c.visible = 1
  GROUP BY c.id, c.fullname, c.shortname, c.startdate, c.enddate, c.originalcourseid, c.timecreated,
    cc.name, cf.modality_field_value, cf.category_field_value, cf.workload_value, u.id, u.firstname, u.lastname, u.email
),
activity_instances AS (
  SELECT 'assign' AS module_name, id AS instance_id, name FROM dbo.mdl_assign
  UNION ALL SELECT 'forum', id, name FROM dbo.mdl_forum
  UNION ALL SELECT 'quiz', id, name FROM dbo.mdl_quiz
  UNION ALL SELECT 'page', id, name FROM dbo.mdl_page
  UNION ALL SELECT 'url', id, name FROM dbo.mdl_url
  UNION ALL SELECT 'resource', id, name FROM dbo.mdl_resource
),
course_activities AS (
  SELECT cm.id AS cm_id, cm.course AS course_id, m.name AS module_name, ai.name AS activity_name, cm.visible
  FROM dbo.mdl_course_modules cm
  INNER JOIN dbo.mdl_modules m ON m.id = cm.module
  INNER JOIN activity_instances ai ON ai.module_name = m.name AND ai.instance_id = cm.instance
  INNER JOIN (SELECT DISTINCT course_id FROM teacher_courses) scoped ON scoped.course_id = cm.course
  WHERE cm.deletioninprogress = 0
),
relevant_logs AS (
  SELECT l.courseid, l.userid, l.contextinstanceid AS cm_id,
    MIN(CASE WHEN l.eventname = '\core\event\course_module_updated' THEN l.timecreated END) AS module_updated_at,
    MAX(CASE WHEN l.eventname = '\core\event\course_module_completion_updated' THEN l.timecreated END) AS completion_updated_at,
    MAX(CASE WHEN l.eventname = '\core\event\course_module_completion_updated' THEN l.relateduserid END) AS completion_related_user_id,
    MAX(CASE WHEN l.eventname LIKE '%course_module_viewed' THEN l.timecreated END) AS module_viewed_at
  FROM dbo.mdl_logstore_standard_log l
  INNER JOIN teacher_courses tc ON tc.course_id = l.courseid AND tc.teacher_id = l.userid
  WHERE l.timecreated >= @logFrom
    AND l.contextlevel = 70
    AND (l.eventname IN ('\core\event\course_module_updated','\core\event\course_module_completion_updated') OR l.eventname LIKE '%course_module_viewed')
  GROUP BY l.courseid, l.userid, l.contextinstanceid
)
SELECT tc.*, ca.cm_id, ca.module_name, ca.activity_name, ca.visible AS activity_visible,
  ula.timeaccess AS last_access_at, rl.module_updated_at, rl.completion_updated_at,
  rl.completion_related_user_id, rl.module_viewed_at
FROM teacher_courses tc
LEFT JOIN course_activities ca ON ca.course_id = tc.course_id
LEFT JOIN dbo.mdl_user_lastaccess ula ON ula.courseid = tc.course_id AND ula.userid = tc.teacher_id
LEFT JOIN relevant_logs rl ON rl.courseid = tc.course_id AND rl.userid = tc.teacher_id AND rl.cm_id = ca.cm_id
OPTION (MAXRECURSION 100);
