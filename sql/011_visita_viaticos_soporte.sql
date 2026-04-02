ALTER TABLE visita_viaticos
ADD COLUMN IF NOT EXISTS soporte_nombre TEXT,
ADD COLUMN IF NOT EXISTS soporte_tipo_mime TEXT,
ADD COLUMN IF NOT EXISTS soporte_tamano INTEGER,
ADD COLUMN IF NOT EXISTS soporte_contenido_base64 TEXT;

ALTER TABLE visita_viaticos
DROP CONSTRAINT IF EXISTS visita_viaticos_soporte_tipo_mime_check;

ALTER TABLE visita_viaticos
ADD CONSTRAINT visita_viaticos_soporte_tipo_mime_check
CHECK (
  soporte_tipo_mime IS NULL OR
  soporte_tipo_mime IN (
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp'
  )
);
