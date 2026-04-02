CREATE TABLE IF NOT EXISTS visitas (
  id TEXT PRIMARY KEY,
  cliente_id TEXT REFERENCES clientes(id) ON DELETE SET NULL,
  prospecto_id TEXT REFERENCES prospectos(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('prospectacion', 'seguimiento', 'negociacion', 'servicio')),
  fecha TIMESTAMPTZ NOT NULL,
  hora TEXT NOT NULL,
  objetivo TEXT NOT NULL,
  resultado TEXT NOT NULL DEFAULT '',
  observaciones TEXT,
  proxima_accion TEXT,
  estado TEXT NOT NULL CHECK (estado IN ('programada', 'realizada', 'cancelada')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (cliente_id IS NULL OR prospecto_id IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_visitas_cliente_id
  ON visitas (cliente_id);

CREATE INDEX IF NOT EXISTS idx_visitas_prospecto_id
  ON visitas (prospecto_id);

CREATE INDEX IF NOT EXISTS idx_visitas_tipo
  ON visitas (tipo);

CREATE INDEX IF NOT EXISTS idx_visitas_estado
  ON visitas (estado);

CREATE INDEX IF NOT EXISTS idx_visitas_fecha
  ON visitas (fecha DESC);

CREATE TABLE IF NOT EXISTS visita_viaticos (
  id TEXT PRIMARY KEY,
  visita_id TEXT NOT NULL REFERENCES visitas(id) ON DELETE CASCADE,
  usuario_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  tipo_gasto TEXT NOT NULL CHECK (tipo_gasto IN ('peajes', 'gasolina', 'estadia', 'alimentacion')),
  fecha TIMESTAMPTZ NOT NULL,
  valor NUMERIC(14, 2) NOT NULL DEFAULT 0,
  descripcion TEXT NOT NULL,
  observaciones TEXT,
  soporte_nombre TEXT,
  soporte_tipo_mime TEXT CHECK (
    soporte_tipo_mime IS NULL OR
    soporte_tipo_mime IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')
  ),
  soporte_tamano INTEGER,
  soporte_contenido_base64 TEXT,
  legalizacion_estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (
    legalizacion_estado IN ('pendiente', 'legalizado', 'aprobado', 'rechazado')
  ),
  legalizacion_observaciones TEXT,
  legalizacion_updated_at TIMESTAMPTZ,
  legalizacion_updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  contable_egreso_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visita_viaticos_visita_id
  ON visita_viaticos (visita_id, fecha DESC);

CREATE INDEX IF NOT EXISTS idx_visita_viaticos_usuario_id
  ON visita_viaticos (usuario_id, fecha DESC);

CREATE INDEX IF NOT EXISTS idx_visita_viaticos_tipo_gasto
  ON visita_viaticos (tipo_gasto, fecha DESC);

CREATE INDEX IF NOT EXISTS idx_visita_viaticos_legalizacion_estado
  ON visita_viaticos (legalizacion_estado, fecha DESC);

CREATE INDEX IF NOT EXISTS idx_visita_viaticos_contable_egreso_id
  ON visita_viaticos (contable_egreso_id);
