# Homologação de regras e dados

Objetivo: impedir apontamento falso antes de liberar e-mail.

## Gate 1 · Regras acadêmicas

NED confirma por escrito:

| Item | Proposta piloto |
|---|---|
| Acesso em dia | 0 a 7 dias |
| Atenção | 8 a 14 dias |
| Crítico | 15 dias ou mais |
| Todas as modalidades | 1 pacote de UAs por disciplina |
| Todas as modalidades | 1 videoaula para cada 10h de carga horária |
| Estrutura herdada | Pronta antes da atribuição; acesso continua avaliado |
| Unidade de aprendizagem | Pacote único pela data de envio do docente |
| Videoaula | Controle individual pela data de gravação do docente |
| Publicação | Informação operacional, fora do indicador docente |
| Não aplicável | Exige justificativa e não entra no cálculo de entregas aplicáveis |

Também confirme fóruns, desafios e avaliações listados em `backend/config/rules.json`.

## Gate 2 · Prazos oficiais

Não use o prazo de envio do aluno como prazo de construção do professor. Preencha `backend/config/deadlines.json` com datas aprovadas:

```json
{
  "version": "2026.2-homologado",
  "periods": {
    "2026/2": {
      "MODULAR": {
        "defaults": {
          "unidades_aprendizagem": "2026-08-01T02:59:59.000Z",
          "videos": "2026-08-01T02:59:59.000Z"
        },
        "courses": {
          "1101": {
            "desafio": "2026-08-08T02:59:59.000Z"
          }
        }
      }
    }
  }
}
```

Use ISO 8601 com fuso. NED assina a origem de cada data.

Quando cada vídeo tiver um prazo diferente, use uma lista na ordem dos itens. O pacote de UAs usa uma única data:

```json
"videos": [
  "2026-08-01T02:59:59.000Z",
  "2026-08-08T02:59:59.000Z"
]
```

## Gate 3 · Conferência Moodle

Selecione amostra estratificada:

- pelo menos 10 disciplinas de cada modalidade;
- cargas horárias diferentes;
- todos os cursos restaurados encontrados;
- todos os itens classificados como críticos ou não verificáveis;
- casos com mais de um docente.

Para cada disciplina, compare painel, Moodle e consulta do DBA:

| Campo | Critério |
|---|---|
| Curso e período | ID, nome e período idênticos |
| Modalidade | Campo personalizado resolve para modalidade correta |
| Carga horária | Valor correto; sem inferência ambígua pelo nome |
| Docente | Papel e contexto do curso corretos |
| Atividades | Tipo, visibilidade e quantidade iguais ao Moodle |
| Prazo | Igual ao documento oficial |
| Último acesso | Mesmo instante do registro Moodle |
| Restauração | Curso de origem e data anteriores à atribuição |
| Momento da entrega | Comprovado por fotografia; não inferido do primeiro log |

### Atenção técnica

A consulta usa índice iniciado em 1, como o campo seletor padrão do Moodle, e evita a função ordinal exclusiva do SQL Server 2022. Confirme que esta instalação não alterou o plugin. Referência: [implementação oficial do seletor Moodle](https://github.com/moodle/moodle/blob/8eae8fc94d0e3932cbc64f1e81414903a1e2e83b/public/customfield/field/select/classes/field_controller.php).

## Gate 4 · Casos obrigatórios

### Tarefa apenas acessada

1. Escolha Tarefa incompleta.
2. Gere `course_module_completion_updated` ou visualização pelo docente.
3. Colete nova fotografia.
4. Esperado: estrutura continua `PENDING`; evento aparece como `ACCESS_ONLY`.

A ligação usa `contextinstanceid` do log, que representa o módulo do curso. `objectid` não é usado para esta ligação porque, no evento de conclusão, ele identifica o registro de conclusão e não a Tarefa.

### Tarefa atualizada

1. Configure e torne visível uma Tarefa exigida.
2. Colete nova fotografia.
3. Esperado: estado atual e quantidade comprovam entrega.
4. Data do evento apenas apoia classificação do prazo.

### Estrutura herdada

1. Escolha curso restaurado pronto antes da atribuição.
2. Confirme todos os requisitos visíveis e completos.
3. Esperado: `INHERITED_READY` para estrutura.
4. Afaste o acesso do docente por 15 dias.
5. Esperado: acesso `CRITICAL` sem transformar estrutura em pendência.

### Dois docentes

1. Escolha disciplina com dois docentes.
2. Esperado: estrutura não dobra no resumo.
3. Esperado: acesso é calculado uma vez por docente e disciplina.

### UA e videoaula

1. Confirme um único pacote de UAs e `carga horária ÷ 10` videoaulas.
2. Registre a data de envio do pacote e a data de gravação de um vídeo.
3. Esperado: cada item recebe sua própria situação conforme o prazo oficial.
4. Altere apenas a data de publicação.
5. Esperado: a situação docente permanece igual.
6. Marque um item como não aplicável sem justificativa.
7. Esperado: gravação rejeitada.

### Troca de material e regravação

1. Em item entregue ou herdado, abra nova versão com motivo e novo prazo.
2. Esperado: versão anterior permanece no histórico.
3. Esperado: nova versão fica pendente e usa exclusivamente o novo prazo.
4. Regrave todas as videoaulas de uma disciplina.
5. Esperado: todos os vídeos recebem nova versão; pacote de UAs permanece inalterado.
6. Corrija apenas uma data na versão ativa.
7. Esperado: nenhuma nova versão é criada.

## Validação automatizada

No ambiente piloto:

```bash
npm --prefix backend test
npm --prefix backend run validate:data -- --fresh
```

No contêiner de produção:

```bash
docker compose --env-file .env.production run --rm api node scripts/validate-snapshot.js --fresh
```

O validador detecta:

- chave duplicada;
- ID de fotografia divergente;
- acesso inconsistente entre requisitos;
- conclusão tratada indevidamente como entrega;
- estado herdado incoerente;
- nova versão sem motivo ou prazo próprio;
- prazo Moodle sem origem oficial;
- liberação indevida de demonstração ou base bloqueada.

## Critério de aprovação

- zero erro de invariante;
- zero divergência crítica na amostra;
- 100% dos prazos com fonte oficial;
- todas as modalidades e cargas mapeadas;
- escopo de cada coordenação conferido;
- destinatários revisados por duas pessoas;
- prévia executiva e detalhada aprovadas;
- backup e restauração testados.

Depois:

1. altere status/versionamento do catálogo;
2. defina `RULES_APPROVED=true`;
3. execute validador com `--require-publishable`;
4. registre aprovação abaixo.

## Registro

| Responsável | Nome | Data | Resultado |
|---|---|---|---|
| NED |  |  |  |
| TI/DBA |  |  |  |
| Coordenação piloto |  |  |  |
| Pró-reitoria |  |  |  |
