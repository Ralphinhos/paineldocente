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

### Aba Prazos

A revisão seguinte acrescenta a quarta aba: **Prazos**. O NED escolhe período/modalidade, aplica uma data às disciplinas do recorte ou edita uma disciplina, com opção de datas individuais de vídeo e campos dos dois bimestres. Revisão antes da gravação, motivo obrigatório, autor, data e versões ficam disponíveis. Coletas antigas não são alteradas; nova versão manual mantém prazo próprio.

`npm run check` passou com **119 testes (21 de interface e 98 de backend)**. Dezesseis testes de calendário cobrem autorização/origem/CSRF, datas inválidas, escopo, confirmação assinada e expirada, gravação em lote, bimestres, vídeos, histórico, concorrência, coleta desatualizada, falha de recálculo, atualização do worker e bloqueio de relatório com calendário novo. API, worker, API legada e validador reconhecem a versão de prazos da coleta. A confirmação afeta até 1.000 disciplinas; a tabela de conferência pagina vinte alterações.

As verificações de persistência/conflito foram executadas em memória. A reserva e as transações PostgreSQL foram revisadas no código; migração e concorrência contra PostgreSQL real ainda precisam de homologação. O ambiente não possui Docker/PostgreSQL instalados. A conferência completa da aba no navegador continua pendente; os módulos React e o fluxo HTTP são verificados separadamente.

| Etapa | Resultado |
|---|---|
| Lint, TypeScript e build | `npm run check` passou |
| Testes | 21 testes de interface e 98 de backend, todos aprovados |
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

1. Entrega o aplicativo e compila os componentes das quatro abas e o CSS.
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


## Dois perfis e panorama semestral — 20/10/2026

- NED mantém quatro abas; Alta Gestão recebe resumo por semestre e detalhamento em leitura. Login de coordenação/auditoria removido da configuração, da demonstração e da aceitação de sessões antigas. Destinatários de e-mail continuam separados por curso.
- `npm run check` aprovado: lint, TypeScript, build e **138 testes** (27 interface/SSR e 111 backend). Novos casos cobrem bases percentuais, bimestres, homônimos, disciplinas encerradas, replicação, responsabilidade compartilhada, paginação de mil docentes e bloqueio das operações para a Gestão.
- Verificação HTTP pela API e pelo proxy Vite: módulos/CSS novos, duas entradas demo, login de coordenação rejeitado, resumo e histórico, links com mesma referência, contagem do detalhamento consistente com os gráficos, operações/destinatários bloqueados para Gestão e Prazos disponível ao NED. Nenhum e-mail externo foi enviado.
- SVGs reais de roscas, quatro comparações e evolução foram renderizados e inspecionados. Essa inspeção não comprova o layout completo em Chrome/Edge nem a interação de mouse/teclado no navegador; esses testes continuam pendentes.
- PostgreSQL real, criação do índice por período, SQL Server, Docker, SSO e SMTP continuam dependentes de homologação institucional. Esta alteração implementa os dois perfis e a análise semestral; não declara resolvidas todas as correções propostas no diagnóstico anterior.
