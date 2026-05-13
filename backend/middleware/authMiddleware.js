// backend/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(403).json({ error: 'Acesso negado. Token ausente.' });

    const token = authHeader.split(' ')[1];
    const JWT_SECRET = process.env.JWT_SECRET || 'chave-fallback-super-secreta-mudar-no-env';

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; 
        next(); 
    } catch (error) {
        return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
    }
};

module.exports = { verifyToken };