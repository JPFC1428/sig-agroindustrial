CREATE TABLE IF NOT EXISTS contable_terceros (
  id TEXT PRIMARY KEY,
  tipo_tercero TEXT NOT NULL CHECK (
    tipo_tercero IN ('cliente', 'proveedor', 'empleado', 'banco', 'otro')
  ),
  nombre_razon_social TEXT NOT NULL,
  documento_nit TEXT NOT NULL,
  contacto TEXT,
  telefono TEXT,
  correo TEXT,
  ciudad TEXT,
  direccion TEXT,
  observaciones TEXT,
  estado TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_contable_terceros_documento_nit_unique
  ON contable_terceros (LOWER(documento_nit));

CREATE INDEX IF NOT EXISTS idx_contable_terceros_tipo_tercero
  ON contable_terceros (tipo_tercero);

CREATE INDEX IF NOT EXISTS idx_contable_terceros_estado
  ON contable_terceros (estado);

CREATE INDEX IF NOT EXISTS idx_contable_terceros_nombre_razon_social
  ON contable_terceros (nombre_razon_social);
