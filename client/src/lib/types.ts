/**
 * Tipos e interfaces base para SIG Agroindustrial - Módulo Comercial
 * 
 * Estructura de datos para:
 * - Clientes y Prospectos
 * - Visitas comerciales
 * - Cotizaciones
 * - Seguimientos
 */

/* ============================================
   ENUMERACIONES
   ============================================ */

export enum ClienteEstado {
  ACTIVO = 'activo',
  INACTIVO = 'inactivo',
  SUSPENDIDO = 'suspendido',
}

export enum ProspectoEstado {
  NUEVO = 'nuevo',
  CONTACTADO = 'contactado',
  INTERESADO = 'interesado',
  NEGOCIACION = 'negociacion',
  GANADO = 'ganado',
  PERDIDO = 'perdido',
}

export enum VisitaTipo {
  PROSPECTACION = 'prospectacion',
  SEGUIMIENTO = 'seguimiento',
  NEGOCIACION = 'negociacion',
  SERVICIO = 'servicio',
}

export enum CotizacionEstado {
  BORRADOR = 'borrador',
  ENVIADA = 'enviada',
  ACEPTADA = 'aceptada',
  RECHAZADA = 'rechazada',
  VENCIDA = 'vencida',
}

export enum SeguimientoTipo {
  LLAMADA = 'llamada',
  EMAIL = 'email',
  REUNION = 'reunion',
  MENSAJE = 'mensaje',
  TAREA = 'tarea',
}

/* ============================================
   INTERFACES - CLIENTES
   ============================================ */

export interface Cliente {
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

export interface ClienteFormData {
  nombre: string;
  empresa: string;
  email: string;
  telefono: string;
  ciudad: string;
  departamento: string;
  direccion: string;
  tipoCliente: 'empresa' | 'persona';
  nit?: string;
  contactoPrincipal: string;
  cargoContacto: string;
  notas?: string;
}

/* ============================================
   INTERFACES - PROSPECTOS
   ============================================ */

export interface Prospecto {
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
  probabilidadConversion: number; // 0-100
  montoEstimado?: number;
  notas?: string;
  asignadoA?: string; // ID del vendedor
}

export interface ProspectoFormData {
  nombre: string;
  empresa: string;
  email: string;
  telefono: string;
  ciudad: string;
  departamento: string;
  contactoPrincipal: string;
  cargoContacto: string;
  fuente: 'referencia' | 'web' | 'evento' | 'llamada_fria' | 'otro';
  probabilidadConversion: number;
  montoEstimado?: number;
  notas?: string;
}

/* ============================================
   INTERFACES - VISITAS
   ============================================ */

export interface Visita {
  id: string;
  clienteId?: string;
  prospectoId?: string;
  tipo: VisitaTipo;
  fecha: Date;
  hora: string;
  duracion: number; // en minutos
  lugar: string;
  asistentes: string[];
  temas: string[];
  resultados: string;
  proximaAccion?: string;
  proximaFecha?: Date;
  notas?: string;
  documentos?: string[];
}

export interface VisitaFormData {
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

/* ============================================
   INTERFACES - COTIZACIONES
   ============================================ */

export interface LineaCotizacion {
  id: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  descuento: number; // porcentaje
  subtotal: number;
}

export interface Cotizacion {
  id: string;
  numero: string;
  clienteId?: string;
  prospectoId?: string;
  fecha: Date;
  fechaVencimiento: Date;
  estado: CotizacionEstado;
  lineas: LineaCotizacion[];
  subtotal: number;
  impuesto: number; // IVA
  descuentoGlobal?: number;
  total: number;
  moneda: 'COP' | 'USD';
  condicionesPago: string;
  notas?: string;
  enviadoA?: string;
  fechaEnvio?: Date;
  fechaRespuesta?: Date;
}

export interface CotizacionFormData {
  clienteId?: string;
  prospectoId?: string;
  fecha: Date;
  fechaVencimiento: Date;
  lineas: Omit<LineaCotizacion, 'id' | 'subtotal'>[];
  descuentoGlobal?: number;
  moneda: 'COP' | 'USD';
  condicionesPago: string;
  notas?: string;
}

/* ============================================
   INTERFACES - SEGUIMIENTOS
   ============================================ */

export interface Seguimiento {
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
  asignadoA?: string;
  notas?: string;
}

export interface SeguimientoFormData {
  clienteId?: string;
  prospectoId?: string;
  tipo: SeguimientoTipo;
  fecha: Date;
  asunto: string;
  descripcion: string;
  resultado?: string;
  proximoSeguimiento?: Date;
  notas?: string;
}

/* ============================================
   INTERFACES - DASHBOARD
   ============================================ */

export interface MetricasDashboard {
  totalClientes: number;
  totalProspectos: number;
  visitasHoy: number;
  cotizacionesMes: number;
  cotizacionesPendientes: number;
  montoProspectos: number;
  tasaConversion: number;
  proximosSegumientos: number;
}

export interface ActividadReciente {
  id: string;
  tipo: 'visita' | 'cotizacion' | 'seguimiento' | 'cliente' | 'prospecto';
  titulo: string;
  descripcion: string;
  fecha: Date;
  usuario?: string;
}

/* ============================================
   INTERFACES - FILTROS Y BÚSQUEDA
   ============================================ */

export interface FiltrosCliente {
  estado?: ClienteEstado;
  ciudad?: string;
  departamento?: string;
  tipoCliente?: 'empresa' | 'persona';
  busqueda?: string;
}

export interface FiltrosProspecto {
  estado?: ProspectoEstado;
  ciudad?: string;
  departamento?: string;
  fuente?: string;
  busqueda?: string;
}

export interface FiltrosCotizacion {
  estado?: CotizacionEstado;
  mes?: number;
  año?: number;
  busqueda?: string;
}

/* ============================================
   INTERFACES - PAGINACIÓN
   ============================================ */

export interface PaginacionParams {
  pagina: number;
  limite: number;
  ordenarPor?: string;
  orden?: 'asc' | 'desc';
}

export interface RespuestaPaginada<T> {
  datos: T[];
  total: number;
  pagina: number;
  limite: number;
  totalPaginas: number;
}
