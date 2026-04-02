CREATE TABLE IF NOT EXISTS cotizaciones (
  id TEXT PRIMARY KEY,
  numero TEXT NOT NULL,
  cliente_id TEXT REFERENCES clientes(id) ON DELETE SET NULL,
  fecha TIMESTAMPTZ NOT NULL,
  fecha_vencimiento TIMESTAMPTZ NOT NULL,
  estado TEXT NOT NULL CHECK (estado IN ('borrador', 'enviada', 'aprobada', 'rechazada')),
  subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0,
  impuesto NUMERIC(14, 2) NOT NULL DEFAULT 0,
  descuento_global NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total NUMERIC(14, 2) NOT NULL DEFAULT 0,
  moneda TEXT NOT NULL DEFAULT 'COP' CHECK (moneda IN ('COP', 'USD')),
  condiciones_pago TEXT NOT NULL,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cotizaciones_numero_unique
  ON cotizaciones (numero);

CREATE INDEX IF NOT EXISTS idx_cotizaciones_cliente_id
  ON cotizaciones (cliente_id);

CREATE INDEX IF NOT EXISTS idx_cotizaciones_estado
  ON cotizaciones (estado);

CREATE INDEX IF NOT EXISTS idx_cotizaciones_fecha
  ON cotizaciones (fecha DESC);

CREATE TABLE IF NOT EXISTS cotizacion_items (
  id TEXT PRIMARY KEY,
  cotizacion_id TEXT NOT NULL REFERENCES cotizaciones(id) ON DELETE CASCADE,
  orden INTEGER NOT NULL DEFAULT 0,
  descripcion TEXT NOT NULL,
  cantidad NUMERIC(14, 2) NOT NULL DEFAULT 0,
  precio_unitario NUMERIC(14, 2) NOT NULL DEFAULT 0,
  descuento NUMERIC(5, 2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cotizacion_items_cotizacion_id
  ON cotizacion_items (cotizacion_id, orden);

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
