const sql = require('mssql');

// As credenciais e configurações do banco de dados devem ser lidas a partir de variáveis de ambiente
// para garantir a segurança e a portabilidade da aplicação.
const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
        // --- ADIÇÃO IMPORTANTE ---
        // Força o uso de uma versão mais antiga e compatível do TLS.
        // Isto é necessário para conectar a servidores SQL Server mais antigos.
        cryptoCredentialsDetails: {
            minVersion: 'TLSv1'
        }
    }
};

// Pool de conexões para ser reutilizado pela aplicação
let poolPromise;

const getPool = () => {
    if (!poolPromise) {
        poolPromise = new sql.ConnectionPool(dbConfig)
            .connect()
            .then(pool => {
                console.log('Conectado ao SQL Server');
                return pool;
            })
            .catch(err => {
                console.error('Falha ao conectar ao banco de dados:', err);
                // Reseta a promise para permitir uma nova tentativa de conexão
                poolPromise = null; 
                // Propaga o erro para que a aplicação saiba que a conexão falhou
                throw err; 
            });
    }
    return poolPromise;
};

// Função para executar a consulta SQL principal
async function executeMoodleQuery() {
  const query = `
  WITH ultimo_acesso_docente AS (
    SELECT
        l.userid AS docente_id,
        l.courseid AS curso_id,
        MAX(DATEADD(SECOND, l.timecreated - 10800, '1970-01-01')) AS ultimo_acesso
    FROM
        mdl_logstore_standard_log l
    GROUP BY
        l.userid,
        l.courseid
),
dados_brutos AS (
    SELECT
        LTRIM(RTRIM(
            CASE WHEN CHARINDEX(' - ', c.shortname) > 0 THEN LEFT(c.shortname, CHARINDEX(' - ', c.shortname) - 1) ELSE c.shortname END
        )) AS Disciplina,
        LTRIM(RTRIM(
            CASE WHEN CHARINDEX(' - ', c.shortname) > 0 AND CHARINDEX('|', c.shortname) > CHARINDEX(' - ', c.shortname) THEN SUBSTRING(c.shortname, CHARINDEX(' - ', c.shortname) + 3, CHARINDEX('|', c.shortname) - CHARINDEX(' - ', c.shortname) - 3) ELSE '' END
        )) AS Cód_Disciplina,
        LTRIM(RTRIM(
            CASE WHEN CHARINDEX('2502-', c.shortname) > 0 AND CHARINDEX('-', c.shortname, CHARINDEX('2502-', c.shortname) + 5) > 0 THEN SUBSTRING(c.shortname, CHARINDEX('2502-', c.shortname) + 5, CHARINDEX('-', c.shortname, CHARINDEX('2502-', c.shortname) + 5) - (CHARINDEX('2502-', c.shortname) + 5)) ELSE '' END
        )) AS Cód_Curso,
        c.fullname AS Curso,
        m.name AS Atividade,
        CASE WHEN m.name = 'forum' THEN f.name WHEN m.name = 'quiz' THEN q.name ELSE NULL END AS nome_atividade,
        u.firstname + ' ' + u.lastname AS Docente,
        DATEDIFF(day, uad.ultimo_acesso, GETDATE()) AS 'Dias s/ Acesso',

        CASE
            WHEN m.name = 'forum' AND EXISTS (
                SELECT 1 FROM mdl_forum_discussions fd JOIN mdl_forum_posts fp ON fp.discussion = fd.id WHERE fd.forum = f.id AND fp.userid = u.id
            ) THEN 'Entregue'
            WHEN m.name = 'forum' THEN 'Não Entregue'
            WHEN m.name = 'quiz' AND EXISTS (
                SELECT 1 FROM mdl_quiz_attempts qa WHERE qa.quiz = q.id AND qa.userid = u.id AND qa.state = 'finished'
            ) THEN 'Entregue'
            WHEN m.name = 'quiz' THEN 'Não Entregue'
            ELSE 'N/A'
        END AS Entregue

    FROM
        mdl_course c
    JOIN mdl_context ctx ON ctx.instanceid = c.id AND ctx.contextlevel = 50
    JOIN mdl_role_assignments ra ON ra.contextid = ctx.id AND ra.roleid = 3
    JOIN mdl_user u ON u.id = ra.userid AND u.suspended = 0
    JOIN mdl_course_modules cm ON cm.course = c.id
    JOIN mdl_modules m ON m.id = cm.module AND m.name IN ('forum', 'quiz')
    LEFT JOIN mdl_forum f ON f.id = cm.instance AND m.name = 'forum'
    LEFT JOIN mdl_quiz q ON q.id = cm.instance AND m.name = 'quiz'
    LEFT JOIN mdl_course_sections cs ON cs.id = cm.section
    LEFT JOIN ultimo_acesso_docente uad ON uad.docente_id = u.id AND uad.curso_id = c.id
    WHERE
        (c.category BETWEEN 704 AND 800)
        AND cm.deletioninprogress = 0
        AND (
            (m.name = 'forum' AND cs.name IN ('Fórum Avaliativo', 'Fórum Avaliativo 1', 'Fórum Avaliativo 2'))
            OR m.name = 'quiz'
        )
)
SELECT
    Disciplina,
    Cód_Disciplina,
    Cód_Curso,
    Curso,
    Atividade,
    nome_atividade,
    Docente,
    MAX(Entregue) AS Entregue,
    MAX([Dias s/ Acesso]) AS [Dias s/ Acesso],
    -- Colunas ausentes que serão nulas
    NULL AS Semestre,
    NULL AS Modalidade,
    NULL AS Módulo,
    NULL AS Coordenador,
    NULL AS Login,
    NULL AS Senha,
    NULL AS [Data Limite Construção],
    NULL AS DataInicioSemestre,
    NULL AS DataTerminoPrevisto,
    NULL AS email_coordenador,
    NULL AS email_docente
FROM
    dados_brutos
GROUP BY
    Disciplina,
    Cód_Disciplina,
    Cód_Curso,
    Curso,
    Atividade,
    nome_atividade,
    Docente
ORDER BY
    Docente,
    Disciplina,
    Atividade;
  `;

  try {
    const pool = await getPool();
    const result = await pool.request().query(query);
    return result.recordset;
  } catch (err) {
    console.error('Erro ao executar a consulta Moodle:', err);
    throw new Error('Falha ao buscar dados do Moodle.');
  }
}

module.exports = {
  executeMoodleQuery
};