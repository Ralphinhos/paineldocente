// Carrega as variáveis de ambiente do arquivo .env
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { processData } = require('./dataProcessor');
const { executeMoodleQuery } = require('./db'); // Importa a função de consulta

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());

// Rota de verificação de saúde
app.get('/', (req, res) => {
  res.send('Backend do Discipline Insight Dash está no ar!');
});

// Rota da API para buscar e processar os dados do Moodle
app.get('/api/dados', async (req, res) => {
  try {
    const { curso, modalidade, semestre, modulo, cursosCoordenador } = req.query;

    // 1. Busca os dados brutos do banco de dados Moodle
    let dadosDoBanco = await executeMoodleQuery();

    // O filtro de `cursosCoordenador` não pode mais ser aplicado aqui,
    // pois os dados de coordenador não vêm do Moodle.
    // Esta lógica precisará ser repensada quando a fonte de dados do Lyceum for integrada.

    // 2. Aplica os filtros da UI aos dados já buscados
    if (curso && curso !== 'Todos') {
        dadosDoBanco = dadosDoBanco.filter(item => item.Curso === curso);
    }
    // As colunas a seguir são nulas, então os filtros não terão efeito por enquanto,
    // mas a estrutura está mantida para quando forem preenchidas.
    if (modalidade && modalidade !== 'Todos') {
        dadosDoBanco = dadosDoBanco.filter(item => item.Modalidade === modalidade);
    }
    if (semestre && semestre !== 'Todos') {
        dadosDoBanco = dadosDoBanco.filter(item => item.Semestre === semestre);
    }
    if (modulo && modulo !== 'Todos') {
        dadosDoBanco = dadosDoBanco.filter(item => item['Módulo'] === modulo);
    }

    // 3. Processa os dados JÁ FILTRADOS
    const processed = processData(dadosDoBanco);
    res.json(processed);

  } catch (error) {
    console.error('Erro ao buscar ou processar dados do Moodle:', error);
    res.status(500).json({ error: 'Erro interno do servidor ao conectar ao banco de dados.' });
  }
});

// Rota para obter as opções de filtro dinamicamente do banco
app.get('/api/filter-options', async (req, res) => {
    try {
        const rawData = await executeMoodleQuery();
        
        // Gera as opções de filtro a partir dos dados reais do banco
        const semestres = [...new Set(rawData.map(item => item.Semestre).filter(Boolean))].sort();
        const modalidades = [...new Set(rawData.map(item => item.Modalidade).filter(Boolean))].sort();
        const modulos = [...new Set(rawData.map(item => item['Módulo']).filter(Boolean))].sort();
        const cursos = [...new Set(rawData.map(item => item.Curso).filter(Boolean))].sort();

        res.json({ semestres, modalidades, modulos, cursos });
    } catch (error) {
        console.error('Erro ao buscar opções de filtro do Moodle:', error);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
});


// Rota da API para buscar dados dos coordenadores (RETORNA VAZIO TEMPORARIAMENTE)
app.get('/api/coordinators', (req, res) => {
  try {
    // Como os dados do coordenador não vêm do Moodle, retornamos um array vazio
    // para não quebrar o frontend. Isso será ajustado na integração com o Lyceum.
    res.json([]);

  } catch (error) {
    console.error('Erro ao processar dados dos coordenadores:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

const nodemailer = require('nodemailer');

// Rota para envio de e-mail (permanece inalterada)
app.post('/api/send-email', async (req, res) => {
    const { action, dadosDetalhados } = req.body;

    if (!dadosDetalhados || dadosDetalhados.length === 0) {
        return res.status(400).json({ error: 'Nenhum dado fornecido para o e-mail.' });
    }

    try {
        let testAccount = await nodemailer.createTestAccount();
        let transporter = nodemailer.createTransport({
            host: "smtp.ethereal.email",
            port: 587,
            secure: false,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass,
            },
        });

        let htmlBody = `<h1>Relatório de Notificação</h1><p>Ação solicitada: <strong>${action}</strong></p><p>Total de registros: <strong>${dadosDetalhados.length}</strong></p><table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%;"><thead><tr><th>Docente</th><th>Disciplina</th><th>Status</th><th>Dias Calculado</th></tr></thead><tbody>`;
        dadosDetalhados.forEach(item => {
            htmlBody += `<tr><td>${item.Docente}</td><td>${item.Disciplina}</td><td>${item.statusCalculado}</td><td>${item.diasCalculado}</td></tr>`;
        });
        htmlBody += `</tbody></table>`;

        let info = await transporter.sendMail({
            from: '"Sistema de Painel Docente" <noreply@painel.com>',
            to: "coordenador@exemplo.com",
            subject: `Notificação de Atividades: ${action}`,
            html: htmlBody,
        });

        const previewUrl = nodemailer.getTestMessageUrl(info);
        console.log("URL para visualização do e-mail: %s", previewUrl);

        res.status(200).json({ 
            message: "E-mail enviado com sucesso para a caixa de teste!",
            previewUrl: previewUrl 
        });

    } catch (error) {
        console.error('Erro ao enviar e-mail:', error);
        res.status(500).json({ error: 'Falha ao enviar o e-mail.' });
    }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
