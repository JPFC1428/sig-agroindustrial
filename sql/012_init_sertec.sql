CREATE TABLE IF NOT EXISTS sertec_ordenes (
  id TEXT PRIMARY KEY,
  numero TEXT NOT NULL UNIQUE,
  estado TEXT NOT NULL CHECK (estado IN ('entrada', 'reparacion', 'salida')),
  fecha_ingreso TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_reparacion TIMESTAMPTZ,
  fecha_salida TIMESTAMPTZ,
  cliente_id TEXT REFERENCES clientes(id) ON DELETE SET NULL,
  cliente_nombre TEXT NOT NULL,
  cliente_documento TEXT,
  cliente_telefono TEXT,
  cotizacion_id TEXT REFERENCES cotizaciones(id) ON DELETE SET NULL,
  cotizacion_item_id TEXT REFERENCES cotizacion_items(id) ON DELETE SET NULL,
  origen_comercial_tipo TEXT CHECK (origen_comercial_tipo IN ('cotizacion')),
  fecha_venta TIMESTAMPTZ,
  garantia_meses INTEGER CHECK (garantia_meses IS NULL OR garantia_meses >= 0),
  equipo_tipo TEXT NOT NULL,
  equipo_marca TEXT,
  equipo_modelo TEXT,
  equipo_serial TEXT,
  falla_reportada TEXT NOT NULL,
  diagnostico TEXT,
  trabajo_realizado TEXT,
  observaciones TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sertec_ordenes_estado
  ON sertec_ordenes (estado);

CREATE INDEX IF NOT EXISTS idx_sertec_ordenes_cliente_id
  ON sertec_ordenes (cliente_id);

CREATE INDEX IF NOT EXISTS idx_sertec_ordenes_cotizacion_id
  ON sertec_ordenes (cotizacion_id);

CREATE INDEX IF NOT EXISTS idx_sertec_ordenes_cotizacion_item_id
  ON sertec_ordenes (cotizacion_item_id);

CREATE INDEX IF NOT EXISTS idx_sertec_ordenes_fecha_ingreso
  ON sertec_ordenes (fecha_ingreso DESC);

CREATE INDEX IF NOT EXISTS idx_sertec_ordenes_cliente_nombre
  ON sertec_ordenes (cliente_nombre);

CREATE TABLE IF NOT EXISTS sertec_orden_historial (
  id TEXT PRIMARY KEY,
  orden_id TEXT NOT NULL REFERENCES sertec_ordenes(id) ON DELETE CASCADE,
  estado TEXT NOT NULL CHECK (estado IN ('entrada', 'reparacion', 'salida')),
  movimiento TEXT NOT NULL CHECK (
    movimiento IN ('entrada', 'reparacion', 'salida', 'adjunto')
  ),
  detalle TEXT,
  usuario_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sertec_orden_historial_orden_id
  ON sertec_orden_historial (orden_id, created_at ASC);

CREATE TABLE IF NOT EXISTS sertec_orden_adjuntos (
  id TEXT PRIMARY KEY,
  orden_id TEXT NOT NULL REFERENCES sertec_ordenes(id) ON DELETE CASCADE,
  nombre_archivo TEXT NOT NULL,
  tipo_mime TEXT NOT NULL CHECK (
    tipo_mime IN (
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp'
    )
  ),
  tamano INTEGER NOT NULL,
  contenido_base64 TEXT NOT NULL,
  descripcion TEXT,
  usuario_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sertec_orden_adjuntos_orden_id
  ON sertec_orden_adjuntos (orden_id, created_at DESC);
