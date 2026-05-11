require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("ERRO CRÍTICO: SUPABASE_URL ou SUPABASE_KEY ausentes no arquivo .env. A aplicação não pode iniciar de forma insegura.");
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = {
  supabase
};