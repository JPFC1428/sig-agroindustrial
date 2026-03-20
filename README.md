# SIG Agroindustrial - Módulo Comercial

Sistema de Información Geográfica para **AGROINDUSTRIAL DEL CAFE S.A.S.** - Módulo de Gestión Comercial.

## 📋 Descripción General

SIG Agroindustrial es una plataforma web diseñada para gestionar todas las actividades comerciales de la empresa. El módulo comercial actual incluye funcionalidades para la gestión integral de clientes, prospectos, visitas, cotizaciones y seguimientos.

## 🎯 Características Principales

### Dashboard Comercial
- **Métricas Clave**: Visualización en tiempo real de clientes, prospectos, visitas y cotizaciones
- **Actividad Reciente**: Historial de últimas acciones realizadas en el sistema
- **Indicadores de Desempeño**: Tasa de conversión, monto en prospectos, seguimientos pendientes

### Gestión de Clientes
- Tabla de clientes con búsqueda y filtros avanzados
- Información completa: contacto, ubicación, historial de compras
- Vista detallada del cliente con historial de visitas y cotizaciones
- Estados de cliente: Activo, Inactivo, Suspendido

### Gestión de Prospectos
- Cartera de prospectos con indicadores de probabilidad
- Filtros por estado, probabilidad de conversión y fuente
- Seguimiento de oportunidades de venta
- Estados: Nuevo, Contactado, Interesado, Negociación, Ganado, Perdido

### Gestión de Visitas
- Registro de visitas comerciales
- Tipos de visita: Prospectación, Seguimiento, Negociación, Servicio
- Información detallada: fecha, hora, duración, asistentes, resultados
- Próximas acciones y seguimientos

### Gestión de Cotizaciones
- Creación y seguimiento de cotizaciones
- Líneas de producto con precios y descuentos
- Estados: Borrador, Enviada, Aceptada, Rechazada, Vencida
- Cálculo automático de totales e impuestos

### Gestión de Seguimientos
- Tareas y recordatorios de seguimiento
- Tipos: Llamada, Email, Reunión, Mensaje, Tarea
- Marcado de completados
- Próximos seguimientos programados

## 🏗️ Arquitectura Técnica

### Stack Tecnológico
- **Frontend**: React 19 con TypeScript
- **Enrutamiento**: Wouter (client-side routing)
- **Estilos**: Tailwind CSS 4 + shadcn/ui
- **Componentes**: shadcn/ui (Button, Input, Select, Dialog, etc.)
- **Iconografía**: Lucide React
- **Utilidades**: date-fns para manejo de fechas

### Estructura de Carpetas

```
client/
├── src/
│   ├── components/
│   │   ├── DashboardLayout.tsx      # Layout principal con sidebar
│   │   ├── Sidebar.tsx              # Navegación lateral
│   │   ├── DashboardCard.tsx        # Tarjeta de métricas
│   │   └── ui/                      # Componentes shadcn/ui
│   ├── pages/
│   │   ├── Dashboard.tsx            # Dashboard comercial
│   │   ├── Clientes.tsx             # Listado de clientes
│   │   ├── ClienteDetalle.tsx       # Detalle del cliente
│   │   ├── Prospectos.tsx           # Listado de prospectos
│   │   ├── Visitas.tsx              # Listado de visitas
│   │   ├── Cotizaciones.tsx         # Listado de cotizaciones
│   │   ├── Seguimientos.tsx         # Listado de seguimientos
│   │   └── NotFound.tsx             # Página 404
│   ├── lib/
│   │   ├── types.ts                 # Interfaces y tipos TypeScript
│   │   └── mock-data.ts             # Datos de ejemplo
│   ├── contexts/
│   │   └── ThemeContext.tsx         # Contexto de tema
│   ├── App.tsx                      # Rutas principales
│   ├── main.tsx                     # Punto de entrada
│   └── index.css                    # Estilos globales y temas
├── public/
│   └── favicon.ico
└── index.html
```

## 📊 Tipos de Datos

### Cliente
```typescript
interface Cliente {
  id: string;
  nombre: string;
  empresa: string;
  email: string;
  telefono: string;
  ciudad: string;
  departamento: string;
  direccion: string;
  estado: ClienteEstado;
  tipoCliente: 'empresa' | 'persona';
  nit?: string;
  contactoPrincipal: string;
  cargoContacto: string;
  fechaRegistro: Date;
  ultimaVisita?: Date;
  totalCompras: number;
  montoTotalCompras: number;
  notas?: string;
}
```

### Prospecto
```typescript
interface Prospecto {
  id: string;
  nombre: string;
  empresa: string;
  email: string;
  telefono: string;
  ciudad: string;
  departamento: string;
  contactoPrincipal: string;
  cargoContacto: string;
  estado: ProspectoEstado;
  fuente: 'referencia' | 'web' | 'evento' | 'llamada_fria' | 'otro';
  fechaCaptura: Date;
  proximoSeguimiento?: Date;
  probabilidadConversion: number;
  montoEstimado?: number;
  notas?: string;
}
```

### Visita
```typescript
interface Visita {
  id: string;
  clienteId?: string;
  prospectoId?: string;
  tipo: VisitaTipo;
  fecha: Date;
  hora: string;
  duracion: number;
  lugar: string;
  asistentes: string[];
  temas: string[];
  resultados: string;
  proximaAccion?: string;
  proximaFecha?: Date;
  notas?: string;
}
```

### Cotización
```typescript
interface Cotizacion {
  id: string;
  numero: string;
  clienteId?: string;
  prospectoId?: string;
  fecha: Date;
  fechaVencimiento: Date;
  estado: CotizacionEstado;
  lineas: LineaCotizacion[];
  subtotal: number;
  impuesto: number;
  descuentoGlobal?: number;
  total: number;
  moneda: 'COP' | 'USD';
  condicionesPago: string;
  notas?: string;
}
```

### Seguimiento
```typescript
interface Seguimiento {
  id: string;
  clienteId?: string;
  prospectoId?: string;
  tipo: SeguimientoTipo;
  fecha: Date;
  asunto: string;
  descripcion: string;
  resultado?: string;
  proximoSeguimiento?: Date;
  completado: boolean;
  notas?: string;
}
```

## 🎨 Diseño - Minimalismo Corporativo Moderno

El proyecto utiliza una filosofía de diseño minimalista corporativa que prioriza:

- **Claridad**: Cada elemento tiene propósito funcional
- **Jerarquía**: Tipografía y espaciado definen importancia visual
- **Profesionalismo**: Paleta neutral con acentos estratégicos
- **Eficiencia**: Máxima información sin saturación visual

### Paleta de Color
- **Primario**: Azul profesional (oklch(0.623 0.214 259.815))
- **Secundario**: Verde suave (oklch(0.6 0.1 142))
- **Fondo**: Blanco puro
- **Texto**: Gris oscuro profundo
- **Bordes**: Gris muy claro

### Tipografía
- **Display**: Geist Sans Bold (700)
- **Body**: Geist Sans Regular (400)
- **Monoespaciado**: IBM Plex Mono

## 🚀 Guía de Desarrollo

### Instalación

```bash
# Instalar dependencias
pnpm install

# Iniciar servidor de desarrollo
pnpm dev

# Compilar para producción
pnpm build

# Vista previa de producción
pnpm preview
```

### Datos Mock

El proyecto utiliza datos mock almacenados en `client/src/lib/mock-data.ts`. Estos datos incluyen:
- 3 clientes de ejemplo
- 3 prospectos de ejemplo
- 3 visitas de ejemplo
- 3 cotizaciones de ejemplo
- 3 seguimientos de ejemplo

Para conectar a una base de datos real, reemplaza las importaciones de `mock-data.ts` con llamadas a API.

### Agregar Nuevas Páginas

1. Crear componente en `client/src/pages/NuevaPagina.tsx`
2. Importar en `client/src/App.tsx`
3. Agregar ruta en el componente `Router`

```tsx
import NuevaPagina from "./pages/NuevaPagina";

<Route path={"/nueva-pagina"} component={NuevaPagina} />
```

### Agregar Nuevos Componentes

1. Crear componente en `client/src/components/NuevoComponente.tsx`
2. Importar en la página donde se necesite
3. Usar con props tipadas

## 📝 Próximas Fases

### Fase 2: Backend y Base de Datos
- Implementar servidor Express.js
- Configurar PostgreSQL con Prisma
- Crear API REST para todas las entidades
- Autenticación y autorización

### Fase 3: Formularios Avanzados
- Crear formularios para clientes, prospectos, visitas, cotizaciones
- Validación de datos con Zod
- Manejo de errores y confirmaciones

### Fase 4: Reportes y Análisis
- Gráficos de desempeño comercial
- Reportes exportables (PDF, Excel)
- Análisis de tendencias

### Fase 5: Geolocalización
- Integración de mapas (Google Maps)
- Visualización de clientes y prospectos en mapa
- Rutas de visitas

### Fase 6: Integraciones
- Sincronización con CRM externo
- Integración de email
- Notificaciones en tiempo real

## 🔐 Consideraciones de Seguridad

- Validar todos los datos de entrada
- Implementar autenticación JWT
- Usar HTTPS en producción
- Proteger datos sensibles (NIT, contactos)
- Implementar rate limiting en API

## 📱 Responsividad

El proyecto es completamente responsivo y funciona en:
- Desktop (1920px+)
- Tablet (768px - 1919px)
- Mobile (320px - 767px)

## 🤝 Contribución

Para contribuir al proyecto:
1. Crear rama feature: `git checkout -b feature/nueva-funcionalidad`
2. Hacer commit de cambios: `git commit -am 'Agregar nueva funcionalidad'`
3. Push a la rama: `git push origin feature/nueva-funcionalidad`
4. Crear Pull Request

## 📄 Licencia

Proyecto propietario de AGROINDUSTRIAL DEL CAFE S.A.S.

## 📞 Soporte

Para soporte técnico, contactar al equipo de desarrollo.

---

**Versión**: 1.0.0  
**Última actualización**: Marzo 2026  
**Estado**: En desarrollo
