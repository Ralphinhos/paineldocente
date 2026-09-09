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
  item_number integer NOT NULL CHECK (item_number > 0), disposition text NOT NULL CHECK (disposition IN ('PENDING','DELIVERED','NOT_APPLICABLE')),
  evidence_date date, published_date date, justification text, updated_by text NOT NULL, updated_at timestamptz NOT NULL,
  PRIMARY KEY (course_id,teacher_id,requirement_id,item_number),
  CHECK (disposition <> 'DELIVERED' OR evidence_date IS NOT NULL),
  CHECK (disposition <> 'NOT_APPLICABLE' OR length(trim(justification)) >= 3)
);
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
