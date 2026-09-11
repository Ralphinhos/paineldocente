# Arquitetura e segurança

## Fluxo

```mermaid
flowchart LR
  U["Usuário institucional"] --> G["OIDC + gateway"]
  G --> W["Interface web"]
  W --> A["API com RBAC"]
  A --> P["PostgreSQL · histórico"]
  K["Worker diário"] --> M["Moodle · somente leitura"]
  K --> P
  A --> E["SMTP · envio liberado"]
```

O navegador nunca consulta o Moodle nem escolhe sua própria permissão. A API recebe identidade validada pelo gateway, aplica o escopo cadastrado no servidor e trabalha sobre a última fotografia imutável.

## Componentes

| Componente | Responsabilidade | Limite de confiança |
|---|---|---|
| OAuth2 Proxy | Login OIDC e domínio institucional | Não decide papel ou cursos |
| Nginx | Interface, cabeçalhos e proxy interno | Injeta segredo compartilhado apenas para a API |
| API | Sessão, CSRF, RBAC, filtros e relatórios | Autoridade sobre perfil, escopo e destinatários |
| Worker | Consulta Moodle e gera fotografias | Credencial SQL somente leitura |
| PostgreSQL | Fotografias, entregas manuais, envios e auditoria | Não fica exposto na rede do servidor |
| SMTP | Entrega do relatório homologado | Desativado por padrão |

## Modelo de verdade

1. Worker consulta cursos na categoria raiz e subcategorias.
2. Docentes são obtidos pelas atribuições do papel configurado.
3. Atividades do Moodle são classificadas conforme catálogo versionado.
4. Cada disciplina possui um pacote de UAs e uma videoaula para cada 10h de carga horária.
5. Pacote de UAs usa a data de envio do docente; videoaula usa a data de gravação.
6. Data de publicação é operacional e não altera o indicador docente.
7. Prazo inicial vem do catálogo oficial; nova versão recebe prazo próprio informado pelo NED.
8. Registros e fotografias classificam entrega no prazo ou com atraso.
9. Logs acrescentam interação; nunca definem a data de UA ou videoaula.
10. Uma fotografia recebe ID único e não é alterada.
11. Dashboard e e-mail leem a mesma fotografia.

Chave de resultado: `snapshot_id + course_id + teacher_id + requirement_key`. Pacote de UAs usa item 1; vídeos incluem o número do item.

## Controle manual de UA e videoaula

- Somente o NED pode alterar registros; auditor pode apenas consultar.
- Pacote de UAs possui um registro por disciplina e docente responsável.
- Videoaulas usam `carga horária ÷ 10`: 20h = 2, 40h = 4, 60h = 6 e 80h = 8.
- Cada item possui data do docente e publicação opcional.
- Correção de data altera a versão vigente; troca de material ou regravação cria nova versão.
- Nova versão exige motivo e novo prazo. Versões anteriores não são apagadas.
- Regravação pode atingir um vídeo ou todas as videoaulas da disciplina.
- Rótulos, H5P e LTI podem comprovar presença da estrutura restaurada, mas suas datas no Moodle não substituem o registro manual.
- `NOT_APPLICABLE` exige justificativa e não entra no denominador de entregas aplicáveis.
- Estrutura herdada permanece dispensada; somente o acesso docente continua avaliado.
- Toda alteração registra usuário, horário, itens alterados e nova fotografia.

## Disciplina restaurada

A estrutura vira `INHERITED_READY` apenas quando todas as condições são verdadeiras:

- Moodle informa curso de origem;
- restauração ocorreu antes da atribuição do docente;
- todos os requisitos atuais estão visíveis;
- quantidades exigidas estão completas;
- mapeamento não é ambíguo.

Isso isenta a entrega da estrutura. O acesso do docente continua independente e pode ficar crítico.

## Evento de Tarefa

| Evento | Uso |
|---|---|
| `course_module_updated` | Apoia interação e mudança; não define sozinho a data da entrega |
| `course_module_completion_updated` | Interação/acesso; nunca prova entrega |
| `course_module_viewed` | Interação/acesso; nunca prova entrega |
| Evento desconhecido | Contexto; não altera situação |

## Controles aplicados

- Cookie de sessão `HttpOnly + Secure + SameSite=Strict`.
- CSRF e origem exata em qualquer mutação.
- Papéis e cursos definidos em variável protegida no servidor.
- TLS verificado no SQL Server; `trustServerCertificate=false`.
- Consulta `READ COMMITTED`, sem `NOLOCK`.
- Limite de conexões e tempo máximo de consulta.
- E-mail com idempotência por fotografia, público e destinatário.
- Dados demonstrativos não podem ser enviados.
- Falha crítica de qualidade bloqueia publicação.
- Alteração manual usa origem exata, CSRF, papel NED e validação de item contra a fotografia atual.
- Contêineres sem privilégios, com sistema de arquivos somente leitura onde possível.

## Privacidade

O sistema usa nome, e-mail institucional e atividade de acesso. Antes da produção, a UNIFENAS deve registrar finalidade, responsáveis, prazo de retenção e processo de atendimento ao titular conforme suas políticas e a LGPD. Evite exportações locais e não inclua dados de estudantes.

## Limites do piloto

- Prazos iniciais oficiais, inclusive os de UA e videoaula, ainda não foram preenchidos.
- Regras ainda marcadas como piloto.
- Mapeamento dos campos personalizados do Moodle depende de conferência no banco real.
- Metadados OIDC e escopos reais dependem da TI.
- Envio automático depende de homologação e decisão do dia/horário.
