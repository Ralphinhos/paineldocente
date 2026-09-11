CREATE TABLE IF NOT EXISTS pd_snapshots (
  id uuid PRIMARY KEY, generated_at timestamptz NOT NULL, source text NOT NULL CHECK (source IN ('demo','moodle')),
  rules_version text NOT NULL, rules_status text NOT NULL, quality_status text NOT NULL,
  publish_allowed boolean NOT NULL DEFAULT false, is_demo boolean NOT NULL DEFAULT false,
  quality_issues jsonb NOT NULL DEFAULT '[]'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS pd_snapshot_rows (
  snapshot_id uuid NOT NULL REFERENCES pd_snapshots(id) ON DELETE RESTRICT,
  course_id text NOT NULL, teacher_id text NOT NULL, requirement_id text NOT NULL, payload jsonb NOT NULL,
  PRIMARY KEY (snapshot_id,course_id,teacher_id,requirement_id)
);
CREATE INDEX IF NOT EXISTS pd_snapshot_rows_course_idx ON pd_snapshot_rows (snapshot_id,course_id);
CREATE TABLE IF NOT EXISTS pd_manual_deliveries (
  course_id text NOT NULL, teacher_id text NOT NULL, requirement_id text NOT NULL CHECK (requirement_id IN ('unidades_aprendizagem','videos')),
  item_number integer NOT NULL CHECK (item_number > 0), revision integer NOT NULL DEFAULT 1,
  disposition text NOT NULL CHECK (disposition IN ('PENDING','DELIVERED','NOT_APPLICABLE')),
  evidence_date date, published_date date, justification text, replacement_reason text, revision_deadline_date date,
  updated_by text NOT NULL, updated_at timestamptz NOT NULL,
  PRIMARY KEY (course_id,teacher_id,requirement_id,item_number,revision),
  CHECK (disposition <> 'DELIVERED' OR evidence_date IS NOT NULL),
  CHECK (disposition <> 'NOT_APPLICABLE' OR coalesce(length(trim(justification)),0) >= 3)
);
ALTER TABLE pd_manual_deliveries ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;
ALTER TABLE pd_manual_deliveries ADD COLUMN IF NOT EXISTS replacement_reason text;
ALTER TABLE pd_manual_deliveries ADD COLUMN IF NOT EXISTS revision_deadline_date date;
DO $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('paineldocente:manual-delivery-schema-v2'));
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'pd_manual_deliveries'::regclass AND conname = 'pd_manual_deliveries_revision_check') THEN
    ALTER TABLE pd_manual_deliveries ADD CONSTRAINT pd_manual_deliveries_revision_check CHECK (revision > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'pd_manual_deliveries'::regclass AND conname = 'pd_manual_deliveries_replacement_check') THEN
    ALTER TABLE pd_manual_deliveries ADD CONSTRAINT pd_manual_deliveries_replacement_check CHECK (revision = 1 OR coalesce(length(trim(replacement_reason)),0) >= 3);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'pd_manual_deliveries'::regclass AND conname = 'pd_manual_deliveries_revision_deadline_check') THEN
    ALTER TABLE pd_manual_deliveries ADD CONSTRAINT pd_manual_deliveries_revision_deadline_check CHECK (revision = 1 OR revision_deadline_date IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'pd_manual_deliveries'::regclass AND conname = 'pd_manual_deliveries_not_applicable_reason_check') THEN
    ALTER TABLE pd_manual_deliveries ADD CONSTRAINT pd_manual_deliveries_not_applicable_reason_check CHECK (disposition <> 'NOT_APPLICABLE' OR coalesce(length(trim(justification)),0) >= 3);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'pd_manual_deliveries'::regclass AND conname = 'pd_manual_deliveries_versioned_pkey') THEN
    ALTER TABLE pd_manual_deliveries DROP CONSTRAINT IF EXISTS pd_manual_deliveries_pkey;
    ALTER TABLE pd_manual_deliveries ADD CONSTRAINT pd_manual_deliveries_versioned_pkey PRIMARY KEY (course_id,teacher_id,requirement_id,item_number,revision);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS pd_manual_deliveries_course_idx ON pd_manual_deliveries (course_id,requirement_id);
CREATE TABLE IF NOT EXISTS pd_report_runs (
  id uuid PRIMARY KEY, snapshot_id uuid NOT NULL REFERENCES pd_snapshots(id) ON DELETE RESTRICT,
  audience text NOT NULL, status text NOT NULL, idempotency_key text NOT NULL UNIQUE,
  recipients jsonb NOT NULL, error_message text, created_at timestamptz NOT NULL DEFAULT now(), sent_at timestamptz
);
CREATE TABLE IF NOT EXISTS pd_audit_events (
  id bigserial PRIMARY KEY, actor_id text NOT NULL, action text NOT NULL, target_id text, request_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE UPDATE, DELETE, TRUNCATE ON pd_snapshots, pd_snapshot_rows FROM PUBLIC;
