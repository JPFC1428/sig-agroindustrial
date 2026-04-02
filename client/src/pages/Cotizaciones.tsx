import { useEffect, useMemo, useState } from "react";
import {
  Download,
  Edit,
  Mail,
  MessageCircle,
  Plus,
  Printer,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import { DashboardLayout } from "@/components/DashboardLayout";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import {
  deleteCotizacion,
  downloadCotizacionExcel,
  getCotizaciones,
  prepareCotizacionWhatsapp,
  sendCotizacionByEmail,
} from "@/lib/cotizaciones-api";
import { CotizacionEstado, type Cotizacion } from "@/lib/types";

function formatMoney(value: number, moneda: Cotizacion["moneda"]) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: moneda,
    maximumFractionDigits: 0,
  }).format(value);
}

function buildDefaultEmailSubject(cotizacion: Cotizacion) {
  const clienteLabel = cotizacion.clienteEmpresa ?? cotizacion.clienteNombre;

  return clienteLabel
    ? `Cotizacion ${cotizacion.numero} - ${clienteLabel}`
    : `Cotizacion ${cotizacion.numero}`;
}

function buildDefaultEmailMessage(
  cotizacion: Cotizacion,
  usuarioNombre?: string
) {
  const clienteLabel =
    cotizacion.clienteNombre ?? cotizacion.clienteEmpresa ?? "cliente";
  const fecha = cotizacion.fecha.toLocaleDateString("es-CO");

  return [
    `Hola ${clienteLabel},`,
    "",
    `Adjuntamos la cotizacion ${cotizacion.numero}, generada el ${fecha}.`,
    "Quedamos atentos a tus comentarios.",
    "",
    "Saludos,",
    usuarioNombre ?? "Equipo comercial",
  ].join("\n");
}

function openPrintView(cotizacionId: string) {
  const printUrl = `/cotizaciones/${cotizacionId}/imprimir`;
  const popup = window.open(printUrl, "_blank", "noopener,noreferrer");

  if (!popup) {
    window.location.href = printUrl;
  }
}

export default function Cotizaciones() {
  const { user } = useAuth();
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<CotizacionEstado | "todos">(
    "todos"
  );
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [descargandoId, setDescargandoId] = useState<string | null>(null);
  const [enviandoId, setEnviandoId] = useState<string | null>(null);
  const [preparandoWhatsappId, setPreparandoWhatsappId] = useState<
    string | null
  >(null);
  const [cotizacionEnviar, setCotizacionEnviar] = useState<Cotizacion | null>(
    null
  );
  const [destinatarioEnvio, setDestinatarioEnvio] = useState("");
  const [asuntoEnvio, setAsuntoEnvio] = useState("");
  const [mensajeEnvio, setMensajeEnvio] = useState("");
  const itemsPorPagina = 10;

  useEffect(() => {
    let activo = true;

    async function cargar() {
      setCargando(true);
      setError(null);

      try {
        const data = await getCotizaciones();

        if (!activo) {
          return;
        }

        setCotizaciones(data);
      } catch (loadError) {
        if (!activo) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudieron cargar las cotizaciones"
        );
      } finally {
        if (activo) {
          setCargando(false);
        }
      }
    }

    void cargar();

    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    setPagina(1);
  }, [busqueda, filtroEstado]);

  const cotizacionesFiltradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();

    return cotizaciones.filter(cotizacion => {
      const coincideBusqueda =
        termino === "" ||
        [
          cotizacion.numero,
          cotizacion.clienteNombre ?? "",
          cotizacion.clienteEmpresa ?? "",
        ].some(valor => valor.toLowerCase().includes(termino));

      const coincideEstado =
        filtroEstado === "todos" || cotizacion.estado === filtroEstado;

      return coincideBusqueda && coincideEstado;
    });
  }, [cotizaciones, busqueda, filtroEstado]);

  const totalPaginas = Math.max(
    1,
    Math.ceil(cotizacionesFiltradas.length / itemsPorPagina)
  );

  useEffect(() => {
    setPagina(actual => Math.min(Math.max(actual, 1), totalPaginas));
  }, [totalPaginas]);

  const cotizacionesPaginadas = cotizacionesFiltradas.slice(
    (pagina - 1) * itemsPorPagina,
    pagina * itemsPorPagina
  );

  const desde =
    cotizacionesFiltradas.length === 0
      ? 0
      : (pagina - 1) * itemsPorPagina + 1;
  const hasta =
    cotizacionesFiltradas.length === 0
      ? 0
      : Math.min(pagina * itemsPorPagina, cotizacionesFiltradas.length);

  const estados = Object.values(CotizacionEstado);

  const getEstadoBadge = (estado: CotizacionEstado) => {
    const estilos = {
      [CotizacionEstado.BORRADOR]: "bg-gray-100 text-gray-800",
      [CotizacionEstado.ENVIADA]: "bg-blue-100 text-blue-800",
      [CotizacionEstado.APROBADA]: "bg-green-100 text-green-800",
      [CotizacionEstado.RECHAZADA]: "bg-red-100 text-red-800",
    };

    return estilos[estado];
  };

  function abrirDialogoEnvio(cotizacion: Cotizacion) {
    setCotizacionEnviar(cotizacion);
    setDestinatarioEnvio(cotizacion.clienteEmail ?? "");
    setAsuntoEnvio(buildDefaultEmailSubject(cotizacion));
    setMensajeEnvio(buildDefaultEmailMessage(cotizacion, user?.nombre));
  }

  function cerrarDialogoEnvio(force = false) {
    if (enviandoId && !force) {
      return;
    }

    setCotizacionEnviar(null);
    setDestinatarioEnvio("");
    setAsuntoEnvio("");
    setMensajeEnvio("");
  }

  async function handleEliminar(cotizacion: Cotizacion) {
    const confirmado = window.confirm(
      `¿Eliminar la cotizacion "${cotizacion.numero}"?`
    );

    if (!confirmado) {
      return;
    }

    setEliminandoId(cotizacion.id);
    setError(null);

    try {
      await deleteCotizacion(cotizacion.id);
      const data = await getCotizaciones();
      setCotizaciones(data);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "No se pudo eliminar la cotizacion"
      );
    } finally {
      setEliminandoId(null);
    }
  }

  async function handleDescargar(cotizacion: Cotizacion) {
    setDescargandoId(cotizacion.id);
    setError(null);

    try {
      await downloadCotizacionExcel(cotizacion.id);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "No se pudo descargar la cotizacion"
      );
    } finally {
      setDescargandoId(null);
    }
  }

  async function handleEnviarCorreo() {
    if (!cotizacionEnviar) {
      return;
    }

    setEnviandoId(cotizacionEnviar.id);
    setError(null);

    try {
      const result = await sendCotizacionByEmail(cotizacionEnviar.id, {
        asunto: asuntoEnvio,
        destinatario: destinatarioEnvio,
        mensaje: mensajeEnvio,
      });

      setCotizaciones(current =>
        current.map(cotizacion =>
          cotizacion.id === result.cotizacion.id ? result.cotizacion : cotizacion
        )
      );

      toast.success("Cotizacion enviada por correo");
      cerrarDialogoEnvio(true);
    } catch (sendError) {
      const message =
        sendError instanceof Error
          ? sendError.message
          : "No se pudo enviar la cotizacion por correo";

      setError(message);
      toast.error(message);
    } finally {
      setEnviandoId(null);
    }
  }

  async function handleEnviarWhatsapp(cotizacion: Cotizacion) {
    setPreparandoWhatsappId(cotizacion.id);
    setError(null);

    try {
      const result = await prepareCotizacionWhatsapp(cotizacion.id);
      const popup = window.open(
        result.whatsapp.urlWhatsapp,
        "_blank",
        "noopener,noreferrer"
      );

      if (!popup) {
        window.location.href = result.whatsapp.urlWhatsapp;
      }

      toast.success("Mensaje preparado en WhatsApp");
    } catch (whatsappError) {
      const message =
        whatsappError instanceof Error
          ? whatsappError.message
          : "No se pudo preparar el envio por WhatsApp";

      setError(message);
      toast.error(message);
    } finally {
      setPreparandoWhatsappId(null);
    }
  }

  return (
    <DashboardLayout
      titulo="Cotizaciones"
      descripcion="Gestion de cotizaciones comerciales asociadas a clientes"
      acciones={
        <Button asChild className="gap-2">
          <Link href="/cotizaciones/nuevo">
            <Plus size={18} />
            Nueva Cotizacion
          </Link>
        </Button>
      }
    >
      <div className="bg-card rounded-lg border border-border p-6 mb-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-3 text-muted-foreground"
            />
            <Input
              placeholder="Buscar cotizacion..."
              value={busqueda}
              onChange={event => setBusqueda(event.target.value)}
              className="pl-10"
            />
          </div>

          <Select
            value={filtroEstado}
            onValueChange={value =>
              setFiltroEstado(value as CotizacionEstado | "todos")
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              {estados.map(estado => (
                <SelectItem key={estado} value={estado}>
                  {estado.charAt(0).toUpperCase() + estado.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center justify-end text-sm text-muted-foreground">
            {cargando
              ? "Cargando cotizaciones..."
              : `${cotizacionesFiltradas.length} cotizacion${
                  cotizacionesFiltradas.length !== 1 ? "es" : ""
                }`}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive rounded-lg border border-destructive/20 px-4 py-3 mb-6 text-sm">
          {error}
        </div>
      )}

      <Dialog
        open={cotizacionEnviar !== null}
        onOpenChange={open => {
          if (!open) {
            cerrarDialogoEnvio();
          }
        }}
      >
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Enviar cotizacion por correo</DialogTitle>
            <DialogDescription>
              {cotizacionEnviar
                ? `Se enviara ${cotizacionEnviar.numero} al cliente asociado y se adjuntara el archivo Excel generado desde la plantilla actual.`
                : "Configura el destinatario y el mensaje del correo."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cotizacion-destinatario">Destinatario</Label>
              <Input
                id="cotizacion-destinatario"
                type="email"
                value={destinatarioEnvio}
                onChange={event => setDestinatarioEnvio(event.target.value)}
                placeholder="cliente@empresa.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cotizacion-asunto">Asunto</Label>
              <Input
                id="cotizacion-asunto"
                value={asuntoEnvio}
                onChange={event => setAsuntoEnvio(event.target.value)}
                placeholder="Asunto del correo"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cotizacion-mensaje">Mensaje</Label>
              <Textarea
                id="cotizacion-mensaje"
                value={mensajeEnvio}
                onChange={event => setMensajeEnvio(event.target.value)}
                placeholder="Escribe el mensaje que acompanara la cotizacion"
                rows={8}
              />
            </div>

            <div className="rounded-lg border border-border bg-accent/40 px-3 py-2 text-sm text-muted-foreground">
              Adjunto incluido: archivo Excel generado desde la plantilla de cotizacion.
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => cerrarDialogoEnvio()}
              disabled={enviandoId === cotizacionEnviar?.id}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => void handleEnviarCorreo()}
              disabled={enviandoId === cotizacionEnviar?.id}
              className="gap-2"
            >
              <Mail size={16} />
              {enviandoId === cotizacionEnviar?.id ? "Enviando..." : "Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="bg-card rounded-lg border border-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-accent">
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Numero
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Cliente
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Fecha
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Total
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Estado
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Vencimiento
                </th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-foreground">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-10 text-center text-sm text-muted-foreground"
                  >
                    Cargando cotizaciones...
                  </td>
                </tr>
              ) : cotizacionesPaginadas.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-10 text-center text-sm text-muted-foreground"
                  >
                    No se encontraron cotizaciones
                  </td>
                </tr>
              ) : (
                cotizacionesPaginadas.map((cotizacion, index) => (
                  <tr
                    key={cotizacion.id}
                    className={`border-b border-border transition-smooth hover:bg-accent ${
                      index % 2 === 0 ? "bg-background" : "bg-accent/50"
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-foreground">
                          {cotizacion.numero}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {cotizacion.lineas.length} linea
                          {cotizacion.lineas.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {cotizacion.clienteId ? (
                        <Link href={`/clientes/${cotizacion.clienteId}`}>
                          <div className="transition-smooth hover:opacity-80">
                            <p className="text-sm font-medium text-foreground">
                              {cotizacion.clienteNombre ?? "Cliente sin nombre"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {cotizacion.clienteEmpresa ?? "Sin empresa"}
                            </p>
                          </div>
                        </Link>
                      ) : (
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {cotizacion.clienteNombre ?? "Cliente sin nombre"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {cotizacion.clienteEmpresa ?? "Sin empresa"}
                          </p>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      {cotizacion.fecha.toLocaleDateString("es-CO")}
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-foreground">
                        {formatMoney(cotizacion.total, cotizacion.moneda)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Subtotal {formatMoney(cotizacion.subtotal, cotizacion.moneda)}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${getEstadoBadge(
                          cotizacion.estado
                        )}`}
                      >
                        {cotizacion.estado.charAt(0).toUpperCase() +
                          cotizacion.estado.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      {cotizacion.fechaVencimiento.toLocaleDateString("es-CO")}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          className="p-2 hover:bg-background rounded transition-smooth text-muted-foreground hover:text-foreground disabled:opacity-50"
                          onClick={() => void handleDescargar(cotizacion)}
                          disabled={descargandoId === cotizacion.id}
                          title="Descargar Excel"
                        >
                          <Download size={18} />
                        </button>
                        <button
                          className="p-2 hover:bg-background rounded transition-smooth text-muted-foreground hover:text-foreground disabled:opacity-50"
                          onClick={() => abrirDialogoEnvio(cotizacion)}
                          disabled={enviandoId === cotizacion.id}
                          title="Enviar por correo"
                        >
                          <Mail size={18} />
                        </button>
                        <button
                          className="p-2 hover:bg-background rounded transition-smooth text-muted-foreground hover:text-foreground disabled:opacity-50"
                          onClick={() => void handleEnviarWhatsapp(cotizacion)}
                          disabled={preparandoWhatsappId === cotizacion.id}
                          title="Enviar por WhatsApp"
                        >
                          <MessageCircle size={18} />
                        </button>
                        <button
                          className="p-2 hover:bg-background rounded transition-smooth text-muted-foreground hover:text-foreground"
                          onClick={() => openPrintView(cotizacion.id)}
                          title="Imprimir"
                          type="button"
                        >
                          <Printer size={18} />
                        </button>
                        <Link
                          href={`/cotizaciones/${cotizacion.id}/editar`}
                          className="p-2 hover:bg-background rounded transition-smooth text-muted-foreground hover:text-foreground"
                        >
                          <Edit size={18} />
                        </Link>
                        <button
                          className="p-2 hover:bg-background rounded transition-smooth text-muted-foreground hover:text-destructive disabled:opacity-50"
                          onClick={() => void handleEliminar(cotizacion)}
                          disabled={eliminandoId === cotizacion.id}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 border-t border-border flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {desde} a {hasta} de {cotizacionesFiltradas.length}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPagina(actual => Math.max(1, actual - 1))}
              disabled={pagina === 1}
            >
              Anterior
            </Button>
            <span className="flex items-center px-3 text-sm text-foreground">
              Pagina {pagina} de {totalPaginas}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setPagina(actual => Math.min(totalPaginas, actual + 1))
              }
              disabled={
                pagina === totalPaginas || cotizacionesFiltradas.length === 0
              }
            >
              Siguiente
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
