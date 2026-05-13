// backend/routes/auth.js
const express = require('express');
const jwt = require('jsonwebtoken');
const { verifyToken } = require('../middleware/authMiddleware');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'chave-fallback-super-secreta-mudar-no-env';

router.post('/login', async (req, res) => {
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
        const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '12h' });
        return res.json({ ...userPayload, token }); 
    }

    res.status(401).json({ error: 'Usuário ou senha inválidos' });
});

router.get('/validate-session', verifyToken, (req, res) => {
    res.json({ valid: true, user: req.user });
});

module.exports = router;