// backend/routes/history.js
const express = require('express');
const router = express.Router();
const { getSheetsData } = require('../sheets');
const { supabase } = require('../supabase');
const { verifyToken } = require('../middleware/authMiddleware');

router.get('/history', verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabase.from('history_reports').select('id, created_at, label').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: 'Erro ao listar.' });
    res.json(data);
  } catch (error) { res.status(500).json({ error: 'Erro no servidor.' }); }
});

router.post('/history', verifyToken, async (req, res) => {
  try {
    const dadosAtuais = await getSheetsData();
    if (!dadosAtuais.length) return res.status(400).json({ error: 'Planilha vazia.' });
    const label = `Relatório de ${new Date().toLocaleDateString('pt-BR')}`;
    const { data, error } = await supabase.from('history_reports').insert([{ data: dadosAtuais, label }]).select();
    if (error) return res.status(500).json({ error: 'Erro Supabase.' });
    res.json({ message: 'Salvo!', history: data[0] });
  } catch (error) { res.status(500).json({ error: 'Erro.' }); }
});

module.exports = router;