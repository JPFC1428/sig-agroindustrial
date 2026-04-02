type CotizacionEmailAttachment = {
  contentBase64: string;
  contentType: string;
  fileName: string;
};

type SendCotizacionEmailInput = {
  attachment: CotizacionEmailAttachment;
  message: string;
  subject: string;
  to: string;
};

type CotizacionEmailProvider = "resend";

type SendCotizacionEmailResult = {
  messageId: string | null;
  provider: CotizacionEmailProvider;
};

type ResendEmailResponse = {
  error?: {
    message?: string;
    name?: string;
  };
  id?: string;
  message?: string;
  name?: string;
};

const RESEND_API_URL = "https://api.resend.com/emails";

export class CotizacionEmailConfigError extends Error {
  invalidSettings: string[];
  missingEnvVars: string[];
  provider: CotizacionEmailProvider;

  constructor(
    message: string,
    options?: {
      invalidSettings?: string[];
      missingEnvVars?: string[];
      provider?: CotizacionEmailProvider;
    }
  ) {
    super(message);
    this.name = "CotizacionEmailConfigError";
    this.invalidSettings = options?.invalidSettings ?? [];
    this.missingEnvVars = options?.missingEnvVars ?? [];
    this.provider = options?.provider ?? "resend";
  }
}

function readString(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isValidEmailAddress(value: string) {
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
}

function extractEmailAddress(value: string) {
  const matchedValue = value.match(/<([^<>]+)>$/)?.[1] ?? value;
  return matchedValue.trim();
}

function buildConfigErrorMessage(input: {
  invalidSettings: string[];
  missingEnvVars: string[];
  provider: CotizacionEmailProvider;
}) {
  const messages = [
    `Configuracion incompleta de correo saliente. Proveedor actual: ${input.provider === "resend" ? "Resend" : input.provider}.`,
  ];

  if (input.missingEnvVars.length > 0) {
    messages.push(
      `Faltan variables en el backend: ${input.missingEnvVars.join(", ")}.`
    );
  }

  if (input.invalidSettings.length > 0) {
    messages.push(...input.invalidSettings);
  }

  messages.push(
    'Configura EMAIL_FROM con un remitente valido y verificado en Resend, por ejemplo "SIG Agroindustrial <cotizaciones@tu-dominio.com>".'
  );

  return messages.join(" ");
}

function readCotizacionEmailConfig() {
  const provider: CotizacionEmailProvider = "resend";
  const apiKey = readString(process.env.RESEND_API_KEY);
  const from = readString(process.env.EMAIL_FROM);
  const replyTo = readString(process.env.EMAIL_REPLY_TO);
  const missingEnvVars: string[] = [];
  const invalidSettings: string[] = [];

  if (!apiKey) {
    missingEnvVars.push("RESEND_API_KEY");
  }

  if (!from) {
    missingEnvVars.push("EMAIL_FROM");
  } else {
    const fromAddress = extractEmailAddress(from);

    if (!isValidEmailAddress(fromAddress)) {
      invalidSettings.push(
        "EMAIL_FROM no tiene un formato valido de remitente."
      );
    }
  }

  if (replyTo && !isValidEmailAddress(replyTo)) {
    invalidSettings.push(
      "EMAIL_REPLY_TO debe ser un correo valido cuando se configure."
    );
  }

  if (missingEnvVars.length > 0 || invalidSettings.length > 0) {
    throw new CotizacionEmailConfigError(
      buildConfigErrorMessage({
        invalidSettings,
        missingEnvVars,
        provider,
      }),
      {
        invalidSettings,
        missingEnvVars,
        provider,
      }
    );
  }

  return {
    apiKey: apiKey as string,
    from: from as string,
    provider,
    ...(replyTo ? { replyTo } : {}),
  };
}

export function isCotizacionEmailConfigError(
  error: unknown
): error is CotizacionEmailConfigError {
  return error instanceof CotizacionEmailConfigError;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildHtmlMessage(message: string) {
  const safeMessage = escapeHtml(message).replace(/\r?\n/g, "<br />");

  return [
    "<div style=\"font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937;\">",
    `<p>${safeMessage}</p>`,
    "</div>",
  ].join("");
}

function getResendErrorMessage(
  payload: ResendEmailResponse | null,
  statusCode?: number
) {
  if (!payload) {
    return "No se pudo enviar el correo con Resend";
  }

  const baseMessage =
    readString(payload.error?.message) ||
    readString(payload.message) ||
    readString(payload.name) ||
    "No se pudo enviar el correo con Resend";

  if (statusCode === 401 || statusCode === 403) {
    return `${baseMessage}. Verifica RESEND_API_KEY y que EMAIL_FROM pertenezca a un remitente verificado en Resend`;
  }

  return baseMessage;
}

export function buildDefaultCotizacionEmailSubject(
  numero: string,
  clienteNombre?: string,
  clienteEmpresa?: string
) {
  const clienteLabel = clienteEmpresa || clienteNombre;

  return clienteLabel
    ? `Cotizacion ${numero} - ${clienteLabel}`
    : `Cotizacion ${numero}`;
}

export function buildDefaultCotizacionEmailMessage(input: {
  clienteNombre?: string;
  clienteEmpresa?: string;
  fecha?: Date | string;
  numero: string;
  usuarioNombre?: string;
}) {
  const fecha =
    input.fecha instanceof Date
      ? input.fecha
      : input.fecha
        ? new Date(input.fecha)
        : undefined;
  const clienteLabel =
    input.clienteNombre || input.clienteEmpresa || "cliente";
  const fechaLabel = fecha && !Number.isNaN(fecha.getTime())
    ? new Intl.DateTimeFormat("es-CO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(fecha)
    : undefined;

  const lines = [
    `Hola ${clienteLabel},`,
    "",
    fechaLabel
      ? `Adjuntamos la cotizacion ${input.numero}, generada el ${fechaLabel}.`
      : `Adjuntamos la cotizacion ${input.numero}.`,
    "Quedamos atentos a tus comentarios.",
    "",
    "Saludos,",
    input.usuarioNombre || "Equipo comercial",
  ];

  return lines.join("\n");
}

export async function sendCotizacionEmail(
  input: SendCotizacionEmailInput
): Promise<SendCotizacionEmailResult> {
  const config = readCotizacionEmailConfig();

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      attachments: [
        {
          content: input.attachment.contentBase64,
          filename: input.attachment.fileName,
        },
      ],
      from: config.from,
      ...(config.replyTo
        ? { replyTo: config.replyTo, reply_to: config.replyTo }
        : {}),
      html: buildHtmlMessage(input.message),
      subject: input.subject,
      text: input.message,
      to: [input.to],
    }),
  });

  let payload: ResendEmailResponse | null = null;

  try {
    payload = (await response.json()) as ResendEmailResponse;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(getResendErrorMessage(payload, response.status));
  }

  return {
    messageId: readString(payload?.id) ?? null,
    provider: config.provider,
  };
}
