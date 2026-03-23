import { neon } from "@neondatabase/serverless";

type ProspectoEstadoValue =
  | "nuevo"
  | "contactado"
  | "interesado"
  | "negociacion"
  | "ganado"
  | "perdido";

type ProspectoFuenteValue =
  | "referencia"
  | "web"
  | "evento"
  | "llamada_fria"
  | "otro";

type ProspectoRow = {
  id: string;
  nombre: string;
  empresa: string;
  email: string | null;
  telefono: string | null;
  ciudad: string;
  departamento: string | null;
  contacto_principal: string | null;
  cargo_contacto: string | null;
  estado: ProspectoEstadoValue;
  fuente: ProspectoFuenteValue;
  fecha_captura: string | Date;
  proximo_seguimiento: string | Date | null;
  probabilidad_conversion: number | string;
  monto_estimado: number | string | null;
  notas: string | null;
  asignado_a: string | null;
};

let sqlClient: ReturnType<typeof neon> | undefined;

export const config = {
  runtime: "nodejs",
};

function jsonResponse(
  status: number,
  body: unknown,
  headers?: Record<string, string>
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...(headers ?? {}),
    },
  });
}

function getSql() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL no esta configurada");
  }

  sqlClient ??= neon(databaseUrl);
  return sqlClient;
}

function toIsoString(value: string | Date | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  const parsed = value instanceof Date ? new Date(value) : new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Fecha invalida en la base de datos");
  }

  return parsed.toISOString();
}

function toNumber(value: number | string, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function mapProspecto(row: ProspectoRow) {
  const fechaCaptura = toIsoString(row.fecha_captura);

  if (!fechaCaptura) {
    throw new Error("fecha_captura es obligatoria");
  }

  const proximoSeguimiento = toIsoString(row.proximo_seguimiento);
  const montoEstimado =
    row.monto_estimado === null ? undefined : toNumber(row.monto_estimado);

  return {
    id: row.id,
    nombre: row.nombre,
    empresa: row.empresa,
    email: row.email ?? "",
    telefono: row.telefono ?? "",
    ciudad: row.ciudad,
    departamento: row.departamento ?? "",
    contactoPrincipal: row.contacto_principal ?? "",
    cargoContacto: row.cargo_contacto ?? "",
    estado: row.estado,
    fuente: row.fuente,
    fechaCaptura,
    ...(proximoSeguimiento ? { proximoSeguimiento } : {}),
    probabilidadConversion: Math.round(toNumber(row.probabilidad_conversion)),
    ...(montoEstimado !== undefined ? { montoEstimado } : {}),
    ...(row.notas ? { notas: row.notas } : {}),
    ...(row.asignado_a ? { asignadoA: row.asignado_a } : {}),
  };
}

export default async function handler(request: Request) {
  if (request.method !== "GET") {
    return jsonResponse(
      405,
      { error: "Metodo no permitido en /api/prospectos" },
      { Allow: "GET" }
    );
  }

  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT
        id,
        nombre,
        empresa,
        email,
        telefono,
        ciudad,
        departamento,
        contacto_principal,
        cargo_contacto,
        estado,
        fuente,
        fecha_captura,
        proximo_seguimiento,
        probabilidad_conversion,
        monto_estimado,
        notas,
        asignado_a
      FROM prospectos
      ORDER BY fecha_captura DESC, id DESC
    `) as ProspectoRow[];

    return jsonResponse(200, rows.map(mapProspecto));
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Error desconocido";

    console.error("[api/prospectos/index] GET error", {
      detail,
      ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
    });

    return jsonResponse(500, {
      error: "Error interno en /api/prospectos",
      detail,
    });
  }
}
