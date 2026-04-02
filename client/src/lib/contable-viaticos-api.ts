import type {
  ContableLegalizacionViatico,
  ContableLegalizacionViaticoEstado,
  ContableLegalizacionViaticoVendedor,
  VisitaViaticoSoporte,
} from "./types";

type ContableLegalizacionViaticoApiRecord = Omit<
  ContableLegalizacionViatico,
  "fecha" | "legalizacionUpdatedAt" | "visitaFecha" | "soporte"
> & {
  fecha: string;
  legalizacionUpdatedAt?: string;
  visitaFecha: string;
  soporte?: VisitaViaticoSoporte;
};

type ContableLegalizacionViaticoVendedorApiRecord =
  ContableLegalizacionViaticoVendedor;

export type ContableLegalizacionViaticoFilters = {
  estado?: ContableLegalizacionViaticoEstado;
  fechaDesde?: string;
  fechaHasta?: string;
  q?: string;
  vendedorId?: string;
};

export type ContableLegalizacionViaticoUpdateInput = {
  legalizacionEstado: ContableLegalizacionViaticoEstado;
  legalizacionObservaciones?: string;
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

const CONTABLE_VIATICOS_API_URL = buildApiUrl("/api/contable/viaticos");

const JSON_HEADERS = {
  "Content-Type": "application/json",
};

function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
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

function buildFiltersQuery(filters: ContableLegalizacionViaticoFilters) {
  const params = new URLSearchParams();

  if (filters.q?.trim()) {
    params.set("q", filters.q.trim());
  }

  if (filters.vendedorId?.trim()) {
    params.set("vendedorId", filters.vendedorId.trim());
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

function toContableLegalizacionViatico(
  record: ContableLegalizacionViaticoApiRecord
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

async function downloadContableViaticosExport(
  filters: ContableLegalizacionViaticoFilters,
  format: "excel" | "pdf"
) {
  const params = buildFiltersQuery(filters);
  params.set("export", format);

  const response = await fetch(
    `${CONTABLE_VIATICOS_API_URL}?${params.toString()}`,
    {
      cache: "no-store",
      credentials: "include",
    }
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const extension = format === "excel" ? "xlsx" : "pdf";
  const blob = await response.blob();
  const fileName = getDownloadFileName(
    response,
    `legalizacion-viaticos.${extension}`
  );
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(objectUrl);
}

export async function getContableLegalizacionViaticos(
  filters: ContableLegalizacionViaticoFilters = {}
) {
  const params = buildFiltersQuery(filters);
  const response = await fetch(
    params.size > 0
      ? `${CONTABLE_VIATICOS_API_URL}?${params.toString()}`
      : CONTABLE_VIATICOS_API_URL,
    {
      cache: "no-store",
      credentials: "include",
    }
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as ContableLegalizacionViaticoApiRecord[];
  return data.map(toContableLegalizacionViatico);
}

export async function getContableLegalizacionViaticosVendedores() {
  const response = await fetch(
    `${CONTABLE_VIATICOS_API_URL}?resource=vendedores`,
    {
      cache: "no-store",
      credentials: "include",
    }
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as ContableLegalizacionViaticoVendedorApiRecord[];
}

export async function updateContableLegalizacionViatico(
  id: string,
  payload: ContableLegalizacionViaticoUpdateInput
) {
  const response = await fetch(`${CONTABLE_VIATICOS_API_URL}/${id}`, {
    body: JSON.stringify(payload),
    credentials: "include",
    headers: JSON_HEADERS,
    method: "PUT",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as ContableLegalizacionViaticoApiRecord;
  return toContableLegalizacionViatico(data);
}

export function getContableLegalizacionViaticoSupportUrl(
  viaticoId: string,
  mode: "view" | "download" = "view"
) {
  const params = new URLSearchParams({
    resource: "support",
    ...(mode === "download" ? { download: "1" } : {}),
  });

  return `${CONTABLE_VIATICOS_API_URL}/${encodeURIComponent(
    viaticoId
  )}?${params.toString()}`;
}

export function downloadContableLegalizacionViaticosExcel(
  filters: ContableLegalizacionViaticoFilters = {}
) {
  return downloadContableViaticosExport(filters, "excel");
}

export function downloadContableLegalizacionViaticosPdf(
  filters: ContableLegalizacionViaticoFilters = {}
) {
  return downloadContableViaticosExport(filters, "pdf");
}
