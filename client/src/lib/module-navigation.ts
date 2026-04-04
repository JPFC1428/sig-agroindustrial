import type { ConteosModulosDashboard } from "./types";

export type AppModuleKey =
  | "comercial"
  | "sertec"
  | "contable"
  | "inventario-compras"
  | "chat-interno"
  | "mercado-agricola";

export type ModuleNavItem = {
  id: string;
  label: string;
  href: string;
  description: string;
  badgeKey?: keyof ConteosModulosDashboard;
  visibleInNavigation?: boolean;
};

export type AppModuleDefinition = {
  key: AppModuleKey;
  label: string;
  href: string;
  description: string;
  subtitle: string;
  routePrefixes: string[];
  items: ModuleNavItem[];
};

const comercialItems: ModuleNavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/dashboard",
    description: "Indicadores y actividad comercial consolidada.",
  },
  {
    id: "clientes",
    label: "Clientes",
    href: "/clientes",
    description: "Gestion de clientes activos y su historial comercial.",
    badgeKey: "clientes",
  },
  {
    id: "prospectos",
    label: "Prospectos",
    href: "/prospectos",
    description: "Seguimiento a oportunidades comerciales en curso.",
    badgeKey: "prospectos",
  },
  {
    id: "visitas",
    label: "Visitas",
    href: "/visitas",
    description: "Planeacion y control de visitas comerciales y viaticos.",
    badgeKey: "visitas",
  },
  {
    id: "cotizaciones",
    label: "Cotizaciones",
    href: "/cotizaciones",
    description: "Cotizaciones, exportaciones y envios comerciales.",
    badgeKey: "cotizaciones",
  },
  {
    id: "seguimientos",
    label: "Seguimientos",
    href: "/seguimientos",
    description: "Alertas, tareas y seguimiento a clientes o prospectos.",
    badgeKey: "seguimientos",
  },
];

const sertecItems: ModuleNavItem[] = [
  {
    id: "sertec-ordenes",
    label: "Ordenes",
    href: "/sertec",
    description: "Listado operativo de ordenes de entrada, reparacion y salida.",
  },
  {
    id: "sertec-nueva-orden",
    label: "Nueva Orden",
    href: "/sertec/nuevo",
    description: "Registro inicial de ordenes de entrada SERTEC.",
  },
];

export const contableItems: ModuleNavItem[] = [
  {
    id: "contable-dashboard",
    label: "Dashboard",
    href: "/contable/dashboard",
    description: "Vista base del modulo Contable para evolucion por fases.",
  },
  {
    id: "contable-reportes",
    label: "Reportes",
    href: "/contable/reportes",
    description: "Consolidado contable con filtros, resumenes y exportaciones.",
  },
  {
    id: "contable-terceros",
    label: "Terceros",
    href: "/contable/terceros",
    description: "Catalogo de terceros, clientes, proveedores y relacionados.",
  },
  {
    id: "contable-facturas-compra",
    label: "Facturas de Compra",
    href: "/contable/facturas-compra",
    description: "Registro y control de documentos de compra.",
  },
  {
    id: "contable-recibos-caja",
    label: "Recibos de Caja",
    href: "/contable/recibos-caja",
    description: "Ingreso y trazabilidad de recaudos y recibos.",
  },
  {
    id: "contable-comprobantes-egreso",
    label: "Comprobantes de Egreso",
    href: "/contable/comprobantes-egreso",
    description: "Egresos y soportes contables de salida de dinero.",
  },
  {
    id: "contable-cartera-clientes",
    label: "Cartera Clientes",
    href: "/contable/cartera-clientes",
    description: "Control de saldos, vencimientos y recuperacion de cartera.",
  },
  {
    id: "contable-cartera-proveedores",
    label: "Cartera Proveedores",
    href: "/contable/cartera-proveedores",
    description: "Seguimiento a cuentas por pagar y compromisos pendientes.",
  },
  {
    id: "contable-notas-credito",
    label: "Notas Credito",
    href: "/contable/notas-credito",
    description: "Gestion de ajustes, devoluciones y notas credito.",
  },
  {
    id: "contable-viaticos",
    label: "Legalizacion de Viaticos",
    href: "/contable/viaticos",
    description: "Revision contable de gastos, soportes y estados de legalizacion.",
  },
  {
    id: "contable-cuadres-caja",
    label: "Cuadres de Caja",
    href: "/contable/cuadres-caja",
    description: "Cierres y validaciones de caja por periodo o responsable.",
  },
  {
    id: "contable-conciliaciones-bancarias",
    label: "Conciliaciones Bancarias",
    href: "/contable/conciliaciones-bancarias",
    description: "Conciliacion de movimientos contables contra bancos.",
  },
  {
    id: "contable-bancos",
    label: "Bancos",
    href: "/contable/bancos",
    description: "Catalogo y control de cuentas bancarias.",
  },
  {
    id: "contable-archivo",
    label: "Archivo",
    href: "/contable/archivo",
    description: "Repositorio documental y consulta por proceso contable.",
  },
  {
    id: "contable-nomina-seguridad-social",
    label: "Nomina y Seguridad Social",
    href: "/contable/nomina-seguridad-social",
    description: "Preparado para procesos de personal, nomina y aportes.",
  },
];

const inventarioComprasItems: ModuleNavItem[] = [
  {
    id: "inventario-dashboard",
    label: "Dashboard",
    href: "/inventario-compras",
    description:
      "Punto de entrada funcional para inventario, compras y abastecimiento.",
  },
  {
    id: "inventario-proveedores",
    label: "Proveedores",
    href: "/inventario-compras/proveedores",
    description:
      "Consulta y registro de proveedores reutilizando terceros tipo proveedor.",
  },
  {
    id: "inventario-productos",
    label: "Productos / Equipos",
    href: "/inventario-compras/productos",
    description:
      "Catalogo base con codigo, categoria, costo, precio y control de stock.",
  },
  {
    id: "inventario-compras",
    label: "Compras",
    href: "/inventario-compras/compras",
    description:
      "Registro de compras por proveedor con detalle de items adquiridos.",
  },
  {
    id: "inventario-entradas",
    label: "Entradas",
    href: "/inventario-compras/entradas",
    description:
      "Entradas a inventario que incrementan stock sin duplicar movimientos.",
  },
];

const chatInternoItems: ModuleNavItem[] = [
  {
    id: "chat-conversaciones",
    label: "Conversaciones",
    href: "/chat",
    description:
      "Mensajeria interna directa entre usuarios con historial y polling simple.",
  },
];

const mercadoAgricolaItems: ModuleNavItem[] = [
  {
    id: "mercado-catalogo",
    label: "Catalogo",
    href: "/mercado-agricola",
    description:
      "Catalogo conectado a inventario para visibilidad comercial y solicitud de cotizaciones.",
  },
];

export const APP_MODULES: AppModuleDefinition[] = [
  {
    key: "comercial",
    label: "Comercial",
    href: "/dashboard",
    description: "Modulo operativo actual para clientes, visitas y cotizaciones.",
    subtitle: "Modulo Comercial",
    routePrefixes: [
      "/",
      "/dashboard",
      "/clientes",
      "/prospectos",
      "/visitas",
      "/cotizaciones",
      "/seguimientos",
      "/usuarios",
      "/configuracion",
    ],
    items: comercialItems,
  },
  {
    key: "sertec",
    label: "SERTEC",
    href: "/sertec",
    description:
      "Gestion de ordenes de servicio tecnico, historial y adjuntos.",
    subtitle: "Modulo SERTEC",
    routePrefixes: ["/sertec"],
    items: sertecItems,
  },
  {
    key: "contable",
    label: "Contable",
    href: "/contable/dashboard",
    description:
      "Modulo principal independiente para desarrollo contable por fases.",
    subtitle: "Modulo Contable",
    routePrefixes: ["/contable"],
    items: contableItems,
  },
  {
    key: "inventario-compras",
    label: "Inventario / Compras",
    href: "/inventario-compras",
    description:
      "Base funcional del modulo de inventario, compras y abastecimiento.",
    subtitle: "Modulo Inventario / Compras",
    routePrefixes: ["/inventario-compras"],
    items: inventarioComprasItems,
  },
  {
    key: "chat-interno",
    label: "Chat Interno",
    href: "/chat",
    description:
      "Comunicacion interna entre usuarios del sistema sin salir de la plataforma.",
    subtitle: "Modulo Chat Interno",
    routePrefixes: ["/chat"],
    items: chatInternoItems,
  },
  {
    key: "mercado-agricola",
    label: "Mercado Agricola",
    href: "/mercado-agricola",
    description:
      "Catalogo de productos visible para mercado y conectado con cotizaciones.",
    subtitle: "Modulo Mercado Agricola",
    routePrefixes: ["/mercado-agricola"],
    items: mercadoAgricolaItems,
  },
];

function matchesPath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getModuleByKey(key: AppModuleKey) {
  return APP_MODULES.find(module => module.key === key) ?? APP_MODULES[0];
}

export function getModuleByPath(pathname: string) {
  return (
    APP_MODULES.find(module =>
      module.routePrefixes.some(prefix => matchesPath(pathname, prefix))
    ) ?? APP_MODULES[0]
  );
}

export function getVisibleModuleItems(
  moduleOrKey: AppModuleDefinition | AppModuleKey
) {
  const module =
    typeof moduleOrKey === "string" ? getModuleByKey(moduleOrKey) : moduleOrKey;

  return module.items.filter(item => item.visibleInNavigation !== false);
}

export function getModuleItemByPath(
  moduleKey: AppModuleKey,
  pathname: string
) {
  const module = getModuleByKey(moduleKey);
  const matchedItems = module.items
    .filter(item => matchesPath(pathname, item.href))
    .sort((left, right) => right.href.length - left.href.length);

  return matchedItems[0] ?? module.items[0];
}
