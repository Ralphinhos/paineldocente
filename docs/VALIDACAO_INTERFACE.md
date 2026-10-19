# Conferência — Acessos e Entregas do NED

Conferência técnica de 19/10/2026, com dados fictícios. A interface tem duas abas principais e foco nas ocorrências. A identidade visual foi refeita a partir do HTML: quatro cartões coloridos e dois gráficos de colunas por aba, com eixos, valores, nomes e unidades. O filtro de docente vale para ambas. O painel e as notificações usam o mesmo cálculo de ocorrências.

## Evidências locais

| Etapa | Resultado |
|---|---|
| Lint, TypeScript e build | `npm run check` passou |
| Testes | 17 testes de interface e 75 de backend, todos aprovados |
| Acesso global | Faixas 0–7 / 8–14 / 15+, dias civis, um registro por ID docente; acesso de 2 dias ao ambiente não vira 16 dias por uma disciplina |
| Ausência de dados | Campo ausente, data futura e conflito exigem revisão; zero conhecido é sem registro; consulta vazia bloqueia publicação |
| Entregas | Categorias exclusivas reconciliadas; atraso cresce enquanto pendente e congela após entrega; resolvidas saem das cobranças abertas |
| Filtros e escopo | Docente restringe as duas abas e o controle manual; coordenação só recebe disciplinas configuradas; paginação não altera métricas |
| Panorama | Todos os docentes autorizados do recorte, inclusive fora da página; registros desconhecidos preservam `null`, acesso medido de zero dias preserva zero |
| Escalas | Eixos começam em zero, usam intervalos inteiros regulares e incluem o maior valor; base vazia e valores indisponíveis não geram escala inválida |
| Gráficos estáticos | SVG dos componentes reais, com dados do serviço, renderizado em PNG e inspecionado: eixos, valores, nomes e atraso; essa conferência não valida o layout da página no navegador |
| Materiais | Pacote único de UAs, vídeos por carga horária, publicação informativa e versões/histórico preservados |
| Componentes reais | Renderização React em Node, alimentada pelo serviço, confirmou tabela, dias, filtros, antecipadas, resolvidas e escape de conteúdo externo |
| Relatórios | Ocorrências pontuais sem ranking ou corte em cinco; Para/Cc e texto/HTML; envio selecionado, idempotência e bloqueio por dados antigos |
| E-mail em memória | Nodemailer compôs MIME com destinatário e três cópias, sem conectar a SMTP |
| Validador | 57 linhas fictícias, sem erro de invariante; publicação bloqueada pelo prazo ausente, catálogo piloto e modo de demonstração |

## Fluxo HTTP pelo Vite

O teste iniciou os serviços reais com `scripts/demo.mjs` e executou seis grupos de conferência:

1. Vite entrega o aplicativo com as duas abas.
2. Login NED e sessão atravessam o proxy até a API.
3. Filtro por docente retorna acesso global e entregas correspondentes.
4. Salvar uma gravação gera nova coleta, mostra atraso de 2 dias e mantém o item fora das pendências abertas.
5. Prévia por coordenação informa Cc, preserva disciplinas vinculadas e não usa o acesso antigo à disciplina como ausência do ambiente.
6. Demonstração e prévia antiga rejeitam o envio externo. Os serviços do teste foram encerrados.

Essas requisições e a renderização em Node verificam dados e conteúdo. Não verificam clique, foco, aparência, rolagem ou responsividade em navegador.

Na revisão da identidade visual, três verificações HTTP adicionais confirmaram os módulos novos no Vite, o panorama completo de seis docentes com lista paginada em cinco e a seleção do Docente Beta com acesso global de dois dias e material replicado regular. Os serviços foram encerrados após o teste.

## Verificações pendentes

- Conferir Chrome/Edge em desktop, tela estreita e zoom de 200%, inclusive filtros, abas, diálogos e bloqueio de edição não salva. O navegador remoto bloqueou localhost e arquivos locais por política de acesso.
- Conectar uma amostra real do Moodle institucional e comparar com consultas do DBA/planilhas, usando o último acesso ao ambiente e os prazos docentes homologados.
- Homologar endereços, cópias, SMTP institucional e Docker em execução no servidor interno. Nenhum e-mail real foi enviado.

As auditorias de dependências de produção passaram no limite alto/crítico. Frontend sem vulnerabilidades apontadas; backend mantém dois avisos moderados associados ao driver SQL (`sprintf-js`/`tedious`), fora do escopo desta alteração de funcionalidade.

## Testar no computador

```bash
npm ci
npm --prefix backend ci
npm run demo
```

Abra http://localhost:8080 e clique em **Abrir demonstração do NED**. Identifique o título **Análise docente: acessos e atrasos**, os quatro cartões coloridos e somente **Acessos ao ambiente** / **Entregas**.

- Filtre Docente Beta: acesso ao ambiente de 2 dias e material replicado regular.
- Em Entregas, veja as pendências vencidas e use a situação para consultar resolvidas/antecipadas/todas.
- Abra Registrar UA e videoaulas, salve uma data de docente e confira a situação resultante. Durante edição, salve ou descarte antes de sair.
- Em Preparar notificação, alterne a coordenação, confira Para/Cc e baixe o HTML. O envio fica bloqueado no modo demonstração.

Ctrl+C encerra os serviços. O modo de demonstração não persiste registros após encerrar.
