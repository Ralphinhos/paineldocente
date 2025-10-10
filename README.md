# Instruções para Execução e Conexão ao Banco de Dados

Este documento descreve como executar a aplicação localmente usando Docker e, mais importante, como conectar o sistema ao banco de dados Moodle.

## 1. Pré-requisitos

- **Docker Desktop:** [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/)

## 2. Como Executar a Aplicação Localmente

1.  **Configure as Credenciais do Banco de Dados:**
    - Vá para o diretório `backend/`.
    - Renomeie o arquivo `.env.example` para `.env`.
    - Abra o arquivo `.env` e preencha com as credenciais do seu banco de dados SQL Server (Moodle).

2.  **Execute o Docker Compose:**
    - Abra um terminal na raiz do projeto.
    - Execute o comando:
      ```bash
      docker-compose up --build
      ```
    - O Docker irá construir as imagens e iniciar os containers.

3.  **Acesse a aplicação:**
    - Abra seu navegador e acesse: [**http://localhost:8080**](http://localhost:8080)
    - O dashboard agora deve carregar os dados diretamente do seu banco de dados Moodle.

---

## 3. Dúvida Comum: "Pode dar algum problema na conexão com o DB?"

**Sim, é a causa mais comum de problemas.** A conexão entre a aplicação e o banco de dados pode falhar por vários motivos. Para te ajudar, criamos ferramentas de diagnóstico.

### Principais Causas de Falha

1.  **Credenciais Incorretas:** O usuário, senha, host ou nome do banco no arquivo `backend/.env` estão errados.
2.  **Firewall ou Rede:** A máquina que executa o Docker pode não ter permissão para acessar o servidor do banco de dados na porta 1433.
3.  **Configurações de Criptografia (SSL):** As configurações de `DB_ENCRYPT` e `DB_TRUST_SERVER_CERTIFICATE` no arquivo `.env` podem não ser compatíveis com as exigências do seu servidor.

### Como Diagnosticar Rapidamente

Para verificar sua conexão de forma isolada, use o script de teste que criamos.

1.  **Certifique-se de que o passo 1 (configuração do `.env`) foi feito.**
2.  **Execute o script de teste no terminal:**
    ```bash
    node backend/test_connection.js
    ```
3.  O script mostrará uma mensagem de **SUCESSO** ou de **ERRO**, indicando a causa mais provável.

Para um guia mais detalhado, consulte o arquivo `backend/DB_CONNECTION_GUIDE.md`.

---

## 4. Como Parar a Aplicação

Para parar os containers, pressione `Ctrl + C` no terminal e depois execute:
```bash
docker-compose down
```