require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { processData } = require('./dataProcessor');
const { getSheetsData } = require('./sheets');
const { supabase } = require('./supabase');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares - Segurança S4 e I7
app.use(cors({ origin: process.env.FRONTEND_URL || '*' })); // Defina FRONTEND_URL em .env no Netlify
app.use(express.json());

const apiLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutos
    max: 150, // Limite
    message: { error: 'Muitas requisições. Tente novamente mais tarde.' }
});

// Sanitização básica - Segurança S3
const sanitizeParam = (val) => val ? String(val).trim() : null;

app.get('/', (req, res) => res.send('Backend Online!'));

// Autenticação - S2 e B2 - A lógica das senhas sai do Frontend!
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Credenciais ausentes' });

    // Mock Admin
    if (username === 'admin' && password === 'admin') {
        return res.json({ name: 'Administrador', role: 'admin', courses: [], username: 'admin' });
    }
    
    // NOTA: Em produção com banco de dados real, faça a verificação de hash aqui!
    // Exemplo de mockup de fallback para coordenadores:
    const mockCoordinators = process.env.MOCK_COORDINATORS ? JSON.parse(process.env.MOCK_COORDINATORS) : [];
    const coord = mockCoordinators.find(c => c.username === username && c.password === password);
    
    if (coord) {
        return res.json({ name: coord.fullName, role: 'coordinator', courses: coord.courses, username: coord.username });
    }

    res.status(401).json({ error: 'Usuário ou senha inválidos' });
});

app.get('/api/dados', apiLimiter, async (req, res) => {
  try {
    const curso = sanitizeParam(req.query.curso);
    const modalidade = sanitizeParam(req.query.modalidade);
    const semestre = sanitizeParam(req.query.semestre);
    const modulo = sanitizeParam(req.query.modulo);
    const history_id = sanitizeParam(req.query.history_id);

    let dadosBrutos = [];
    if (history_id && history_id !== 'current') {
      const { data, error } = await supabase.from('history_reports').select('data').eq('id', history_id).single();
      if (error) return res.status(500).json({ error: 'Erro ao buscar dados do histórico.' });
      dadosBrutos = data.data || [];
    } else {
      dadosBrutos = await getSheetsData();
    }

    if (curso && curso !== 'Todos') dadosBrutos = dadosBrutos.filter(item => item.Curso === curso);
    if (modalidade && modalidade !== 'Todos') dadosBrutos = dadosBrutos.filter(item => item.Modalidade === modalidade);
    if (semestre && semestre !== 'Todos') dadosBrutos = dadosBrutos.filter(item => item.Semestre === semestre);
    if (modulo && modulo !== 'Todos') dadosBrutos = dadosBrutos.filter(item => item['Módulo'] === modulo || item['Modulo'] === modulo);

    const processed = processData(dadosBrutos);
    res.json(processed);
  } catch (error) {
    console.error('Erro /api/dados:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

app.get('/api/filter-options', apiLimiter, async (req, res) => {
    try {
        const rawData = await getSheetsData();
        const semestres = [...new Set(rawData.map(item => item.Semestre).filter(Boolean))].sort();
        const modalidades = [...new Set(rawData.map(item => item.Modalidade).filter(Boolean))].sort();
        const modulos = [...new Set(rawData.map(item => item['Módulo'] || item['Modulo']).filter(Boolean))].sort();
        const cursos = [...new Set(rawData.map(item => item.Curso).filter(Boolean))].sort();
        res.json({ semestres, modalidades, modulos, cursos });
    } catch (error) {
        res.status(500).json({ error: 'Erro interno.' });
    }
});

app.get('/api/history', apiLimiter, async (req, res) => {
  try {
    const { data, error } = await supabase.from('history_reports').select('id, created_at, label').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: 'Erro ao listar.' });
    res.json(data);
  } catch (error) { res.status(500).json({ error: 'Erro no servidor.' }); }
});

app.post('/api/history', apiLimiter, async (req, res) => {
  try {
    const dadosAtuais = await getSheetsData();
    if (!dadosAtuais.length) return res.status(400).json({ error: 'Planilha vazia.' });
    const label = `Relatório de ${new Date().toLocaleDateString('pt-BR')}`;
    const { data, error } = await supabase.from('history_reports').insert([{ data: dadosAtuais, label }]).select();
    if (error) return res.status(500).json({ error: 'Erro Supabase.' });
    res.json({ message: 'Salvo!', history: data[0] });
  } catch (error) { res.status(500).json({ error: 'Erro.' }); }
});

// Envio de E-mail Refatorado - Q4
app.post('/api/send-email', apiLimiter, async (req, res) => {
    const { action, dadosDetalhados } = req.body;
    if (!dadosDetalhados || !dadosDetalhados.length) return res.status(400).json({ error: 'Sem dados.' });

    try {
        let transporter;
        // Usa conta real caso tenha variáveis no .env
        if (process.env.SMTP_HOST && process.env.SMTP_USER) {
             transporter = nodemailer.createTransport({
                 host: process.env.SMTP_HOST,
                 port: parseInt(process.env.SMTP_PORT) || 587,
                 secure: process.env.SMTP_SECURE === 'true',
                 auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
             });
        } else {
             // Conta Teste Ethereal apenas de Fallback
             let testAccount = await nodemailer.createTestAccount();
             transporter = nodemailer.createTransport({ host: "smtp.ethereal.email", port: 587, secure: false, auth: { user: testAccount.user, pass: testAccount.pass } });
        }

        let htmlBody = `<h1>Relatório de Notificação: ${action}</h1><table border="1">...</table>`;
        let info = await transporter.sendMail({
            from: process.env.SMTP_FROM || '"Sistema" <noreply@painel.com>',
            to: "coordenador@exemplo.com",
            subject: `Notificação de Atividades: ${action}`,
            html: htmlBody,
        });

        const resp = { message: "E-mail enviado!" };
        if (!process.env.SMTP_HOST) resp.previewUrl = nodemailer.getTestMessageUrl(info);
        res.status(200).json(resp);
    } catch (error) { res.status(500).json({ error: 'Falha.' }); }
});

app.listen(PORT, () => console.log(`Backend rodando na porta ${PORT}`));