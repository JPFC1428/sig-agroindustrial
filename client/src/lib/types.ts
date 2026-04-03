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

export enum VisitaEstado {
  PROGRAMADA = 'programada',
  REALIZADA = 'realizada',
  CANCELADA = 'cancelada',
}

export enum ViaticoTipoGasto {
  PEAJES = 'peajes',
  GASOLINA = 'gasolina',
  ESTADIA = 'estadia',
  ALIMENTACION = 'alimentacion',
}

export enum CotizacionEstado {
  BORRADOR = 'borrador',
  ENVIADA = 'enviada',
  APROBADA = 'aprobada',
  RECHAZADA = 'rechazada',
}

export enum SeguimientoTipo {
  LLAMADA = 'llamada',
  EMAIL = 'email',
  REUNION = 'reunion',
  MENSAJE = 'mensaje',
  TAREA = 'tarea',
}

export enum SeguimientoEstado {
  PENDIENTE = 'pendiente',
  EN_PROCESO = 'en_proceso',
  CERRADO = 'cerrado',
  CANCELADO = 'cancelado',
}

export enum SertecOrdenEstado {
  ENTRADA = 'entrada',
  REPARACION = 'reparacion',
  SALIDA = 'salida',
}

export type SeguimientoRelacionTipo =
  | 'cliente'
  | 'prospecto'
  | 'cotizacion';

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
  clienteNombre?: string;
  clienteEmpresa?: string;
  prospectoId?: string;
  prospectoNombre?: string;
  prospectoEmpresa?: string;
  tipo: VisitaTipo;
  fecha: Date;
  hora: string;
  objetivo: string;
  resultado: string;
  observaciones?: string;
  proximaAccion?: string;
  estado: VisitaEstado;
  duracion?: number; // legado para vistas mock existentes
  lugar?: string;
  asistentes?: string[];
  temas?: string[];
  resultados?: string;
  proximaFecha?: Date;
  notas?: string;
  documentos?: string[];
  viaticos?: VisitaViatico[];
  resumenViaticos?: ResumenViaticosVisita;
  totalViaticos?: number;
}

export interface VisitaFormData {
  clienteId?: string;
  prospectoId?: string;
  tipo: VisitaTipo;
  fecha: Date;
  hora: string;
  objetivo: string;
  resultado: string;
  observaciones?: string;
  proximaAccion?: string;
  estado: VisitaEstado;
}

export interface VisitaViatico {
  id: string;
  visitaId: string;
  usuarioId?: string;
  usuarioNombre?: string;
  tipoGasto: ViaticoTipoGasto;
  fecha: Date;
  valor: number;
  descripcion: string;
  observaciones?: string;
  soporte?: VisitaViaticoSoporte;
}

export interface ResumenViaticosVisita {
  peajes: number;
  gasolina: number;
  estadia: number;
  alimentacion: number;
  totalGeneral: number;
}

export interface VisitaViaticoFormData {
  tipoGasto: ViaticoTipoGasto;
  fecha: Date;
  valor: number;
  descripcion: string;
  observaciones?: string;
}

export interface VisitaViaticoSoporte {
  fileName: string;
  fileSize: number;
  mimeType: "application/pdf" | "image/jpeg" | "image/png" | "image/webp";
}

export interface VisitaViaticoSoporteUpload {
  contentBase64: string;
  fileName: string;
  fileSize: number;
  mimeType: VisitaViaticoSoporte["mimeType"];
}

export enum ContableLegalizacionViaticoEstado {
  PENDIENTE = "pendiente",
  LEGALIZADO = "legalizado",
  APROBADO = "aprobado",
  RECHAZADO = "rechazado",
}

export interface ContableLegalizacionViatico {
  id: string;
  visitaId: string;
  visitaTipo: Visita["tipo"];
  visitaFecha: Date;
  visitaObjetivo: string;
  visitaRelacionTipo?: "cliente" | "prospecto";
  relacionadoId?: string;
  relacionadoNombre?: string;
  relacionadoEmpresa?: string;
  usuarioId?: string;
  usuarioNombre?: string;
  tipoGasto: ViaticoTipoGasto;
  fecha: Date;
  valor: number;
  descripcion: string;
  observaciones?: string;
  soporte?: VisitaViaticoSoporte;
  legalizacionEstado: ContableLegalizacionViaticoEstado;
  legalizacionObservaciones?: string;
  legalizacionUpdatedAt?: Date;
  legalizacionUpdatedBy?: string;
  legalizacionUpdatedByNombre?: string;
  contableEgresoId?: string;
}

export interface ContableLegalizacionViaticoVendedor {
  id?: string;
  nombre: string;
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
  clienteEmail?: string;
  clienteNombre?: string;
  clienteEmpresa?: string;
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
  estado?: CotizacionEstado;
  lineas: Omit<LineaCotizacion, 'id' | 'subtotal'>[];
  impuesto?: number;
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
  clienteNombre?: string;
  clienteEmpresa?: string;
  prospectoId?: string;
  prospectoNombre?: string;
  prospectoEmpresa?: string;
  cotizacionId?: string;
  cotizacionNumero?: string;
  relacionTipo?: SeguimientoRelacionTipo;
  relacionadoNombre?: string;
  relacionadoEmpresa?: string;
  tipo: SeguimientoTipo;
  fechaVencimiento: Date;
  observaciones?: string;
  estado: SeguimientoEstado;
  completado: boolean;
  fecha: Date; // alias de fechaVencimiento para compatibilidad
  asunto?: string;
  descripcion?: string;
  resultado?: string;
  proximoSeguimiento?: Date;
  asignadoA?: string;
  notas?: string;
}

export interface SeguimientoFormData {
  clienteId?: string;
  prospectoId?: string;
  cotizacionId?: string;
  tipo: SeguimientoTipo;
  fechaVencimiento: Date;
  observaciones?: string;
  estado: SeguimientoEstado;
  completado: boolean;
}

/* ============================================
   INTERFACES - SERTEC
   ============================================ */

export interface SertecOrdenAdjunto {
  id: string;
  ordenId: string;
  nombreArchivo: string;
  tipoMime: "application/pdf" | "image/jpeg" | "image/png" | "image/webp";
  tamano: number;
  descripcion?: string;
  usuarioId?: string;
  usuarioNombre?: string;
  createdAt: Date;
}

export interface SertecOrdenHistorial {
  id: string;
  ordenId: string;
  estado: SertecOrdenEstado;
  movimiento: 'entrada' | 'reparacion' | 'salida' | 'adjunto';
  detalle?: string;
  usuarioId?: string;
  usuarioNombre?: string;
  createdAt: Date;
}

export interface SertecGarantia {
  aplica: boolean;
  diasRestantes?: number;
  fechaVenta?: Date;
  garantiaMeses?: number;
  vigenteHasta?: Date;
}

export interface SertecComercialOrigenItem {
  id: string;
  descripcion: string;
}

export interface SertecComercialOrigen {
  clienteEmpresa?: string;
  clienteId?: string;
  clienteNombre: string;
  clienteTelefono?: string;
  cotizacionId: string;
  cotizacionNumero: string;
  fechaVenta: Date;
  garantiaMesesSugerida: number;
  items: SertecComercialOrigenItem[];
  moneda: 'COP' | 'USD';
  total: number;
}

export interface SertecOrden {
  id: string;
  numero: string;
  estado: SertecOrdenEstado;
  fechaIngreso: Date;
  fechaReparacion?: Date;
  fechaSalida?: Date;
  clienteId?: string;
  clienteNombre: string;
  clienteDocumento?: string;
  clienteTelefono?: string;
  cotizacionId?: string;
  cotizacionNumero?: string;
  cotizacionItemId?: string;
  equipoTipo: string;
  equipoMarca?: string;
  equipoModelo?: string;
  equipoSerial?: string;
  equipoVendidoDescripcion?: string;
  fallaReportada: string;
  diagnostico?: string;
  garantia?: SertecGarantia;
  origenComercialTipo?: 'cotizacion';
  trabajoRealizado?: string;
  observaciones?: string;
  createdAt: Date;
  updatedAt: Date;
  historial?: SertecOrdenHistorial[];
  adjuntos?: SertecOrdenAdjunto[];
}

/* ============================================
   INTERFACES - CONTABLE
   ============================================ */

export enum ContableTerceroTipo {
  CLIENTE = "cliente",
  PROVEEDOR = "proveedor",
  EMPLEADO = "empleado",
  BANCO = "banco",
  OTRO = "otro",
}

export enum ContableTerceroEstado {
  ACTIVO = "activo",
  INACTIVO = "inactivo",
}

export interface ContableTercero {
  id: string;
  tipoTercero: ContableTerceroTipo;
  nombreRazonSocial: string;
  documentoNit: string;
  contacto?: string;
  telefono?: string;
  correo?: string;
  ciudad?: string;
  direccion?: string;
  observaciones?: string;
  estado: ContableTerceroEstado;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContableTerceroFormData {
  tipoTercero: ContableTerceroTipo;
  nombreRazonSocial: string;
  documentoNit: string;
  contacto?: string;
  telefono?: string;
  correo?: string;
  ciudad?: string;
  direccion?: string;
  observaciones?: string;
  estado: ContableTerceroEstado;
}

export enum ContableFacturaCompraEstado {
  PENDIENTE = "pendiente",
  PARCIAL = "parcial",
  PAGADA = "pagada",
  VENCIDA = "vencida",
  ANULADA = "anulada",
}

export interface ContableFacturaCompra {
  id: string;
  numeroFactura: string;
  terceroId: string;
  terceroNombreRazonSocial: string;
  terceroDocumentoNit: string;
  fechaFactura: Date;
  fechaVencimiento: Date;
  subtotal: number;
  iva: number;
  total: number;
  saldo: number;
  estado: ContableFacturaCompraEstado;
  observaciones?: string;
  soporteUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContableFacturaCompraFormData {
  numeroFactura: string;
  terceroId: string;
  fechaFactura: Date;
  fechaVencimiento: Date;
  subtotal: number;
  iva: number;
  total: number;
  saldo: number;
  estado: ContableFacturaCompraEstado;
  observaciones?: string;
  soporteUrl?: string;
}

export enum ContableNotaCreditoTipo {
  CLIENTE = "cliente",
  PROVEEDOR = "proveedor",
}

export enum ContableNotaCreditoEstado {
  BORRADOR = "borrador",
  EMITIDA = "emitida",
  APLICADA = "aplicada",
  ANULADA = "anulada",
}

export enum ContableNotaCreditoDocumentoTipo {
  FACTURA_COMPRA = "factura_compra",
  CUENTA_POR_COBRAR = "cuenta_por_cobrar",
  OTRO = "otro",
}

export enum ContableNotaCreditoCarteraEstado {
  PENDIENTE = "pendiente",
  PREPARADA = "preparada",
  APLICADA = "aplicada",
}

export interface ContableNotaCredito {
  id: string;
  numeroNota: string;
  terceroId: string;
  terceroNombreRazonSocial: string;
  terceroDocumentoNit: string;
  tipo: ContableNotaCreditoTipo;
  fecha: Date;
  valor: number;
  motivo: string;
  referenciaDocumento?: string;
  observaciones?: string;
  estado: ContableNotaCreditoEstado;
  documentoRelacionadoTipo?: ContableNotaCreditoDocumentoTipo;
  documentoRelacionadoId?: string;
  documentoRelacionadoNumero?: string;
  afectaCartera: boolean;
  carteraEstado: ContableNotaCreditoCarteraEstado;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContableNotaCreditoFormData {
  numeroNota: string;
  terceroId: string;
  tipo: ContableNotaCreditoTipo;
  fecha: Date;
  valor: number;
  motivo: string;
  referenciaDocumento?: string;
  observaciones?: string;
  estado: ContableNotaCreditoEstado;
  documentoRelacionadoTipo?: ContableNotaCreditoDocumentoTipo;
  documentoRelacionadoId?: string;
}

export enum ContableMetodoPago {
  EFECTIVO = "efectivo",
  TRANSFERENCIA = "transferencia",
  CHEQUE = "cheque",
  TARJETA = "tarjeta",
  OTRO = "otro",
}

export enum ContableCuentaBancariaTipo {
  AHORROS = "ahorros",
  CORRIENTE = "corriente",
  OTRA = "otra",
}

export interface ContableCuentaBancaria {
  id: string;
  nombreBanco: string;
  nombreCuenta: string;
  tipoCuenta: ContableCuentaBancariaTipo;
  numeroCuenta: string;
  titular: string;
  saldoInicial: number;
  activa: boolean;
  observaciones?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContableCuentaBancariaFormData {
  nombreBanco: string;
  nombreCuenta: string;
  tipoCuenta: ContableCuentaBancariaTipo;
  numeroCuenta: string;
  titular: string;
  saldoInicial: number;
  activa: boolean;
  observaciones?: string;
}

export type ContableMovimientoBancarioTipo = "ingreso" | "egreso";

export type ContableMovimientoBancarioReferenciaTipo =
  | "recibo_caja"
  | "egreso";

export interface ContableMovimientoBancario {
  id: string;
  cuentaBancariaId: string;
  fecha: Date;
  tipo: ContableMovimientoBancarioTipo;
  referenciaTipo: ContableMovimientoBancarioReferenciaTipo;
  referenciaId: string;
  referenciaNumero: string;
  terceroId: string;
  terceroNombreRazonSocial: string;
  terceroDocumentoNit: string;
  valor: number;
  saldoAcumulado: number;
  conciliado: boolean;
  fechaConciliacion?: Date;
  metodoPago: ContableMetodoPago;
  createdAt: Date;
}

export interface ContableCuentaBancariaMovimientos {
  cuenta: ContableCuentaBancaria;
  fechaDesde?: Date;
  fechaHasta?: Date;
  saldoInicialPeriodo: number;
  saldoFinal: number;
  totalIngresos: number;
  totalEgresos: number;
  movimientos: ContableMovimientoBancario[];
}

export interface ContableConciliacionBancaria {
  cuenta: ContableCuentaBancaria;
  fechaDesde?: Date;
  fechaHasta?: Date;
  totalIngresos: number;
  totalEgresos: number;
  saldoSistema: number;
  saldoConciliado: number;
  diferencia: number;
  movimientos: ContableMovimientoBancario[];
}

export interface ContableEgresoDetalle {
  id: string;
  egresoId: string;
  facturaId: string;
  facturaNumero: string;
  facturaFecha: Date;
  facturaFechaVencimiento: Date;
  facturaTotal: number;
  facturaSaldoActual: number;
  valorPagado: number;
  createdAt: Date;
}

export interface ContableEgreso {
  id: string;
  numeroComprobante: string;
  terceroId: string;
  terceroNombreRazonSocial: string;
  terceroDocumentoNit: string;
  cuentaBancariaId?: string;
  cuentaBancariaNombre?: string;
  cuentaBancariaNumero?: string;
  cuentaBancariaBanco?: string;
  fecha: Date;
  valorTotal: number;
  metodoPago: ContableMetodoPago;
  observaciones?: string;
  soporteUrl?: string;
  createdAt: Date;
  detalles?: ContableEgresoDetalle[];
}

export interface ContableEgresoFormData {
  numeroComprobante: string;
  terceroId: string;
  cuentaBancariaId?: string;
  fecha: Date;
  valorTotal: number;
  metodoPago: ContableMetodoPago;
  observaciones?: string;
  soporteUrl?: string;
}

export enum ContableReciboDocumentoTipo {
  CUENTA_POR_COBRAR = "cuenta_por_cobrar",
  OTRO = "otro",
}

export interface ContableReciboCajaDetalle {
  id: string;
  reciboId: string;
  documentoTipo: ContableReciboDocumentoTipo;
  documentoId?: string;
  documentoReferencia?: string;
  valorDocumento?: number;
  valorPagado: number;
  createdAt: Date;
}

export interface ContableReciboCaja {
  id: string;
  numeroRecibo: string;
  terceroId: string;
  terceroNombreRazonSocial: string;
  terceroDocumentoNit: string;
  cuentaBancariaId?: string;
  cuentaBancariaNombre?: string;
  cuentaBancariaNumero?: string;
  cuentaBancariaBanco?: string;
  fecha: Date;
  valorTotal: number;
  metodoPago: ContableMetodoPago;
  observaciones?: string;
  soporteUrl?: string;
  createdAt: Date;
  detalles?: ContableReciboCajaDetalle[];
}

export interface ContableReciboCajaFormData {
  numeroRecibo: string;
  terceroId: string;
  cuentaBancariaId?: string;
  fecha: Date;
  valorTotal: number;
  metodoPago: ContableMetodoPago;
  observaciones?: string;
  soporteUrl?: string;
}

export type ContableCuadreCajaMovimientoTipo = "ingreso" | "salida";

export interface ContableCuadreCajaMovimiento {
  id: string;
  tipo: ContableCuadreCajaMovimientoTipo;
  numero: string;
  terceroNombreRazonSocial: string;
  terceroDocumentoNit: string;
  fecha: Date;
  valor: number;
  metodoPago: ContableMetodoPago;
}

export interface ContableCuadreCajaResumen {
  fechaDesde: Date;
  fechaHasta: Date;
  cantidadIngresos: number;
  cantidadSalidas: number;
  totalIngresos: number;
  totalSalidas: number;
  saldoEsperado: number;
  ingresos: ContableCuadreCajaMovimiento[];
  salidas: ContableCuadreCajaMovimiento[];
}

export interface ContableCuadreCaja {
  id: string;
  fechaDesde: Date;
  fechaHasta: Date;
  cantidadIngresos: number;
  cantidadSalidas: number;
  totalIngresos: number;
  totalSalidas: number;
  saldoEsperado: number;
  observaciones?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContableCuadreCajaFormData {
  fechaDesde: Date;
  fechaHasta: Date;
  observaciones?: string;
}

export enum ContableNominaTipoContrato {
  INDEFINIDO = "indefinido",
  FIJO = "fijo",
  OTRO = "otro",
}

export enum ContableNominaPeriodoTipo {
  MENSUAL = "mensual",
  QUINCENAL = "quincenal",
}

export enum ContableNominaPeriodoEstado {
  ABIERTO = "abierto",
  CERRADO = "cerrado",
}

export interface ContableNominaEmpleado {
  id: string;
  terceroId: string;
  nombreRazonSocial: string;
  documentoNit: string;
  contacto?: string;
  telefono?: string;
  correo?: string;
  ciudad?: string;
  direccion?: string;
  estado: ContableTerceroEstado;
  tipoContrato: ContableNominaTipoContrato;
  cargo: string;
  fechaIngreso: Date;
  salarioBasico: number;
  auxilioTransporte: number;
  aplicaAuxilioTransporte: boolean;
  eps?: string;
  fondoPension?: string;
  arl?: string;
  cajaCompensacion?: string;
  porcentajeArl: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContableNominaPeriodo {
  id: string;
  codigoPeriodo: string;
  tipo: ContableNominaPeriodoTipo;
  fechaInicio: Date;
  fechaFin: Date;
  estado: ContableNominaPeriodoEstado;
  observaciones?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContableNominaLiquidacion {
  id: string;
  periodoId: string;
  periodoCodigo: string;
  empleadoId: string;
  terceroId: string;
  empleadoNombreRazonSocial: string;
  empleadoDocumentoNit: string;
  diasTrabajados: number;
  salarioBasicoMensual: number;
  salarioDevengado: number;
  auxilioTransporte: number;
  devengado: number;
  deduccionSalud: number;
  deduccionPension: number;
  netoPagar: number;
  ibcSeguridadSocial: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContableNominaSeguridadSocial {
  id: string;
  liquidacionId: string;
  periodoId: string;
  periodoCodigo: string;
  empleadoId: string;
  empleadoNombreRazonSocial: string;
  ibc: number;
  saludEmpleado: number;
  saludEmpresa: number;
  pensionEmpleado: number;
  pensionEmpresa: number;
  arl: number;
  cajaCompensacion: number;
  totalAportes: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContableNominaData {
  empleados: ContableNominaEmpleado[];
  periodos: ContableNominaPeriodo[];
  liquidaciones: ContableNominaLiquidacion[];
  seguridadSocial: ContableNominaSeguridadSocial[];
}

export enum InventarioProductoTipoItem {
  PRODUCTO = "producto",
  EQUIPO = "equipo",
}

export enum InventarioProductoEstado {
  ACTIVO = "activo",
  INACTIVO = "inactivo",
  DESCONTINUADO = "descontinuado",
}

export interface InventarioProducto {
  id: string;
  tipoItem: InventarioProductoTipoItem;
  codigo: string;
  nombre: string;
  categoria: string;
  marca?: string;
  modelo?: string;
  serial?: string;
  manejaSerial: boolean;
  unidad: string;
  costo: number;
  precio: number;
  stockActual: number;
  estado: InventarioProductoEstado;
  referenciaExternaTipo?: string;
  referenciaExternaId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum InventarioCompraEstado {
  REGISTRADA = "registrada",
  PARCIAL = "parcial",
  RECIBIDA = "recibida",
  ANULADA = "anulada",
}

export interface InventarioCompraItem {
  id: string;
  compraId: string;
  productoId: string;
  productoCodigo: string;
  productoNombre: string;
  descripcion: string;
  cantidad: number;
  costoUnitario: number;
  total: number;
  cantidadRecibida: number;
  pendienteRecibir: number;
}

export interface InventarioCompra {
  id: string;
  numeroCompra: string;
  proveedorId: string;
  proveedorNombreRazonSocial: string;
  proveedorDocumentoNit: string;
  fecha: Date;
  observaciones?: string;
  estado: InventarioCompraEstado;
  total: number;
  items: InventarioCompraItem[];
  createdAt: Date;
  updatedAt: Date;
}

export enum InventarioEntradaOrigenTipo {
  MANUAL = "manual",
  COMPRA = "compra",
  AJUSTE = "ajuste",
  SERTEC = "sertec",
  COMERCIAL = "comercial",
  TRASLADO = "traslado",
  GARANTIA = "garantia",
}

export interface InventarioEntradaItem {
  id: string;
  entradaId: string;
  productoId: string;
  productoCodigo: string;
  productoNombre: string;
  cantidad: number;
  costoUnitario: number;
  total: number;
  serial?: string;
  compraItemId?: string;
}

export interface InventarioEntrada {
  id: string;
  numeroEntrada: string;
  fecha: Date;
  origenTipo: InventarioEntradaOrigenTipo;
  origenId?: string;
  compraId?: string;
  compraNumero?: string;
  bodegaId?: string;
  observaciones?: string;
  totalItems: number;
  totalCosto: number;
  items: InventarioEntradaItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface InventarioResumen {
  proveedores: number;
  productos: number;
  compras: number;
  entradas: number;
  stockTotal: number;
  valorInventario: number;
}

export interface InventarioDashboardData {
  resumen: InventarioResumen;
  comprasRecientes: InventarioCompra[];
  entradasRecientes: InventarioEntrada[];
  productosRecientes: InventarioProducto[];
}

export enum ContableArchivoDocumentoTipo {
  FACTURA_COMPRA = "factura_compra",
  EGRESO = "egreso",
  RECIBO_CAJA = "recibo_caja",
  VIATICO = "viatico",
}

export interface ContableArchivoDocumento {
  id: string;
  tipoDocumento: ContableArchivoDocumentoTipo;
  terceroId?: string;
  terceroNombreRazonSocial?: string;
  terceroDocumentoNit?: string;
  fecha: Date;
  referencia: string;
  soporteNombre?: string;
  soporteViewUrl?: string;
  soporteDownloadUrl?: string;
}

export enum ContableCarteraEstado {
  PENDIENTE = "pendiente",
  PARCIAL = "parcial",
  PAGADO = "pagado",
}

export interface ContableCarteraProveedorItem {
  id: string;
  terceroId: string;
  proveedorNombreRazonSocial: string;
  proveedorDocumentoNit: string;
  numeroFactura: string;
  fechaFactura: Date;
  fechaVencimiento: Date;
  total: number;
  valorPagado: number;
  saldo: number;
  estado: ContableCarteraEstado;
  vencida: boolean;
}

export interface ContableCarteraClienteItem {
  id: string;
  terceroId: string;
  clienteNombreRazonSocial: string;
  clienteDocumentoNit: string;
  documentoTipo: ContableReciboDocumentoTipo;
  documentoId?: string;
  documentoReferencia?: string;
  fechaUltimoMovimiento: Date;
  total: number;
  valorRecibido: number;
  saldo: number;
  estado: ContableCarteraEstado;
}

export type ContableReporteEstadoFiltro =
  | "pendiente"
  | "parcial"
  | "pagado"
  | "vencida"
  | "anulada"
  | "legalizado"
  | "aprobado"
  | "rechazado"
  | "conciliado"
  | "no_conciliado";

export interface ContableReporteMovimientoBancario
  extends ContableMovimientoBancario {
  cuentaBancariaBanco?: string;
  cuentaBancariaNombre?: string;
  cuentaBancariaNumero?: string;
}

export interface ContableReportesResumen {
  totalFacturasCompra: number;
  totalEgresos: number;
  totalRecibosCaja: number;
  saldoCarteraProveedores: number;
  saldoCarteraClientes: number;
  totalViaticos: number;
  totalIngresosBancarios: number;
  totalEgresosBancarios: number;
  saldoBancarioSistema: number;
  saldoConciliado: number;
  diferenciaConciliacion: number;
}

export interface ContableReportesConciliacion {
  movimientosConciliados: number;
  movimientosPendientes: number;
  totalIngresos: number;
  totalEgresos: number;
  saldoSistema: number;
  saldoConciliado: number;
  diferencia: number;
}

export interface ContableReportesData {
  resumen: ContableReportesResumen;
  conciliacion: ContableReportesConciliacion;
  facturasCompra: ContableFacturaCompra[];
  egresos: ContableEgreso[];
  recibosCaja: ContableReciboCaja[];
  carteraProveedores: ContableCarteraProveedorItem[];
  carteraClientes: ContableCarteraClienteItem[];
  viaticos: ContableLegalizacionViatico[];
  movimientosBancarios: ContableReporteMovimientoBancario[];
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

export interface AlertaSeguimientoDashboard {
  id: string;
  clienteId?: string;
  clienteNombre?: string;
  clienteEmpresa?: string;
  prospectoId?: string;
  prospectoNombre?: string;
  prospectoEmpresa?: string;
  cotizacionId?: string;
  cotizacionNumero?: string;
  relacionTipo?: SeguimientoRelacionTipo;
  relacionadoNombre?: string;
  relacionadoEmpresa?: string;
  tipo: SeguimientoTipo;
  fechaVencimiento: Date;
  observaciones?: string;
  estado: SeguimientoEstado;
  completado: boolean;
}

export interface ConteosModulosDashboard {
  clientes: number;
  prospectos: number;
  visitas: number;
  cotizaciones: number;
  seguimientos: number;
}

export interface DashboardResumen {
  metricas: MetricasDashboard;
  conteos: ConteosModulosDashboard;
  actividadReciente: ActividadReciente[];
  alertasSeguimiento: AlertaSeguimientoDashboard[];
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

/* ============================================
   INTERFACES - AUTH Y USUARIOS
   ============================================ */

export enum UsuarioRol {
  ADMIN = "admin",
  COMERCIAL = "comercial",
  CONTABLE = "contable",
  SERTEC = "sertec",
  INVENTARIO = "inventario",
}

export type ThemePreference = "light" | "dark";

export type AccentColor = "blue" | "green" | "orange" | "red" | "teal";

export interface UserVisualPreferences {
  accentColor: AccentColor;
  themePreference: ThemePreference;
}

export interface AuthUser {
  id: string;
  nombre: string;
  email: string;
  rol: UsuarioRol;
  preferencias: UserVisualPreferences;
}

export interface Usuario extends AuthUser {
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
  ultimoLoginAt?: Date;
}
