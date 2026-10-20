# Conferência — Acessos e Entregas do NED

Conferência técnica de 20/10/2026, com dados fictícios. A interface segue os dois modelos de imagem aprovados: cabeçalho único, cartões suaves com ícones circulares, roscas, barras horizontais, tabela e prioridades. Acessos e Entregas compartilham filtros; Relatório por coordenador prepara a notificação dentro da mesma área do NED. O painel e as notificações usam o mesmo cálculo de ocorrências.

## Correções da revisão de 20 de outubro

- Detalhes da entrega agora têm fundo branco opaco; clicar no espaço interno do diálogo não o fecha por engano. Escape, botão de fechar e clique no fundo externo permanecem disponíveis.
- Roscas, legendas e barras exibem dicas com dados completos por mouse ou foco de teclado. Escape fecha a dica; o posicionamento considera as bordas da tela e permite mover o mouse para o conteúdo.
- Os SVGs não aumentam além de sua largura de desenho. A altura depende das linhas visíveis e há limite de dez docentes por gráfico. Um teste com mil docentes confirma que a lista visual mantém dez linhas e preserva o nome completo acessível.
- A entrada usa o cabeçalho NED UNIFENAS, o fundo claro e as cores da área de gráficos, mantendo ação de demonstração e entrada institucional conforme o ambiente.
- Sessão via proxy agora revalida identidade e mapeamento a cada requisição; troca de conta ou remoção de permissão não reutiliza o perfil do cookie anterior. Cookie malformado é ignorado sem derrubar a consulta.
- A reserva de envio por coleta/destinatário é atômica, inclusive em tentativa após falha. Testes concorrentes em memória confirmam um único envio; o comando PostgreSQL também foi ajustado, com execução no banco real ainda pendente.
- Uma mudança de prazo não reaproveita a classificação observada sob o prazo anterior. O guia SQL de permissões inclui as tabelas de rótulos, H5P e LTI usadas pela consulta.
- [Guia do NED](GUIA_NED.md) e [cadastro de prazos](PRAZOS.md) descrevem as funcionalidades existentes e os limites atuais, incluindo ausência de formulário geral de prazos.

## Evidências locais

| Etapa | Resultado |
|---|---|
| Lint, TypeScript e build | `npm run check` passou |
| Testes | 21 testes de interface e 82 de backend, todos aprovados |
| Acesso global | Faixas 0–7 / 8–14 / 15+, dias civis, um registro por ID docente; acesso de 2 dias ao ambiente não vira 16 dias por uma disciplina |
| Ausência de dados | Campo ausente, data futura e conflito exigem revisão; zero conhecido é sem registro; consulta vazia bloqueia publicação |
| Entregas | Categorias exclusivas reconciliadas; atraso cresce enquanto pendente e congela após entrega; resolvidas saem das cobranças abertas |
| Filtros e escopo | Docente restringe as duas abas e o controle manual; coordenação só recebe disciplinas configuradas; paginação não altera métricas |
| Base dos gráficos | Todos os docentes autorizados do recorte alimentam o Top 10; paginação não altera barras, roscas, atividades ou prioridades; desconhecido preserva `null` e zero dias permanece zero |
| Roscas e barras | Estados exclusivos reconciliam totais; fatia verde de entregas retorna no prazo/replicadas, com antecipadas separadas; gráficos vazios não afirmam regularidade |
| Comparações | Percentual usa base exigível em dias civis; exclui futuro, dispensa e dado a validar; sem responsável confirmado não há atribuição ao docente; resolvida não aumenta maior atraso aberto |
| Escalas | Eixos começam em zero, usam intervalos inteiros regulares e incluem o maior valor; base vazia e valores indisponíveis não geram escala inválida |
| Gráficos estáticos | SVG dos componentes reais, com dados do serviço, renderizado em PNG e inspecionado: eixos, valores, nomes e atraso; essa conferência não valida o layout da página no navegador |
| Materiais | Pacote único de UAs, vídeos por carga horária, publicação informativa e versões/histórico preservados |
| Componentes reais | Renderização React em Node, alimentada pelo serviço, confirmou tabela, dias, filtros, antecipadas, resolvidas e escape de conteúdo externo |
| Relatórios | Ocorrências pontuais sem ranking ou corte em cinco; Para/Cc e texto/HTML; envio selecionado, idempotência e bloqueio por dados antigos |
| E-mail em memória | Nodemailer compôs MIME com destinatário e três cópias, sem conectar a SMTP |
| Validador | 57 linhas fictícias, sem erro de invariante; publicação bloqueada pelo prazo ausente, catálogo piloto e modo de demonstração |

## Fluxo HTTP pelo Vite

A conferência desta revisão inicia os serviços reais com `scripts/demo.mjs` e usa o proxy do Vite:

1. Entrega o aplicativo e compila os componentes das três abas e o novo CSS.
2. Exige autenticação; panorama, barras e prioridades usam a base completa mesmo com tabela paginada.
3. Seleção do Docente Beta preserva dois dias de acesso global e material replicado regular.
4. A fatia no prazo/replicadas e o filtro por atividade retornam somente os estados e itens correspondentes, preservando os totais do recorte.
5. A prévia por coordenação mantém os cursos configurados, Para/Cc e bloqueio de demonstração. Nenhuma mensagem é enviada.

Os serviços do teste são encerrados ao final. HTTP e renderização React em Node verificam dados e conteúdo; SVGs são inspecionados estaticamente. Essas etapas não verificam a página completa, cliques, foco ou responsividade em navegador.

## Verificações pendentes

- Conferir Chrome/Edge em desktop, tela estreita e zoom de 200%, inclusive filtros, abas, diálogos e bloqueio de edição não salva. O navegador remoto bloqueou localhost e arquivos locais por política de acesso.
- Conectar uma amostra real do Moodle institucional e comparar com consultas do DBA/planilhas, usando o último acesso ao ambiente e os prazos docentes homologados.
- Homologar endereços, cópias, SMTP institucional e Docker em execução no servidor interno. Nenhum e-mail real foi enviado.

As auditorias de dependências de produção realizadas em 19/10 passaram no limite alto/crítico. Naquela execução, frontend sem vulnerabilidades apontadas; backend com dois avisos moderados associados ao driver SQL (`sprintf-js`/`tedious`). A revisão de 20/10 não altera dependências nem repete a consulta aos avisos; a TI deve atualizar essa conferência antes da implantação.

## Testar no computador

```bash
npm ci
npm --prefix backend ci
npm run demo
```

Abra http://localhost:8080 e clique em **Abrir demonstração do NED**. Identifique **Monitoramento Docente**, os cartões suaves com ícones circulares e as abas **Acessos**, **Entregas** e **Relatório por coordenador**.

- Filtre Docente Beta: acesso ao ambiente de 2 dias e material replicado regular.
- Em Entregas, veja as pendências vencidas e use a situação para consultar resolvidas/antecipadas/todas.
- Abra o botão de detalhes: o conteúdo deve aparecer sobre fundo branco. Feche com Escape ou pelo botão; clicar no preenchimento interno não fecha.
- Passe o mouse nas barras/roscas ou use Tab para conferir as dicas. Expanda as comparações: nomes e números devem manter tamanho compacto, inclusive em monitor largo.
- Abra Registrar UA e videoaulas, salve uma data de docente e confira a situação resultante. Durante edição, salve ou descarte antes de sair.
- Em Relatório por coordenador, alterne a coordenação, confira Para/Cc e baixe o HTML. O envio fica bloqueado no modo demonstração.

Ctrl+C encerra os serviços. O modo de demonstração não persiste registros após encerrar.
