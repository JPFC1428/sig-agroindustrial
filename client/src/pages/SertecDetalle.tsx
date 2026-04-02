import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Download,
  Eye,
  FileText,
  Hammer,
  PackageCheck,
  Paperclip,
  Printer,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Link, useRoute } from "wouter";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  appendSertecAdjuntos,
  getSertecAdjuntoUrl,
  getSertecOrdenById,
  transitionSertecOrden,
  type SertecAdjuntoUpload,
} from "@/lib/sertec-api";
import { SertecOrdenEstado, type SertecOrden } from "@/lib/types";

const ALLOWED_ADJUNTO_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_ADJUNTO_FILE_SIZE = 5 * 1024 * 1024;

function formatDateTime(value: Date) {
  return value.toLocaleString("es-CO");
}

function getEstadoBadge(estado: SertecOrdenEstado) {
  const styles = {
    [SertecOrdenEstado.ENTRADA]: "bg-blue-100 text-blue-800",
    [SertecOrdenEstado.REPARACION]: "bg-amber-100 text-amber-800",
    [SertecOrdenEstado.SALIDA]: "bg-emerald-100 text-emerald-800",
  };

  return styles[estado];
}

function getHistorialLabel(movimiento: string) {
  switch (movimiento) {
    case "entrada":
      return "Entrada";
    case "reparacion":
      return "Reparacion";
    case "salida":
      return "Salida";
    case "adjunto":
      return "Adjunto";
    default:
      return movimiento;
  }
}

function openPrintView(pathname: string) {
  const popup = window.open(pathname, "_blank", "noopener,noreferrer");

  if (!popup) {
    window.location.href = pathname;
  }
}

async function readFileAsBase64(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";

  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index] ?? 0);
  }

  return window.btoa(binary);
}

async function buildAdjuntos(
  files: File[],
  descripcion?: string
): Promise<SertecAdjuntoUpload[]> {
  return Promise.all(
    files.map(async file => ({
      contentBase64: await readFileAsBase64(file),
      descripcion,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type as SertecAdjuntoUpload["mimeType"],
    }))
  );
}

export default function SertecDetalle() {
  const [match, params] = useRoute("/sertec/:id");
  const ordenId = params?.id;
  const [orden, setOrden] = useState<SertecOrden | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [procesandoEstado, setProcesandoEstado] = useState<
    "reparacion" | "salida" | null
  >(null);
  const [archivos, setArchivos] = useState<File[]>([]);
  const [descripcionAdjunto, setDescripcionAdjunto] = useState("");
  const [subiendoAdjuntos, setSubiendoAdjuntos] = useState(false);

  useEffect(() => {
    if (!match || !ordenId) {
      return;
    }

    let active = true;
    const currentOrdenId = ordenId;

    async function cargar() {
      setCargando(true);
      setError(null);

      try {
        const data = await getSertecOrdenById(currentOrdenId);

        if (!active) {
          return;
        }

        if (!data) {
          setOrden(null);
          setError("La orden SERTEC solicitada no existe");
          return;
        }

        setOrden(data);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setOrden(null);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudo cargar la orden SERTEC"
        );
      } finally {
        if (active) {
          setCargando(false);
        }
      }
    }

    void cargar();

    return () => {
      active = false;
    };
  }, [match, ordenId]);

  async function handleTransition(estado: "reparacion" | "salida") {
    if (!orden) {
      return;
    }

    const detalle = window.prompt("Detalle del movimiento (opcional)") ?? "";
    setProcesandoEstado(estado);
    setError(null);

    try {
      const updated = await transitionSertecOrden(orden.id, estado, {
        detalle: detalle.trim() || undefined,
      });

      setOrden(updated);
      toast.success(
        estado === "reparacion"
          ? "Orden enviada a reparacion"
          : "Orden registrada como salida"
      );
    } catch (transitionError) {
      const message =
        transitionError instanceof Error
          ? transitionError.message
          : "No se pudo actualizar la orden";

      setError(message);
      toast.error(message);
    } finally {
      setProcesandoEstado(null);
    }
  }

  async function handleAdjuntarArchivos() {
    if (!orden || archivos.length === 0) {
      return;
    }

    const archivoInvalido = archivos.find(
      file =>
        !ALLOWED_ADJUNTO_MIME_TYPES.has(file.type) ||
        file.size <= 0 ||
        file.size > MAX_ADJUNTO_FILE_SIZE
    );

    if (archivoInvalido) {
      const message =
        "Los adjuntos deben ser PDF, JPG, PNG o WEBP y no superar 5 MB";
      setError(message);
      toast.error(message);
      return;
    }

    setSubiendoAdjuntos(true);
    setError(null);

    try {
      const updated = await appendSertecAdjuntos(orden.id, {
        adjuntos: await buildAdjuntos(
          archivos,
          descripcionAdjunto.trim() || undefined
        ),
      });

      setOrden(updated);
      setArchivos([]);
      setDescripcionAdjunto("");
      toast.success("Adjuntos agregados a la orden");
    } catch (uploadError) {
      const message =
        uploadError instanceof Error
          ? uploadError.message
          : "No se pudieron adjuntar los archivos";

      setError(message);
      toast.error(message);
    } finally {
      setSubiendoAdjuntos(false);
    }
  }

  return (
    <DashboardLayout
      titulo={orden ? `SERTEC ${orden.numero}` : "Detalle SERTEC"}
      descripcion="Seguimiento completo de la orden de servicio tecnico"
      acciones={
        orden ? (
          <>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => openPrintView(`/sertec/${orden.id}/imprimir-entrada`)}
            >
              <Printer size={16} />
              Imprimir entrada
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              disabled={orden.estado !== SertecOrdenEstado.SALIDA}
              onClick={() => openPrintView(`/sertec/${orden.id}/imprimir-salida`)}
            >
              <Printer size={16} />
              Imprimir salida
            </Button>
            {orden.estado === SertecOrdenEstado.ENTRADA && (
              <Button
                onClick={() => void handleTransition("reparacion")}
                disabled={procesandoEstado !== null}
                className="gap-2"
              >
                <Hammer size={16} />
                {procesandoEstado === "reparacion"
                  ? "Procesando..."
                  : "Enviar a reparacion"}
              </Button>
            )}
            {orden.estado === SertecOrdenEstado.REPARACION && (
              <Button
                onClick={() => void handleTransition("salida")}
                disabled={procesandoEstado !== null}
                className="gap-2"
              >
                <PackageCheck size={16} />
                {procesandoEstado === "salida"
                  ? "Procesando..."
                  : "Registrar salida"}
              </Button>
            )}
          </>
        ) : null
      }
    >
      <div className="max-w-6xl space-y-6">
        <div>
          <Button asChild variant="outline" className="gap-2">
            <Link href="/sertec">
              <ArrowLeft size={16} />
              Volver a ordenes
            </Link>
          </Button>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {cargando ? (
          <div className="rounded-lg border border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground shadow-sm">
            Cargando orden SERTEC...
          </div>
        ) : !orden ? (
          <div className="rounded-lg border border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground shadow-sm">
            No se encontro la orden solicitada.
          </div>
        ) : (
          <>
            <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
              <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      Datos de la orden
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Cliente, equipo, garantia y estado actual
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${getEstadoBadge(
                      orden.estado
                    )}`}
                  >
                    {orden.estado.charAt(0).toUpperCase() + orden.estado.slice(1)}
                  </span>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Cliente relacionado
                    </p>
                    {orden.clienteId ? (
                      <Link href={`/clientes/${orden.clienteId}`}>
                        <p className="text-sm text-muted-foreground transition-smooth hover:opacity-80">
                          {orden.clienteNombre}
                        </p>
                      </Link>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {orden.clienteNombre}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Telefono</p>
                    <p className="text-sm text-muted-foreground">
                      {orden.clienteTelefono ?? "Sin telefono"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Documento</p>
                    <p className="text-sm text-muted-foreground">
                      {orden.clienteDocumento ?? "Sin documento"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Ingreso</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(orden.fechaIngreso)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Equipo</p>
                    <p className="text-sm text-muted-foreground">
                      {orden.equipoTipo}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Serie</p>
                    <p className="text-sm text-muted-foreground">
                      {orden.equipoSerial ?? "Sin serial"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Marca</p>
                    <p className="text-sm text-muted-foreground">
                      {orden.equipoMarca ?? "Sin marca"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Modelo</p>
                    <p className="text-sm text-muted-foreground">
                      {orden.equipoModelo ?? "Sin modelo"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Origen comercial
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {orden.cotizacionNumero
                        ? `Cotizacion ${orden.cotizacionNumero}`
                        : "Sin origen comercial"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Equipo vendido
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {orden.equipoVendidoDescripcion ?? "No asociado"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Garantia</p>
                    <p className="text-sm text-muted-foreground">
                      {orden.garantia?.aplica ? "Aplica" : "No aplica"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Fecha de venta
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {orden.garantia?.fechaVenta
                        ? formatDateTime(orden.garantia.fechaVenta)
                        : "Sin fecha de venta"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Garantia en meses
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {orden.garantia?.garantiaMeses ?? "Sin definir"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Vigencia</p>
                    <p className="text-sm text-muted-foreground">
                      {orden.garantia?.vigenteHasta
                        ? formatDateTime(orden.garantia.vigenteHasta)
                        : "Sin fecha de vigencia"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-semibold text-foreground">
                  Notas tecnicas
                </h2>
                <div className="space-y-4 text-sm">
                  <div>
                    <p className="font-medium text-foreground">Falla reportada</p>
                    <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                      {orden.fallaReportada}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Diagnostico</p>
                    <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                      {orden.diagnostico ?? "Sin diagnostico registrado"}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Trabajo realizado</p>
                    <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                      {orden.trabajoRealizado ?? "Sin trabajo registrado"}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Observaciones</p>
                    <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                      {orden.observaciones ?? "Sin observaciones"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr,1fr]">
              <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-semibold text-foreground">
                  Historial cronologico
                </h2>

                <div className="space-y-4">
                  {(orden.historial ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No hay movimientos registrados.
                    </p>
                  ) : (
                    orden.historial?.map(evento => (
                      <div
                        key={evento.id}
                        className="rounded-lg border border-border bg-accent/30 p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-foreground">
                            {getHistorialLabel(evento.movimiento)}
                          </p>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${getEstadoBadge(
                              evento.estado
                            )}`}
                          >
                            {evento.estado}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {evento.detalle ?? "Sin detalle adicional"}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {formatDateTime(evento.createdAt)}
                          {evento.usuarioNombre
                            ? ` | ${evento.usuarioNombre}`
                            : ""}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <Paperclip size={18} className="text-muted-foreground" />
                  <h2 className="text-lg font-semibold text-foreground">
                    Adjuntos
                  </h2>
                </div>

                <div className="mb-6 space-y-3 rounded-lg border border-border bg-accent/20 p-4">
                  <Input
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                    onChange={event =>
                      setArchivos(Array.from(event.target.files ?? []))
                    }
                  />
                  <Textarea
                    rows={3}
                    value={descripcionAdjunto}
                    onChange={event => setDescripcionAdjunto(event.target.value)}
                    placeholder="Descripcion opcional para los archivos adjuntos"
                  />
                  <div className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
                    {archivos.length === 0
                      ? "No hay archivos seleccionados."
                      : `${archivos.length} archivo(s): ${archivos
                          .map(file => file.name)
                          .join(", ")}`}
                  </div>
                  <div className="flex justify-end">
                    <Button
                      onClick={() => void handleAdjuntarArchivos()}
                      disabled={subiendoAdjuntos || archivos.length === 0}
                      className="gap-2"
                    >
                      <Upload size={16} />
                      {subiendoAdjuntos ? "Subiendo..." : "Adjuntar archivos"}
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  {(orden.adjuntos ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No hay adjuntos registrados para esta orden.
                    </p>
                  ) : (
                    orden.adjuntos?.map(adjunto => (
                      <div
                        key={adjunto.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border bg-accent/30 p-4"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <FileText size={16} className="text-muted-foreground" />
                            <p className="truncate text-sm font-medium text-foreground">
                              {adjunto.nombreArchivo}
                            </p>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatDateTime(adjunto.createdAt)}
                            {adjunto.usuarioNombre
                              ? ` | ${adjunto.usuarioNombre}`
                              : ""}
                          </p>
                          {adjunto.descripcion && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {adjunto.descripcion}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <a
                            href={getSertecAdjuntoUrl(orden.id, adjunto.id, "view")}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded p-2 text-muted-foreground transition-smooth hover:bg-background hover:text-foreground"
                            title="Ver adjunto"
                          >
                            <Eye size={18} />
                          </a>
                          <a
                            href={getSertecAdjuntoUrl(
                              orden.id,
                              adjunto.id,
                              "download"
                            )}
                            className="rounded p-2 text-muted-foreground transition-smooth hover:bg-background hover:text-foreground"
                            title="Descargar adjunto"
                          >
                            <Download size={18} />
                          </a>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
