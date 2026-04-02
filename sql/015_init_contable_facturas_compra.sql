CREATE TABLE IF NOT EXISTS contable_facturas_compra (
  id TEXT PRIMARY KEY,
  numero_factura TEXT NOT NULL,
  tercero_id TEXT NOT NULL REFERENCES contable_terceros(id) ON DELETE RESTRICT,
  fecha_factura DATE NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  iva NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (iva >= 0),
  total NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  saldo NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (saldo >= 0),
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (
    estado IN ('pendiente', 'parcial', 'pagada', 'vencida', 'anulada')
  ),
  observaciones TEXT,
  soporte_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (saldo <= total)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_contable_facturas_compra_tercero_numero_unique
  ON contable_facturas_compra (tercero_id, LOWER(numero_factura));

CREATE INDEX IF NOT EXISTS idx_contable_facturas_compra_tercero_id
  ON contable_facturas_compra (tercero_id);

CREATE INDEX IF NOT EXISTS idx_contable_facturas_compra_estado
  ON contable_facturas_compra (estado);

CREATE INDEX IF NOT EXISTS idx_contable_facturas_compra_fecha_factura
  ON contable_facturas_compra (fecha_factura DESC);

CREATE INDEX IF NOT EXISTS idx_contable_facturas_compra_fecha_vencimiento
  ON contable_facturas_compra (fecha_vencimiento ASC);
