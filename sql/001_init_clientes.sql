CREATE TABLE IF NOT EXISTS clientes (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  empresa TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  telefono TEXT NOT NULL DEFAULT '',
  ciudad TEXT NOT NULL,
  departamento TEXT NOT NULL DEFAULT '',
  direccion TEXT NOT NULL DEFAULT '',
  estado TEXT NOT NULL CHECK (estado IN ('activo', 'inactivo', 'suspendido')),
  tipo_cliente TEXT NOT NULL DEFAULT 'empresa' CHECK (tipo_cliente IN ('empresa', 'persona')),
  nit TEXT,
  contacto_principal TEXT NOT NULL DEFAULT '',
  cargo_contacto TEXT NOT NULL DEFAULT '',
  fecha_registro TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ultima_visita TIMESTAMPTZ,
  total_compras INTEGER NOT NULL DEFAULT 0,
  monto_total_compras NUMERIC(14, 2) NOT NULL DEFAULT 0,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clientes_estado ON clientes (estado);
CREATE INDEX IF NOT EXISTS idx_clientes_ciudad ON clientes (ciudad);
