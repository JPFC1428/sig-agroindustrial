import type {
  ActividadReciente,
  AlertaSeguimientoDashboard,
  ConteosModulosDashboard,
  DashboardResumen,
  MetricasDashboard,
} from "./types";

type ActividadRecienteApiRecord = Omit<ActividadReciente, "fecha"> & {
  fecha: string;
};

type AlertaSeguimientoDashboardApiRecord = Omit<
  AlertaSeguimientoDashboard,
  "fechaVencimiento"
> & {
  fechaVencimiento: string;
};

type DashboardResumenApiRecord = {
  metricas: MetricasDashboard;
  conteos: ConteosModulosDashboard;
  actividadReciente: ActividadRecienteApiRecord[];
  alertasSeguimiento: AlertaSeguimientoDashboardApiRecord[];
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

const DASHBOARD_API_URL = buildApiUrl("/api/dashboard");

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

function parseActividadReciente(
  record: ActividadRecienteApiRecord
): ActividadReciente {
  return {
    ...record,
    fecha: new Date(record.fecha),
  };
}

function parseAlertaSeguimiento(
  record: AlertaSeguimientoDashboardApiRecord
): AlertaSeguimientoDashboard {
  return {
    ...record,
    fechaVencimiento: new Date(record.fechaVencimiento),
  };
}

export async function getDashboardResumen(): Promise<DashboardResumen> {
  const response = await fetch(DASHBOARD_API_URL, {
    cache: "no-store",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as DashboardResumenApiRecord;

  return {
    metricas: data.metricas,
    conteos: data.conteos,
    actividadReciente: data.actividadReciente.map(parseActividadReciente),
    alertasSeguimiento: data.alertasSeguimiento.map(parseAlertaSeguimiento),
  };
}
