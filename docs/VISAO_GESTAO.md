# Alta Gestão e NED

**A aplicação possui dois perfis: NED e Alta Gestão. Coordenadores recebem relatórios por e-mail e não possuem login.**

| Perfil | Entrada | O que pode fazer |
| --- | --- | --- |
| NED | `/acompanhamento` ou `/` | Acompanhar acessos e entregas, registrar UA/vídeos, cadastrar prazos e preparar notificações. Também pode abrir a Alta Gestão. |
| Alta Gestão | `/gestao` | Consultar o panorama por semestre e abrir os detalhes em leitura. Não altera dados, solicita coleta ou acessa destinatários/envios. |

## Panorama semestral

A organização aproveita o HTML **Análise Docente - Acessos e Atrasos(3).html**, com a identidade visual atual: cabeçalho institucional, cartões suaves, ícones circulares, roscas, barras horizontais e tabelas. Os gráficos são componentes locais; não é necessário carregar planilha ou biblioteca por CDN.

O resumo oferece semestre, modalidade e bimestre; quatro indicadores; situação das entregas e acessos; quatro comparações Top 10; evolução semanal; atividades com pendências; busca, ordenação e paginação de docentes. Ao escolher um bimestre, a modalidade passa a Semestral. O bimestre filtra apenas as entregas dos requisitos daquele bimestre; acessos mantêm a população do semestre. Não há campo de módulo na coleta atual e nenhum módulo é inferido de forma artificial.

| Comparação | Base e interpretação |
| --- | --- |
| Maior proporção de atrasos | Pendentes vencidas e entregues com atraso, divididas pelos itens verificáveis com prazo encerrado. |
| Maior proporção no prazo | Pontuais, antecipadas e replicadas com prazo encerrado, sobre a mesma base. |
| Mais dias sem acesso | Último acesso ao ambiente, entre docentes em atenção/crítico. |
| Acessos mais recentes | Menor tempo desde o último acesso entre docentes em dia. Não mede quantidade de acessos. |

Percentuais mostram numerador e denominador; empates das comparações de entrega priorizam a maior base. Pendências futuras, dispensas e situações não verificáveis ficam fora da base percentual. Um nome igual não junta docentes com IDs diferentes. Material compartilhado não duplica a entrega; responsabilidade não confirmada fica fora da atribuição individual. Não há nova nota ponderada nessa visão.

**Pendência vencida exige ação. Entrega com atraso já foi resolvida.** A distribuição e a evolução mantêm esses estados separados. Nenhum prazo encerrado significa percentual indisponível, representado por `—`, e não 100% de cumprimento.

## Datas e histórico

Selecionar um semestre recupera sua última coleta disponível. O acesso é o último acesso ao ambiente **na data daquela coleta**, incluindo docentes de disciplinas já encerradas do semestre. Não é uma média de acessos nem uma reconstrução do estado no último dia do semestre. A referência fica explícita no cabeçalho.

A evolução é um **gráfico de linhas**, com uma série por situação de entrega. Os pontos mostram valores no tooltip, por mouse ou teclado, e abrem o detalhamento da referência. A escala horizontal respeita o intervalo real entre as coletas; uma única coleta aparece como pontos, sem inventar uma evolução.

Use **Data inicial**, **Data final** e **Aplicar** junto ao gráfico para consultar um período. Os limites incluem os dois dias, no horário de Brasília; é possível informar somente uma das datas. **Limpar** volta ao histórico disponível. Esse filtro afeta somente a evolução por data de coleta: os demais indicadores continuam usando a referência do panorama, e não um total de entregas realizadas entre as datas. O intervalo fica na URL e é recuperado ao recarregar ou voltar do detalhamento de um ponto.

A evolução usa até 26 referências no período escolhido, uma por semana, com as mesmas versões de regras e calendário e até a coleta do panorama. As datas e a compatibilidade são aplicadas antes da seleção semanal. Mudanças de versão podem reduzir o histórico comparável. Cada referência preserva seus próprios quantitativos; a quantidade de itens pode variar. Um período sem coletas mostra essa ausência, sem acrescentar a referência atual fora do filtro.

Os gráficos e a tabela abrem `/acompanhamento` com semestre, modalidade, bimestre, docente/atividade e ID da coleta. A base de prazos encerrados é preservada quando necessária. A consulta histórica é somente leitura, inclusive para o NED; o NED pode escolher **Abrir dados atuais para editar**. Isso impede que um clique mostre números diferentes por trocar silenciosamente a coleta.

## Configuração institucional

`AUTH_USERS_JSON` aceita somente `ned_admin` e `executive`. Cadastros antigos com `coordinator` ou `auditor` precisam ser removidos antes de reiniciar os serviços; a configuração rejeita esses perfis. Cookies de sessão antigos desses perfis também não liberam consultas. Não migre coordenadores para outro perfil para preservar acesso.

Os destinatários e Cc continuam em `REPORT_RECIPIENTS_JSON`. A identificação `audience: "coordinators"` é uma categoria de e-mail, não um perfil de login. O escopo por disciplinas é aplicado no servidor ao gerar cada relatório.

Modelo de contas, usando endereços que a TI/NED devem confirmar:

```json
[
  {"email":"ned@unifenas.br","name":"Equipe NED","role":"ned_admin","courseIds":[]},
  {"email":"gestao.exemplo@unifenas.br","name":"Alta Gestão","role":"executive","courseIds":[]}
]
```

O PostgreSQL recebe um índice de período para as consultas semestrais. Homologue a atualização do esquema em cópia do banco e faça backup antes da implantação. O resumo não carrega 26 fotografias completas na primeira resposta; o histórico é solicitado separadamente e mantém somente agregados na resposta. A compatibilidade com o PostgreSQL e com dados reais deve ser confirmada na infraestrutura da Universidade.

## Testar

1. Na pasta atualizada do projeto, execute `npm ci`, `npm --prefix backend ci` e `npm run demo`.
2. Abra http://localhost:8080. Escolha **Abrir Alta Gestão**.
3. Confira as comparações e abra um docente ou gráfico. A coleta e os filtros permanecem no detalhamento, sem opções de edição.
4. Saia e escolha **Abrir demonstração do NED**. Confira as quatro abas, incluindo Prazos, e o acesso à Alta Gestão.

A demonstração usa dados fictícios e não envia e-mails. A quantidade de semestres disponíveis depende das coletas existentes; não são inventados semestres para preencher o seletor.
