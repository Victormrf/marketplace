-- Dedicated integration-test environment, never the historical scale database.
COMMENT ON DATABASE marketplace_load_test IS 'marketplace-load-fixture-test-v1';
CREATE SCHEMA scale_ops;
CREATE TABLE scale_ops.load_experiments (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  namespace text,
  state text NOT NULL CHECK (state IN ('EMPTY','PREPARING','READY','RUNNING','UNKNOWN','RECOVERED')),
  manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  baseline jsonb NOT NULL DEFAULT '{}'::jsonb,
  effects jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO scale_ops.load_experiments (state) VALUES ('EMPTY');
