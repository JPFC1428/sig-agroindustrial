import type {
  ContableNominaData,
  ContableNominaEmpleado,
  ContableNominaLiquidacion,
  ContableNominaPeriodo,
  ContableNominaSeguridadSocial,
} from "./types";

type ContableNominaEmpleadoApiRecord = Omit<
  ContableNominaEmpleado,
  "fechaIngreso" | "createdAt" | "updatedAt"
> & {
  fechaIngreso: string;
  createdAt: string;
  updatedAt: string;
};

type ContableNominaPeriodoApiRecord = Omit<
  ContableNominaPeriodo,
  "fechaInicio" | "fechaFin" | "createdAt" | "updatedAt"
> & {
  fechaInicio: string;
  fechaFin: string;
  createdAt: string;
  updatedAt: string;
};

type ContableNominaLiquidacionApiRecord = Omit<
  ContableNominaLiquidacion,
  "createdAt" | "updatedAt"
> & {
  createdAt: string;
  updatedAt: string;
};

type ContableNominaSeguridadSocialApiRecord = Omit<
  ContableNominaSeguridadSocial,
  "createdAt" | "updatedAt"
> & {
  createdAt: string;
  updatedAt: string;
};

type ContableNominaDataApiRecord = {
  empleados: ContableNominaEmpleadoApiRecord[];
  periodos: ContableNominaPeriodoApiRecord[];
  liquidaciones: ContableNominaLiquidacionApiRecord[];
  seguridadSocial: ContableNominaSeguridadSocialApiRecord[];
};

export type ContableNominaEmpleadoMutationInput = {
  nombreRazonSocial: string;
  documentoNit: string;
  contacto?: string;
  telefono?: string;
  correo?: string;
  ciudad?: string;
  direccion?: string;
  estado: ContableNominaEmpleado["estado"];
  tipoContrato: ContableNominaEmpleado["tipoContrato"];
  cargo: string;
  fechaIngreso: string;
  salarioBasico: number;
  auxilioTransporte: number;
  aplicaAuxilioTransporte: boolean;
  eps?: string;
  fondoPension?: string;
  arl?: string;
  cajaCompensacion?: string;
  porcentajeArl: number;
};

export type ContableNominaPeriodoMutationInput = {
  codigoPeriodo: string;
  tipo: ContableNominaPeriodo["tipo"];
  fechaInicio: string;
  fechaFin: string;
  estado: ContableNominaPeriodo["estado"];
  observaciones?: string;
};

export type ContableNominaLiquidacionMutationInput = {
  periodoId: string;
  empleadoId: string;
  diasTrabajados: number;
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

export function formatDateOnlyInput(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const NOMINA_API_URL = buildApiUrl("/api/contable/nomina");

const JSON_HEADERS = {
  "Content-Type": "application/json",
};

function toEmpleado(
  record: ContableNominaEmpleadoApiRecord
): ContableNominaEmpleado {
  return {
    ...record,
    fechaIngreso: parseDateOnly(record.fechaIngreso),
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
}

function toPeriodo(record: ContableNominaPeriodoApiRecord): ContableNominaPeriodo {
  return {
    ...record,
    fechaInicio: parseDateOnly(record.fechaInicio),
    fechaFin: parseDateOnly(record.fechaFin),
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
}

function toLiquidacion(
  record: ContableNominaLiquidacionApiRecord
): ContableNominaLiquidacion {
  return {
    ...record,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
}

function toSeguridadSocial(
  record: ContableNominaSeguridadSocialApiRecord
): ContableNominaSeguridadSocial {
  return {
    ...record,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
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

export async function getContableNominaData() {
  const response = await fetch(NOMINA_API_URL, {
    cache: "no-store",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as ContableNominaDataApiRecord;

  return {
    empleados: data.empleados.map(toEmpleado),
    periodos: data.periodos.map(toPeriodo),
    liquidaciones: data.liquidaciones.map(toLiquidacion),
    seguridadSocial: data.seguridadSocial.map(toSeguridadSocial),
  } satisfies ContableNominaData;
}

export async function createContableNominaEmpleado(
  payload: ContableNominaEmpleadoMutationInput
) {
  const response = await fetch(`${NOMINA_API_URL}?resource=empleados`, {
    credentials: "include",
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as ContableNominaEmpleadoApiRecord;
  return toEmpleado(data);
}

export async function createContableNominaPeriodo(
  payload: ContableNominaPeriodoMutationInput
) {
  const response = await fetch(`${NOMINA_API_URL}?resource=periodos`, {
    credentials: "include",
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as ContableNominaPeriodoApiRecord;
  return toPeriodo(data);
}

export async function createContableNominaLiquidacion(
  payload: ContableNominaLiquidacionMutationInput
) {
  const response = await fetch(`${NOMINA_API_URL}?resource=liquidaciones`, {
    credentials: "include",
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as ContableNominaLiquidacionApiRecord;
  return toLiquidacion(data);
}
