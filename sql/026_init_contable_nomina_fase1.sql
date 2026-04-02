CREATE TABLE IF NOT EXISTS contable_nomina_empleados (
  id TEXT PRIMARY KEY,
  tercero_id TEXT NOT NULL UNIQUE REFERENCES contable_terceros (id) ON DELETE RESTRICT,
  tipo_contrato TEXT NOT NULL CHECK (
    tipo_contrato IN ('indefinido', 'fijo', 'otro')
  ),
  cargo TEXT NOT NULL,
  fecha_ingreso DATE NOT NULL,
  salario_basico NUMERIC(14, 2) NOT NULL CHECK (salario_basico > 0),
  auxilio_transporte NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (auxilio_transporte >= 0),
  aplica_auxilio_transporte BOOLEAN NOT NULL DEFAULT TRUE,
  eps TEXT,
  fondo_pension TEXT,
  arl TEXT,
  caja_compensacion TEXT,
  porcentaje_arl NUMERIC(8, 6) NOT NULL DEFAULT 0.005220 CHECK (
    porcentaje_arl >= 0 AND porcentaje_arl <= 1
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contable_nomina_empleados_fecha_ingreso
  ON contable_nomina_empleados (fecha_ingreso DESC);

CREATE TABLE IF NOT EXISTS contable_nomina_periodos (
  id TEXT PRIMARY KEY,
  codigo_periodo TEXT NOT NULL UNIQUE,
  tipo TEXT NOT NULL CHECK (
    tipo IN ('mensual', 'quincenal')
  ),
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  estado TEXT NOT NULL DEFAULT 'abierto' CHECK (
    estado IN ('abierto', 'cerrado')
  ),
  observaciones TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT contable_nomina_periodos_rango_check CHECK (fecha_inicio <= fecha_fin)
);

CREATE INDEX IF NOT EXISTS idx_contable_nomina_periodos_fecha_inicio
  ON contable_nomina_periodos (fecha_inicio DESC);

CREATE TABLE IF NOT EXISTS contable_nomina_liquidaciones (
  id TEXT PRIMARY KEY,
  periodo_id TEXT NOT NULL REFERENCES contable_nomina_periodos (id) ON DELETE RESTRICT,
  empleado_id TEXT NOT NULL REFERENCES contable_nomina_empleados (id) ON DELETE RESTRICT,
  dias_trabajados INTEGER NOT NULL CHECK (dias_trabajados > 0 AND dias_trabajados <= 30),
  salario_basico_mensual NUMERIC(14, 2) NOT NULL CHECK (salario_basico_mensual >= 0),
  salario_devengado NUMERIC(14, 2) NOT NULL CHECK (salario_devengado >= 0),
  auxilio_transporte NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (auxilio_transporte >= 0),
  devengado NUMERIC(14, 2) NOT NULL CHECK (devengado >= 0),
  deduccion_salud NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (deduccion_salud >= 0),
  deduccion_pension NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (deduccion_pension >= 0),
  neto_pagar NUMERIC(14, 2) NOT NULL,
  ibc_seguridad_social NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (ibc_seguridad_social >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT contable_nomina_liquidaciones_periodo_empleado_unique UNIQUE (
    periodo_id,
    empleado_id
  )
);

CREATE INDEX IF NOT EXISTS idx_contable_nomina_liquidaciones_periodo
  ON contable_nomina_liquidaciones (periodo_id, created_at DESC);

CREATE TABLE IF NOT EXISTS contable_nomina_seguridad_social (
  id TEXT PRIMARY KEY,
  liquidacion_id TEXT NOT NULL UNIQUE REFERENCES contable_nomina_liquidaciones (id) ON DELETE CASCADE,
  periodo_id TEXT NOT NULL REFERENCES contable_nomina_periodos (id) ON DELETE RESTRICT,
  empleado_id TEXT NOT NULL REFERENCES contable_nomina_empleados (id) ON DELETE RESTRICT,
  ibc NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (ibc >= 0),
  salud_empleado NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (salud_empleado >= 0),
  salud_empresa NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (salud_empresa >= 0),
  pension_empleado NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (pension_empleado >= 0),
  pension_empresa NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (pension_empresa >= 0),
  arl NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (arl >= 0),
  caja_compensacion NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (caja_compensacion >= 0),
  total_aportes NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (total_aportes >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contable_nomina_seguridad_social_periodo
  ON contable_nomina_seguridad_social (periodo_id, created_at DESC);
