import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Paperclip, Save } from "lucide-react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";
import { DashboardLayout } from "@/components/DashboardLayout";
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
import { getClientes } from "@/lib/clientes-api";
import {
  createSertecOrden,
  getSertecComercialOrigenes,
  type SertecAdjuntoUpload,
  type SertecOrdenMutationInput,
} from "@/lib/sertec-api";
import type { Cliente, SertecComercialOrigen } from "@/lib/types";

type FormValues = {
  archivos: File[];
  clienteDocumento: string;
  clienteId: string;
  clienteNombre: string;
  clienteTelefono: string;
  cotizacionId: string;
  cotizacionItemId: string;
  diagnostico: string;
  equipoMarca: string;
  equipoModelo: string;
  equipoSerial: string;
  equipoTipo: string;
  fallaReportada: string;
  fechaVenta: string;
  garantiaMeses: string;
  observaciones: string;
  trabajoRealizado: string;
};

type FormErrors = Partial<
  Record<
    | "archivos"
    | "clienteNombre"
    | "cotizacionItemId"
    | "equipoTipo"
    | "fallaReportada"
    | "garantiaMeses",
    string
  >
>;

const ALLOWED_ADJUNTO_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_ADJUNTO_FILE_SIZE = 5 * 1024 * 1024;
const CLIENTE_NONE_VALUE = "sin-cliente";
const COTIZACION_NONE_VALUE = "sin-origen";
const EQUIPO_NONE_VALUE = "sin-equipo";

const INITIAL_FORM: FormValues = {
  archivos: [],
  clienteDocumento: "",
  clienteId: "",
  clienteNombre: "",
  clienteTelefono: "",
  cotizacionId: "",
  cotizacionItemId: "",
  diagnostico: "",
  equipoMarca: "",
  equipoModelo: "",
  equipoSerial: "",
  equipoTipo: "",
  fallaReportada: "",
  fechaVenta: "",
  garantiaMeses: "12",
  observaciones: "",
  trabajoRealizado: "",
};

function toOptionalString(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toIsoDateFromInput(value: string) {
  return `${value}T12:00:00.000Z`;
}

function validateForm(values: FormValues) {
  const errors: FormErrors = {};

  if (!values.clienteNombre.trim()) {
    errors.clienteNombre = "El nombre del cliente es obligatorio";
  }

  if (!values.equipoTipo.trim()) {
    errors.equipoTipo = "El tipo de equipo es obligatorio";
  }

  if (!values.fallaReportada.trim()) {
    errors.fallaReportada = "La falla reportada es obligatoria";
  }

  if (values.cotizacionId && !values.cotizacionItemId) {
    errors.cotizacionItemId =
      "Selecciona el equipo vendido asociado al origen comercial";
  }

  if (values.garantiaMeses.trim()) {
    const parsed = Number(values.garantiaMeses);

    if (!Number.isInteger(parsed) || parsed < 0) {
      errors.garantiaMeses =
        "La garantia debe expresarse en meses enteros mayores o iguales a cero";
    }
  }

  const invalidFile = values.archivos.find(
    file =>
      !ALLOWED_ADJUNTO_MIME_TYPES.has(file.type) ||
      file.size <= 0 ||
      file.size > MAX_ADJUNTO_FILE_SIZE
  );

  if (invalidFile) {
    errors.archivos =
      "Los adjuntos deben ser PDF, JPG, PNG o WEBP y no superar 5 MB";
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

async function buildAdjuntos(files: File[]): Promise<SertecAdjuntoUpload[]> {
  return Promise.all(
    files.map(async file => ({
      contentBase64: await readFileAsBase64(file),
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type as SertecAdjuntoUpload["mimeType"],
    }))
  );
}

export default function SertecNueva() {
  const [, setLocation] = useLocation();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [origenesComerciales, setOrigenesComerciales] = useState<
    SertecComercialOrigen[]
  >([]);
  const [form, setForm] = useState<FormValues>(INITIAL_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [guardando, setGuardando] = useState(false);
  const [cargandoCatalogos, setCargandoCatalogos] = useState(true);
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null);

  const origenSeleccionado = useMemo(
    () =>
      origenesComerciales.find(origen => origen.cotizacionId === form.cotizacionId) ??
      null,
    [form.cotizacionId, origenesComerciales]
  );

  const equiposDisponibles = origenSeleccionado?.items ?? [];

  useEffect(() => {
    let active = true;

    async function loadCatalogs() {
      setCargandoCatalogos(true);
      setErrorGlobal(null);

      try {
        const [clientesData, origenesData] = await Promise.all([
          getClientes(),
          getSertecComercialOrigenes(),
        ]);

        if (!active) {
          return;
        }

        setClientes(clientesData);
        setOrigenesComerciales(origenesData);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setErrorGlobal(
          loadError instanceof Error
            ? loadError.message
            : "No se pudo cargar la configuracion comercial para SERTEC"
        );
      } finally {
        if (active) {
          setCargandoCatalogos(false);
        }
      }
    }

    void loadCatalogs();

    return () => {
      active = false;
    };
  }, []);

  function clearFieldError(
    field:
      | "archivos"
      | "clienteNombre"
      | "cotizacionItemId"
      | "equipoTipo"
      | "fallaReportada"
      | "garantiaMeses"
  ) {
    setErrors(current => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function applyClienteSnapshot(cliente: Cliente | undefined) {
    if (!cliente) {
      return;
    }

    setForm(current => ({
      ...current,
      clienteDocumento: cliente.nit ?? current.clienteDocumento,
      clienteId: cliente.id,
      clienteNombre: cliente.nombre,
      clienteTelefono: cliente.telefono ?? current.clienteTelefono,
    }));
    clearFieldError("clienteNombre");
  }

  function handleClienteChange(value: string) {
    if (value === CLIENTE_NONE_VALUE) {
      setForm(current => ({
        ...current,
        clienteId: "",
      }));
      return;
    }

    const clienteSeleccionado = clientes.find(cliente => cliente.id === value);
    applyClienteSnapshot(clienteSeleccionado);
  }

  function handleCotizacionChange(value: string) {
    if (value === COTIZACION_NONE_VALUE) {
      setForm(current => ({
        ...current,
        cotizacionId: "",
        cotizacionItemId: "",
      }));
      clearFieldError("cotizacionItemId");
      return;
    }

    const origen = origenesComerciales.find(
      currentOrigen => currentOrigen.cotizacionId === value
    );

    setForm(current => ({
      ...current,
      clienteId: origen?.clienteId ?? current.clienteId,
      clienteNombre: origen?.clienteNombre ?? current.clienteNombre,
      clienteTelefono: origen?.clienteTelefono ?? current.clienteTelefono,
      cotizacionId: value,
      cotizacionItemId: "",
      fechaVenta: origen ? toDateInputValue(origen.fechaVenta) : current.fechaVenta,
      garantiaMeses: origen
        ? String(origen.garantiaMesesSugerida)
        : current.garantiaMeses,
    }));
    clearFieldError("clienteNombre");
    clearFieldError("cotizacionItemId");
    clearFieldError("garantiaMeses");
  }

  function handleEquipoVendidoChange(value: string) {
    const equipoSeleccionado = equiposDisponibles.find(item => item.id === value);

    setForm(current => ({
      ...current,
      cotizacionItemId: value === EQUIPO_NONE_VALUE ? "" : value,
      equipoTipo:
        value === EQUIPO_NONE_VALUE
          ? current.equipoTipo
          : (equipoSeleccionado?.descripcion ?? current.equipoTipo),
    }));
    clearFieldError("cotizacionItemId");
    clearFieldError("equipoTipo");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationErrors = validateForm(form);
    setErrors(validationErrors);
    setErrorGlobal(null);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setGuardando(true);

    try {
      const payload: SertecOrdenMutationInput = {
        clienteDocumento: toOptionalString(form.clienteDocumento),
        clienteId: toOptionalString(form.clienteId),
        clienteNombre: form.clienteNombre.trim(),
        clienteTelefono: toOptionalString(form.clienteTelefono),
        cotizacionId: toOptionalString(form.cotizacionId),
        cotizacionItemId: toOptionalString(form.cotizacionItemId),
        diagnostico: toOptionalString(form.diagnostico),
        equipoMarca: toOptionalString(form.equipoMarca),
        equipoModelo: toOptionalString(form.equipoModelo),
        equipoSerial: toOptionalString(form.equipoSerial),
        equipoTipo: form.equipoTipo.trim(),
        fallaReportada: form.fallaReportada.trim(),
        fechaVenta: form.fechaVenta ? toIsoDateFromInput(form.fechaVenta) : undefined,
        garantiaMeses: form.garantiaMeses.trim()
          ? Number(form.garantiaMeses)
          : undefined,
        observaciones: toOptionalString(form.observaciones),
        trabajoRealizado: toOptionalString(form.trabajoRealizado),
        adjuntos: await buildAdjuntos(form.archivos),
      };

      const orden = await createSertecOrden(payload);
      toast.success("Orden SERTEC creada");
      setLocation(`/sertec/${orden.id}`);
    } catch (saveError) {
      setErrorGlobal(
        saveError instanceof Error
          ? saveError.message
          : "No se pudo crear la orden SERTEC"
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <DashboardLayout
      titulo="Nueva Orden SERTEC"
      descripcion="Registro inicial de orden de entrada y garantia comercial"
    >
      <div className="max-w-5xl space-y-6">
        <div>
          <Button asChild variant="outline" className="gap-2">
            <Link href="/sertec">
              <ArrowLeft size={16} />
              Volver a ordenes
            </Link>
          </Button>
        </div>

        {errorGlobal && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorGlobal}
          </div>
        )}

        <form onSubmit={event => void handleSubmit(event)} className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-foreground">
                Origen comercial y garantia
              </h2>
            </div>

            {cargandoCatalogos ? (
              <div className="rounded-lg border border-border bg-accent/40 px-4 py-3 text-sm text-muted-foreground">
                Cargando relacion comercial...
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sertec-cotizacion-origen">
                    Origen comercial
                  </Label>
                  <Select
                    value={form.cotizacionId || COTIZACION_NONE_VALUE}
                    onValueChange={handleCotizacionChange}
                  >
                    <SelectTrigger id="sertec-cotizacion-origen">
                      <SelectValue placeholder="Sin origen comercial" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={COTIZACION_NONE_VALUE}>
                        Sin origen comercial
                      </SelectItem>
                      {origenesComerciales.map(origen => (
                        <SelectItem
                          key={origen.cotizacionId}
                          value={origen.cotizacionId}
                        >
                          {origen.cotizacionNumero} - {origen.clienteNombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sertec-equipo-vendido">Equipo vendido</Label>
                  <Select
                    value={form.cotizacionItemId || EQUIPO_NONE_VALUE}
                    onValueChange={handleEquipoVendidoChange}
                    disabled={!origenSeleccionado}
                  >
                    <SelectTrigger id="sertec-equipo-vendido">
                      <SelectValue
                        placeholder={
                          origenSeleccionado
                            ? "Selecciona el equipo vendido"
                            : "Selecciona primero un origen comercial"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={EQUIPO_NONE_VALUE}>
                        Sin equipo seleccionado
                      </SelectItem>
                      {equiposDisponibles.map(item => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.descripcion}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.cotizacionItemId && (
                    <p className="text-sm text-destructive">
                      {errors.cotizacionItemId}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sertec-fecha-venta">Fecha de venta</Label>
                  <Input
                    id="sertec-fecha-venta"
                    type="date"
                    value={form.fechaVenta}
                    onChange={event =>
                      setForm(current => ({
                        ...current,
                        fechaVenta: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sertec-garantia-meses">Garantia (meses)</Label>
                  <Input
                    id="sertec-garantia-meses"
                    type="number"
                    min="0"
                    step="1"
                    value={form.garantiaMeses}
                    onChange={event => {
                      setForm(current => ({
                        ...current,
                        garantiaMeses: event.target.value,
                      }));
                      clearFieldError("garantiaMeses");
                    }}
                  />
                  {errors.garantiaMeses && (
                    <p className="text-sm text-destructive">
                      {errors.garantiaMeses}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-foreground">
                Datos del cliente
              </h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sertec-cliente-id">Cliente relacionado</Label>
                <Select
                  value={form.clienteId || CLIENTE_NONE_VALUE}
                  onValueChange={handleClienteChange}
                  disabled={Boolean(form.cotizacionId)}
                >
                  <SelectTrigger id="sertec-cliente-id">
                    <SelectValue placeholder="Sin cliente asociado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CLIENTE_NONE_VALUE}>
                      Sin cliente asociado
                    </SelectItem>
                    {clientes.map(cliente => (
                      <SelectItem key={cliente.id} value={cliente.id}>
                        {cliente.nombre} - {cliente.empresa}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sertec-cliente-nombre">Cliente</Label>
                <Input
                  id="sertec-cliente-nombre"
                  value={form.clienteNombre}
                  onChange={event => {
                    setForm(current => ({
                      ...current,
                      clienteNombre: event.target.value,
                    }));
                    clearFieldError("clienteNombre");
                  }}
                />
                {errors.clienteNombre && (
                  <p className="text-sm text-destructive">{errors.clienteNombre}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="sertec-cliente-documento">Documento</Label>
                <Input
                  id="sertec-cliente-documento"
                  value={form.clienteDocumento}
                  onChange={event =>
                    setForm(current => ({
                      ...current,
                      clienteDocumento: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sertec-cliente-telefono">Telefono</Label>
                <Input
                  id="sertec-cliente-telefono"
                  value={form.clienteTelefono}
                  onChange={event =>
                    setForm(current => ({
                      ...current,
                      clienteTelefono: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-foreground">
                Equipo y diagnostico inicial
              </h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sertec-equipo-tipo">Tipo de equipo</Label>
                <Input
                  id="sertec-equipo-tipo"
                  value={form.equipoTipo}
                  onChange={event => {
                    setForm(current => ({ ...current, equipoTipo: event.target.value }));
                    clearFieldError("equipoTipo");
                  }}
                />
                {errors.equipoTipo && (
                  <p className="text-sm text-destructive">{errors.equipoTipo}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="sertec-equipo-marca">Marca</Label>
                <Input
                  id="sertec-equipo-marca"
                  value={form.equipoMarca}
                  onChange={event =>
                    setForm(current => ({ ...current, equipoMarca: event.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sertec-equipo-modelo">Modelo</Label>
                <Input
                  id="sertec-equipo-modelo"
                  value={form.equipoModelo}
                  onChange={event =>
                    setForm(current => ({ ...current, equipoModelo: event.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sertec-equipo-serial">Serial</Label>
                <Input
                  id="sertec-equipo-serial"
                  value={form.equipoSerial}
                  onChange={event =>
                    setForm(current => ({ ...current, equipoSerial: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sertec-falla">Falla reportada</Label>
                <Textarea
                  id="sertec-falla"
                  rows={4}
                  value={form.fallaReportada}
                  onChange={event => {
                    setForm(current => ({
                      ...current,
                      fallaReportada: event.target.value,
                    }));
                    clearFieldError("fallaReportada");
                  }}
                />
                {errors.fallaReportada && (
                  <p className="text-sm text-destructive">{errors.fallaReportada}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="sertec-diagnostico">Diagnostico inicial</Label>
                <Textarea
                  id="sertec-diagnostico"
                  rows={3}
                  value={form.diagnostico}
                  onChange={event =>
                    setForm(current => ({
                      ...current,
                      diagnostico: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sertec-trabajo">Trabajo realizado</Label>
                <Textarea
                  id="sertec-trabajo"
                  rows={3}
                  value={form.trabajoRealizado}
                  onChange={event =>
                    setForm(current => ({
                      ...current,
                      trabajoRealizado: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sertec-observaciones">Observaciones</Label>
                <Textarea
                  id="sertec-observaciones"
                  rows={3}
                  value={form.observaciones}
                  onChange={event =>
                    setForm(current => ({
                      ...current,
                      observaciones: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Paperclip size={18} className="text-muted-foreground" />
              <h2 className="text-lg font-semibold text-foreground">Adjuntos</h2>
            </div>

            <div className="space-y-3">
              <Input
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                onChange={event =>
                  setForm(current => ({
                    ...current,
                    archivos: Array.from(event.target.files ?? []),
                  }))
                }
              />

              {errors.archivos && (
                <p className="text-sm text-destructive">{errors.archivos}</p>
              )}

              <div className="rounded-lg border border-border bg-accent/40 px-4 py-3 text-sm text-muted-foreground">
                {form.archivos.length === 0
                  ? "No hay adjuntos seleccionados."
                  : `${form.archivos.length} adjunto(s): ${form.archivos
                      .map(file => file.name)
                      .join(", ")}`}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button asChild variant="outline">
              <Link href="/sertec">Cancelar</Link>
            </Button>
            <Button type="submit" className="gap-2" disabled={guardando}>
              <Save size={16} />
              {guardando ? "Guardando..." : "Crear orden"}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
