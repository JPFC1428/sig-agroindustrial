CREATE TABLE IF NOT EXISTS public.chat_conversaciones (
  id TEXT PRIMARY KEY,
  llave_directa TEXT UNIQUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.chat_participantes (
  id TEXT PRIMARY KEY,
  conversacion_id TEXT NOT NULL REFERENCES public.chat_conversaciones(id) ON DELETE CASCADE,
  usuario_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (conversacion_id, usuario_id)
);

CREATE TABLE IF NOT EXISTS public.chat_mensajes (
  id TEXT PRIMARY KEY,
  conversacion_id TEXT NOT NULL REFERENCES public.chat_conversaciones(id) ON DELETE CASCADE,
  usuario_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  contenido TEXT NOT NULL DEFAULT '',
  tipo TEXT NOT NULL DEFAULT 'texto',
  archivo_url TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chat_mensajes_tipo_check CHECK (tipo IN ('texto', 'archivo', 'sistema'))
);

CREATE INDEX IF NOT EXISTS idx_chat_participantes_usuario
  ON public.chat_participantes (usuario_id);

CREATE INDEX IF NOT EXISTS idx_chat_participantes_conversacion
  ON public.chat_participantes (conversacion_id);

CREATE INDEX IF NOT EXISTS idx_chat_mensajes_conversacion_fecha
  ON public.chat_mensajes (conversacion_id, creado_en DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_chat_mensajes_usuario
  ON public.chat_mensajes (usuario_id);
