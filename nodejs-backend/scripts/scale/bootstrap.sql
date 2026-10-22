-- Operational metadata only; not an application migration.
COMMENT ON DATABASE marketplace_scale IS 'marketplace-scale-v1';
CREATE SCHEMA scale_ops;
CREATE TABLE scale_ops.control (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  environment_id text NOT NULL CHECK (environment_id = 'marketplace-scale-v1'),
  state text NOT NULL CHECK (state IN ('ready', 'loading', 'completed', 'interrupted')),
  run_id text,
  small_measured boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  report jsonb NOT NULL DEFAULT '{}'::jsonb
);
INSERT INTO scale_ops.control (environment_id, state, report)
VALUES ('marketplace-scale-v1', 'interrupted', '{"reason":"Explicit purge required before first load"}');
