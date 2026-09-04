const crypto = require('node:crypto');
const path = require('node:path');
const { z } = require('zod');

const boolFromEnv = z.preprocess((value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return value;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}, z.boolean());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  APP_ORIGIN: z.string().url().default('http://localhost:8080'),
  TRUST_PROXY: boolFromEnv.default(false),
  AUTH_MODE: z.enum(['demo', 'proxy']).default('demo'),
  AUTH_PROXY_SHARED_SECRET: z.string().min(32).optional(),
  DEMO_AUTH_ENABLED: boolFromEnv.default(true),
  COOKIE_SECURE: boolFromEnv.default(false),
  JWT_SECRET: z.string().min(32).optional(),
  AUTH_USERS_JSON: z.string().optional(),
  DATA_SOURCE: z.enum(['demo', 'moodle']).default('demo'),
  SNAPSHOT_STORE: z.enum(['memory', 'postgres']).default('memory'),
  APP_DATABASE_URL: z.string().optional(),
  MOODLE_DB_SERVER: z.string().optional(),
  MOODLE_DB_PORT: z.coerce.number().int().min(1).max(65535).default(1433),
  MOODLE_DB_DATABASE: z.string().optional(),
  MOODLE_DB_USER: z.string().optional(),
  MOODLE_DB_PASSWORD: z.string().optional(),
  MOODLE_DB_CA_FILE: z.string().optional(),
  MOODLE_CATEGORY_ROOT: z.coerce.number().int().positive().default(109),
  MOODLE_TEACHER_ROLE_ID: z.coerce.number().int().positive().default(3),
  MOODLE_QUERY_WINDOW_DAYS: z.coerce.number().int().min(30).max(1095).default(400),
  MOODLE_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(5000).max(300000).default(90000),
  MOODLE_DEADLINE_CATALOG_PATH: z.string().default(path.join(__dirname, 'config', 'deadlines.json')),
  RULE_CATALOG_PATH: z.string().default(path.join(__dirname, 'config', 'rules.json')),
  RULES_APPROVED: boolFromEnv.default(false),
  EMAIL_SEND_ENABLED: boolFromEnv.default(false),
  REPORT_RECIPIENTS_JSON: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_SECURE: boolFromEnv.default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().email().optional(),
  SNAPSHOT_INTERVAL_MINUTES: z.coerce.number().int().min(15).max(10080).default(1440),
});

const roleSchema = z.enum(['ned_admin', 'coordinator', 'executive', 'auditor']);
const userSchema = z.object({
  email: z.string().email(), name: z.string().min(1).max(120), role: roleSchema,
  courseIds: z.array(z.union([z.string(), z.number()])).default([]),
});
const recipientSchema = z.object({
  audience: z.enum(['coordinators', 'executive']), email: z.string().email(), name: z.string().min(1).max(120),
  courseIds: z.array(z.union([z.string(), z.number()])).default([]),
});

const DEMO_PROFILES = Object.freeze([
  { id: 'ned', email: 'ned.demo@example.invalid', name: 'Equipe NED — Demonstração', role: 'ned_admin', courseIds: [] },
  { id: 'coordenacao', email: 'coordenacao.demo@example.invalid', name: 'Coordenação — Demonstração', role: 'coordinator', courseIds: ['1101', '1102'] },
  { id: 'gestao', email: 'gestao.demo@example.invalid', name: 'Alta Gestão — Demonstração', role: 'executive', courseIds: [] },
]);

function parseJsonArray(raw, schema, fieldName) {
  if (!raw) return [];
  let parsed;
  try { parsed = JSON.parse(raw); } catch { throw new Error(`${fieldName} deve conter JSON válido.`); }
  const result = z.array(schema).safeParse(parsed);
  if (!result.success) throw new Error(`${fieldName} possui formato inválido.`);
  return result.data.map((item) => ({ ...item, courseIds: item.courseIds.map(String) }));
}

function loadConfig(environment = process.env) {
  const parsed = envSchema.safeParse(environment);
  if (!parsed.success) throw new Error(`Configuração inválida: ${parsed.error.issues.map((issue) => issue.path.join('.')).join(', ')}`);
  const env = parsed.data;
  const production = env.NODE_ENV === 'production';
  const jwtSecret = env.JWT_SECRET || (!production ? crypto.randomBytes(48).toString('base64url') : null);
  if (!jwtSecret) throw new Error('JWT_SECRET é obrigatório em produção.');
  if (production && env.AUTH_MODE === 'demo') throw new Error('AUTH_MODE=demo é proibido em produção.');
  if (production && env.DEMO_AUTH_ENABLED) throw new Error('DEMO_AUTH_ENABLED=true é proibido em produção.');
  if (production && env.DATA_SOURCE === 'demo') throw new Error('DATA_SOURCE=demo é proibido em produção.');
  if (production && env.SNAPSHOT_STORE === 'memory') throw new Error('SNAPSHOT_STORE=memory é proibido em produção.');
  if (production && !env.COOKIE_SECURE) throw new Error('COOKIE_SECURE=true é obrigatório em produção.');
  if (env.AUTH_MODE === 'proxy' && !env.AUTH_PROXY_SHARED_SECRET) throw new Error('AUTH_PROXY_SHARED_SECRET é obrigatório para autenticação via proxy.');
  if (env.SNAPSHOT_STORE === 'postgres' && !env.APP_DATABASE_URL) throw new Error('APP_DATABASE_URL é obrigatório para SNAPSHOT_STORE=postgres.');
  if (env.DATA_SOURCE === 'moodle' && [env.MOODLE_DB_SERVER, env.MOODLE_DB_DATABASE, env.MOODLE_DB_USER, env.MOODLE_DB_PASSWORD].some((value) => !value)) throw new Error('Credenciais Moodle somente leitura incompletas.');
  if (env.EMAIL_SEND_ENABLED && (!env.SMTP_HOST || !env.SMTP_FROM)) throw new Error('SMTP_HOST e SMTP_FROM são obrigatórios quando o envio está habilitado.');

  return Object.freeze({
    environment: env.NODE_ENV, production, port: env.PORT, appOrigin: new URL(env.APP_ORIGIN).origin,
    trustProxy: env.TRUST_PROXY,
    auth: { mode: env.AUTH_MODE, proxySharedSecret: env.AUTH_PROXY_SHARED_SECRET, demoEnabled: env.DEMO_AUTH_ENABLED, jwtSecret, cookieSecure: env.COOKIE_SECURE, users: parseJsonArray(env.AUTH_USERS_JSON, userSchema, 'AUTH_USERS_JSON'), demoProfiles: DEMO_PROFILES },
    dataSource: env.DATA_SOURCE, snapshotStore: env.SNAPSHOT_STORE, appDatabaseUrl: env.APP_DATABASE_URL,
    moodle: { server: env.MOODLE_DB_SERVER, port: env.MOODLE_DB_PORT, database: env.MOODLE_DB_DATABASE, user: env.MOODLE_DB_USER, password: env.MOODLE_DB_PASSWORD, caFile: env.MOODLE_DB_CA_FILE, categoryRoot: env.MOODLE_CATEGORY_ROOT, teacherRoleId: env.MOODLE_TEACHER_ROLE_ID, queryWindowDays: env.MOODLE_QUERY_WINDOW_DAYS, requestTimeoutMs: env.MOODLE_REQUEST_TIMEOUT_MS, deadlineCatalogPath: env.MOODLE_DEADLINE_CATALOG_PATH },
    rules: { catalogPath: env.RULE_CATALOG_PATH, approved: env.RULES_APPROVED },
    reports: { emailEnabled: env.EMAIL_SEND_ENABLED, recipients: parseJsonArray(env.REPORT_RECIPIENTS_JSON, recipientSchema, 'REPORT_RECIPIENTS_JSON'), smtp: { host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_SECURE, user: env.SMTP_USER, password: env.SMTP_PASSWORD, from: env.SMTP_FROM } },
    snapshotIntervalMinutes: env.SNAPSHOT_INTERVAL_MINUTES,
  });
}

module.exports = { loadConfig, roleSchema };
