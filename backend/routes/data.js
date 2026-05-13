// backend/routes/data.js
const express = require('express');
const router = express.Router();
const { processData } = require('../dataProcessor');
const { getSheetsData } = require('../sheets');
const { supabase } = require('../supabase');
const { verifyToken } = require('../middleware/authMiddleware');

const sanitizeParam = (val) => val ? String(val).trim() : null;

router.get('/dados', verifyToken, async (req, res) => {
  try {
    const curso = sanitizeParam(req.query.curso);
    const modalidade = sanitizeParam(req.query.modalidade);
    const semestre = sanitizeParam(req.query.semestre);
    const modulo = sanitizeParam(req.query.modulo);
    const history_id = sanitizeParam(req.query.history_id);

    let dadosBrutos = [];
    // Mesmo estando na rota de dados, ele precisa consultar o supabase se o usuário pedir um dado antigo
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

module.exports = router;