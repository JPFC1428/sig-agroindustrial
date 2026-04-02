import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Download,
  Edit,
  Eye,
  Paperclip,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Link, useRoute } from "wouter";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  createVisitaViatico,
  deleteVisitaViatico,
  downloadVisitaViaticosExcel,
  downloadVisitaViaticosPdf,
  getVisitaById,
  getVisitaViaticoSupportUrl,
  updateVisitaViatico,
  type VisitaViaticoMutationInput,
} from "@/lib/visitas-api";
import {
  ViaticoTipoGasto,
  type ResumenViaticosVisita,
  type Visita,
  type VisitaViatico,
  type VisitaViaticoSoporteUpload,
} from "@/lib/types";

type ViaticoFormValues = {
  descripcion: string;
  fecha: string;
  observaciones: string;
  removeSoporte: boolean;
  soporteArchivo: File | null;
  tipoGasto: ViaticoTipoGasto;
  valor: string;
};

type ViaticoFormErrors = Partial<
  Record<"tipoGasto" | "fecha" | "valor" | "descripcion" | "soporte", string>
>;

const ALLOWED_SUPPORT_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MAX_SUPPORT_FILE_SIZE = 2.5 * 1024 * 1024;

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toIsoDateFromInput(value: string) {
  return `${value}T12:00:00.000Z`;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function buildEmptyResumen(): ResumenViaticosVisita {
  return {
    alimentacion: 0,
    estadia: 0,
    gasolina: 0,
    peajes: 0,
    totalGeneral: 0,
  };
}

function buildInitialForm(visita: Visita): ViaticoFormValues {
  return {
    descripcion: "",
    fecha: toDateInputValue(visita.fecha),
    observaciones: "",
    removeSoporte: false,
    soporteArchivo: null,
    tipoGasto: ViaticoTipoGasto.PEAJES,
    valor: "",
  };
}

function toFormValues(viatico: VisitaViatico): ViaticoFormValues {
  return {
    descripcion: viatico.descripcion,
    fecha: toDateInputValue(viatico.fecha),
    observaciones: viatico.observaciones ?? "",
    removeSoporte: false,
    soporteArchivo: null,
    tipoGasto: viatico.tipoGasto,
    valor: String(viatico.valor),
  };
}

function validateForm(values: ViaticoFormValues) {
  const errors: ViaticoFormErrors = {};

  if (!values.tipoGasto) {
    errors.tipoGasto = "Selecciona un tipo de gasto";
  }

  if (!values.fecha) {
    errors.fecha = "La fecha es obligatoria";
  }

  const valor = Number(values.valor);
  if (!values.valor.trim() || !Number.isFinite(valor) || valor <= 0) {
    errors.valor = "El valor debe ser mayor a cero";
  }

  if (!values.descripcion.trim()) {
    errors.descripcion = "La descripcion es obligatoria";
  }

  if (values.soporteArchivo) {
    if (!ALLOWED_SUPPORT_MIME_TYPES.has(values.soporteArchivo.type)) {
      errors.soporte = "El soporte debe ser PDF, JPG, JPEG, PNG o WEBP";
    } else if (values.soporteArchivo.size > MAX_SUPPORT_FILE_SIZE) {
      errors.soporte = "El soporte no puede superar 2.5 MB";
    }
  }

  return errors;
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

async function buildPayload(
  values: ViaticoFormValues
): Promise<VisitaViaticoMutationInput> {
  const payload: VisitaViaticoMutationInput = {
    tipoGasto: values.tipoGasto,
    fecha: toIsoDateFromInput(values.fecha),
    valor: Number(values.valor),
    descripcion: values.descripcion.trim(),
    observaciones: values.observaciones.trim() || undefined,
  };

  if (values.removeSoporte) {
    payload.removeSoporte = true;
  }

  if (values.soporteArchivo) {
    payload.soporte = {
      contentBase64: await readFileAsBase64(values.soporteArchivo),
      fileName: values.soporteArchivo.name,
      fileSize: values.soporteArchivo.size,
      mimeType: values.soporteArchivo.type as VisitaViaticoSoporteUpload["mimeType"],
    };
    payload.removeSoporte = false;
  }

  return payload;
}

function getTipoLabel(tipo: ViaticoTipoGasto) {
  return tipo.charAt(0).toUpperCase() + tipo.slice(1);
}

function openSupportInNewTab(url: string) {
  const popup = window.open(url, "_blank", "noopener,noreferrer");

  if (!popup) {
    window.location.assign(url);
  }
}

export default function VisitaDetalle() {
  const [match, params] = useRoute("/visitas/:id");
  const visitaId = params?.id;
  const [visita, setVisita] = useState<Visita | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [exportandoFormato, setExportandoFormato] = useState<"excel" | "pdf" | null>(
    null
  );
  const [viaticoEditando, setViaticoEditando] = useState<VisitaViatico | null>(
    null
  );
  const [form, setForm] = useState<ViaticoFormValues | null>(null);
  const [formErrors, setFormErrors] = useState<ViaticoFormErrors>({});

  useEffect(() => {
    if (!match || !visitaId) {
      return;
    }

    const currentVisitaId = visitaId;
    let activo = true;

    async function cargar() {
      setCargando(true);
      setError(null);

      try {
        const data = await getVisitaById(currentVisitaId);

        if (!activo) {
          return;
        }

        if (!data) {
          setVisita(null);
          setError("La visita solicitada no existe");
          return;
        }

        setVisita(data);
      } catch (loadError) {
        if (!activo) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudo cargar el detalle de la visita"
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
  }, [match, visitaId]);

  if (!match) {
    return null;
  }

  const resumen = visita?.resumenViaticos ?? buildEmptyResumen();
  const viaticos = visita?.viaticos ?? [];

  function abrirNuevoViatico() {
    if (!visita) {
      return;
    }

    setViaticoEditando(null);
    setForm(buildInitialForm(visita));
    setFormErrors({});
    setDialogoAbierto(true);
  }

  function abrirEditarViatico(viatico: VisitaViatico) {
    setViaticoEditando(viatico);
    setForm(toFormValues(viatico));
    setFormErrors({});
    setDialogoAbierto(true);
  }

  function cerrarDialogo() {
    if (guardando) {
      return;
    }

    setDialogoAbierto(false);
    setViaticoEditando(null);
    setForm(null);
    setFormErrors({});
  }

  function updateField<K extends keyof ViaticoFormValues>(
    field: K,
    value: ViaticoFormValues[K]
  ) {
    setForm(current => (current ? { ...current, [field]: value } : current));
    setFormErrors(current => {
      const next = { ...current };
      delete next[field as keyof ViaticoFormErrors];
      return next;
    });
  }

  function handleSupportFileChange(file: File | null) {
    setForm(current =>
      current
        ? {
            ...current,
            removeSoporte: file ? false : current.removeSoporte,
            soporteArchivo: file,
          }
        : current
    );
    setFormErrors(current => {
      const next = { ...current };
      delete next.soporte;
      return next;
    });
  }

  async function handleGuardarViatico() {
    if (!visita || !form) {
      return;
    }

    const validationErrors = validateForm(form);
    setFormErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setGuardando(true);
    setError(null);

    try {
      const payload = await buildPayload(form);
      const updatedVisita = viaticoEditando
        ? await updateVisitaViatico(visita.id, viaticoEditando.id, payload)
        : await createVisitaViatico(visita.id, payload);

      setVisita(updatedVisita);
      toast.success(
        viaticoEditando ? "Viatico actualizado" : "Viatico registrado"
      );
      cerrarDialogo();
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "No se pudo guardar el viatico";

      setError(message);
      toast.error(message);
    } finally {
      setGuardando(false);
    }
  }

  async function handleEliminarViatico(viatico: VisitaViatico) {
    if (!visita) {
      return;
    }

    const confirmado = window.confirm(
      `¿Eliminar el gasto de ${getTipoLabel(viatico.tipoGasto)} por ${formatMoney(
        viatico.valor
      )}?`
    );

    if (!confirmado) {
      return;
    }

    setEliminandoId(viatico.id);
    setError(null);

    try {
      const updatedVisita = await deleteVisitaViatico(visita.id, viatico.id);
      setVisita(updatedVisita);
      toast.success("Viatico eliminado");
    } catch (deleteError) {
      const message =
        deleteError instanceof Error
          ? deleteError.message
          : "No se pudo eliminar el viatico";

      setError(message);
      toast.error(message);
    } finally {
      setEliminandoId(null);
    }
  }

  async function handleExportar(formato: "excel" | "pdf") {
    if (!visita) {
      return;
    }

    setExportandoFormato(formato);
    setError(null);

    try {
      if (formato === "excel") {
        await downloadVisitaViaticosExcel(visita.id);
      } else {
        await downloadVisitaViaticosPdf(visita.id);
      }
    } catch (exportError) {
      const message =
        exportError instanceof Error
          ? exportError.message
          : `No se pudo exportar la relacion de gastos en ${formato.toUpperCase()}`;

      setError(message);
      toast.error(message);
    } finally {
      setExportandoFormato(null);
    }
  }

  return (
    <DashboardLayout
      titulo="Detalle de Visita"
      descripcion="Informacion principal de la visita y resumen de viaticos"
      acciones={
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/visitas">
              <ArrowLeft size={18} />
              Volver
            </Link>
          </Button>
          {visita && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => void handleExportar("excel")}
                disabled={exportandoFormato !== null}
              >
                <Download size={18} />
                {exportandoFormato === "excel" ? "Exportando..." : "Excel"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => void handleExportar("pdf")}
                disabled={exportandoFormato !== null}
              >
                <Download size={18} />
                {exportandoFormato === "pdf" ? "Exportando..." : "PDF"}
              </Button>
            </>
          )}
          {visitaId && (
            <Button asChild size="sm" className="gap-2">
              <Link href={`/visitas/${visitaId}/editar`}>
                <Edit size={18} />
                Editar Visita
              </Link>
            </Button>
          )}
        </div>
      }
    >
      {error && (
        <div className="bg-destructive/10 text-destructive rounded-lg border border-destructive/20 px-4 py-3 mb-6 text-sm">
          {error}
        </div>
      )}

      {cargando ? (
        <div className="bg-card rounded-lg border border-border p-12 text-center shadow-sm">
          <p className="text-muted-foreground">Cargando detalle de visita...</p>
        </div>
      ) : !visita ? (
        <div className="bg-card rounded-lg border border-border p-12 text-center shadow-sm">
          <p className="text-muted-foreground mb-4">
            La visita solicitada no existe
          </p>
          <Button asChild variant="outline">
            <Link href="/visitas">Volver a Visitas</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-card rounded-lg border border-border p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  {visita.clienteNombre ?? visita.prospectoNombre ?? "Sin relacion"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {visita.clienteEmpresa ??
                    visita.prospectoEmpresa ??
                    "Sin empresa relacionada"}
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-accent text-foreground capitalize">
                {visita.tipo}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Fecha</p>
                  <p className="text-sm font-medium text-foreground">
                    {visita.fecha.toLocaleDateString("es-CO")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Hora</p>
                  <p className="text-sm font-medium text-foreground">
                    {visita.hora}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Users size={16} className="text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Relacion</p>
                  <p className="text-sm font-medium text-foreground">
                    {visita.clienteId ? "Cliente" : "Prospecto"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Estado</p>
                  <p className="text-sm font-medium text-foreground capitalize">
                    {visita.estado}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <div className="rounded-lg border border-border p-4 bg-accent/30">
                <p className="text-xs text-muted-foreground mb-1">Objetivo</p>
                <p className="text-sm text-foreground">{visita.objetivo}</p>
              </div>
              <div className="rounded-lg border border-border p-4 bg-accent/30">
                <p className="text-xs text-muted-foreground mb-1">Resultado</p>
                <p className="text-sm text-foreground">
                  {visita.resultado || "Sin resultado registrado"}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg border border-border p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  Resumen de Viaticos
                </h3>
                <p className="text-sm text-muted-foreground">
                  Totales acumulados por tipo de gasto asociados a esta visita
                </p>
              </div>
              <Button className="gap-2" onClick={abrirNuevoViatico}>
                <Plus size={18} />
                Nuevo Gasto
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="rounded-lg border border-border p-4">
                <p className="text-xs text-muted-foreground">Peajes</p>
                <p className="text-lg font-semibold text-foreground">
                  {formatMoney(resumen.peajes)}
                </p>
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className="text-xs text-muted-foreground">Gasolina</p>
                <p className="text-lg font-semibold text-foreground">
                  {formatMoney(resumen.gasolina)}
                </p>
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className="text-xs text-muted-foreground">Estadia</p>
                <p className="text-lg font-semibold text-foreground">
                  {formatMoney(resumen.estadia)}
                </p>
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className="text-xs text-muted-foreground">Alimentacion</p>
                <p className="text-lg font-semibold text-foreground">
                  {formatMoney(resumen.alimentacion)}
                </p>
              </div>
              <div className="rounded-lg border border-border p-4 bg-accent/40">
                <p className="text-xs text-muted-foreground">Total General</p>
                <p className="text-lg font-semibold text-foreground">
                  {formatMoney(resumen.totalGeneral)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg border border-border p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Gastos Registrados
            </h3>

            {viaticos.length === 0 ? (
              <div className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">
                No hay viaticos registrados para esta visita
              </div>
            ) : (
              <div className="space-y-3">
                {viaticos.map(viatico => (
                  <div
                    key={viatico.id}
                    className="rounded-lg border border-border p-4"
                  >
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-accent text-foreground capitalize">
                            {getTipoLabel(viatico.tipoGasto)}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {viatico.fecha.toLocaleDateString("es-CO")}
                          </span>
                          <span className="text-sm font-semibold text-foreground">
                            {formatMoney(viatico.valor)}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-foreground">
                          {viatico.descripcion}
                        </p>
                        {viatico.observaciones && (
                          <p className="text-sm text-muted-foreground">
                            {viatico.observaciones}
                          </p>
                        )}
                        {viatico.soporte && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                              <Paperclip size={14} />
                              {viatico.soporte.fileName}
                            </span>
                            <button
                              className="text-xs text-foreground hover:opacity-80"
                              onClick={() =>
                                openSupportInNewTab(
                                  getVisitaViaticoSupportUrl(
                                    visita.id,
                                    viatico.id,
                                    "view"
                                  )
                                )
                              }
                              type="button"
                            >
                              Ver soporte
                            </button>
                            <button
                              className="text-xs text-foreground hover:opacity-80"
                              onClick={() =>
                                openSupportInNewTab(
                                  getVisitaViaticoSupportUrl(
                                    visita.id,
                                    viatico.id,
                                    "download"
                                  )
                                )
                              }
                              type="button"
                            >
                              Descargar
                            </button>
                          </div>
                        )}
                        {viatico.usuarioNombre && (
                          <p className="text-xs text-muted-foreground">
                            Registrado por {viatico.usuarioNombre}
                          </p>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <button
                          className="p-2 hover:bg-accent rounded transition-smooth text-muted-foreground hover:text-foreground"
                          onClick={() => abrirEditarViatico(viatico)}
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          className="p-2 hover:bg-accent rounded transition-smooth text-muted-foreground hover:text-destructive disabled:opacity-50"
                          onClick={() => void handleEliminarViatico(viatico)}
                          disabled={eliminandoId === viatico.id}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Dialog open={dialogoAbierto} onOpenChange={open => !open && cerrarDialogo()}>
            <DialogContent className="sm:max-w-[560px]">
              <DialogHeader>
                <DialogTitle>
                  {viaticoEditando ? "Editar Gasto" : "Nuevo Gasto"}
                </DialogTitle>
                <DialogDescription>
                  Registra los viaticos asociados a esta visita comercial.
                </DialogDescription>
              </DialogHeader>

              {form && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="tipoGasto">Tipo de gasto</Label>
                      <Select
                        value={form.tipoGasto}
                        onValueChange={value =>
                          updateField("tipoGasto", value as ViaticoTipoGasto)
                        }
                      >
                        <SelectTrigger id="tipoGasto">
                          <SelectValue placeholder="Selecciona el tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(ViaticoTipoGasto).map(tipo => (
                            <SelectItem key={tipo} value={tipo}>
                              {getTipoLabel(tipo)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {formErrors.tipoGasto && (
                        <p className="text-xs text-destructive">
                          {formErrors.tipoGasto}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="fecha">Fecha</Label>
                      <Input
                        id="fecha"
                        type="date"
                        value={form.fecha}
                        onChange={event => updateField("fecha", event.target.value)}
                      />
                      {formErrors.fecha && (
                        <p className="text-xs text-destructive">
                          {formErrors.fecha}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="valor">Valor</Label>
                      <Input
                        id="valor"
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.valor}
                        onChange={event => updateField("valor", event.target.value)}
                        placeholder="0"
                      />
                      {formErrors.valor && (
                        <p className="text-xs text-destructive">
                          {formErrors.valor}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="descripcion">Descripcion</Label>
                      <Input
                        id="descripcion"
                        value={form.descripcion}
                        onChange={event =>
                          updateField("descripcion", event.target.value)
                        }
                        placeholder="Describe el gasto"
                      />
                      {formErrors.descripcion && (
                        <p className="text-xs text-destructive">
                          {formErrors.descripcion}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="observaciones">Observaciones</Label>
                    <Textarea
                      id="observaciones"
                      value={form.observaciones}
                      onChange={event =>
                        updateField("observaciones", event.target.value)
                      }
                      rows={4}
                      placeholder="Observaciones opcionales"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="soporteArchivo">Soporte</Label>
                    <Input
                      id="soporteArchivo"
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                      onChange={event =>
                        handleSupportFileChange(event.target.files?.[0] ?? null)
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Formatos permitidos: PDF, JPG, JPEG, PNG, WEBP. Maximo 2.5 MB.
                    </p>

                    {viaticoEditando?.soporte && !form.soporteArchivo && !form.removeSoporte && (
                      <div className="rounded-lg border border-border p-3 text-sm">
                        <p className="text-foreground font-medium">
                          Archivo actual: {viaticoEditando.soporte.fileName}
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                          <button
                            className="inline-flex items-center gap-1 text-xs text-foreground hover:opacity-80"
                            onClick={() =>
                              openSupportInNewTab(
                                getVisitaViaticoSupportUrl(
                                  visita.id,
                                  viaticoEditando.id,
                                  "view"
                                )
                              )
                            }
                            type="button"
                          >
                            <Eye size={14} />
                            Ver
                          </button>
                          <button
                            className="inline-flex items-center gap-1 text-xs text-foreground hover:opacity-80"
                            onClick={() =>
                              openSupportInNewTab(
                                getVisitaViaticoSupportUrl(
                                  visita.id,
                                  viaticoEditando.id,
                                  "download"
                                )
                              )
                            }
                            type="button"
                          >
                            <Download size={14} />
                            Descargar
                          </button>
                          <button
                            className="inline-flex items-center gap-1 text-xs text-destructive hover:opacity-80"
                            onClick={() =>
                              setForm(current =>
                                current
                                  ? {
                                      ...current,
                                      removeSoporte: true,
                                      soporteArchivo: null,
                                    }
                                  : current
                              )
                            }
                            type="button"
                          >
                            <Trash2 size={14} />
                            Quitar soporte
                          </button>
                        </div>
                      </div>
                    )}

                    {form.removeSoporte && !form.soporteArchivo && (
                      <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                        El soporte actual sera eliminado al guardar.
                      </div>
                    )}

                    {form.soporteArchivo && (
                      <div className="rounded-lg border border-border p-3 text-sm">
                        Nuevo archivo: {form.soporteArchivo.name}
                      </div>
                    )}

                    {formErrors.soporte && (
                      <p className="text-xs text-destructive">
                        {formErrors.soporte}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={cerrarDialogo} disabled={guardando}>
                  Cancelar
                </Button>
                <Button onClick={() => void handleGuardarViatico()} disabled={guardando}>
                  {guardando ? "Guardando..." : "Guardar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </DashboardLayout>
  );
}
