import type {
  ContableCarteraClienteItem,
  ContableCarteraProveedorItem,
  ContableEgreso,
  ContableFacturaCompra,
  ContableLegalizacionViatico,
  ContableReporteEstadoFiltro,
  ContableReporteMovimientoBancario,
  ContableReportesData,
  ContableReciboCaja,
} from "./types";

type ContableReportesFilters = {
  estado?: ContableReporteEstadoFiltro;
  fechaDesde?: string;
  fechaHasta?: string;
  tercero?: string;
};

type FacturaCompraApiRecord = Omit<
  ContableFacturaCompra,
  "createdAt" | "fechaFactura" | "fechaVencimiento" | "updatedAt"
> & {
  createdAt: string;
  fechaFactura: string;
  fechaVencimiento: string;
  updatedAt: string;
};

type EgresoApiRecord = Omit<ContableEgreso, "createdAt" | "fecha"> & {
  createdAt: string;
  fecha: string;
};

type ReciboCajaApiRecord = Omit<ContableReciboCaja, "createdAt" | "fecha"> & {
  createdAt: string;
  fecha: string;
};

type CarteraProveedorApiRecord = Omit<
  ContableCarteraProveedorItem,
  "fechaFactura" | "fechaVencimiento"
> & {
  fechaFactura: string;
  fechaVencimiento: string;
};

type CarteraClienteApiRecord = Omit<
  ContableCarteraClienteItem,
  "fechaUltimoMovimiento"
> & {
  fechaUltimoMovimiento: string;
};

type LegalizacionViaticoApiRecord = Omit<
  ContableLegalizacionViatico,
  "fecha" | "legalizacionUpdatedAt" | "visitaFecha"
> & {
  fecha: string;
  legalizacionUpdatedAt?: string;
  visitaFecha: string;
};

type MovimientoBancarioApiRecord = Omit<
  ContableReporteMovimientoBancario,
  "createdAt" | "fecha" | "fechaConciliacion"
> & {
  createdAt: string;
  fecha: string;
  fechaConciliacion?: string;
};

type ContableReportesApiRecord = Omit<
  ContableReportesData,
  | "carteraClientes"
  | "carteraProveedores"
  | "egresos"
  | "facturasCompra"
  | "movimientosBancarios"
  | "recibosCaja"
  | "viaticos"
> & {
  carteraClientes: CarteraClienteApiRecord[];
  carteraProveedores: CarteraProveedorApiRecord[];
  egresos: EgresoApiRecord[];
  facturasCompra: FacturaCompraApiRecord[];
  movimientosBancarios: MovimientoBancarioApiRecord[];
  recibosCaja: ReciboCajaApiRecord[];
  viaticos: LegalizacionViaticoApiRecord[];
};

function getApiBaseUrl() {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

  if (!configuredBaseUrl) {
    return "";
  }

  return configuredBaseUrl.replace(/\/+$/, "");
}

function buildApiUrl(pathname: string) {
  const apiBaseUrl = getApiBaseUrl();

  if (!apiBaseUrl) {
    return pathname;
  }

  return `${apiBaseUrl}${pathname}`;
}

function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function buildFiltersQuery(filters: ContableReportesFilters) {
  const params = new URLSearchParams();

  if (filters.tercero?.trim()) {
    params.set("tercero", filters.tercero.trim());
  }

  if (filters.estado) {
    params.set("estado", filters.estado);
  }

  if (filters.fechaDesde?.trim()) {
    params.set("fechaDesde", filters.fechaDesde.trim());
  }

  if (filters.fechaHasta?.trim()) {
    params.set("fechaHasta", filters.fechaHasta.trim());
  }

  return params;
}

function getDownloadFileName(response: Response, fallback: string) {
  const contentDisposition = response.headers.get("Content-Disposition");

  if (!contentDisposition) {
    return fallback;
  }

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);

  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const simpleMatch = contentDisposition.match(/filename=\"?([^\";]+)\"?/i);
  return simpleMatch?.[1] ?? fallback;
}

async function readErrorMessage(response: Response) {
  try {
    const data = (await response.json()) as {
      detail?: string;
      error?: string;
      message?: string;
    };

    return (
      data.message || data.detail || data.error || `Error ${response.status}`
    );
  } catch {
    return `Error ${response.status}`;
  }
}

function toFacturaCompra(record: FacturaCompraApiRecord): ContableFacturaCompra {
  return {
    ...record,
    createdAt: new Date(record.createdAt),
    fechaFactura: parseDateOnly(record.fechaFactura),
    fechaVencimiento: parseDateOnly(record.fechaVencimiento),
    updatedAt: new Date(record.updatedAt),
  };
}

function toEgreso(record: EgresoApiRecord): ContableEgreso {
  return {
    ...record,
    createdAt: new Date(record.createdAt),
    fecha: parseDateOnly(record.fecha),
  };
}

function toReciboCaja(record: ReciboCajaApiRecord): ContableReciboCaja {
  return {
    ...record,
    createdAt: new Date(record.createdAt),
    fecha: parseDateOnly(record.fecha),
  };
}

function toCarteraProveedor(
  record: CarteraProveedorApiRecord
): ContableCarteraProveedorItem {
  return {
    ...record,
    fechaFactura: parseDateOnly(record.fechaFactura),
    fechaVencimiento: parseDateOnly(record.fechaVencimiento),
  };
}

function toCarteraCliente(
  record: CarteraClienteApiRecord
): ContableCarteraClienteItem {
  return {
    ...record,
    fechaUltimoMovimiento: parseDateOnly(record.fechaUltimoMovimiento),
  };
}

function toLegalizacionViatico(
  record: LegalizacionViaticoApiRecord
): ContableLegalizacionViatico {
  return {
    ...record,
    fecha: new Date(record.fecha),
    legalizacionUpdatedAt: record.legalizacionUpdatedAt
      ? new Date(record.legalizacionUpdatedAt)
      : undefined,
    visitaFecha: parseDateOnly(record.visitaFecha),
  };
}

function toMovimientoBancario(
  record: MovimientoBancarioApiRecord
): ContableReporteMovimientoBancario {
  return {
    ...record,
    createdAt: new Date(record.createdAt),
    fecha: parseDateOnly(record.fecha),
    fechaConciliacion: record.fechaConciliacion
      ? new Date(record.fechaConciliacion)
      : undefined,
  };
}

const CONTABLE_REPORTES_API_URL = buildApiUrl("/api/contable/reportes");

async function downloadContableReportesExport(
  filters: ContableReportesFilters,
  format: "excel" | "pdf"
) {
  const params = buildFiltersQuery(filters);
  params.set("export", format);

  const response = await fetch(
    `${CONTABLE_REPORTES_API_URL}?${params.toString()}`,
    {
      cache: "no-store",
      credentials: "include",
    }
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const extension = format === "excel" ? "xlsx" : "pdf";
  const fileName = getDownloadFileName(
    response,
    `reportes-contables.${extension}`
  );
  const blob = await response.blob();
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(objectUrl);
}

export async function getContableReportes(
  filters: ContableReportesFilters = {}
) {
  const params = buildFiltersQuery(filters);
  const response = await fetch(
    params.size > 0
      ? `${CONTABLE_REPORTES_API_URL}?${params.toString()}`
      : CONTABLE_REPORTES_API_URL,
    {
      cache: "no-store",
      credentials: "include",
    }
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as ContableReportesApiRecord;
  return {
    ...data,
    carteraClientes: data.carteraClientes.map(toCarteraCliente),
    carteraProveedores: data.carteraProveedores.map(toCarteraProveedor),
    egresos: data.egresos.map(toEgreso),
    facturasCompra: data.facturasCompra.map(toFacturaCompra),
    movimientosBancarios: data.movimientosBancarios.map(toMovimientoBancario),
    recibosCaja: data.recibosCaja.map(toReciboCaja),
    viaticos: data.viaticos.map(toLegalizacionViatico),
  } satisfies ContableReportesData;
}

export function downloadContableReportesExcel(
  filters: ContableReportesFilters = {}
) {
  return downloadContableReportesExport(filters, "excel");
}

export function downloadContableReportesPdf(
  filters: ContableReportesFilters = {}
) {
  return downloadContableReportesExport(filters, "pdf");
}

export type { ContableReportesFilters };
