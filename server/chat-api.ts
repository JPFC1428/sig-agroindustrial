import type { IncomingMessage, ServerResponse } from "node:http";
import { nanoid } from "nanoid";
import {
  ChatMensajeTipo,
  UsuarioRol,
  type ChatAvailableUser,
  type ChatConversationDetail,
  type ChatConversationSummary,
  type ChatMessage,
  type ChatParticipant,
} from "../client/src/lib/types.js";
import { requireAuthenticatedRequest } from "./auth-api.js";
import { normalizeUserRole } from "./access-control.js";
import { getSql } from "./neon.js";

type NodeRequest = IncomingMessage & {
  body?: unknown;
};

type ConnectNext = (error?: unknown) => void;

type ChatAvailableUserApiRecord = Omit<ChatAvailableUser, "ultimoLoginAt"> & {
  ultimoLoginAt?: string;
};

type ChatParticipantApiRecord = ChatParticipant;

type ChatMessageApiRecord = Omit<ChatMessage, "creadoEn"> & {
  creadoEn: string;
};

type ChatConversationSummaryApiRecord = Omit<
  ChatConversationSummary,
  "creadoEn" | "ultimoMensaje"
> & {
  creadoEn: string;
  ultimoMensaje?: ChatMessageApiRecord;
};

type ChatConversationDetailApiRecord = Omit<
  ChatConversationDetail,
  "creadoEn" | "ultimoMensaje" | "mensajes"
> & {
  creadoEn: string;
  ultimoMensaje?: ChatMessageApiRecord;
  mensajes: ChatMessageApiRecord[];
};

type ChatBootstrapDataApiRecord = {
  conversaciones: ChatConversationSummaryApiRecord[];
  usuarios: ChatAvailableUserApiRecord[];
};

type ChatUserRow = {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  activo: boolean;
  ultimo_login_at: string | Date | null;
};

type ChatConversationRow = {
  id: string;
  creado_en: string | Date;
};

type ChatParticipantRow = {
  id: string;
  conversacion_id: string;
  usuario_id: string;
  nombre: string;
  email: string;
  rol: string;
  activo: boolean;
};

type ChatMessageRow = {
  id: string;
  conversacion_id: string;
  usuario_id: string;
  usuario_nombre: string;
  usuario_email: string;
  usuario_rol: string;
  contenido: string;
  tipo: ChatMensajeTipo;
  archivo_url: string | null;
  creado_en: string | Date;
};

type ChatMessageCountRow = {
  conversacion_id: string;
  total: number | string;
};

type ChatConversationCreatePayload = {
  usuarioId?: unknown;
};

type ChatMessagePayload = {
  archivoUrl?: unknown;
  contenido?: unknown;
  tipo?: unknown;
};

type BuiltConversationInput = {
  usuarioId: string;
};

type BuiltMessageInput = {
  archivoUrl?: string;
  contenido: string;
  tipo: ChatMensajeTipo;
};

type AuthenticatedChatUser = {
  email: string;
  id: string;
  nombre: string;
  rol: ReturnType<typeof normalizeUserRole>;
};

type DatabaseError = Error & {
  code?: string;
};

const CHAT_MESSAGE_TYPES = new Set<ChatMensajeTipo>([
  ChatMensajeTipo.TEXTO,
  ChatMensajeTipo.ARCHIVO,
  ChatMensajeTipo.SISTEMA,
]);

function setJsonHeaders(res: ServerResponse) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  setJsonHeaders(res);
  res.end(JSON.stringify(payload));
}

function sendErrorJson(
  res: ServerResponse,
  statusCode: number,
  error: string,
  detail: string
) {
  sendJson(res, statusCode, { error, detail });
}

function sendMethodNotAllowed(
  res: ServerResponse,
  allowedMethods: readonly string[]
) {
  res.setHeader("Allow", allowedMethods.join(", "));
  sendErrorJson(
    res,
    405,
    "Metodo no permitido",
    `Metodos permitidos: ${allowedMethods.join(", ")}`
  );
}

async function readJsonBody(req: NodeRequest): Promise<unknown> {
  if (typeof req.body === "string") {
    return req.body.trim() ? JSON.parse(req.body) : {};
  }

  if (Buffer.isBuffer(req.body)) {
    const rawBody = req.body.toString("utf-8").trim();
    return rawBody ? JSON.parse(rawBody) : {};
  }

  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  const rawBody = Buffer.concat(chunks).toString("utf-8").trim();
  return rawBody ? JSON.parse(rawBody) : {};
}

function getPathname(urlValue?: string) {
  return new URL(urlValue ?? "/", "http://localhost").pathname;
}

function readString(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readOptionalString(value: unknown) {
  return readString(value);
}

function parseDateValue(value: string | Date) {
  const parsed = value instanceof Date ? new Date(value) : new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Fecha invalida en la base de datos");
  }

  return parsed;
}

function normalizeDatabaseError(error: unknown): DatabaseError {
  if (error instanceof Error) {
    return error as DatabaseError;
  }

  return new Error("Error desconocido") as DatabaseError;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function isConflictError(error: unknown) {
  return error instanceof Error && (error as DatabaseError).code === "23505";
}

function isValidationError(error: unknown) {
  return (
    error instanceof Error &&
    /obligatorio|invalido|no existe|no puede|pertenece|maximo|activo/i.test(
      error.message
    )
  );
}

function buildDirectConversationKey(leftUserId: string, rightUserId: string) {
  return [leftUserId, rightUserId].sort().join("::");
}

function toUsuarioRol(role: string): UsuarioRol {
  switch (normalizeUserRole(role)) {
    case "admin":
      return UsuarioRol.ADMIN;
    case "contable":
      return UsuarioRol.CONTABLE;
    case "inventario":
      return UsuarioRol.INVENTARIO;
    case "sertec":
      return UsuarioRol.SERTEC;
    case "comercial":
    default:
      return UsuarioRol.COMERCIAL;
  }
}

function getChatSegments(pathname: string) {
  if (pathname === "/api/chat" || pathname === "/api/chat/") {
    return [] as string[];
  }

  if (!pathname.startsWith("/api/chat/")) {
    return null;
  }

  return pathname
    .slice("/api/chat/".length)
    .split("/")
    .filter(Boolean);
}

function buildConversationInput(payload: unknown): BuiltConversationInput {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Cuerpo de solicitud invalido");
  }

  const data = payload as ChatConversationCreatePayload;
  const usuarioId = readString(data.usuarioId) ?? "";

  if (!usuarioId) {
    throw new Error("El usuario destino es obligatorio");
  }

  return { usuarioId };
}

function buildMessageInput(payload: unknown): BuiltMessageInput {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Cuerpo de solicitud invalido");
  }

  const data = payload as ChatMessagePayload;
  const tipo =
    (readString(data.tipo) as ChatMensajeTipo | undefined) ??
    ChatMensajeTipo.TEXTO;
  const contenido = readOptionalString(data.contenido) ?? "";
  const archivoUrl = readOptionalString(data.archivoUrl);

  if (!CHAT_MESSAGE_TYPES.has(tipo)) {
    throw new Error("El tipo de mensaje es invalido");
  }

  if (contenido.length > 4000) {
    throw new Error("El contenido del mensaje no puede superar 4000 caracteres");
  }

  if (tipo === ChatMensajeTipo.ARCHIVO) {
    if (!archivoUrl && !contenido) {
      throw new Error("El mensaje de archivo requiere URL o descripcion");
    }
  } else if (!contenido) {
    throw new Error("El contenido del mensaje es obligatorio");
  }

  return {
    ...(archivoUrl ? { archivoUrl } : {}),
    contenido,
    tipo,
  };
}

function mapChatUserRow(row: ChatUserRow): ChatAvailableUserApiRecord {
  const ultimoLoginAt = row.ultimo_login_at
    ? parseDateValue(row.ultimo_login_at).toISOString()
    : undefined;

  return {
    activo: row.activo,
    email: row.email,
    id: row.id,
    nombre: row.nombre,
    ...(ultimoLoginAt ? { ultimoLoginAt } : {}),
    rol: toUsuarioRol(row.rol),
  };
}

function mapChatParticipantRow(row: ChatParticipantRow): ChatParticipantApiRecord {
  return {
    activo: row.activo,
    email: row.email,
    id: row.id,
    nombre: row.nombre,
    rol: toUsuarioRol(row.rol),
    usuarioId: row.usuario_id,
  };
}

function mapChatMessageRow(row: ChatMessageRow): ChatMessageApiRecord {
  return {
    contenido: row.contenido ?? "",
    conversacionId: row.conversacion_id,
    creadoEn: parseDateValue(row.creado_en).toISOString(),
    id: row.id,
    ...(row.archivo_url ? { archivoUrl: row.archivo_url } : {}),
    tipo: row.tipo,
    usuarioEmail: row.usuario_email,
    usuarioId: row.usuario_id,
    usuarioNombre: row.usuario_nombre,
    usuarioRol: toUsuarioRol(row.usuario_rol),
  };
}

async function findActiveUserById(userId: string) {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      id,
      nombre,
      email,
      rol,
      activo,
      ultimo_login_at
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `) as ChatUserRow[];

  const row = rows[0] ?? null;

  if (!row || !row.activo) {
    return null;
  }

  return row;
}

async function listChatUsers(
  currentUserId: string
): Promise<ChatAvailableUserApiRecord[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      id,
      nombre,
      email,
      rol,
      activo,
      ultimo_login_at
    FROM users
    WHERE activo = TRUE
      AND id <> ${currentUserId}
    ORDER BY nombre ASC, email ASC
  `) as ChatUserRow[];

  return rows.map(mapChatUserRow);
}

async function listConversationRowsForUser(currentUserId: string) {
  const sql = getSql();
  const rows = (await sql`
    SELECT DISTINCT
      c.id,
      c.creado_en
    FROM chat_conversaciones c
    INNER JOIN chat_participantes cp
      ON cp.conversacion_id = c.id
    WHERE cp.usuario_id = ${currentUserId}
  `) as ChatConversationRow[];

  return rows;
}

async function listParticipantsByConversationIds(conversationIds: string[]) {
  if (conversationIds.length === 0) {
    return [] as ChatParticipantRow[];
  }

  const sql = getSql();
  const rows = (await sql.query(
    `
      SELECT
        cp.id,
        cp.conversacion_id,
        cp.usuario_id,
        u.nombre,
        u.email,
        u.rol,
        u.activo
      FROM chat_participantes cp
      INNER JOIN users u
        ON u.id = cp.usuario_id
      WHERE cp.conversacion_id = ANY($1::text[])
      ORDER BY cp.conversacion_id ASC, u.nombre ASC, u.email ASC
    `,
    [conversationIds]
  )) as ChatParticipantRow[];

  return rows;
}

async function listLatestMessagesByConversationIds(conversationIds: string[]) {
  if (conversationIds.length === 0) {
    return [] as ChatMessageRow[];
  }

  const sql = getSql();
  const rows = (await sql.query(
    `
      SELECT DISTINCT ON (m.conversacion_id)
        m.id,
        m.conversacion_id,
        m.usuario_id,
        u.nombre AS usuario_nombre,
        u.email AS usuario_email,
        u.rol AS usuario_rol,
        m.contenido,
        m.tipo,
        m.archivo_url,
        m.creado_en
      FROM chat_mensajes m
      INNER JOIN users u
        ON u.id = m.usuario_id
      WHERE m.conversacion_id = ANY($1::text[])
      ORDER BY m.conversacion_id ASC, m.creado_en DESC, m.id DESC
    `,
    [conversationIds]
  )) as ChatMessageRow[];

  return rows;
}

async function countMessagesByConversationIds(conversationIds: string[]) {
  if (conversationIds.length === 0) {
    return [] as ChatMessageCountRow[];
  }

  const sql = getSql();
  const rows = (await sql.query(
    `
      SELECT
        conversacion_id,
        COUNT(*) AS total
      FROM chat_mensajes
      WHERE conversacion_id = ANY($1::text[])
      GROUP BY conversacion_id
    `,
    [conversationIds]
  )) as ChatMessageCountRow[];

  return rows;
}

function groupParticipantsByConversation(
  rows: ChatParticipantRow[]
): Map<string, ChatParticipantApiRecord[]> {
  const grouped = new Map<string, ChatParticipantApiRecord[]>();

  for (const row of rows) {
    const participants = grouped.get(row.conversacion_id) ?? [];
    participants.push(mapChatParticipantRow(row));
    grouped.set(row.conversacion_id, participants);
  }

  return grouped;
}

function mapLatestMessagesByConversation(
  rows: ChatMessageRow[]
): Map<string, ChatMessageApiRecord> {
  return new Map(
    rows.map(row => [row.conversacion_id, mapChatMessageRow(row)] as const)
  );
}

function mapMessageCountsByConversation(
  rows: ChatMessageCountRow[]
): Map<string, number> {
  return new Map(
    rows.map(row => [row.conversacion_id, Number(row.total ?? 0)] as const)
  );
}

function buildConversationSummaryRecord(
  currentUserId: string,
  conversation: ChatConversationRow,
  participants: ChatParticipantApiRecord[],
  latestMessage?: ChatMessageApiRecord,
  totalMessages = 0
): ChatConversationSummaryApiRecord {
  return {
    creadoEn: parseDateValue(conversation.creado_en).toISOString(),
    id: conversation.id,
    ...(latestMessage ? { ultimoMensaje: latestMessage } : {}),
    otroUsuario: participants.find(
      participant => participant.usuarioId !== currentUserId
    ),
    participantes: participants,
    totalMensajes: totalMessages,
  };
}

function sortConversationSummaries(
  conversations: ChatConversationSummaryApiRecord[]
) {
  return [...conversations].sort((left, right) => {
    const leftSortValue = left.ultimoMensaje?.creadoEn ?? left.creadoEn;
    const rightSortValue = right.ultimoMensaje?.creadoEn ?? right.creadoEn;
    return rightSortValue.localeCompare(leftSortValue);
  });
}

async function listConversationSummaries(
  currentUserId: string
): Promise<ChatConversationSummaryApiRecord[]> {
  const conversationRows = await listConversationRowsForUser(currentUserId);
  const conversationIds = conversationRows.map(conversation => conversation.id);

  if (conversationIds.length === 0) {
    return [];
  }

  const [participantRows, latestMessageRows, messageCountRows] = await Promise.all([
    listParticipantsByConversationIds(conversationIds),
    listLatestMessagesByConversationIds(conversationIds),
    countMessagesByConversationIds(conversationIds),
  ]);

  const participantsByConversation =
    groupParticipantsByConversation(participantRows);
  const latestMessagesByConversation =
    mapLatestMessagesByConversation(latestMessageRows);
  const messageCountsByConversation =
    mapMessageCountsByConversation(messageCountRows);

  const summaries = conversationRows.map(conversation =>
    buildConversationSummaryRecord(
      currentUserId,
      conversation,
      participantsByConversation.get(conversation.id) ?? [],
      latestMessagesByConversation.get(conversation.id),
      messageCountsByConversation.get(conversation.id) ?? 0
    )
  );

  return sortConversationSummaries(summaries);
}

async function ensureConversationMembership(
  currentUserId: string,
  conversationId: string
) {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      c.id,
      c.creado_en
    FROM chat_conversaciones c
    INNER JOIN chat_participantes cp
      ON cp.conversacion_id = c.id
    WHERE c.id = ${conversationId}
      AND cp.usuario_id = ${currentUserId}
    LIMIT 1
  `) as ChatConversationRow[];

  const conversation = rows[0] ?? null;

  if (!conversation) {
    throw new Error("La conversacion no existe o no pertenece al usuario");
  }

  return conversation;
}

async function listMessagesForConversation(conversationId: string) {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      m.id,
      m.conversacion_id,
      m.usuario_id,
      u.nombre AS usuario_nombre,
      u.email AS usuario_email,
      u.rol AS usuario_rol,
      m.contenido,
      m.tipo,
      m.archivo_url,
      m.creado_en
    FROM chat_mensajes m
    INNER JOIN users u
      ON u.id = m.usuario_id
    WHERE m.conversacion_id = ${conversationId}
    ORDER BY m.creado_en ASC, m.id ASC
  `) as ChatMessageRow[];

  return rows.map(mapChatMessageRow);
}

async function getConversationDetail(
  currentUserId: string,
  conversationId: string
): Promise<ChatConversationDetailApiRecord> {
  const conversation = await ensureConversationMembership(
    currentUserId,
    conversationId
  );
  const [participantRows, messages] = await Promise.all([
    listParticipantsByConversationIds([conversation.id]),
    listMessagesForConversation(conversation.id),
  ]);

  const participantes = participantRows.map(mapChatParticipantRow);
  const ultimoMensaje = messages[messages.length - 1];

  return {
    creadoEn: parseDateValue(conversation.creado_en).toISOString(),
    id: conversation.id,
    mensajes: messages,
    ...(ultimoMensaje ? { ultimoMensaje } : {}),
    otroUsuario: participantes.find(
      participante => participante.usuarioId !== currentUserId
    ),
    participantes,
    totalMensajes: messages.length,
  };
}

async function createOrReuseConversation(
  currentUser: AuthenticatedChatUser,
  payload: unknown
): Promise<ChatConversationDetailApiRecord> {
  const input = buildConversationInput(payload);

  if (input.usuarioId === currentUser.id) {
    throw new Error("No puedes iniciar una conversacion contigo mismo");
  }

  const targetUser = await findActiveUserById(input.usuarioId);

  if (!targetUser) {
    throw new Error("El usuario destino no existe o esta inactivo");
  }

  const sql = getSql();
  const directKey = buildDirectConversationKey(currentUser.id, targetUser.id);
  const conversationRows = (await sql`
    INSERT INTO chat_conversaciones (
      id,
      llave_directa
    ) VALUES (
      ${`chatconv-${nanoid(10)}`},
      ${directKey}
    )
    ON CONFLICT (llave_directa)
    DO UPDATE SET llave_directa = EXCLUDED.llave_directa
    RETURNING
      id,
      creado_en
  `) as ChatConversationRow[];
  const conversation = conversationRows[0];

  await sql`
    INSERT INTO chat_participantes (
      id,
      conversacion_id,
      usuario_id
    ) VALUES
      (${`chatpar-${nanoid(10)}`}, ${conversation.id}, ${currentUser.id}),
      (${`chatpar-${nanoid(10)}`}, ${conversation.id}, ${targetUser.id})
    ON CONFLICT (conversacion_id, usuario_id) DO NOTHING
  `;

  return getConversationDetail(currentUser.id, conversation.id);
}

async function insertChatMessage(
  currentUser: AuthenticatedChatUser,
  conversationId: string,
  payload: unknown
): Promise<ChatMessageApiRecord> {
  await ensureConversationMembership(currentUser.id, conversationId);

  const input = buildMessageInput(payload);
  const sql = getSql();
  const rows = (await sql`
    INSERT INTO chat_mensajes (
      id,
      conversacion_id,
      usuario_id,
      contenido,
      tipo,
      archivo_url
    ) VALUES (
      ${`chatmsg-${nanoid(12)}`},
      ${conversationId},
      ${currentUser.id},
      ${input.contenido},
      ${input.tipo},
      ${input.archivoUrl ?? null}
    )
    RETURNING
      id,
      conversacion_id,
      usuario_id,
      contenido,
      tipo,
      archivo_url,
      creado_en
  `) as Array<{
    id: string;
    conversacion_id: string;
    usuario_id: string;
    contenido: string;
    tipo: ChatMensajeTipo;
    archivo_url: string | null;
    creado_en: string | Date;
  }>;
  const inserted = rows[0];

  return {
    contenido: inserted.contenido,
    conversacionId: inserted.conversacion_id,
    creadoEn: parseDateValue(inserted.creado_en).toISOString(),
    id: inserted.id,
    ...(inserted.archivo_url ? { archivoUrl: inserted.archivo_url } : {}),
    tipo: inserted.tipo,
    usuarioEmail: currentUser.email,
    usuarioId: currentUser.id,
    usuarioNombre: currentUser.nombre,
    usuarioRol: toUsuarioRol(currentUser.rol),
  };
}

async function getChatBootstrapData(
  currentUserId: string
): Promise<ChatBootstrapDataApiRecord> {
  const [usuarios, conversaciones] = await Promise.all([
    listChatUsers(currentUserId),
    listConversationSummaries(currentUserId),
  ]);

  return {
    conversaciones,
    usuarios,
  };
}

export async function handleChatRoute(req: NodeRequest, res: ServerResponse) {
  const pathname = getPathname(req.url);
  const segments = getChatSegments(pathname);

  if (segments === null) {
    sendErrorJson(res, 404, "Ruta no encontrada", "La ruta de chat no existe");
    return;
  }

  const currentUser = (await requireAuthenticatedRequest(
    req,
    res
  )) as AuthenticatedChatUser | null;

  if (!currentUser) {
    return;
  }

  try {
    if (segments.length === 0) {
      if (req.method !== "GET") {
        sendMethodNotAllowed(res, ["GET"]);
        return;
      }

      const data = await getChatBootstrapData(currentUser.id);
      sendJson(res, 200, data);
      return;
    }

    if (segments.length === 1 && segments[0] === "usuarios") {
      if (req.method !== "GET") {
        sendMethodNotAllowed(res, ["GET"]);
        return;
      }

      const data = await listChatUsers(currentUser.id);
      sendJson(res, 200, data);
      return;
    }

    if (segments.length === 1 && segments[0] === "conversaciones") {
      if (req.method === "GET") {
        const data = await listConversationSummaries(currentUser.id);
        sendJson(res, 200, data);
        return;
      }

      if (req.method === "POST") {
        const payload = await readJsonBody(req);
        const data = await createOrReuseConversation(currentUser, payload);
        sendJson(res, 201, data);
        return;
      }

      sendMethodNotAllowed(res, ["GET", "POST"]);
      return;
    }

    if (segments.length === 2 && segments[0] === "conversaciones") {
      if (req.method !== "GET") {
        sendMethodNotAllowed(res, ["GET"]);
        return;
      }

      const data = await getConversationDetail(currentUser.id, segments[1]);
      sendJson(res, 200, data);
      return;
    }

    if (
      segments.length === 3 &&
      segments[0] === "conversaciones" &&
      segments[2] === "mensajes"
    ) {
      if (req.method !== "POST") {
        sendMethodNotAllowed(res, ["POST"]);
        return;
      }

      const payload = await readJsonBody(req);
      const data = await insertChatMessage(currentUser, segments[1], payload);
      sendJson(res, 201, data);
      return;
    }

    sendErrorJson(
      res,
      404,
      "Ruta no encontrada",
      `La ruta de chat "${pathname}" no existe`
    );
  } catch (error) {
    const normalizedError = normalizeDatabaseError(error);
    const statusCode = isConflictError(normalizedError)
      ? 409
      : isValidationError(normalizedError)
        ? 400
        : 500;

    sendErrorJson(
      res,
      statusCode,
      statusCode === 409
        ? "Conflicto al guardar informacion del chat"
        : statusCode === 400
          ? "Solicitud invalida"
          : "Error interno",
      getErrorMessage(normalizedError, "No se pudo procesar la solicitud de chat")
    );
  }
}

export function createChatDevMiddleware() {
  return (req: NodeRequest, res: ServerResponse, next: ConnectNext) => {
    const pathname = getPathname(req.url);

    if (pathname === "/api/chat" || pathname.startsWith("/api/chat/")) {
      void handleChatRoute(req, res).catch(next);
      return;
    }

    next();
  };
}
