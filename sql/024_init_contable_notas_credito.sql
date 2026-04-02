CREATE TABLE IF NOT EXISTS contable_notas_credito (
  id TEXT PRIMARY KEY,
  numero_nota TEXT NOT NULL UNIQUE,
  tercero_id TEXT NOT NULL REFERENCES contable_terceros(id) ON DELETE RESTRICT,
  tipo TEXT NOT NULL CHECK (
    tipo IN ('cliente', 'proveedor')
  ),
  fecha DATE NOT NULL,
  valor NUMERIC(14, 2) NOT NULL CHECK (valor > 0),
  motivo TEXT NOT NULL,
  referencia_documento TEXT,
  observaciones TEXT,
  estado TEXT NOT NULL DEFAULT 'borrador' CHECK (
    estado IN ('borrador', 'emitida', 'aplicada', 'anulada')
  ),
  documento_relacionado_tipo TEXT CHECK (
    documento_relacionado_tipo IN ('factura_compra', 'cuenta_por_cobrar', 'otro')
  ),
  documento_relacionado_id TEXT,
  documento_relacionado_numero TEXT,
  afecta_cartera BOOLEAN NOT NULL DEFAULT FALSE,
  cartera_estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (
    cartera_estado IN ('pendiente', 'preparada', 'aplicada')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT contable_notas_credito_documento_tipo_id_check CHECK (
    documento_relacionado_id IS NULL OR documento_relacionado_tipo IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_contable_notas_credito_tercero_id
  ON contable_notas_credito (tercero_id);

CREATE INDEX IF NOT EXISTS idx_contable_notas_credito_tipo
  ON contable_notas_credito (tipo);

CREATE INDEX IF NOT EXISTS idx_contable_notas_credito_estado
  ON contable_notas_credito (estado);

CREATE INDEX IF NOT EXISTS idx_contable_notas_credito_fecha
  ON contable_notas_credito (fecha DESC);

CREATE INDEX IF NOT EXISTS idx_contable_notas_credito_documento_relacionado
  ON contable_notas_credito (
    documento_relacionado_tipo,
    COALESCE(documento_relacionado_id, '')
  );
