# Deployment

## Arquitectura recomendada

- `Vercel`: frontend Vite/React
- `Fly.io`: backend HTTP (`/api/clientes`)
- `Neon`: PostgreSQL

## Variables en Fly.io

- `DATABASE_URL`: cadena de conexion de Neon
- `PORT=8080`
- `CORS_ALLOWED_ORIGINS=https://tu-app.vercel.app`
- `RESEND_API_KEY`: API key del provider de correo `Resend`
- `EMAIL_FROM`: remitente verificado en Resend, por ejemplo `SIG Agroindustrial <cotizaciones@tu-dominio.com>`
- `EMAIL_REPLY_TO`: opcional, correo de respuesta para el cliente
- `PUBLIC_APP_URL`: URL publica usada por enlaces salientes del backend

Tambien puedes usar varios origenes separados por comas:

```env
CORS_ALLOWED_ORIGINS=https://tu-app.vercel.app,https://tu-preview.vercel.app
```

Si no defines `CORS_ALLOWED_ORIGINS`, el backend responde con `Access-Control-Allow-Origin: *`.

## Correo de cotizaciones

El envio de cotizaciones por correo usa `Resend` desde el backend. No hay SMTP configurado en este proyecto.

Para dejarlo funcionando en `local` y `produccion`, configura las variables anteriores en el proceso del backend:

```env
RESEND_API_KEY=re_xxxxxxxxx
EMAIL_FROM=SIG Agroindustrial <cotizaciones@tu-dominio.com>
EMAIL_REPLY_TO=comercial@tu-dominio.com
```

En Fly.io normalmente se cargan como secretos:

```bash
fly secrets set \
  RESEND_API_KEY=re_xxxxxxxxx \
  EMAIL_FROM="SIG Agroindustrial <cotizaciones@tu-dominio.com>" \
  EMAIL_REPLY_TO=comercial@tu-dominio.com \
  PUBLIC_APP_URL=https://tu-app.vercel.app
```

En local, agrega las mismas variables en `.env`. El modo `npm run dev` ya las propaga al middleware de API.

## Variables en Vercel

- `VITE_API_BASE_URL=https://tu-backend.fly.dev`

Importante: `VITE_API_BASE_URL` debe ser el origen del backend, sin `/api` al final.

## Backend en Fly.io

1. Crear o ajustar `fly.toml` a partir de `fly.toml.example`.
2. Desplegar usando el `Dockerfile` del repo.
3. El healthcheck queda en `GET /health`.

## Frontend en Vercel

1. Mantener `vercel.json` para servir el frontend.
2. Configurar `VITE_API_BASE_URL`.
3. Redeploy.

## Scripts utiles

- `npm run dev`: frontend local con Vite
- `npm run dev:api`: backend local con `tsx`
- `npm run build:api`: compila el backend para produccion
- `npm run start:api`: ejecuta el backend compilado
