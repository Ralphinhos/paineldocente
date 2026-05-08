# Instruções para Execução e Homologação do Sistema

Este documento descreve como executar a aplicação localmente usando Docker e como conectar o sistema ao banco de dados da universidade.

## 1. Pré-requisitos

Para executar este projeto, você precisará ter os seguintes softwares instalados em sua máquina:

- **Docker Desktop:** [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/)

O Docker Desktop inclui o Docker Engine e o Docker Compose, que são as ferramentas que vamos utilizar.

## 2. Como Executar a Aplicação Localmente

Com o Docker em execução na sua máquina, siga os passos abaixo.

1.  **Abra um terminal** (como o terminal integrado do VSCode) na raiz deste projeto.
2.  **Execute o comando de build e inicialização:**

    ```bash
    docker-compose up --build
    ```

    - O comando `--build` força a reconstrução das imagens Docker. Isso é útil na primeira vez que você executa ou se fizer alguma alteração nos `Dockerfiles` ou no código-fonte.
    - O Docker irá baixar as imagens base, instalar as dependências, construir os projetos de frontend e backend e iniciar os containers. Este processo pode levar alguns minutos na primeira vez.

3.  **Acesse a aplicação:**

    Após a conclusão do comando, abra seu navegador e acesse a seguinte URL:

    [**http://localhost:8080**](http://localhost:8080)

    Você deverá ver o dashboard funcionando, carregando os dados de exemplo que configuramos no backend.

## 3. Próximo Passo: Integrar com o Banco de Dados

O sistema está atualmente funcionando com dados de exemplo. O próximo passo é conectá-lo ao banco de dados real da universidade.

1.  **Localize o ponto de integração:**
    Abra o arquivo `backend/server.js`. Dentro da rota `app.get('/api/dados', ...)` você encontrará um bloco de código claramente marcado:

    ```javascript
    // --- PONTO DE INTEGRAÇÃO COM O BANCO DE DADOS ---
    // Aqui é onde você deverá substituir os dados mock pelos dados do seu banco.
    // Exemplo de como seria com uma consulta a um banco de dados (usando um cliente fictício 'db'):
    // const rawDataFromDB = await db.query('SELECT * FROM sua_tabela_de_disciplinas');

    // Por enquanto, usamos dados mock para simular a resposta do banco.
    const mockRawData = [ /* ... dados de exemplo ... */ ];
    // --- FIM DO PONTO DE INTEGRAÇÃO ---

    const processed = processData(mockRawData);
    ```

2.  **Implemente a conexão e a consulta:**
    - **Instale o driver do banco de dados:** No terminal, dentro do diretório `backend`, instale o driver necessário (ex: `npm install pg` para PostgreSQL, `npm install mysql2` para MySQL, etc.). Não se esqueça de adicionar o driver ao `backend/package.json`.
    - **Substitua os dados mock:** Remova ou comente a variável `mockRawData` e insira a sua lógica de conexão e consulta ao banco de dados. O resultado da sua consulta (`rawDataFromDB`) deve ser um array de objetos, onde cada objeto representa uma linha e as chaves correspondem aos nomes das colunas esperadas pelo `processData` (ex: `'Data Limite Construção'`).
    - **Gerencie as credenciais:** É uma boa prática usar variáveis de ambiente para as credenciais do banco de dados (host, usuário, senha, etc.). Você pode usar um arquivo `.env` no diretório `backend` e a biblioteca `dotenv` (`npm install dotenv`) para carregá-las.

3.  **Reinicie a aplicação:**
    Após fazer as alterações, execute `docker-compose up --build` novamente para reconstruir a imagem do backend com o novo código.

## 4. Como Parar a Aplicação

Para parar todos os containers da aplicação, pressione `Ctrl + C` no terminal onde o `docker-compose` está rodando. Em seguida, para garantir que os containers e a rede sejam removidos, execute:

```bash
docker-compose down
```

Isso finaliza a sessão e libera as portas utilizadas.
