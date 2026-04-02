CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'comercial' CHECK (
    rol IN ('admin', 'comercial', 'contable', 'sertec', 'inventario')
  ),
  theme_preference TEXT NOT NULL DEFAULT 'light' CHECK (
    theme_preference IN ('light', 'dark')
  ),
  accent_color TEXT NOT NULL DEFAULT 'blue' CHECK (
    accent_color IN ('blue', 'green', 'orange', 'red', 'teal')
  ),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  ultimo_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique
  ON users (LOWER(email));

CREATE INDEX IF NOT EXISTS idx_users_rol ON users (rol);
CREATE INDEX IF NOT EXISTS idx_users_activo ON users (activo);

-- Admin inicial
-- email: admin@sigagroindustrial.com
-- password: Admin123456!
INSERT INTO users (
  id,
  nombre,
  email,
  password_hash,
  rol,
  activo
)
SELECT
  'usr-admin-inicial',
  'Administrador General',
  'admin@sigagroindustrial.com',
  'scrypt$CvX6bEKOzJ2UPl_rfVAIeg$XZCIaVUrjhHd6cX1LWDDn7AERfAaojKIlUi57zUk8Kd2zHh9Qu_S_CkpTJvVcdZz0kvWI4XatNl2fbzuBRMABQ',
  'admin',
  TRUE
WHERE NOT EXISTS (
  SELECT 1
  FROM users
  WHERE LOWER(email) = LOWER('admin@sigagroindustrial.com')
);
