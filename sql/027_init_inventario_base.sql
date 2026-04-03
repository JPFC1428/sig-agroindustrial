CREATE TABLE IF NOT EXISTS inventario_productos (
  id TEXT PRIMARY KEY,
  tipo_item TEXT NOT NULL CHECK (
    tipo_item IN ('producto', 'equipo')
  ),
  codigo TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  categoria TEXT NOT NULL,
  marca TEXT,
  modelo TEXT,
  serial TEXT,
  maneja_serial BOOLEAN NOT NULL DEFAULT FALSE,
  unidad TEXT NOT NULL,
  costo NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (costo >= 0),
  precio NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (precio >= 0),
  stock_actual NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (stock_actual >= 0),
  estado TEXT NOT NULL DEFAULT 'activo' CHECK (
    estado IN ('activo', 'inactivo', 'descontinuado')
  ),
  referencia_externa_tipo TEXT,
  referencia_externa_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventario_productos_categoria
  ON inventario_productos (categoria);

CREATE INDEX IF NOT EXISTS idx_inventario_productos_estado
  ON inventario_productos (estado, created_at DESC);

CREATE TABLE IF NOT EXISTS inventario_compras (
  id TEXT PRIMARY KEY,
  numero_compra TEXT NOT NULL UNIQUE,
  proveedor_id TEXT NOT NULL REFERENCES contable_terceros (id) ON DELETE RESTRICT,
  fecha DATE NOT NULL,
  observaciones TEXT,
  estado TEXT NOT NULL DEFAULT 'registrada' CHECK (
    estado IN ('registrada', 'parcial', 'recibida', 'anulada')
  ),
  total NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventario_compras_proveedor
  ON inventario_compras (proveedor_id, fecha DESC);

CREATE TABLE IF NOT EXISTS inventario_compra_items (
  id TEXT PRIMARY KEY,
  compra_id TEXT NOT NULL REFERENCES inventario_compras (id) ON DELETE CASCADE,
  producto_id TEXT NOT NULL REFERENCES inventario_productos (id) ON DELETE RESTRICT,
  descripcion TEXT NOT NULL,
  cantidad NUMERIC(14, 2) NOT NULL CHECK (cantidad > 0),
  costo_unitario NUMERIC(14, 2) NOT NULL CHECK (costo_unitario >= 0),
  total NUMERIC(14, 2) NOT NULL CHECK (total >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventario_compra_items_compra
  ON inventario_compra_items (compra_id, created_at ASC);

CREATE TABLE IF NOT EXISTS inventario_entradas (
  id TEXT PRIMARY KEY,
  numero_entrada TEXT NOT NULL UNIQUE,
  fecha DATE NOT NULL,
  origen_tipo TEXT NOT NULL DEFAULT 'manual' CHECK (
    origen_tipo IN ('manual', 'compra', 'ajuste', 'sertec', 'comercial', 'traslado', 'garantia')
  ),
  origen_id TEXT,
  compra_id TEXT REFERENCES inventario_compras (id) ON DELETE SET NULL,
  bodega_id TEXT,
  observaciones TEXT,
  total_items NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (total_items >= 0),
  total_costo NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (total_costo >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventario_entradas_fecha
  ON inventario_entradas (fecha DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventario_entradas_origen
  ON inventario_entradas (origen_tipo, origen_id);

CREATE TABLE IF NOT EXISTS inventario_entrada_items (
  id TEXT PRIMARY KEY,
  entrada_id TEXT NOT NULL REFERENCES inventario_entradas (id) ON DELETE CASCADE,
  producto_id TEXT NOT NULL REFERENCES inventario_productos (id) ON DELETE RESTRICT,
  compra_item_id TEXT REFERENCES inventario_compra_items (id) ON DELETE SET NULL,
  cantidad NUMERIC(14, 2) NOT NULL CHECK (cantidad > 0),
  costo_unitario NUMERIC(14, 2) NOT NULL CHECK (costo_unitario >= 0),
  total NUMERIC(14, 2) NOT NULL CHECK (total >= 0),
  serial TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventario_entrada_items_entrada
  ON inventario_entrada_items (entrada_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_inventario_entrada_items_producto
  ON inventario_entrada_items (producto_id, created_at DESC);
