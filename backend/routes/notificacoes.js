const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { notificarCoordenadores, notificarDocentes, cobrarUasPendentes } = require('../emailService');

router.post('/notificacoes', verifyToken, async (req, res) => {
  try {
    const { action, dados } = req.body;
    const user = req.user; 
    let resultado = '';

    // Agora o sistema aguarda o término da função para pegar a mensagem real
    if (action === 'coordenadores') {
      resultado = await notificarCoordenadores(dados);
    } else if (action === 'docentes') {
      resultado = await notificarDocentes(dados, user);
    } else if (action === 'cobrancaUas') {
      resultado = await cobrarUasPendentes(dados);
    }

    res.json({ 
      success: true, 
      message: resultado // Ex: "E-mails enviados para 5 docente(s)."
    });

  } catch (error) {
    console.error('Erro fatal na rota de notificações:', error);
    res.status(500).json({ success: false, error: 'Ocorreu um erro interno no envio.' });
  }
});

module.exports = router;