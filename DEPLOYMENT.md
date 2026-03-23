# Deployment

## Arquitectura recomendada

- `Vercel`: frontend Vite/React
- `Fly.io`: backend HTTP (`/api/clientes`)
- `Neon`: PostgreSQL

## Variables en Fly.io

- `DATABASE_URL`: cadena de conexion de Neon
- `PORT=8080`
- `CORS_ALLOWED_ORIGINS=https://tu-app.vercel.app`

Tambien puedes usar varios origenes separados por comas:

```env
CORS_ALLOWED_ORIGINS=https://tu-app.vercel.app,https://tu-preview.vercel.app
```

Si no defines `CORS_ALLOWED_ORIGINS`, el backend responde con `Access-Control-Allow-Origin: *`.

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
