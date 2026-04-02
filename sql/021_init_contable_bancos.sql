CREATE TABLE IF NOT EXISTS contable_cuentas_bancarias (
  id TEXT PRIMARY KEY,
  nombre_banco TEXT NOT NULL,
  nombre_cuenta TEXT NOT NULL,
  tipo_cuenta TEXT NOT NULL CHECK (
    tipo_cuenta IN ('ahorros', 'corriente', 'otra')
  ),
  numero_cuenta TEXT NOT NULL,
  titular TEXT NOT NULL,
  saldo_inicial NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (saldo_inicial >= 0),
  activa BOOLEAN NOT NULL DEFAULT TRUE,
  observaciones TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_contable_cuentas_bancarias_numero_unique
  ON contable_cuentas_bancarias (LOWER(numero_cuenta));

CREATE INDEX IF NOT EXISTS idx_contable_cuentas_bancarias_activa
  ON contable_cuentas_bancarias (activa);

CREATE INDEX IF NOT EXISTS idx_contable_cuentas_bancarias_nombre_banco
  ON contable_cuentas_bancarias (nombre_banco);

ALTER TABLE contable_egresos
  ADD COLUMN IF NOT EXISTS cuenta_bancaria_id TEXT REFERENCES contable_cuentas_bancarias(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contable_egresos_cuenta_bancaria_id
  ON contable_egresos (cuenta_bancaria_id);

ALTER TABLE contable_recibos_caja
  ADD COLUMN IF NOT EXISTS cuenta_bancaria_id TEXT REFERENCES contable_cuentas_bancarias(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contable_recibos_caja_cuenta_bancaria_id
  ON contable_recibos_caja (cuenta_bancaria_id);
