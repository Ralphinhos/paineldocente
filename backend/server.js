// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

// Importação das rotas modularizadas
const authRoutes = require('./routes/auth');
const dataRoutes = require('./routes/data');
const historyRoutes = require('./routes/history'); // <-- AGORA ELE ESTÁ AQUI
const notificacoesRoutes = require('./routes/notificacoes');

const app = express();
app.set('trust proxy', 1); 

const PORT = process.env.PORT || 3001;

// Validação de Segurança
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
    console.error('ERRO CRÍTICO: JWT_SECRET não definido.');
    process.exit(1);
}

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const apiLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 150,
    message: { error: 'Muitas requisições. Tente novamente mais tarde.' }
});

app.get('/', (req, res) => res.send('Backend Online e Seguro!'));

// Acoplamento das rotas
app.use('/api', authRoutes);
app.use('/api', apiLimiter, dataRoutes);
app.use('/api', apiLimiter, historyRoutes); // <-- CONECTANDO AS ROTAS DE HISTÓRICO
app.use('/api', notificacoesRoutes);

app.listen(PORT, () => console.log(`Backend seguro rodando na porta ${PORT}`));