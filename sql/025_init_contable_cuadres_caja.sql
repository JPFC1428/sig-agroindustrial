CREATE TABLE IF NOT EXISTS contable_cuadres_caja (
  id TEXT PRIMARY KEY,
  fecha_desde DATE NOT NULL,
  fecha_hasta DATE NOT NULL,
  cantidad_ingresos INTEGER NOT NULL DEFAULT 0 CHECK (cantidad_ingresos >= 0),
  cantidad_salidas INTEGER NOT NULL DEFAULT 0 CHECK (cantidad_salidas >= 0),
  total_ingresos NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (total_ingresos >= 0),
  total_salidas NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (total_salidas >= 0),
  saldo_esperado NUMERIC(14, 2) NOT NULL DEFAULT 0,
  observaciones TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT contable_cuadres_caja_rango_check CHECK (fecha_desde <= fecha_hasta),
  CONSTRAINT contable_cuadres_caja_rango_unique UNIQUE (fecha_desde, fecha_hasta)
);

CREATE INDEX IF NOT EXISTS idx_contable_cuadres_caja_rango
  ON contable_cuadres_caja (fecha_desde DESC, fecha_hasta DESC);

CREATE INDEX IF NOT EXISTS idx_contable_cuadres_caja_created_at
  ON contable_cuadres_caja (created_at DESC);
