require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const { processData } = require('./dataProcessor');
const { getSheetsData } = require('./sheets');
const { supabase } = require('./supabase');
const nodemailer = require('nodemailer');
const { notificarCoordenadores, notificarDocentes, cobrarUasPendentes } = require('./emailService');

const app = express();

// ==========================================
// CORREÇÃO PARA O RENDER / RATE-LIMIT
// ==========================================
app.set('trust proxy', 1); 

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'chave-fallback-super-secreta-mudar-no-env';

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

const apiLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 150,
    message: { error: 'Muitas requisições. Tente novamente mais tarde.' }
});

const sanitizeParam = (val) => val ? String(val).trim() : null;

// ==========================================
// MIDDLEWARE DE SEGURANÇA (PORTEIRO)
// ==========================================
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(403).json({ error: 'Acesso negado. Token ausente.' });

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // Guarda os dados do usuário para a requisição
        next(); // Pode passar!
    } catch (error) {
        return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
    }
};

app.get('/', (req, res) => res.send('Backend Online e Seguro!'));

// ==========================================
// LOGIN (GERANDO O TOKEN)
// ==========================================
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Credenciais ausentes' });

    let userPayload = null;

    if (username === 'admin' && password === 'admin') {
        userPayload = { name: 'Administrador', role: 'admin', courses: [], username: 'admin' };
    } else {
        const mockCoordinators = process.env.MOCK_COORDINATORS ? JSON.parse(process.env.MOCK_COORDINATORS) : [];
        const coord = mockCoordinators.find(c => c.username === username && c.password === password);
        if (coord) {
            userPayload = { name: coord.fullName, role: 'coordinator', courses: coord.courses, username: coord.username };
        }
    }

    if (userPayload) {
        // Criptografa os dados em um Token que dura 12 horas
        const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '12h' });
        return res.json({ ...userPayload, token }); // Devolve os dados + a chave
    }

    res.status(401).json({ error: 'Usuário ou senha inválidos' });
});

// Rota para o frontend validar silenciosamente se o token ainda vale
app.get('/api/validate-session', verifyToken, (req, res) => {
    res.json({ valid: true, user: req.user });
});

// ==========================================
// ROTAS PROTEGIDAS (Agora precisam do verifyToken)
// ==========================================
app.get('/api/dados', apiLimiter, verifyToken, async (req, res) => {
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
    res.status(500).json({ error: 'Erro interno.' });
  }
});

app.get('/api/history', apiLimiter, verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabase.from('history_reports').select('id, created_at, label').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: 'Erro ao listar.' });
    res.json(data);
  } catch (error) { res.status(500).json({ error: 'Erro no servidor.' }); }
});

app.post('/api/history', apiLimiter, verifyToken, async (req, res) => {
  try {
    const dadosAtuais = await getSheetsData();
    if (!dadosAtuais.length) return res.status(400).json({ error: 'Planilha vazia.' });
    const label = `Relatório de ${new Date().toLocaleDateString('pt-BR')}`;
    const { data, error } = await supabase.from('history_reports').insert([{ data: dadosAtuais, label }]).select();
    if (error) return res.status(500).json({ error: 'Erro Supabase.' });
    res.json({ message: 'Salvo!', history: data[0] });
  } catch (error) { res.status(500).json({ error: 'Erro.' }); }
});

app.post('/api/notificacoes', verifyToken, async (req, res) => {
  try {
    const { action, dados } = req.body;
    let mensagem = '';

    switch (action) {
      case 'coordenadores':
        mensagem = await notificarCoordenadores(dados);
        break;
      case 'docentes':
        mensagem = await notificarDocentes(dados);
        break;
      case 'cobrancaUas':
        mensagem = await cobrarUasPendentes(dados);
        break;
      default:
        return res.status(400).json({ error: `Ação "${action}" não reconhecida.` });
    }

    res.json({ success: true, message: mensagem });
  } catch (error) {
    console.error('Erro na rota de notificações:', error);
    res.status(500).json({ error: 'Falha ao processar e-mails.' });
  }
});

app.listen(PORT, () => console.log(`Backend seguro rodando na porta ${PORT}`));