CREATE TABLE IF NOT EXISTS cotizacion_whatsapp_historial (
  id TEXT PRIMARY KEY,
  cotizacion_id TEXT NOT NULL REFERENCES cotizaciones(id) ON DELETE CASCADE,
  telefono_destino TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  url_whatsapp TEXT NOT NULL,
  url_cotizacion TEXT,
  fecha_preparado TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  usuario_preparo TEXT REFERENCES users(id) ON DELETE SET NULL,
  estado TEXT NOT NULL DEFAULT 'preparado' CHECK (estado IN ('preparado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cotizacion_whatsapp_historial_cotizacion_id
  ON cotizacion_whatsapp_historial (cotizacion_id, fecha_preparado DESC);

CREATE INDEX IF NOT EXISTS idx_cotizacion_whatsapp_historial_usuario_preparo
  ON cotizacion_whatsapp_historial (usuario_preparo, fecha_preparado DESC);
