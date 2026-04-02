CREATE TABLE IF NOT EXISTS cotizacion_envios (
  id TEXT PRIMARY KEY,
  cotizacion_id TEXT NOT NULL REFERENCES cotizaciones(id) ON DELETE CASCADE,
  destinatario TEXT NOT NULL,
  asunto TEXT NOT NULL,
  fecha_envio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  usuario_envio TEXT REFERENCES users(id) ON DELETE SET NULL,
  estado TEXT NOT NULL CHECK (estado IN ('enviado', 'error')),
  detalle_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cotizacion_envios_cotizacion_id
  ON cotizacion_envios (cotizacion_id, fecha_envio DESC);

CREATE INDEX IF NOT EXISTS idx_cotizacion_envios_usuario_envio
  ON cotizacion_envios (usuario_envio, fecha_envio DESC);

CREATE INDEX IF NOT EXISTS idx_cotizacion_envios_estado
  ON cotizacion_envios (estado, fecha_envio DESC);
