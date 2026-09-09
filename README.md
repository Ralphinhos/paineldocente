# Painel Docente · UNIFENAS

Painel interno para acompanhar estrutura das disciplinas, acessos docentes e relatórios semanais com evidências rastreáveis.

## O que está pronto

- Visões separadas para NED, coordenação e alta gestão.
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
