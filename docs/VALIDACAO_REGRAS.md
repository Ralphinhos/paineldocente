# Homologação de regras e dados

Objetivo: impedir apontamento falso antes de liberar e-mail.

## Gate 1 · Regras acadêmicas

NED confirma por escrito:

| Item | Proposta piloto |
|---|---|
| Acesso em dia | 0 a 3 dias |
| Atenção | 4 a 6 dias |
| Crítico | 7 dias ou mais |
| Graduação EaD 40h/80h | 4/8 unidades e 4/8 videoaulas |
| Modular 40h/80h | 4/8 unidades e 4/8 videoaulas |
| Semestral 40h/80h | 4/8 unidades e 4/8 videoaulas |
| Estrutura herdada | Pronta antes da atribuição; acesso continua avaliado |

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
4. Afaste o acesso do docente por 7 dias.
5. Esperado: acesso `CRITICAL` sem transformar estrutura em pendência.

### Dois docentes

1. Escolha disciplina com dois docentes.
2. Esperado: estrutura não dobra no resumo.
3. Esperado: acesso é calculado uma vez por docente e disciplina.

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
