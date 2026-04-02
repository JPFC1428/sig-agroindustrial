ALTER TABLE sertec_ordenes
  ADD COLUMN IF NOT EXISTS cliente_id TEXT REFERENCES clientes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cotizacion_id TEXT REFERENCES cotizaciones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cotizacion_item_id TEXT REFERENCES cotizacion_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS origen_comercial_tipo TEXT CHECK (origen_comercial_tipo IN ('cotizacion')),
  ADD COLUMN IF NOT EXISTS fecha_venta TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS garantia_meses INTEGER CHECK (garantia_meses IS NULL OR garantia_meses >= 0);

CREATE INDEX IF NOT EXISTS idx_sertec_ordenes_cliente_id
  ON sertec_ordenes (cliente_id);

CREATE INDEX IF NOT EXISTS idx_sertec_ordenes_cotizacion_id
  ON sertec_ordenes (cotizacion_id);

CREATE INDEX IF NOT EXISTS idx_sertec_ordenes_cotizacion_item_id
  ON sertec_ordenes (cotizacion_item_id);
