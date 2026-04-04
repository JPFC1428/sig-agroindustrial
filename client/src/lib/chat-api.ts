import type {
  ChatAvailableUser,
  ChatBootstrapData,
  ChatConversationDetail,
  ChatConversationSummary,
  ChatMessage,
  ChatParticipant,
} from "./types";

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

export type ChatConversationCreateInput = {
  usuarioId: string;
};

export type ChatMessageMutationInput = {
  archivoUrl?: string;
  contenido: string;
  tipo?: ChatMessage["tipo"];
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
  return apiBaseUrl ? `${apiBaseUrl}${pathname}` : pathname;
}

const CHAT_API_URL = buildApiUrl("/api/chat");
const JSON_HEADERS = { "Content-Type": "application/json" };

function toChatAvailableUser(
  record: ChatAvailableUserApiRecord
): ChatAvailableUser {
  return {
    activo: record.activo,
    email: record.email,
    id: record.id,
    nombre: record.nombre,
    ...(record.ultimoLoginAt
      ? { ultimoLoginAt: new Date(record.ultimoLoginAt) }
      : {}),
    rol: record.rol,
  };
}

function toChatParticipant(record: ChatParticipantApiRecord): ChatParticipant {
  return record;
}

function toChatMessage(record: ChatMessageApiRecord): ChatMessage {
  return {
    ...record,
    creadoEn: new Date(record.creadoEn),
  };
}

function toChatConversationSummary(
  record: ChatConversationSummaryApiRecord
): ChatConversationSummary {
  return {
    creadoEn: new Date(record.creadoEn),
    id: record.id,
    ...(record.otroUsuario ? { otroUsuario: toChatParticipant(record.otroUsuario) } : {}),
    ...(record.ultimoMensaje
      ? { ultimoMensaje: toChatMessage(record.ultimoMensaje) }
      : {}),
    participantes: record.participantes.map(toChatParticipant),
    totalMensajes: record.totalMensajes,
  };
}

function toChatConversationDetail(
  record: ChatConversationDetailApiRecord
): ChatConversationDetail {
  return {
    creadoEn: new Date(record.creadoEn),
    id: record.id,
    ...(record.otroUsuario ? { otroUsuario: toChatParticipant(record.otroUsuario) } : {}),
    ...(record.ultimoMensaje
      ? { ultimoMensaje: toChatMessage(record.ultimoMensaje) }
      : {}),
    mensajes: record.mensajes.map(toChatMessage),
    participantes: record.participantes.map(toChatParticipant),
    totalMensajes: record.totalMensajes,
  };
}

async function readErrorMessage(response: Response) {
  try {
    const data = (await response.json()) as {
      detail?: string;
      error?: string;
      message?: string;
    };

    return data.message || data.detail || data.error || `Error ${response.status}`;
  } catch {
    return `Error ${response.status}`;
  }
}

async function fetchJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "include",
    ...init,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as T;
}

export async function getChatBootstrapData(): Promise<ChatBootstrapData> {
  const data = await fetchJson<ChatBootstrapDataApiRecord>(CHAT_API_URL);

  return {
    conversaciones: data.conversaciones.map(toChatConversationSummary),
    usuarios: data.usuarios.map(toChatAvailableUser),
  };
}

export async function getChatUsers() {
  const data = await fetchJson<ChatAvailableUserApiRecord[]>(
    `${CHAT_API_URL}/usuarios`
  );
  return data.map(toChatAvailableUser);
}

export async function getChatConversations() {
  const data = await fetchJson<ChatConversationSummaryApiRecord[]>(
    `${CHAT_API_URL}/conversaciones`
  );
  return data.map(toChatConversationSummary);
}

export async function createChatConversation(
  payload: ChatConversationCreateInput
) {
  const data = await fetchJson<ChatConversationDetailApiRecord>(
    `${CHAT_API_URL}/conversaciones`,
    {
      body: JSON.stringify(payload),
      headers: JSON_HEADERS,
      method: "POST",
    }
  );

  return toChatConversationDetail(data);
}

export async function getChatConversationDetail(conversationId: string) {
  const data = await fetchJson<ChatConversationDetailApiRecord>(
    `${CHAT_API_URL}/conversaciones/${conversationId}`
  );

  return toChatConversationDetail(data);
}

export async function sendChatMessage(
  conversationId: string,
  payload: ChatMessageMutationInput
) {
  const data = await fetchJson<ChatMessageApiRecord>(
    `${CHAT_API_URL}/conversaciones/${conversationId}/mensajes`,
    {
      body: JSON.stringify(payload),
      headers: JSON_HEADERS,
      method: "POST",
    }
  );

  return toChatMessage(data);
}
