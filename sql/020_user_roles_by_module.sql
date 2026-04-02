ALTER TABLE users
DROP CONSTRAINT IF EXISTS users_rol_check;

UPDATE users
SET rol = 'comercial'
WHERE rol = 'usuario';

ALTER TABLE users
ADD CONSTRAINT users_rol_check
CHECK (
  rol IN (
    'admin',
    'comercial',
    'contable',
    'sertec',
    'inventario'
  )
);

ALTER TABLE users
ALTER COLUMN rol SET DEFAULT 'comercial';
