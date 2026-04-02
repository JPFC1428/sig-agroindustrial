ALTER TABLE contable_egresos
  ADD COLUMN IF NOT EXISTS conciliado BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE contable_egresos
  ADD COLUMN IF NOT EXISTS fecha_conciliacion TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_contable_egresos_conciliado
  ON contable_egresos (conciliado, fecha DESC);

ALTER TABLE contable_recibos_caja
  ADD COLUMN IF NOT EXISTS conciliado BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE contable_recibos_caja
  ADD COLUMN IF NOT EXISTS fecha_conciliacion TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_contable_recibos_caja_conciliado
  ON contable_recibos_caja (conciliado, fecha DESC);
