# Painel Docente · UNIFENAS

Painel interno para acompanhar estrutura das disciplinas, acessos docentes e relatórios semanais com evidências rastreáveis.

## O que está pronto

- Visões separadas para NED, coordenação e alta gestão.
- NED organizado em Acompanhamento, UA e videoaulas, Qualidade e envios.
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

## Teste rápido

```bash
docker compose -f compose.demo.yml up --build
```

Abra [http://localhost:8080](http://localhost:8080) e escolha um dos três perfis fictícios. Para parar:

```bash
docker compose -f compose.demo.yml down
```

Na nova versão, confira:

1. **Alta gestão:** ranking → Prioridade, Melhor regularidade e Acessos. Abra “Ver cálculo” e clique no docente para conferir as disciplinas.
2. **NED → Acompanhamento:** abra “Detalhes” de uma pendência e confira prazo e dias de atraso.
3. **NED → UA e videoaulas:** registre envio ou gravação; salve antes de trocar de aba. Publicação não altera a nota. Regravação continua em “Nova versão”.
4. **Relatório semanal:** alterne público, confira a prévia e use “Baixar HTML”. A demonstração mantém o envio bloqueado.

O filtro “Situação da lista” altera somente a lista de ocorrências; a nota e os indicadores usam a base completa dos filtros de período, modalidade, disciplina e docente. A evolução aparece após duas semanas de coletas com a mesma versão de regras. Coletas antigas continuam preservadas; clique em **Atualizar dados** no NED para aplicar a nova versão às próximas coletas.

Sem Docker:

```bash
npm ci
npm --prefix backend ci
npm --prefix backend start
npm run dev
```

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
- [Especificação técnica compacta](SPEC.md)

## Estado de homologação

`backend/config/rules.json` está como `PILOT`. `backend/config/deadlines.json` está vazio. Enquanto isso:

- painel funciona para conferência;
- itens sem prazo ficam “Não verificável”;
- `publishAllowed=false`;
- e-mail externo permanece bloqueado.
