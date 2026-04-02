ALTER TABLE contable_facturas_compra
  DROP CONSTRAINT IF EXISTS contable_facturas_compra_estado_check;

ALTER TABLE contable_facturas_compra
  ADD CONSTRAINT contable_facturas_compra_estado_check CHECK (
    estado IN ('pendiente', 'parcial', 'pagada', 'vencida', 'anulada')
  );

CREATE TABLE IF NOT EXISTS contable_egresos (
  id TEXT PRIMARY KEY,
  numero_comprobante TEXT NOT NULL UNIQUE,
  tercero_id TEXT NOT NULL REFERENCES contable_terceros(id) ON DELETE RESTRICT,
  fecha DATE NOT NULL,
  valor_total NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (valor_total > 0),
  metodo_pago TEXT NOT NULL CHECK (
    metodo_pago IN ('efectivo', 'transferencia', 'cheque', 'tarjeta', 'otro')
  ),
  conciliado BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_conciliacion TIMESTAMPTZ,
  observaciones TEXT,
  soporte_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contable_egresos_tercero_id
  ON contable_egresos (tercero_id);

CREATE INDEX IF NOT EXISTS idx_contable_egresos_fecha
  ON contable_egresos (fecha DESC);

CREATE INDEX IF NOT EXISTS idx_contable_egresos_conciliado
  ON contable_egresos (conciliado, fecha DESC);

CREATE TABLE IF NOT EXISTS contable_egreso_detalle (
  id TEXT PRIMARY KEY,
  egreso_id TEXT NOT NULL REFERENCES contable_egresos(id) ON DELETE CASCADE,
  factura_id TEXT NOT NULL REFERENCES contable_facturas_compra(id) ON DELETE RESTRICT,
  valor_pagado NUMERIC(14, 2) NOT NULL CHECK (valor_pagado > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_contable_egreso_detalle_egreso_factura_unique
  ON contable_egreso_detalle (egreso_id, factura_id);

CREATE INDEX IF NOT EXISTS idx_contable_egreso_detalle_factura_id
  ON contable_egreso_detalle (factura_id);

CREATE OR REPLACE FUNCTION contable_calcular_estado_factura_compra(
  p_total NUMERIC,
  p_saldo NUMERIC,
  p_fecha_vencimiento DATE
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_saldo <= 0 THEN
    RETURN 'pagada';
  END IF;

  IF p_saldo < p_total THEN
    RETURN 'parcial';
  END IF;

  IF p_fecha_vencimiento < CURRENT_DATE THEN
    RETURN 'vencida';
  END IF;

  RETURN 'pendiente';
END;
$$;

CREATE OR REPLACE FUNCTION contable_egreso_detalle_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_egreso_tercero_id TEXT;
  v_factura_tercero_id TEXT;
  v_factura_saldo NUMERIC(14, 2);
  v_factura_estado TEXT;
BEGIN
  IF NEW.valor_pagado <= 0 THEN
    RAISE EXCEPTION 'El valor pagado debe ser mayor a cero';
  END IF;

  SELECT tercero_id
    INTO v_egreso_tercero_id
  FROM contable_egresos
  WHERE id = NEW.egreso_id;

  IF v_egreso_tercero_id IS NULL THEN
    RAISE EXCEPTION 'El egreso relacionado no existe';
  END IF;

  SELECT tercero_id, saldo, estado
    INTO v_factura_tercero_id, v_factura_saldo, v_factura_estado
  FROM contable_facturas_compra
  WHERE id = NEW.factura_id
  FOR UPDATE;

  IF v_factura_tercero_id IS NULL THEN
    RAISE EXCEPTION 'La factura relacionada no existe';
  END IF;

  IF v_factura_tercero_id <> v_egreso_tercero_id THEN
    RAISE EXCEPTION 'La factura no pertenece al mismo proveedor del egreso';
  END IF;

  IF v_factura_estado = 'anulada' THEN
    RAISE EXCEPTION 'No se puede aplicar un egreso a una factura anulada';
  END IF;

  IF v_factura_saldo < NEW.valor_pagado THEN
    RAISE EXCEPTION 'El valor pagado supera el saldo disponible de la factura';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION contable_egreso_detalle_after_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE contable_facturas_compra
  SET
    saldo = ROUND(saldo - NEW.valor_pagado, 2),
    estado = contable_calcular_estado_factura_compra(
      total,
      ROUND(saldo - NEW.valor_pagado, 2),
      fecha_vencimiento
    ),
    updated_at = NOW()
  WHERE id = NEW.factura_id;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION contable_egreso_detalle_after_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE contable_facturas_compra
  SET
    saldo = LEAST(total, ROUND(saldo + OLD.valor_pagado, 2)),
    estado = contable_calcular_estado_factura_compra(
      total,
      LEAST(total, ROUND(saldo + OLD.valor_pagado, 2)),
      fecha_vencimiento
    ),
    updated_at = NOW()
  WHERE id = OLD.factura_id;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_contable_egreso_detalle_before_insert
  ON contable_egreso_detalle;

CREATE TRIGGER trg_contable_egreso_detalle_before_insert
BEFORE INSERT ON contable_egreso_detalle
FOR EACH ROW
EXECUTE FUNCTION contable_egreso_detalle_before_insert();

DROP TRIGGER IF EXISTS trg_contable_egreso_detalle_after_insert
  ON contable_egreso_detalle;

CREATE TRIGGER trg_contable_egreso_detalle_after_insert
AFTER INSERT ON contable_egreso_detalle
FOR EACH ROW
EXECUTE FUNCTION contable_egreso_detalle_after_insert();

DROP TRIGGER IF EXISTS trg_contable_egreso_detalle_after_delete
  ON contable_egreso_detalle;

CREATE TRIGGER trg_contable_egreso_detalle_after_delete
AFTER DELETE ON contable_egreso_detalle
FOR EACH ROW
EXECUTE FUNCTION contable_egreso_detalle_after_delete();
