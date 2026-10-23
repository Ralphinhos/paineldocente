const { loadConfig } = require('./config');
const { assertLocalPilotConfig } = require('./core/pilot');
const { createAuth } = require('./core/auth');
const { loadCatalog } = require('./core/rules');
const { MoodleSource } = require('./data/moodleSource');
const { DashboardService } = require('./services/dashboardService');
const { MonitoringService } = require('./services/monitoringService');
const { ReportService } = require('./services/reportService');
const { SnapshotService } = require('./services/snapshotService');
const { DeadlineService } = require('./services/deadlineService');
const { ExecutiveService } = require('./services/executiveService');
const { MemoryStore, PostgresStore } = require('./services/store');
async function createRuntime(environment = process.env, localPilotOptions) {
  const config = loadConfig(environment);
  if (localPilotOptions !== undefined) assertLocalPilotConfig(config);
  const store = config.snapshotStore === 'postgres' ? new PostgresStore(config.appDatabaseUrl) : new MemoryStore();
  await store.init();
  const catalog = loadCatalog(config.rules.catalogPath);
  const source = config.dataSource === 'moodle' ? new MoodleSource(config.moodle, localPilotOptions) : null;
  const snapshotService = new SnapshotService({ source, store, catalog, rulesApproved: config.rules.approved, dataSource: config.dataSource });
  await snapshotService.seedDemoHistory();
  const dashboardService = new DashboardService({ store, snapshotIntervalMinutes: config.snapshotIntervalMinutes });
  const monitoringService = new MonitoringService({ store, snapshotIntervalMinutes: config.snapshotIntervalMinutes });
  const reportService = new ReportService({ config, store, monitoringService });
  const deadlineService = new DeadlineService({ config, store, snapshotService, catalog });
  const executiveService = new ExecutiveService({ store, snapshotIntervalMinutes: config.snapshotIntervalMinutes });
  return { config, auth: createAuth(config), services: { store, snapshotService, dashboardService, monitoringService, reportService, deadlineService, executiveService }, close: async () => { await source?.close(); await store.close(); } };
}
module.exports = { createRuntime };
