ALTER TABLE inventario_productos
  ADD COLUMN IF NOT EXISTS descripcion TEXT;

ALTER TABLE inventario_productos
  ADD COLUMN IF NOT EXISTS visible_en_mercado BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE inventario_productos
  ADD COLUMN IF NOT EXISTS tipo_disponibilidad TEXT NOT NULL DEFAULT 'stock';

ALTER TABLE inventario_productos
  ADD COLUMN IF NOT EXISTS imagen_url TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'inventario_productos_tipo_disponibilidad_check'
  ) THEN
    ALTER TABLE inventario_productos
      ADD CONSTRAINT inventario_productos_tipo_disponibilidad_check CHECK (
        tipo_disponibilidad IN ('stock', 'bajo_pedido')
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_inventario_productos_visible_mercado
  ON inventario_productos (visible_en_mercado, estado, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventario_productos_disponibilidad
  ON inventario_productos (tipo_disponibilidad, updated_at DESC);
