# Guía de Configuración de Base de Datos - SIG Agroindustrial

Este documento describe cómo configurar la base de datos PostgreSQL y Prisma para SIG Agroindustrial.

## 📋 Requisitos Previos

- PostgreSQL 12 o superior
- Node.js 18+
- pnpm

## 🗄️ Instalación de PostgreSQL

### En Linux (Ubuntu/Debian)
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### En macOS
```bash
brew install postgresql
brew services start postgresql
```

### En Windows
Descargar e instalar desde: https://www.postgresql.org/download/windows/

## 🔧 Configuración Inicial

### 1. Crear Base de Datos

```bash
# Conectar a PostgreSQL
sudo -u postgres psql

# Crear base de datos
CREATE DATABASE sig_agroindustrial;

# Crear usuario
CREATE USER sig_user WITH PASSWORD 'tu_contraseña_segura';

# Otorgar permisos
ALTER ROLE sig_user SET client_encoding TO 'utf8';
ALTER ROLE sig_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE sig_user SET default_transaction_deferrable TO on;
ALTER ROLE sig_user SET default_transaction_read_only TO off;
GRANT ALL PRIVILEGES ON DATABASE sig_agroindustrial TO sig_user;

# Salir
\q
```

### 2. Configurar Variables de Entorno

Crear archivo `.env.local` en la raíz del proyecto:

```env
# Base de Datos
DATABASE_URL="postgresql://sig_user:tu_contraseña_segura@localhost:5432/sig_agroindustrial"

# JWT Secret (generar con: openssl rand -base64 32)
JWT_SECRET="tu_jwt_secret_aqui"

# URL de la aplicación
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Modo de desarrollo
NODE_ENV="development"
```

### 3. Instalar Prisma

```bash
pnpm add -D prisma @prisma/client
pnpm prisma init
```

## 📊 Schema de Base de Datos

### Crear archivo `prisma/schema.prisma`

```prisma
// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================
// CLIENTES
// ============================================

model Cliente {
  id                  String      @id @default(cuid())
  nombre              String
  empresa             String
  email               String      @unique
  telefono            String
  ciudad              String
  departamento        String
  direccion           String
  estado              ClienteEstado @default(ACTIVO)
  tipoCliente         String      // 'empresa' | 'persona'
  nit                 String?     @unique
  contactoPrincipal   String
  cargoContacto       String
  fechaRegistro       DateTime    @default(now())
  ultimaVisita        DateTime?
  totalCompras        Int         @default(0)
  montoTotalCompras   BigInt      @default(0)
  notas               String?
  
  // Relaciones
  visitas             Visita[]
  cotizaciones        Cotizacion[]
  seguimientos        Seguimiento[]
  
  createdAt           DateTime    @default(now())
  updatedAt           DateTime    @updatedAt
  
  @@index([estado])
  @@index([ciudad])
}

enum ClienteEstado {
  ACTIVO
  INACTIVO
  SUSPENDIDO
}

// ============================================
// PROSPECTOS
// ============================================

model Prospecto {
  id                      String      @id @default(cuid())
  nombre                  String
  empresa                 String
  email                   String
  telefono                String
  ciudad                  String
  departamento            String
  contactoPrincipal       String
  cargoContacto           String
  estado                  ProspectoEstado @default(NUEVO)
  fuente                  String      // 'referencia' | 'web' | 'evento' | 'llamada_fria' | 'otro'
  fechaCaptura            DateTime    @default(now())
  proximoSeguimiento      DateTime?
  probabilidadConversion  Int         @default(0)
  montoEstimado           BigInt?
  notas                   String?
  asignadoA               String?
  
  // Relaciones
  visitas                 Visita[]
  cotizaciones            Cotizacion[]
  seguimientos            Seguimiento[]
  
  createdAt               DateTime    @default(now())
  updatedAt               DateTime    @updatedAt
  
  @@index([estado])
  @@index([ciudad])
}

enum ProspectoEstado {
  NUEVO
  CONTACTADO
  INTERESADO
  NEGOCIACION
  GANADO
  PERDIDO
}

// ============================================
// VISITAS
// ============================================

model Visita {
  id              String      @id @default(cuid())
  clienteId       String?
  prospectoId     String?
  tipo            VisitaTipo
  fecha           DateTime
  hora            String
  duracion        Int         // en minutos
  lugar           String
  asistentes      String[]    // JSON array
  temas           String[]    // JSON array
  resultados      String
  proximaAccion   String?
  proximaFecha    DateTime?
  notas           String?
  documentos      String[]    // URLs de documentos
  
  // Relaciones
  cliente         Cliente?    @relation(fields: [clienteId], references: [id], onDelete: SetNull)
  prospecto       Prospecto?  @relation(fields: [prospectoId], references: [id], onDelete: SetNull)
  
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  
  @@index([clienteId])
  @@index([prospectoId])
  @@index([fecha])
}

enum VisitaTipo {
  PROSPECTACION
  SEGUIMIENTO
  NEGOCIACION
  SERVICIO
}

// ============================================
// COTIZACIONES
// ============================================

model Cotizacion {
  id                  String      @id @default(cuid())
  numero              String      @unique
  clienteId           String?
  prospectoId         String?
  fecha               DateTime    @default(now())
  fechaVencimiento    DateTime
  estado              CotizacionEstado @default(BORRADOR)
  lineas              LineaCotizacion[]
  subtotal            BigInt
  impuesto            BigInt
  descuentoGlobal     BigInt?
  total               BigInt
  moneda              String      // 'COP' | 'USD'
  condicionesPago     String
  notas               String?
  enviadoA            String?
  fechaEnvio          DateTime?
  fechaRespuesta      DateTime?
  
  // Relaciones
  cliente             Cliente?    @relation(fields: [clienteId], references: [id], onDelete: SetNull)
  prospecto           Prospecto?  @relation(fields: [prospectoId], references: [id], onDelete: SetNull)
  
  createdAt           DateTime    @default(now())
  updatedAt           DateTime    @updatedAt
  
  @@index([clienteId])
  @@index([prospectoId])
  @@index([estado])
  @@index([fecha])
}

model LineaCotizacion {
  id                  String      @id @default(cuid())
  cotizacionId        String
  descripcion         String
  cantidad            Int
  precioUnitario      BigInt
  descuento           Int         // porcentaje
  subtotal            BigInt
  
  // Relaciones
  cotizacion          Cotizacion  @relation(fields: [cotizacionId], references: [id], onDelete: Cascade)
  
  @@index([cotizacionId])
}

enum CotizacionEstado {
  BORRADOR
  ENVIADA
  ACEPTADA
  RECHAZADA
  VENCIDA
}

// ============================================
// SEGUIMIENTOS
// ============================================

model Seguimiento {
  id                  String      @id @default(cuid())
  clienteId           String?
  prospectoId         String?
  tipo                SeguimientoTipo
  fecha               DateTime
  asunto              String
  descripcion         String
  resultado           String?
  proximoSeguimiento  DateTime?
  completado          Boolean     @default(false)
  asignadoA           String?
  notas               String?
  
  // Relaciones
  cliente             Cliente?    @relation(fields: [clienteId], references: [id], onDelete: SetNull)
  prospecto           Prospecto?  @relation(fields: [prospectoId], references: [id], onDelete: SetNull)
  
  createdAt           DateTime    @default(now())
  updatedAt           DateTime    @updatedAt
  
  @@index([clienteId])
  @@index([prospectoId])
  @@index([completado])
  @@index([fecha])
}

enum SeguimientoTipo {
  LLAMADA
  EMAIL
  REUNION
  MENSAJE
  TAREA
}
```

## 🚀 Ejecutar Migraciones

```bash
# Crear migración inicial
pnpm prisma migrate dev --name init

# Ver estado de migraciones
pnpm prisma migrate status

# Abrir Prisma Studio (interfaz gráfica)
pnpm prisma studio
```

## 📝 Seed de Datos Iniciales

Crear archivo `prisma/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Crear clientes
  const cliente1 = await prisma.cliente.create({
    data: {
      nombre: 'Juan Carlos Rodríguez',
      empresa: 'Café Premium Colombia S.A.S.',
      email: 'juan.rodriguez@cafepremium.com',
      telefono: '+57 310 555 0001',
      ciudad: 'Medellín',
      departamento: 'Antioquia',
      direccion: 'Cra 45 #12-34, Sector Laureles',
      estado: 'ACTIVO',
      tipoCliente: 'empresa',
      nit: '890.123.456-7',
      contactoPrincipal: 'Juan Carlos Rodríguez',
      cargoContacto: 'Gerente General',
      totalCompras: 25,
      montoTotalCompras: 125000000,
      notas: 'Cliente VIP, compras mensuales consistentes',
    },
  });

  console.log('Base de datos seeded exitosamente');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
```

Agregar a `package.json`:
```json
{
  "prisma": {
    "seed": "ts-node prisma/seed.ts"
  }
}
```

Ejecutar seed:
```bash
pnpm prisma db seed
```

## 🔌 Conectar Frontend a Backend

### Ejemplo: Obtener Clientes

**Backend (Express):**
```typescript
app.get('/api/clientes', async (req, res) => {
  const clientes = await prisma.cliente.findMany();
  res.json(clientes);
});
```

**Frontend (React Hook):**
```typescript
const [clientes, setClientes] = useState([]);

useEffect(() => {
  fetch('/api/clientes')
    .then(res => res.json())
    .then(data => setClientes(data));
}, []);
```

## 🔒 Seguridad

- Usar variables de entorno para credenciales
- Nunca commitear `.env` a Git
- Usar conexiones SSL en producción
- Implementar validación de datos
- Usar prepared statements (Prisma lo hace automáticamente)

## 📚 Recursos

- [Documentación de Prisma](https://www.prisma.io/docs/)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Prisma Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)

## 🆘 Troubleshooting

### Error: "connect ECONNREFUSED"
- Verificar que PostgreSQL está corriendo: `sudo systemctl status postgresql`
- Verificar DATABASE_URL en `.env.local`

### Error: "role 'sig_user' does not exist"
- Crear el usuario: `CREATE USER sig_user WITH PASSWORD 'contraseña';`

### Error: "database 'sig_agroindustrial' does not exist"
- Crear la base de datos: `CREATE DATABASE sig_agroindustrial;`

---

**Última actualización**: Marzo 2026
