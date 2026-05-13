// backend/routes/notificacoes.js
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { notificarCoordenadores, notificarDocentes, cobrarUasPendentes } = require('../emailService');

router.post('/notificacoes', verifyToken, async (req, res) => {
  try {
    const { action, dados } = req.body;

    res.json({ 
      success: true, 
      message: 'A solicitação foi recebida! Os e-mails estão sendo disparados em segundo plano e chegarão em breve.' 
    });

    if (action === 'coordenadores') {
      notificarCoordenadores(dados)
        .then(msg => console.log('[Background] Coordenadores:', msg))
        .catch(err => console.error('[Background] Erro Coordenadores:', err));
        
    } else if (action === 'docentes') {
      notificarDocentes(dados)
        .then(msg => console.log('[Background] Docentes:', msg))
        .catch(err => console.error('[Background] Erro Docentes:', err));
        
    } else if (action === 'cobrancaUas') {
      cobrarUasPendentes(dados)
        .then(msg => console.log('[Background] Cobrança UAs:', msg))
        .catch(err => console.error('[Background] Erro Cobrança UAs:', err));
    }

  } catch (error) {
    console.error('Erro fatal na rota de notificações:', error);
  }
});

module.exports = router;