CREATE TABLE IF NOT EXISTS contable_recibos_caja (
  id TEXT PRIMARY KEY,
  numero_recibo TEXT NOT NULL UNIQUE,
  tercero_id TEXT NOT NULL REFERENCES contable_terceros(id) ON DELETE RESTRICT,
  fecha DATE NOT NULL,
  valor_total NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (valor_total > 0),
  metodo_pago TEXT NOT NULL CHECK (
    metodo_pago IN ('efectivo', 'transferencia', 'cheque', 'tarjeta', 'otro')
  ),
  conciliado BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_conciliacion TIMESTAMPTZ,
  observaciones TEXT,
  soporte_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contable_recibos_caja_tercero_id
  ON contable_recibos_caja (tercero_id);

CREATE INDEX IF NOT EXISTS idx_contable_recibos_caja_fecha
  ON contable_recibos_caja (fecha DESC);

CREATE INDEX IF NOT EXISTS idx_contable_recibos_caja_conciliado
  ON contable_recibos_caja (conciliado, fecha DESC);

CREATE TABLE IF NOT EXISTS contable_recibo_detalle (
  id TEXT PRIMARY KEY,
  recibo_id TEXT NOT NULL REFERENCES contable_recibos_caja(id) ON DELETE CASCADE,
  documento_tipo TEXT NOT NULL CHECK (
    documento_tipo IN ('cuenta_por_cobrar', 'otro')
  ),
  documento_id TEXT,
  documento_referencia TEXT,
  valor_documento NUMERIC(14, 2) CHECK (valor_documento IS NULL OR valor_documento > 0),
  valor_pagado NUMERIC(14, 2) NOT NULL CHECK (valor_pagado > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT contable_recibo_detalle_documento_check CHECK (
    documento_id IS NOT NULL OR documento_referencia IS NOT NULL
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_contable_recibo_detalle_documento_unique
  ON contable_recibo_detalle (
    recibo_id,
    documento_tipo,
    COALESCE(documento_id, ''),
    COALESCE(documento_referencia, '')
  );

CREATE INDEX IF NOT EXISTS idx_contable_recibo_detalle_recibo_id
  ON contable_recibo_detalle (recibo_id);
