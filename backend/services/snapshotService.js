const { buildSnapshot, manualDeliveryRevisionKey } = require('../core/rules');
const { createDemoSource } = require('../data/demoSource');
const { applyDeadlineCatalog } = require('../core/deadlines');
class SnapshotService {
  constructor({ source, store, catalog, rulesApproved, dataSource }) { Object.assign(this, { source, store, catalog, rulesApproved, dataSource }); this.running = false; }
  async run(options = {}) {
    if (this.running) throw Object.assign(new Error('Coleta já está em execução.'), { code: 'SNAPSHOT_BUSY', status: 409 });
    this.running = true;
    try {
      const previousSnapshot = await this.store.latestSnapshot();
      const deadlines = await this.store.latestDeadlineCatalog();
      const raw = this.dataSource === 'demo'
        ? applyDeadlineCatalog(createDemoSource(options.at || new Date(), options.phase ?? 3), deadlines?.catalog)
        : await this.source.fetch(deadlines?.catalog);
      const defaults = Array.isArray(raw.manualDeliveries) ? raw.manualDeliveries : [];
      const stored = await this.store.listManualDeliveries();
      const merged = new Map(defaults.map((record) => [manualDeliveryRevisionKey(record), record]));
      for (const record of stored) merged.set(manualDeliveryRevisionKey(record), record);
      const snapshot = buildSnapshot(raw, this.catalog, { rulesApproved: this.rulesApproved, previousSnapshot, manualDeliveries: [...merged.values()] });
      snapshot.deadlineVersionId = deadlines?.id || null;
      await this.store.saveSnapshot(snapshot);
      return snapshot;
    } finally { this.running = false; }
  }
  async seedDemoHistory() { if (this.dataSource !== 'demo' || await this.store.latestSnapshot()) return; const now = new Date(); for (let phase = 0; phase < 4; phase += 1) await this.run({ at: new Date(now.getTime() - (3 - phase) * 7 * 86400000), phase }); }
}
module.exports = { SnapshotService };
