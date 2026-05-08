# Guia de Configuração e Implantação (Render + Netlify)

Este guia consolida todas as informações necessárias para você colocar o seu projeto (Backend e Frontend) no ar utilizando serviços modernos e gratuitos.

---

## 1. Configurando o Google Sheets API (Para ler a planilha)

Para que o backend consiga ler a sua planilha automaticamente, você precisará de uma **Conta de Serviço (Service Account)** do Google Cloud:

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/).
2. Crie um novo projeto ou selecione um existente.
3. No menu lateral, vá em **APIs e Serviços > Biblioteca**. Pesquise por **Google Sheets API** e clique em **Ativar**.
4. Vá em **APIs e Serviços > Credenciais**.
5. Clique em **Criar Credenciais** e selecione **Conta de Serviço**. Dê um nome (ex: `painel-planilha`) e conclua a criação.
6. Após criar, na lista de Contas de Serviço, clique no email gerado (algo como `painel-planilha@seu-projeto.iam.gserviceaccount.com`).
7. Vá na aba **Chaves** -> **Adicionar Chave** -> **Criar nova chave**. Escolha o formato **JSON** e baixe o arquivo para o seu computador.
8. **Preparar o JSON para o Render:** O arquivo baixado tem várias linhas de texto. Para facilitar a configuração no Render, o ideal é transformar todo o arquivo em uma única linha, sem espaços. Você pode usar um site como o [JSON Minifier](https://jsonformatter.org/json-minify) para fazer isso.
9. **Na sua planilha do Google:** Clique no botão azul "Compartilhar" (canto superior direito) e compartilhe a planilha dando acesso de **Leitor** ao email da Conta de Serviço que você acabou de criar.
10. O `SPREADSHEET_ID` que você precisa é o código que fica na URL da planilha. Exemplo: se a URL é `https://docs.google.com/spreadsheets/d/1BxiMVs0XRX5bnYpz1BPTn-0/edit`, o ID é **`1BxiMVs0XRX5bnYpz1BPTn-0`**.

---

## 2. Configurando o Supabase (Para armazenar o Histórico)

O Supabase será o banco de dados que vai guardar as "fotografias" da sua planilha.

1. Acesse o [Supabase](https://supabase.com/) e crie um projeto.
2. No painel do projeto recém-criado, vá em **Project Settings** (ícone de engrenagem no menu lateral esquerdo).
3. Na seção **API**, você encontrará a **Project URL** (Essa é a sua `SUPABASE_URL`) e a **Project API keys (anon / public)** (Essa é a sua `SUPABASE_KEY`). Guarde ambas.

### 2.1 Criando a Tabela

Você precisa criar uma tabela para armazenar os relatórios:

1. No menu lateral esquerdo do Supabase, clique em **SQL Editor**.
2. Clique em "New query" e cole exatamente o seguinte código SQL:

```sql
create table public.history_reports (
  id uuid not null default gen_random_uuid (),
  created_at timestamp with time zone not null default now(),
  label text not null,
  data jsonb not null,
  constraint history_reports_pkey primary key (id)
);
```

3. Clique no botão verde **Run** (ou pressione Cmd/Ctrl + Enter). Isso criará a tabela.

---

## 3. Hospedando o Backend no Render (Web Service)

O Render.com hospedará sua API.

1. Acesse o [Render](https://render.com/) e crie um novo **Web Service**.
2. Conecte-o ao seu repositório do GitHub contendo este código.
3. Configure o deploy da seguinte forma:
   - **Name:** `api-painel` (ou algo de sua preferência)
   - **Root Directory:** `backend` (⚠️ Muito importante: certifique-se de preencher este campo, pois o backend está em uma pasta separada)
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Vá até a seção **Environment Variables** e adicione as seguintes variáveis:
   - `PORT`: `3001`
   - `SUPABASE_URL`: `URL do seu projeto Supabase` (obtido no Passo 2)
   - `SUPABASE_KEY`: `Chave anon do Supabase` (obtido no Passo 2)
   - `SPREADSHEET_ID`: `ID da sua planilha` (obtido no Passo 1)
   - `GOOGLE_CREDENTIALS`: `O conteúdo do arquivo JSON minificado em uma única linha` (obtido no Passo 1)
5. Finalize a criação e aguarde o deploy. Quando estiver pronto, você receberá uma URL, por exemplo: `https://api-painel.onrender.com`.

---

## 4. Hospedando o Frontend no Netlify

1. **Antes de fazer o deploy do Frontend:** Abra o arquivo `public/_redirects` do seu projeto.
2. Altere a linha que diz:
   `/api/*  https://SEU_BACKEND_RENDER.onrender.com/api/:splat  200`
   Substitua `https://SEU_BACKEND_RENDER.onrender.com` pela URL real que o Render te deu (Ex: `https://api-painel.onrender.com`). Faça um commit com essa alteração.
3. Acesse o [Netlify](https://www.netlify.com/) e clique em **Add new site** > **Import an existing project**.
4. Conecte ao seu repositório do GitHub.
5. Configure o deploy da seguinte forma:
   - **Base directory:** Vazio (deixe em branco)
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
6. Clique em **Deploy site**.

Pronto! O seu front-end fará os requests no endereço `/api/...`, e o servidor do Netlify, lendo o arquivo `_redirects`, encaminhará de forma segura (proxy reverso) para o seu servidor no Render, evitando qualquer erro de CORS ou URLs complexas no código.