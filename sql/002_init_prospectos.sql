CREATE TABLE IF NOT EXISTS prospectos (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  empresa TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  telefono TEXT NOT NULL DEFAULT '',
  ciudad TEXT NOT NULL,
  departamento TEXT NOT NULL DEFAULT '',
  contacto_principal TEXT NOT NULL DEFAULT '',
  cargo_contacto TEXT NOT NULL DEFAULT '',
  estado TEXT NOT NULL CHECK (
    estado IN (
      'nuevo',
      'contactado',
      'interesado',
      'negociacion',
      'ganado',
      'perdido'
    )
  ),
  fuente TEXT NOT NULL DEFAULT 'otro' CHECK (
    fuente IN ('referencia', 'web', 'evento', 'llamada_fria', 'otro')
  ),
  fecha_captura TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  proximo_seguimiento TIMESTAMPTZ,
  probabilidad_conversion INTEGER NOT NULL DEFAULT 0 CHECK (
    probabilidad_conversion >= 0 AND probabilidad_conversion <= 100
  ),
  monto_estimado NUMERIC(14, 2),
  notas TEXT,
  asignado_a TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prospectos_estado ON prospectos (estado);
CREATE INDEX IF NOT EXISTS idx_prospectos_ciudad ON prospectos (ciudad);
CREATE INDEX IF NOT EXISTS idx_prospectos_fuente ON prospectos (fuente);
CREATE INDEX IF NOT EXISTS idx_prospectos_proximo_seguimiento
  ON prospectos (proximo_seguimiento);
