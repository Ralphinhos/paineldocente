# Painel Docente · UNIFENAS

Painel interno para acompanhar estrutura das disciplinas, acessos docentes e relatórios semanais com evidências rastreáveis.

## O que está pronto

- Panorama inicial para todos os perfis, com os sete gráficos do HTML de referência e o ranking ponderado.
- Planilha com uma linha por atividade: docente, disciplina, carga horária, bimestre, prazo, entrega, dias de atraso e acesso.
- NED organizado em Panorama, Planilha de controle, UA e videoaulas e Relatórios e e-mails.
- Ranking de regularidade com pesos 50/20/30 e cálculo consultável por docente.
- Atrasos em dias por atividade, diferenciando duração comprovada e limite observado.
- Avaliação substitutiva fora dos indicadores e relatórios.
- Consulta direta ao Moodle SQL Server com usuário somente leitura.
- Controle pelo NED: um pacote de UAs por disciplina e uma videoaula para cada 10h de carga horária.
- Nova versão para troca de UAs ou regravação, com motivo, novo prazo e histórico preservado.
- Regra específica para disciplinas restauradas: estrutura herdada pronta fica regular; acesso docente continua avaliado.
- “Conclusão de atividade alterada” e visualização contam como interação, nunca como prova isolada de entrega.
- Fotografias imutáveis no PostgreSQL, controle de qualidade e trilha de auditoria.
- Prévia de e-mail para coordenações e resumo executivo.
- Docker para demonstração e servidor interno.

> Produção inicia com envio de e-mail bloqueado. Só libere após homologar regras, prazos, amostra Moodle e destinatários.

## Teste rápido · Visual 2.0

Encerre os terminais do teste anterior com Ctrl+C. Na pasta do projeto, instale e rode:

```bash
npm ci
npm --prefix backend ci
npm run demo
```

Abra [http://localhost:8080](http://localhost:8080). A tela de entrada deve mostrar **NED · Visual 2.0**. Escolha **Equipe NED** ou **Alta gestão**; ambos abrem o Panorama. Para parar os dois serviços, Ctrl+C no mesmo terminal.

Este comando usa dados fictícios em memória, escuta apenas no computador local e mantém e-mails desabilitados. As portas 3001 e 8080 devem estar livres: se o teste anterior estiver aberto, o comando falha e pede que ele seja encerrado. Ele não abre silenciosamente outra porta nem encerra processos de terceiros.

Confira estas quatro áreas:

1. **Panorama:** quatro estados de entrega; panorama dos docentes; Top 10 de atrasos, entregas no prazo, ausências e acessos recentes; evolução semanal; atividades com atraso; ranking 50/20/30. A tabela inferior mostra todos os docentes e permite ordenar os valores. Clique no docente ou na atividade para consultar a planilha correspondente.
2. **Planilha de controle:** cada atividade aparece diretamente na linha, com datas, bimestre quando aplicável e atraso em dias. Use a lupa para abrir as evidências. A coluna Disciplina e o cabeçalho ficam fixos durante a rolagem. O filtro de situação seleciona as atividades, sem alterar a base do ranking.
3. **UA e videoaulas (NED):** registre a data de envio do pacote ou de gravação de cada vídeo. Salve ou descarte antes de trocar de área. Regravação e troca de pacote preservam o histórico; publicação continua opcional.
4. **Relatórios e e-mails (NED):** escolha público e destinatário; confira o texto ou o HTML. Copie o texto ou baixe o relatório. A demonstração bloqueia envio externo.

Os gráficos e a nota usam toda a base autorizada pelos filtros de período, modalidade, disciplina e docente, independentemente da página e da situação da planilha. Percentuais docentes consideram apenas prazos encerrados, com peso igual por disciplina. Base incompleta aparece sem percentual comparável e sem nota geral. Acesso mostra o maior intervalo entre disciplinas ativas; ausência de registro fica identificada e não vira zero.

A evolução mostra a última coleta de cada semana com a mesma versão de regras e a mesma fonte. Com uma única semana, mostra um ponto real; nenhuma curva é inventada. Entregas com atraso estão incluídas no total entregue e aparecem também como série separada. Material replicado e conferido entra no total entregue, mantendo o tratamento já aprovado no ranking.

As listas oferecem a disciplina do Moodle. Curso acadêmico, campus e módulo não são inventados: dependem de mapeamento adicional na integração. As avaliações semestrais mantêm os dois bimestres separados.

Se preferir Docker:

```bash
docker compose -f compose.demo.yml up --build
```

A direção visual segue **Análise Docente - Acessos e Atrasos** e a aba **Base** das planilhas fornecidas. As abas mantêm a inspiração Cult UI e os links adaptados do Skiper40, com atribuição no rodapé. Não foram adicionadas bibliotecas de animação. Detalhes e licenças em [Referências da interface](docs/UI_REFERENCIAS.md).

A prévia usa o relatório HTML/texto existente. Exportação de XLSX por coordenação, edição de destinatários/cópias pela interface e revisão manual de exceções Moodle ainda exigem uma próxima etapa; não há botões simulando essas funções.

## Como o painel decide

| Dimensão | Prova principal | Não comprova |
|---|---|---|
| Estrutura | Estado atual, visibilidade, quantidade e prazo oficial | Abrir atividade ou alterar conclusão |
| UA | Data em que o docente encaminhou o pacote completo ao NED | Data de publicação no Moodle |
| Videoaula | Data em que o docente gravou cada vídeo | Data de edição do rótulo no Moodle |
| Acesso | Último acesso no curso e eventos do próprio docente | Alteração feita por outra pessoa |
| Estrutura herdada | Curso restaurado, pronto antes da atribuição | Apenas existir backup/restauração |
| Atraso | Prazo do catálogo oficial homologado | Data de entrega configurada para o aluno |

Faixas de acesso: **0–7 dias em dia**, **8–14 dias em atenção** e **15 dias ou mais crítico**.

Ranking: até **50 pontos por entregas no prazo + 20 por duração do atraso + 30 por acesso**. Cada disciplina tem o mesmo peso dentro de cada componente. Só entram entregas cujo prazo já terminou. Base incompleta fica sem nota geral; material herdado e outras dispensas ficam fora das entregas. Acesso também tem classificação própria. Consulte a fórmula e os casos de teste em [Homologação das regras e dados](docs/VALIDACAO_REGRAS.md).

“Publicado” é informação operacional e não altera o indicador docente. “Não aplicável” exige justificativa, fica registrado na auditoria e não entra no cálculo de entregas aplicáveis.

Correção de data atualiza a versão vigente. Troca de material ou regravação abre uma nova versão com motivo e novo prazo; a anterior permanece disponível no histórico. A ação pode atingir uma videoaula ou todas as videoaulas da disciplina.

## Perfis

| Perfil | Visão | Ações |
|---|---|---|
| NED | Todos os detalhes e falhas de qualidade | Coletar, conferir, visualizar e enviar após liberação |
| Coordenação | Somente disciplinas autorizadas | Filtrar, abrir evidências e visualizar relatório detalhado |
| Alta gestão | Indicadores, tendência e prioridades | Visualizar resumo executivo |
| Auditoria | Todos os dados, somente leitura | Conferir evidências e histórico |

## Verificação

```bash
npm run check
npm audit --omit=dev
npm --prefix backend audit --omit=dev
npm --prefix backend run validate:data -- --fresh
```

## Documentos

- [Implantação no servidor interno](GUIA_DEPLOY.md)
- [Arquitetura e segurança](docs/ARQUITETURA.md)
- [Homologação das regras e dados](docs/VALIDACAO_REGRAS.md)
- [Referências da interface](docs/UI_REFERENCIAS.md)
- [Especificação técnica compacta](SPEC.md)

## Estado de homologação

`backend/config/rules.json` está como `PILOT`. `backend/config/deadlines.json` está vazio. Enquanto isso:

- painel funciona para conferência;
- itens sem prazo ficam “Não verificável”;
- `publishAllowed=false`;
- e-mail externo permanece bloqueado.
