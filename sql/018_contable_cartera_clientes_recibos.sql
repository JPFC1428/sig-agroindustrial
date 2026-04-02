ALTER TABLE contable_recibo_detalle
  ADD COLUMN IF NOT EXISTS valor_documento NUMERIC(14, 2);

ALTER TABLE contable_recibo_detalle
  DROP CONSTRAINT IF EXISTS contable_recibo_detalle_valor_documento_check;

ALTER TABLE contable_recibo_detalle
  ADD CONSTRAINT contable_recibo_detalle_valor_documento_check CHECK (
    valor_documento IS NULL OR valor_documento > 0
  );
