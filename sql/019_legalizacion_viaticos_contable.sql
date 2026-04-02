ALTER TABLE visita_viaticos
ADD COLUMN IF NOT EXISTS legalizacion_estado TEXT NOT NULL DEFAULT 'pendiente',
ADD COLUMN IF NOT EXISTS legalizacion_observaciones TEXT,
ADD COLUMN IF NOT EXISTS legalizacion_updated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS legalizacion_updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS contable_egreso_id TEXT;

ALTER TABLE visita_viaticos
DROP CONSTRAINT IF EXISTS visita_viaticos_legalizacion_estado_check;

ALTER TABLE visita_viaticos
ADD CONSTRAINT visita_viaticos_legalizacion_estado_check
CHECK (
  legalizacion_estado IN (
    'pendiente',
    'legalizado',
    'aprobado',
    'rechazado'
  )
);

ALTER TABLE visita_viaticos
DROP CONSTRAINT IF EXISTS visita_viaticos_contable_egreso_id_fkey;

ALTER TABLE visita_viaticos
ADD CONSTRAINT visita_viaticos_contable_egreso_id_fkey
FOREIGN KEY (contable_egreso_id)
REFERENCES contable_egresos(id)
ON DELETE SET NULL;

UPDATE visita_viaticos
SET legalizacion_estado = 'pendiente'
WHERE legalizacion_estado IS NULL
   OR legalizacion_estado = '';

CREATE INDEX IF NOT EXISTS idx_visita_viaticos_legalizacion_estado
  ON visita_viaticos (legalizacion_estado, fecha DESC);

CREATE INDEX IF NOT EXISTS idx_visita_viaticos_legalizacion_usuario_estado
  ON visita_viaticos (usuario_id, legalizacion_estado, fecha DESC);

CREATE INDEX IF NOT EXISTS idx_visita_viaticos_contable_egreso_id
  ON visita_viaticos (contable_egreso_id);
