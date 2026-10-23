# Homologação de regras e dados

Objetivo: impedir apontamento falso antes de liberar e-mail.

## Gate 1 · Regras acadêmicas

NED confere o catálogo aplicado à amostra institucional:

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
| Avaliação substitutiva | Não é requisito; fora de indicadores e relatórios |

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

Os prazos são tratados como **dias civis em America/Sao_Paulo**, válidos até o fim do dia. Exemplo: prazo em 01/09 e envio em 02/09 = 1 dia de atraso, independentemente do horário.

Para disciplinas com mais de um docente, configure o responsável em `responsibleTeachers`, no mesmo nível de `defaults` e `courses` da modalidade:

```json
"responsibleTeachers": {
  "1104": {
    "unidades_aprendizagem": "504",
    "videos": "505",
    "forum_avaliativo": "504",
    "desafio": "505",
    "avaliacao_final": "504"
  }
}
```

Use IDs Moodle. Uma chave específica, como `videos:2`, tem preferência sobre `videos`. Com apenas um docente, a atribuição é automática. Em disciplina compartilhada, um único registro manual ativo não dispensado pode identificar o responsável daquele item; se houver ambiguidade, fica “Responsável a definir” e fora das cobranças confirmadas. Configure explicitamente antes de homologar. Itens atribuídos não são cobrados nem editáveis em nome de outro docente; o resumo conta cada item da disciplina uma vez.

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
| Último acesso ao ambiente | Mesmo instante de mdl_user.lastaccess; independente de user_lastaccess por disciplina |
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
4. Evento comprova interação. Sem prova temporal suficiente, a data da entrega permanece a validar.

### Estrutura herdada

1. Escolha curso restaurado pronto antes da atribuição.
2. Confirme todos os requisitos visíveis e completos.
3. Esperado: `INHERITED_READY` para estrutura.
4. Confira um docente cujo último acesso ao ambiente tenha 15 dias ou mais.
5. Esperado: acesso `CRITICAL` sem transformar estrutura em pendência.

### Dois docentes

1. Escolha disciplina com dois docentes.
2. Esperado: estrutura não dobra no resumo.
3. Esperado: acesso ao ambiente é contado uma vez por ID docente, mesmo com várias disciplinas.
4. Defina responsáveis diferentes por UAs e vídeos; registre as entregas.
5. Esperado: só o responsável recebe a cobrança; controles não duplicam o item; tentar editar em nome do outro docente é rejeitado.

### Acessos ao ambiente

1. Compare último acesso global e acesso à disciplina em um caso com datas diferentes.
2. Esperado: a aba Acessos usa somente o último acesso ao ambiente. Filtrar disciplina não muda esse valor.
3. Confira 7, 8, 14 e 15 dias: respectivamente em dia, atenção, atenção e crítico.
4. Mesmo nome com IDs diferentes deve gerar pessoas distintas; o mesmo ID em várias disciplinas deve contar uma vez.
5. Campo ausente, data futura ou valores globais contraditórios devem exigir revisão. Zero conhecido do Moodle aparece como sem acesso registrado.

### Entregas e problemas abertos

1. Confira antecipada, no prazo, pendente dentro do prazo, pendente vencida e entregue com atraso.
2. Avance a data da coleta com prazo fixo: a pendência deve acumular dias.
3. Confirme a entrega: duração congela e item sai da lista de problemas abertos.
4. Material replicado e conferido permanece regular; não aplicável exige justificativa e sai do total aplicável.
5. Item sem prazo ou responsável definido fica a validar, sem cobrança indevida. Os dois bimestres permanecem separados.

A contagem usa dias civis em São Paulo. Duração observada entre coletas é um limite, não uma data exata. A interface atual não usa nota ponderada para resumir ou compensar problemas.

### Notificações

1. Confira Para, Cc, disciplinas abrangidas e lista completa de ocorrências da coordenação.
2. A prévia deve separar entregas resolvidas, pendências vencidas, ainda no prazo e dados a validar.
3. Se os dados mudarem depois da prévia, o envio deve exigir nova conferência.
4. Envio pela interface deve alcançar somente o destinatário selecionado e suas cópias. Repetição da mesma coleta não deve reenviar.
5. Demonstração, coleta desatualizada, ausência de cursos vinculados e dados incompletos devem bloquear envio.

A gestão recebe as cópias configuradas. Não há limite de cinco ocorrências nem ranking no e-mail. A prévia usa todos os cursos vinculados ao destinatário, independentemente dos filtros da tela.

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
- acesso por disciplina inconsistente entre requisitos;
- acesso global inconsistente entre disciplinas ou fora da faixa correta;
- datas globais inválidas ou indisponíveis publicadas indevidamente;
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
- prévia de ocorrências e cópias conferidas;
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
