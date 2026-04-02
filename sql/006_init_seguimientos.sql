CREATE TABLE IF NOT EXISTS seguimientos (
  id TEXT PRIMARY KEY,
  cliente_id TEXT REFERENCES clientes(id) ON DELETE SET NULL,
  prospecto_id TEXT REFERENCES prospectos(id) ON DELETE SET NULL,
  cotizacion_id TEXT REFERENCES cotizaciones(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('llamada', 'email', 'reunion', 'mensaje', 'tarea')),
  fecha_vencimiento TIMESTAMPTZ NOT NULL,
  observaciones TEXT,
  estado TEXT NOT NULL CHECK (estado IN ('pendiente', 'en_proceso', 'cerrado', 'cancelado')),
  completado BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (num_nonnulls(cliente_id, prospecto_id, cotizacion_id) = 1)
);

CREATE INDEX IF NOT EXISTS idx_seguimientos_cliente_id
  ON seguimientos (cliente_id);

CREATE INDEX IF NOT EXISTS idx_seguimientos_prospecto_id
  ON seguimientos (prospecto_id);

CREATE INDEX IF NOT EXISTS idx_seguimientos_cotizacion_id
  ON seguimientos (cotizacion_id);

CREATE INDEX IF NOT EXISTS idx_seguimientos_tipo
  ON seguimientos (tipo);

CREATE INDEX IF NOT EXISTS idx_seguimientos_estado
  ON seguimientos (estado);

CREATE INDEX IF NOT EXISTS idx_seguimientos_completado
  ON seguimientos (completado);

CREATE INDEX IF NOT EXISTS idx_seguimientos_fecha_vencimiento
  ON seguimientos (fecha_vencimiento);
