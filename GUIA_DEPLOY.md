# Implantação interna

## 1. Pré-requisitos

- Servidor Linux com Docker Engine e Docker Compose.
- DNS interno e HTTPS no proxy institucional.
- Aplicação OIDC institucional configurada.
- Usuário SQL Server exclusivo, somente leitura, para o Moodle.
- Certificado CA usado pelo SQL Server em `secrets/moodle-ca.pem`.
- Credenciais SMTP somente na etapa final.

## 2. Demonstração segura

```bash
docker compose -f compose.demo.yml up --build -d
docker compose -f compose.demo.yml ps
```

Acesse `http://localhost:8080`. Dados e perfis são fictícios; envio externo é impossível.

## 3. Preparar produção

```bash
cp .env.production.example .env.production
mkdir -p secrets
chmod 700 secrets
chmod 600 .env.production secrets/moodle-ca.pem
```

Preencha `.env.production`. Gere segredos diferentes:

```bash
# JWT e segredo interno
openssl rand -base64 48 | tr -d '\n'
# Cookie OIDC
openssl rand -base64 32 | tr -d '\n'
# Senha PostgreSQL sem caracteres que exigem codificação de URL
openssl rand -hex 24
```

Regras:

- `AUTH_USERS_JSON` aceita somente os perfis de login `ned_admin` e `executive`; nunca vem do navegador. Remova cadastros antigos de coordenação/auditoria antes de reiniciar os serviços.
- Coordenadores recebem e-mail e não possuem login. Seus `courseIds` em `REPORT_RECIPIENTS_JSON` usam IDs reais do Moodle.
- `APP_DB_PASSWORD` deve ser alfanumérico ou codificado para URL.
- `RULES_APPROVED=false` e `EMAIL_SEND_ENABLED=false` durante homologação.

## 4. Permissão mínima no Moodle

Peça ao DBA um login dedicado. Exemplo para SQL Server:

```sql
USE [moodle];
CREATE USER [painel_docente_ro] FOR LOGIN [painel_docente_ro];

GRANT SELECT ON OBJECT::dbo.mdl_assign TO [painel_docente_ro];
GRANT SELECT ON OBJECT::dbo.mdl_context TO [painel_docente_ro];
GRANT SELECT ON OBJECT::dbo.mdl_course TO [painel_docente_ro];
GRANT SELECT ON OBJECT::dbo.mdl_course_categories TO [painel_docente_ro];
GRANT SELECT ON OBJECT::dbo.mdl_course_modules TO [painel_docente_ro];
GRANT SELECT ON OBJECT::dbo.mdl_customfield_data TO [painel_docente_ro];
GRANT SELECT ON OBJECT::dbo.mdl_customfield_field TO [painel_docente_ro];
GRANT SELECT ON OBJECT::dbo.mdl_forum TO [painel_docente_ro];
GRANT SELECT ON OBJECT::dbo.mdl_h5pactivity TO [painel_docente_ro];
GRANT SELECT ON OBJECT::dbo.mdl_label TO [painel_docente_ro];
GRANT SELECT ON OBJECT::dbo.mdl_logstore_standard_log TO [painel_docente_ro];
GRANT SELECT ON OBJECT::dbo.mdl_lti TO [painel_docente_ro];
GRANT SELECT ON OBJECT::dbo.mdl_modules TO [painel_docente_ro];
GRANT SELECT ON OBJECT::dbo.mdl_page TO [painel_docente_ro];
GRANT SELECT ON OBJECT::dbo.mdl_quiz TO [painel_docente_ro];
GRANT SELECT ON OBJECT::dbo.mdl_resource TO [painel_docente_ro];
GRANT SELECT ON OBJECT::dbo.mdl_role_assignments TO [painel_docente_ro];
GRANT SELECT ON OBJECT::dbo.mdl_url TO [painel_docente_ro];
GRANT SELECT ON OBJECT::dbo.mdl_user TO [painel_docente_ro];
GRANT SELECT ON OBJECT::dbo.mdl_user_lastaccess TO [painel_docente_ro];

DENY INSERT, UPDATE, DELETE, EXECUTE TO [painel_docente_ro];
```

Não reutilize conta administrativa do Moodle. TLS permanece obrigatório: `encrypt=true` e `trustServerCertificate=false`.

## 5. Subir serviços

```bash
docker compose --env-file .env.production config
docker compose --env-file .env.production build --pull
docker compose --env-file .env.production up -d
docker compose --env-file .env.production ps
docker compose --env-file .env.production logs --tail=100 api worker
```

Somente `127.0.0.1:8080` é publicado. O proxy HTTPS institucional deve encaminhar para esse endereço e preservar `Host`, `X-Forwarded-For` e `X-Forwarded-Proto=https`.

## 6. Homologar antes de publicar

Siga [docs/VALIDACAO_REGRAS.md](docs/VALIDACAO_REGRAS.md). Depois, valide uma nova fotografia:

```bash
docker compose --env-file .env.production run --rm api node scripts/validate-snapshot.js --fresh
```

Somente após aprovação NED + TI:

1. cadastre as datas oficiais na aba **Prazos** do NED, ou importe o catálogo inicial em `backend/config/deadlines.json` antes do primeiro cadastro pela interface;
2. altere o catálogo de regras para status homologado;
3. defina `RULES_APPROVED=true`;
4. recrie `api` e `worker`;
5. execute:

```bash
docker compose --env-file .env.production run --rm api node scripts/validate-snapshot.js --fresh --require-publishable
```

Saída válida e `publishAllowed=true` são obrigatórias.

O NED cadastra e confere os prazos na interface conforme [docs/PRAZOS.md](docs/PRAZOS.md). As versões ficam no PostgreSQL e são lidas por API e worker a cada coleta. O esquema cria `pd_deadline_catalogs` e o vínculo da coleta à versão utilizada. Antes de atualizar uma instalação existente, faça backup e homologue a migração em cópia do banco. O arquivo JSON continua como base inicial; depois do primeiro cadastro NED, o catálogo persistido prevalece. Alterações de variáveis de ambiente exigem recriar os serviços.

## 7. Habilitar e-mail semanal

Configure `REPORT_RECIPIENTS_JSON` no servidor e teste primeiro a prévia. Depois:

```dotenv
EMAIL_SEND_ENABLED=true
```

Recrie API e worker. Faça um envio controlado:

```bash
docker compose --env-file .env.production run --rm -e REPORT_AUDIENCE=coordinators api node scripts/send-weekly-report.js
```

O fluxo atual usa `REPORT_AUDIENCE=coordinators` (também é o padrão quando vazio). Configure as cópias da gestão no campo `cc` de cada destinatário. O modo `executive` permanece apenas para compatibilidade com integrações anteriores. O comando é idempotente por fotografia e destinatário.

Agende no cron do servidor somente após o teste:

```cron
0 8 * * 1 cd /opt/painel-docente && /usr/bin/docker compose --env-file .env.production run --rm api node scripts/send-weekly-report.js >> /var/log/painel-docente-email.log 2>&1
```

O exemplo envia às segundas, 08h no fuso do servidor. Ajuste após decisão institucional.

## 8. Backup e restauração

Backup diário do histórico:

```bash
docker compose --env-file .env.production exec -T postgres pg_dump -U painel -d painel_docente -Fc > painel_docente.dump
```

Teste a restauração em ambiente separado. Nunca restaure por cima da produção sem janela aprovada.

## 9. Atualização e reversão

```bash
git pull --ff-only
docker compose --env-file .env.production build --pull
docker compose --env-file .env.production up -d
```

Para reverter, use o commit anterior aprovado, reconstrua imagens e preserve o volume `painel_data`.
