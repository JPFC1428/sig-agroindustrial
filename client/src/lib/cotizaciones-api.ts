import type { Cotizacion, LineaCotizacion } from "./types";
import { notifyDashboardDataChanged } from "./dashboard-events";

type CotizacionApiRecord = Omit<Cotizacion, "fecha" | "fechaVencimiento"> & {
  fecha: string;
  fechaVencimiento: string;
};

type LineaCotizacionInput = Omit<LineaCotizacion, "id" | "subtotal">;

export type CotizacionMutationInput = {
  clienteId: string;
  fecha: string | Date;
  fechaVencimiento: string | Date;
  estado?: Cotizacion["estado"];
  lineas: LineaCotizacionInput[];
  impuesto?: number;
  descuentoGlobal?: number;
  moneda: Cotizacion["moneda"];
  condicionesPago: string;
  notas?: string;
};

export type CotizacionEmailSendInput = {
  asunto: string;
  destinatario: string;
  mensaje?: string;
};

type CotizacionSendApiRecord = {
  cotizacion: CotizacionApiRecord;
  envio: {
    asunto: string;
    cotizacionId: string;
    destinatario: string;
    estado: "enviado" | "error";
    fechaEnvio: string;
    id: string;
    usuarioEnvio?: string;
  };
};

type CotizacionWhatsappApiRecord = {
  cotizacion: CotizacionApiRecord;
  whatsapp: {
    cotizacionId: string;
    estado: "preparado";
    fechaPreparado: string;
    id: string;
    mensaje: string;
    telefonoDestino: string;
    urlCotizacion?: string;
    urlWhatsapp: string;
    usuarioPreparo?: string;
  };
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

const COTIZACIONES_API_URL = buildApiUrl("/api/cotizaciones");

const JSON_HEADERS = {
  "Content-Type": "application/json",
};

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

function toCotizacion(record: CotizacionApiRecord): Cotizacion {
  return {
    ...record,
    fecha: new Date(record.fecha),
    fechaVencimiento: new Date(record.fechaVencimiento),
  };
}

function serializePayload(payload: CotizacionMutationInput) {
  return {
    ...payload,
    fecha:
      payload.fecha instanceof Date
        ? payload.fecha.toISOString()
        : payload.fecha,
    fechaVencimiento:
      payload.fechaVencimiento instanceof Date
        ? payload.fechaVencimiento.toISOString()
        : payload.fechaVencimiento,
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

export async function getCotizaciones() {
  const response = await fetch(COTIZACIONES_API_URL, {
    cache: "no-store",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as CotizacionApiRecord[];
  return data.map(toCotizacion);
}

export async function getCotizacionById(id: string) {
  const response = await fetch(`${COTIZACIONES_API_URL}/${id}`, {
    cache: "no-store",
    credentials: "include",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as CotizacionApiRecord;
  return toCotizacion(data);
}

export async function createCotizacion(payload: CotizacionMutationInput) {
  const response = await fetch(COTIZACIONES_API_URL, {
    credentials: "include",
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(serializePayload(payload)),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as CotizacionApiRecord;
  const cotizacion = toCotizacion(data);
  notifyDashboardDataChanged();
  return cotizacion;
}

export async function updateCotizacion(
  id: string,
  payload: CotizacionMutationInput
) {
  const response = await fetch(`${COTIZACIONES_API_URL}/${id}`, {
    credentials: "include",
    method: "PUT",
    headers: JSON_HEADERS,
    body: JSON.stringify(serializePayload(payload)),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as CotizacionApiRecord;
  const cotizacion = toCotizacion(data);
  notifyDashboardDataChanged();
  return cotizacion;
}

export async function deleteCotizacion(id: string) {
  const response = await fetch(`${COTIZACIONES_API_URL}/${id}`, {
    credentials: "include",
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  notifyDashboardDataChanged();
}

export async function downloadCotizacionExcel(id: string) {
  const response = await fetch(`${COTIZACIONES_API_URL}/${id}?download=excel`, {
    cache: "no-store",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const blob = await response.blob();
  const fileName = getDownloadFileName(response, `cotizacion-${id}.xlsx`);
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(objectUrl);
}

export async function sendCotizacionByEmail(
  id: string,
  payload: CotizacionEmailSendInput
) {
  const response = await fetch(`${COTIZACIONES_API_URL}/${id}?send=email`, {
    body: JSON.stringify(payload),
    credentials: "include",
    headers: JSON_HEADERS,
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as CotizacionSendApiRecord;
  notifyDashboardDataChanged();

  return {
    cotizacion: toCotizacion(data.cotizacion),
    envio: {
      ...data.envio,
      fechaEnvio: new Date(data.envio.fechaEnvio),
    },
  };
}

export async function prepareCotizacionWhatsapp(id: string) {
  const response = await fetch(`${COTIZACIONES_API_URL}/${id}?send=whatsapp`, {
    credentials: "include",
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as CotizacionWhatsappApiRecord;

  return {
    cotizacion: toCotizacion(data.cotizacion),
    whatsapp: {
      ...data.whatsapp,
      fechaPreparado: new Date(data.whatsapp.fechaPreparado),
    },
  };
}
