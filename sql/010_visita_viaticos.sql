CREATE TABLE IF NOT EXISTS visita_viaticos (
  id TEXT PRIMARY KEY,
  visita_id TEXT NOT NULL REFERENCES visitas(id) ON DELETE CASCADE,
  usuario_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  tipo_gasto TEXT NOT NULL CHECK (tipo_gasto IN ('peajes', 'gasolina', 'estadia', 'alimentacion')),
  fecha TIMESTAMPTZ NOT NULL,
  valor NUMERIC(14, 2) NOT NULL DEFAULT 0,
  descripcion TEXT NOT NULL,
  observaciones TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visita_viaticos_visita_id
  ON visita_viaticos (visita_id, fecha DESC);

CREATE INDEX IF NOT EXISTS idx_visita_viaticos_usuario_id
  ON visita_viaticos (usuario_id, fecha DESC);

CREATE INDEX IF NOT EXISTS idx_visita_viaticos_tipo_gasto
  ON visita_viaticos (tipo_gasto, fecha DESC);
