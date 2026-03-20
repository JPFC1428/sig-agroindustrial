/**
 * Datos Mock para SIG Agroindustrial
 * 
 * Datos de ejemplo para desarrollo y pruebas.
 * Estructura lista para ser reemplazada por datos reales de la base de datos.
 */

import {
  Cliente,
  ClienteEstado,
  Prospecto,
  ProspectoEstado,
  Visita,
  VisitaTipo,
  Cotizacion,
  CotizacionEstado,
  Seguimiento,
  SeguimientoTipo,
  MetricasDashboard,
  ActividadReciente,
} from './types';

/* ============================================
   CLIENTES MOCK
   ============================================ */

export const clientesMock: Cliente[] = [
  {
    id: 'cli-001',
    nombre: 'Juan Carlos Rodríguez',
    empresa: 'Café Premium Colombia S.A.S.',
    email: 'juan.rodriguez@cafepremium.com',
    telefono: '+57 310 555 0001',
    ciudad: 'Medellín',
    departamento: 'Antioquia',
    direccion: 'Cra 45 #12-34, Sector Laureles',
    estado: ClienteEstado.ACTIVO,
    tipoCliente: 'empresa',
    nit: '890.123.456-7',
    contactoPrincipal: 'Juan Carlos Rodríguez',
    cargoContacto: 'Gerente General',
    fechaRegistro: new Date('2024-01-15'),
    ultimaVisita: new Date('2026-03-10'),
    totalCompras: 25,
    montoTotalCompras: 125000000,
    notas: 'Cliente VIP, compras mensuales consistentes',
  },
  {
    id: 'cli-002',
    nombre: 'María Elena López',
    empresa: 'Exportadora de Café Eje Cafetero',
    email: 'maria.lopez@exportcafe.com',
    telefono: '+57 320 555 0002',
    ciudad: 'Pereira',
    departamento: 'Risaralda',
    direccion: 'Av. 30 de Agosto #45-67',
    estado: ClienteEstado.ACTIVO,
    tipoCliente: 'empresa',
    nit: '890.234.567-8',
    contactoPrincipal: 'María Elena López',
    cargoContacto: 'Directora Comercial',
    fechaRegistro: new Date('2024-03-20'),
    ultimaVisita: new Date('2026-03-05'),
    totalCompras: 18,
    montoTotalCompras: 89500000,
    notas: 'Interesado en nuevas líneas de producto',
  },
  {
    id: 'cli-003',
    nombre: 'Carlos Andrés Martínez',
    empresa: 'Distribuidora de Café Manizales',
    email: 'carlos.martinez@distcafe.com',
    telefono: '+57 330 555 0003',
    ciudad: 'Manizales',
    departamento: 'Caldas',
    direccion: 'Calle 21 #18-45',
    estado: ClienteEstado.ACTIVO,
    tipoCliente: 'empresa',
    nit: '890.345.678-9',
    contactoPrincipal: 'Carlos Andrés Martínez',
    cargoContacto: 'Gerente de Compras',
    fechaRegistro: new Date('2024-06-10'),
    ultimaVisita: new Date('2026-02-28'),
    totalCompras: 12,
    montoTotalCompras: 56200000,
    notas: 'Requiere términos de crédito a 60 días',
  },
];

/* ============================================
   PROSPECTOS MOCK
   ============================================ */

export const prospectosMock: Prospecto[] = [
  {
    id: 'pro-001',
    nombre: 'Roberto Sánchez',
    empresa: 'Café Artesanal Colombiano',
    email: 'roberto@cafeartesanal.com',
    telefono: '+57 315 555 0001',
    ciudad: 'Armenia',
    departamento: 'Quindío',
    contactoPrincipal: 'Roberto Sánchez',
    cargoContacto: 'Propietario',
    estado: ProspectoEstado.INTERESADO,
    fuente: 'referencia',
    fechaCaptura: new Date('2026-02-15'),
    proximoSeguimiento: new Date('2026-03-25'),
    probabilidadConversion: 75,
    montoEstimado: 45000000,
    notas: 'Muy interesado en volúmenes grandes',
  },
  {
    id: 'pro-002',
    nombre: 'Sofía Gutiérrez',
    empresa: 'Importadora Café Global',
    email: 'sofia.gutierrez@cafeglobal.com',
    telefono: '+57 325 555 0002',
    ciudad: 'Bogotá',
    departamento: 'Cundinamarca',
    contactoPrincipal: 'Sofía Gutiérrez',
    cargoContacto: 'Gerente de Operaciones',
    estado: ProspectoEstado.CONTACTADO,
    fuente: 'web',
    fechaCaptura: new Date('2026-03-01'),
    proximoSeguimiento: new Date('2026-03-22'),
    probabilidadConversion: 45,
    montoEstimado: 30000000,
    notas: 'Requiere presentación formal del portafolio',
  },
  {
    id: 'pro-003',
    nombre: 'Luis Fernando Díaz',
    empresa: 'Cooperativa Caficultores Unidos',
    email: 'luis.diaz@caficultores.coop',
    telefono: '+57 335 555 0003',
    ciudad: 'Dosquebradas',
    departamento: 'Risaralda',
    contactoPrincipal: 'Luis Fernando Díaz',
    cargoContacto: 'Director Ejecutivo',
    estado: ProspectoEstado.NEGOCIACION,
    fuente: 'evento',
    fechaCaptura: new Date('2026-01-20'),
    proximoSeguimiento: new Date('2026-03-20'),
    probabilidadConversion: 85,
    montoEstimado: 120000000,
    notas: 'Negociación avanzada, espera cotización final',
  },
];

/* ============================================
   VISITAS MOCK
   ============================================ */

export const visitasMock: Visita[] = [
  {
    id: 'vis-001',
    clienteId: 'cli-001',
    tipo: VisitaTipo.SEGUIMIENTO,
    fecha: new Date('2026-03-10'),
    hora: '10:00',
    duracion: 45,
    lugar: 'Oficinas Café Premium Colombia',
    asistentes: ['Juan Carlos Rodríguez', 'Vendedor Comercial'],
    temas: ['Nuevos productos', 'Términos de pago', 'Volúmenes'],
    resultados: 'Cliente interesado en incrementar pedidos. Próximo pedido estimado: 50 sacos',
    proximaAccion: 'Enviar cotización de volumen',
    proximaFecha: new Date('2026-03-15'),
    notas: 'Cliente muy satisfecho con calidad actual',
  },
  {
    id: 'vis-002',
    clienteId: 'cli-002',
    tipo: VisitaTipo.NEGOCIACION,
    fecha: new Date('2026-03-05'),
    hora: '14:30',
    duracion: 60,
    lugar: 'Oficinas Exportadora Eje Cafetero',
    asistentes: ['María Elena López', 'Vendedor Comercial'],
    temas: ['Precios especiales', 'Condiciones de entrega', 'Garantías'],
    resultados: 'Se negociaron precios especiales para volúmenes mayores a 100 sacos',
    proximaAccion: 'Preparar propuesta formal',
    proximaFecha: new Date('2026-03-18'),
  },
  {
    id: 'vis-003',
    prospectoId: 'pro-001',
    tipo: VisitaTipo.PROSPECTACION,
    fecha: new Date('2026-03-12'),
    hora: '09:00',
    duracion: 50,
    lugar: 'Café Artesanal Colombiano - Armenia',
    asistentes: ['Roberto Sánchez', 'Vendedor Comercial'],
    temas: ['Presentación de productos', 'Precios', 'Muestras'],
    resultados: 'Prospecto muy receptivo. Solicitó muestras de 3 variedades diferentes',
    proximaAccion: 'Enviar muestras y cotización',
    proximaFecha: new Date('2026-03-19'),
  },
];

/* ============================================
   COTIZACIONES MOCK
   ============================================ */

export const cotizacionesMock: Cotizacion[] = [
  {
    id: 'cot-001',
    numero: 'COT-2026-001',
    clienteId: 'cli-001',
    fecha: new Date('2026-03-10'),
    fechaVencimiento: new Date('2026-03-24'),
    estado: CotizacionEstado.ENVIADA,
    lineas: [
      {
        id: 'lin-001',
        descripcion: 'Café Arábica Premium - Saco 60kg',
        cantidad: 50,
        precioUnitario: 850000,
        descuento: 5,
        subtotal: 40375000,
      },
      {
        id: 'lin-002',
        descripcion: 'Café Robusta Estándar - Saco 60kg',
        cantidad: 30,
        precioUnitario: 620000,
        descuento: 3,
        subtotal: 18054000,
      },
    ],
    subtotal: 58429000,
    impuesto: 11099510,
    descuentoGlobal: 0,
    total: 69528510,
    moneda: 'COP',
    condicionesPago: 'Pago a 30 días desde la entrega',
    notas: 'Incluye transporte a bodega del cliente',
    enviadoA: 'juan.rodriguez@cafepremium.com',
    fechaEnvio: new Date('2026-03-10'),
  },
  {
    id: 'cot-002',
    numero: 'COT-2026-002',
    prospectoId: 'pro-003',
    fecha: new Date('2026-03-08'),
    fechaVencimiento: new Date('2026-03-22'),
    estado: CotizacionEstado.ENVIADA,
    lineas: [
      {
        id: 'lin-003',
        descripcion: 'Café Arábica Premium - Saco 60kg',
        cantidad: 100,
        precioUnitario: 850000,
        descuento: 10,
        subtotal: 76500000,
      },
      {
        id: 'lin-004',
        descripcion: 'Servicios de Procesamiento',
        cantidad: 1,
        precioUnitario: 5000000,
        descuento: 0,
        subtotal: 5000000,
      },
    ],
    subtotal: 81500000,
    impuesto: 15485000,
    descuentoGlobal: 0,
    total: 96985000,
    moneda: 'COP',
    condicionesPago: 'Pago a 45 días. Descuento por pago anticipado: 2%',
    notas: 'Cotización especial para cooperativa. Incluye capacitación en nuevos procesos',
    enviadoA: 'luis.diaz@caficultores.coop',
    fechaEnvio: new Date('2026-03-08'),
  },
  {
    id: 'cot-003',
    numero: 'COT-2026-003',
    clienteId: 'cli-003',
    fecha: new Date('2026-03-01'),
    fechaVencimiento: new Date('2026-03-15'),
    estado: CotizacionEstado.ACEPTADA,
    lineas: [
      {
        id: 'lin-005',
        descripcion: 'Café Arábica Premium - Saco 60kg',
        cantidad: 25,
        precioUnitario: 850000,
        descuento: 0,
        subtotal: 21250000,
      },
    ],
    subtotal: 21250000,
    impuesto: 4037500,
    descuentoGlobal: 0,
    total: 25287500,
    moneda: 'COP',
    condicionesPago: 'Pago a 30 días',
    enviadoA: 'carlos.martinez@distcafe.com',
    fechaEnvio: new Date('2026-03-01'),
    fechaRespuesta: new Date('2026-03-03'),
  },
];

/* ============================================
   SEGUIMIENTOS MOCK
   ============================================ */

export const seguimientosMock: Seguimiento[] = [
  {
    id: 'seg-001',
    clienteId: 'cli-001',
    tipo: SeguimientoTipo.LLAMADA,
    fecha: new Date('2026-03-15'),
    asunto: 'Seguimiento a cotización COT-2026-001',
    descripcion: 'Confirmar recepción de cotización y resolver dudas sobre términos de pago',
    resultado: 'Cliente confirmó recepción. Solicitó descuento adicional del 2%',
    proximoSeguimiento: new Date('2026-03-20'),
    completado: false,
  },
  {
    id: 'seg-002',
    prospectoId: 'pro-001',
    tipo: SeguimientoTipo.EMAIL,
    fecha: new Date('2026-03-12'),
    asunto: 'Envío de muestras de café',
    descripcion: 'Enviar muestras de 3 variedades de café según solicitud del prospecto',
    resultado: 'Muestras enviadas por mensajería',
    proximoSeguimiento: new Date('2026-03-26'),
    completado: true,
  },
  {
    id: 'seg-003',
    prospectoId: 'pro-003',
    tipo: SeguimientoTipo.REUNION,
    fecha: new Date('2026-03-20'),
    asunto: 'Reunión de cierre de negociación',
    descripcion: 'Presentar términos finales y obtener firma de contrato',
    resultado: '',
    proximoSeguimiento: undefined,
    completado: false,
  },
];

/* ============================================
   MÉTRICAS DASHBOARD MOCK
   ============================================ */

export const metricasDashboardMock: MetricasDashboard = {
  totalClientes: clientesMock.length,
  totalProspectos: prospectosMock.length,
  visitasHoy: 1,
  cotizacionesMes: cotizacionesMock.filter(
    (c) => c.fecha.getMonth() === new Date().getMonth()
  ).length,
  cotizacionesPendientes: cotizacionesMock.filter(
    (c) => c.estado === CotizacionEstado.ENVIADA
  ).length,
  montoProspectos: prospectosMock.reduce((sum, p) => sum + (p.montoEstimado || 0), 0),
  tasaConversion: 28.5,
  proximosSegumientos: seguimientosMock.filter((s) => !s.completado).length,
};

/* ============================================
   ACTIVIDAD RECIENTE MOCK
   ============================================ */

export const actividadRecienteMock: ActividadReciente[] = [
  {
    id: 'act-001',
    tipo: 'visita',
    titulo: 'Visita a Café Premium Colombia',
    descripcion: 'Seguimiento de pedido y negociación de volúmenes',
    fecha: new Date('2026-03-10'),
    usuario: 'Vendedor Comercial',
  },
  {
    id: 'act-002',
    tipo: 'cotizacion',
    titulo: 'Cotización enviada a Cooperativa Caficultores',
    descripcion: 'COT-2026-002 por $96.985.000',
    fecha: new Date('2026-03-08'),
    usuario: 'Gerente Comercial',
  },
  {
    id: 'act-003',
    tipo: 'cliente',
    titulo: 'Nuevo cliente registrado',
    descripcion: 'Distribuidora de Café Manizales',
    fecha: new Date('2026-03-05'),
    usuario: 'Asistente Comercial',
  },
  {
    id: 'act-004',
    tipo: 'prospecto',
    titulo: 'Prospecto en negociación avanzada',
    descripcion: 'Café Artesanal Colombiano - Probabilidad: 75%',
    fecha: new Date('2026-03-01'),
    usuario: 'Vendedor Comercial',
  },
];

/* ============================================
   FUNCIONES AUXILIARES
   ============================================ */

/**
 * Obtiene clientes filtrados por estado
 */
export function getClientesPorEstado(estado: ClienteEstado): Cliente[] {
  return clientesMock.filter((c) => c.estado === estado);
}

/**
 * Obtiene prospectos filtrados por estado
 */
export function getProspectosPorEstado(estado: ProspectoEstado): Prospecto[] {
  return prospectosMock.filter((p) => p.estado === estado);
}

/**
 * Obtiene visitas del día
 */
export function getVisitasDelDia(): Visita[] {
  const hoy = new Date();
  return visitasMock.filter(
    (v) =>
      v.fecha.getDate() === hoy.getDate() &&
      v.fecha.getMonth() === hoy.getMonth() &&
      v.fecha.getFullYear() === hoy.getFullYear()
  );
}

/**
 * Obtiene cotizaciones del mes actual
 */
export function getCotizacionesDelMes(): Cotizacion[] {
  const hoy = new Date();
  return cotizacionesMock.filter(
    (c) =>
      c.fecha.getMonth() === hoy.getMonth() &&
      c.fecha.getFullYear() === hoy.getFullYear()
  );
}

/**
 * Calcula el monto total de cotizaciones pendientes
 */
export function getMontoTotalCotizacionesPendientes(): number {
  return cotizacionesMock
    .filter((c) => c.estado === CotizacionEstado.ENVIADA)
    .reduce((sum, c) => sum + c.total, 0);
}
