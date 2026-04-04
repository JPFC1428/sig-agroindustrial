import { useEffect, useRef, useState } from "react";
import { MessageSquare, Plus, Send, Users } from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import {
  createChatConversation,
  getChatBootstrapData,
  getChatConversationDetail,
  sendChatMessage,
} from "@/lib/chat-api";
import type {
  ChatAvailableUser,
  ChatConversationDetail,
  ChatConversationSummary,
  ChatMessage,
} from "@/lib/types";

const USER_SELECT_PLACEHOLDER = "__placeholder__";

function formatDateTime(value: Date) {
  return value.toLocaleString("es-CO", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatShortDateTime(value: Date) {
  return value.toLocaleString("es-CO", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  });
}

function getConversationSortValue(conversation: ChatConversationSummary) {
  return (
    conversation.ultimoMensaje?.creadoEn.getTime() ?? conversation.creadoEn.getTime()
  );
}

function sortConversations(conversations: ChatConversationSummary[]) {
  return [...conversations].sort(
    (left, right) => getConversationSortValue(right) - getConversationSortValue(left)
  );
}

function toConversationSummary(
  conversation: ChatConversationDetail
): ChatConversationSummary {
  const { mensajes: _mensajes, ...summary } = conversation;
  return summary;
}

function MessageBubble({
  currentUserId,
  message,
}: {
  currentUserId?: string;
  message: ChatMessage;
}) {
  const isOwn = currentUserId === message.usuarioId;

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
          isOwn
            ? "bg-primary text-primary-foreground"
            : "border border-border bg-card text-card-foreground"
        }`}
      >
        {!isOwn && (
          <p className="mb-1 text-xs font-semibold text-muted-foreground">
            {message.usuarioNombre}
          </p>
        )}
        <p className="whitespace-pre-wrap text-sm leading-6">{message.contenido}</p>
        <p
          className={`mt-2 text-[11px] ${
            isOwn ? "text-primary-foreground/80" : "text-muted-foreground"
          }`}
        >
          {formatDateTime(message.creadoEn)}
        </p>
      </div>
    </div>
  );
}

function ConversationListItem({
  active,
  conversation,
  onClick,
}: {
  active: boolean;
  conversation: ChatConversationSummary;
  onClick: () => void;
}) {
  const counterpart = conversation.otroUsuario;
  const preview = conversation.ultimoMensaje?.contenido || "Sin mensajes aun";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-lg border px-4 py-3 text-left transition-smooth ${
        active
          ? "border-primary/30 bg-primary/5"
          : "border-border bg-background hover:bg-accent"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {counterpart?.nombre ?? "Conversacion directa"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {counterpart?.email ?? "Participante no disponible"}
          </p>
        </div>
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {formatShortDateTime(
            conversation.ultimoMensaje?.creadoEn ?? conversation.creadoEn
          )}
        </span>
      </div>

      <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{preview}</p>

      <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{conversation.totalMensajes} mensaje(s)</span>
        <span>{counterpart?.rol ?? "usuario"}</span>
      </div>
    </button>
  );
}

export default function ChatInterno() {
  const { user } = useAuth();
  const [conversaciones, setConversaciones] = useState<ChatConversationSummary[]>(
    []
  );
  const [usuarios, setUsuarios] = useState<ChatAvailableUser[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [selectedConversation, setSelectedConversation] =
    useState<ChatConversationDetail | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const [loadingPanel, setLoadingPanel] = useState(true);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedConversationIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  async function loadBootstrap(showLoader = false) {
    if (showLoader) {
      setLoadingPanel(true);
    }

    try {
      const data = await getChatBootstrapData();

      setConversaciones(sortConversations(data.conversaciones));
      setUsuarios(data.usuarios);
      setSelectedConversationId(currentSelected => {
        if (
          currentSelected &&
          data.conversaciones.some(conversation => conversation.id === currentSelected)
        ) {
          return currentSelected;
        }

        return data.conversaciones[0]?.id ?? null;
      });
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudo cargar el chat interno"
      );
    } finally {
      if (showLoader) {
        setLoadingPanel(false);
      }
    }
  }

  async function loadConversationDetail(
    conversationId: string,
    showLoader = false
  ) {
    if (showLoader) {
      setLoadingConversation(true);
    }

    try {
      const detail = await getChatConversationDetail(conversationId);

      if (selectedConversationIdRef.current !== conversationId) {
        return;
      }

      setSelectedConversation(detail);
      setConversaciones(current =>
        sortConversations(
          current.map(conversation =>
            conversation.id === detail.id
              ? toConversationSummary(detail)
              : conversation
          )
        )
      );
      setError(null);
    } catch (loadError) {
      if (selectedConversationIdRef.current !== conversationId) {
        return;
      }

      setSelectedConversation(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudo cargar la conversacion"
      );
    } finally {
      if (showLoader && selectedConversationIdRef.current === conversationId) {
        setLoadingConversation(false);
      }
    }
  }

  useEffect(() => {
    void loadBootstrap(true);

    const intervalId = window.setInterval(() => {
      void loadBootstrap(false);
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!selectedConversationId) {
      setSelectedConversation(null);
      setLoadingConversation(false);
      return;
    }

    void loadConversationDetail(selectedConversationId, true);

    const intervalId = window.setInterval(() => {
      void loadConversationDetail(selectedConversationId, false);
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [selectedConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedConversation?.mensajes.length]);

  async function handleCreateConversation() {
    if (!selectedUserId) {
      return;
    }

    setCreatingConversation(true);
    setError(null);

    try {
      const detail = await createChatConversation({ usuarioId: selectedUserId });

      setSelectedConversation(detail);
      setSelectedConversationId(detail.id);
      setSelectedUserId("");
      setConversaciones(current =>
        sortConversations([
          toConversationSummary(detail),
          ...current.filter(conversation => conversation.id !== detail.id),
        ])
      );
      await loadBootstrap(false);
    } catch (createError) {
      const message =
        createError instanceof Error
          ? createError.message
          : "No se pudo abrir la conversacion";

      setError(message);
      toast.error(message);
    } finally {
      setCreatingConversation(false);
    }
  }

  async function handleSendMessage() {
    if (!selectedConversationId || !draftMessage.trim()) {
      return;
    }

    setSendingMessage(true);
    setError(null);

    try {
      const createdMessage = await sendChatMessage(selectedConversationId, {
        contenido: draftMessage.trim(),
      });

      setDraftMessage("");
      setSelectedConversation(currentConversation => {
        if (!currentConversation || currentConversation.id !== selectedConversationId) {
          return currentConversation;
        }

        return {
          ...currentConversation,
          mensajes: [...currentConversation.mensajes, createdMessage],
          totalMensajes: currentConversation.totalMensajes + 1,
          ultimoMensaje: createdMessage,
        };
      });
      setConversaciones(current =>
        sortConversations(
          current.map(conversation =>
            conversation.id === selectedConversationId
              ? {
                  ...conversation,
                  totalMensajes: conversation.totalMensajes + 1,
                  ultimoMensaje: createdMessage,
                }
              : conversation
          )
        )
      );
      await loadBootstrap(false);
    } catch (sendError) {
      const message =
        sendError instanceof Error
          ? sendError.message
          : "No se pudo enviar el mensaje";

      setError(message);
      toast.error(message);
    } finally {
      setSendingMessage(false);
    }
  }

  const currentConversationCounterpart = selectedConversation?.otroUsuario;

  return (
    <DashboardLayout
      titulo="Chat Interno"
      descripcion="Mensajeria interna simple entre usuarios con refresco automatico por polling"
      acciones={
        <div className="text-xs text-muted-foreground">
          Conversaciones cada 5s | detalle cada 3s
        </div>
      }
    >
      {error && (
        <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid h-[calc(100vh-11.5rem)] gap-6 xl:grid-cols-[340px,1fr]">
        <section className="flex min-h-0 flex-col rounded-lg border border-border bg-card shadow-sm">
          <div className="border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <MessageSquare size={18} className="text-primary" />
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Conversaciones
                </h2>
                <p className="text-xs text-muted-foreground">
                  Inicia chats directos con otros usuarios activos
                </p>
              </div>
            </div>
          </div>

          <div className="border-b border-border px-5 py-4">
            <div className="space-y-3">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Nueva conversacion
                </p>
                <Select
                  value={selectedUserId || USER_SELECT_PLACEHOLDER}
                  onValueChange={value =>
                    setSelectedUserId(
                      value === USER_SELECT_PLACEHOLDER ? "" : value
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un usuario" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={USER_SELECT_PLACEHOLDER} disabled>
                      Selecciona un usuario
                    </SelectItem>
                    {usuarios.map(usuario => (
                      <SelectItem key={usuario.id} value={usuario.id}>
                        {usuario.nombre} | {usuario.rol}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="button"
                onClick={() => void handleCreateConversation()}
                disabled={
                  creatingConversation || !selectedUserId || usuarios.length === 0
                }
                className="w-full"
              >
                <Plus size={16} className="mr-2" />
                {creatingConversation ? "Abriendo..." : "Abrir conversacion"}
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {loadingPanel ? (
              <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                Cargando conversaciones...
              </div>
            ) : conversaciones.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                Aun no tienes conversaciones activas. Selecciona un usuario para
                iniciar el primer chat.
              </div>
            ) : (
              <div className="space-y-3">
                {conversaciones.map(conversation => (
                  <ConversationListItem
                    key={conversation.id}
                    active={conversation.id === selectedConversationId}
                    conversation={conversation}
                    onClick={() => setSelectedConversationId(conversation.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="flex min-h-0 flex-col rounded-lg border border-border bg-card shadow-sm">
          <div className="border-b border-border px-6 py-4">
            {selectedConversation ? (
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {currentConversationCounterpart?.nombre ?? "Conversacion"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {currentConversationCounterpart?.email ?? "Participante no disponible"}
                  </p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>{selectedConversation.totalMensajes} mensaje(s)</p>
                  <p>
                    Actualizado{" "}
                    {formatShortDateTime(
                      selectedConversation.ultimoMensaje?.creadoEn ??
                        selectedConversation.creadoEn
                    )}
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Selecciona una conversacion
                </h2>
                <p className="text-sm text-muted-foreground">
                  El historial aparecera aqui y se refrescara automaticamente
                </p>
              </div>
            )}
          </div>

          {selectedConversation ? (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto bg-muted/20 px-6 py-6">
                {loadingConversation && selectedConversation.mensajes.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border bg-background px-4 py-8 text-center text-sm text-muted-foreground">
                    Cargando historial...
                  </div>
                ) : selectedConversation.mensajes.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border bg-background px-4 py-8 text-center text-sm text-muted-foreground">
                    Esta conversacion aun no tiene mensajes. Escribe el primero.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {selectedConversation.mensajes.map(message => (
                      <MessageBubble
                        key={message.id}
                        currentUserId={user?.id}
                        message={message}
                      />
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              <div className="border-t border-border px-6 py-5">
                <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Users size={14} />
                  <span>
                    Participantes:{" "}
                    {selectedConversation.participantes
                      .map(participant => participant.nombre)
                      .join(", ")}
                  </span>
                </div>

                <div className="grid gap-3">
                  <Textarea
                    value={draftMessage}
                    onChange={event => setDraftMessage(event.target.value)}
                    onKeyDown={event => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();

                        if (!sendingMessage && draftMessage.trim()) {
                          void handleSendMessage();
                        }
                      }
                    }}
                    placeholder="Escribe un mensaje..."
                    className="min-h-24 resize-none"
                  />

                  <div className="flex items-center justify-between gap-4">
                    <p className="text-xs text-muted-foreground">
                      Enter envia. Shift + Enter crea una nueva linea.
                    </p>
                    <Button
                      type="button"
                      onClick={() => void handleSendMessage()}
                      disabled={sendingMessage || !draftMessage.trim()}
                    >
                      <Send size={16} className="mr-2" />
                      {sendingMessage ? "Enviando..." : "Enviar"}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center px-6">
              {selectedConversationId && loadingConversation ? (
                <div className="max-w-md rounded-lg border border-dashed border-border bg-background px-6 py-10 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <MessageSquare size={22} />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">
                    Cargando conversacion
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Recuperando historial y participantes...
                  </p>
                </div>
              ) : (
                <div className="max-w-md rounded-lg border border-dashed border-border bg-background px-6 py-10 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <MessageSquare size={22} />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">
                    Chat listo para uso interno
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    La fase 1 queda enfocada en mensajes directos entre usuarios.
                    La base ya queda preparada para tipos de mensaje y archivos.
                  </p>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
