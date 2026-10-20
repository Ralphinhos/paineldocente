# Cadastro dos prazos docentes

O NED define as datas fora do Moodle. A versão atual lê `backend/config/deadlines.json` no início da API e do worker. Não há formulário geral de prazos na interface. Não use a data de entrega do aluno como prazo de preparação do docente.

## Estrutura

A procura é `periods[período][modalidade].courses[idMoodle][requisito]`; se não houver valor específico, usa `defaults[requisito]`. Período segue `2026/2`; modalidades: `SEMESTRAL`, `MODULAR`, `GRADUACAO_EAD`. IDs de disciplinas e docentes são strings do Moodle.

| Modalidade | Chaves obrigatórias atuais |
| --- | --- |
| Semestral | `unidades_aprendizagem`, `videos`, `forum`, `desafio`, `avaliacao_bimestral_1`, `avaliacao_bimestral_2` |
| Modular | `unidades_aprendizagem`, `videos`, `forum_avaliativo`, `desafio`, `avaliacao_final` |
| Graduação EaD | `unidades_aprendizagem`, `videos`, `forum_diagnostico`, `desafio`, `avaliacao_final` |

UA: uma data para o pacote. Vídeos: uma data comum ou array em ordem `Videoaula 1`, `2` etc., com quantidade igual à carga horária / 10. O código considera o dia civil em São Paulo. Use ISO UTC com `Z`; `2026-10-30T15:00:00.000Z` representa 30/10/2026 às 12h de São Paulo. Dentro do próprio dia não há atraso.

## Exemplo ilustrativo do semestral

IDs e datas abaixo são fictícios. A versão permanece `NAO_HOMOLOGADO` para bloquear publicação até preenchimento e aprovação oficiais. Complete também as demais modalidades/períodos usados pela consulta antes de homologar.

```json
{
  "version": "NAO_HOMOLOGADO",
  "periods": {
    "2026/2": {
      "SEMESTRAL": {
        "defaults": {
          "unidades_aprendizagem": "2026-08-03T15:00:00.000Z",
          "videos": "2026-08-03T15:00:00.000Z",
          "forum": "2026-08-03T15:00:00.000Z",
          "desafio": "2026-08-03T15:00:00.000Z",
          "avaliacao_bimestral_1": "2026-09-18T15:00:00.000Z",
          "avaliacao_bimestral_2": "2026-11-20T15:00:00.000Z"
        },
        "courses": {
          "12345": {
            "videos": [
              "2026-08-03T15:00:00.000Z",
              "2026-08-10T15:00:00.000Z",
              "2026-08-17T15:00:00.000Z",
              "2026-08-24T15:00:00.000Z"
            ]
          }
        },
        "responsibleTeachers": {
          "12345": {
            "unidades_aprendizagem": "678",
            "videos": "678",
            "forum": "678",
            "desafio": "678",
            "avaliacao_bimestral_1": "678",
            "avaliacao_bimestral_2": "678"
          }
        }
      }
    }
  }
}
```

O exemplo da disciplina `12345` supõe 40h, portanto quatro vídeos. Em `responsibleTeachers`, a chave `videos` vale para todos os vídeos; `videos:2` permite atribuir apenas o segundo vídeo a outro docente vinculado. Sem responsável confirmado, itens compartilhados permanecem a validar em vez de serem cobrados de todos os docentes.

## Aplicar no servidor

1. NED confere datas, chaves, IDs e responsáveis; TI faz cópia/versionamento do catálogo.
2. Preencher `backend/config/deadlines.json`, atribuir uma versão oficial depois da aprovação e manter `EMAIL_SEND_ENABLED=false` durante a conferência. Regras continuam sujeitas à homologação de `backend/config/rules.json` e `RULES_APPROVED`.
3. Reiniciar API e worker para reler o arquivo. Se alterar `.env.production`, recriar os serviços com `up -d --force-recreate api worker`, pois só reiniciar não carrega novas variáveis.
4. Gerar uma coleta nova e conferir prazos/estados no painel. Se um prazo mudou, o sistema não reutiliza automaticamente uma classificação observada sob o prazo anterior.
5. Executar o validador abaixo. `--require-publishable` só passa depois da homologação completa das regras e dos dados.

```bash
docker compose --env-file .env.production restart api worker
docker compose --env-file .env.production run --rm api node scripts/validate-snapshot.js --fresh --require-publishable
```

Prazo ausente ou inválido bloqueia classificação/publicação; não vira atraso presumido. A primeira coleta de atividade já pronta após o prazo pode ficar a validar por falta de histórico confiável.

## Nova versão manual e limites

Em **Entregas → Registrar UA e videoaulas**, abrir nova versão exige motivo e prazo próprio. O prazo dessa versão fica no PostgreSQL e prevalece sobre o catálogo para aquele item. O histórico é preservado; publicação informativa não substitui envio/gravação.

Ajuste justificado de atividades automáticas do Moodle e cadastro geral de prazos pelo NED ainda não têm tela. Uma tela de **Prazos e exceções**, com aprovação e histórico, é o próximo incremento recomendado; não está implementada nesta revisão.
