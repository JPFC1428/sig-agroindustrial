ALTER TABLE contable_egresos
ADD COLUMN IF NOT EXISTS soporte_url TEXT;

ALTER TABLE contable_recibos_caja
ADD COLUMN IF NOT EXISTS soporte_url TEXT;
