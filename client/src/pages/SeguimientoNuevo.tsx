import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { Link, useLocation, useRoute } from "wouter";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { getClientes } from "@/lib/clientes-api";
import { getCotizaciones } from "@/lib/cotizaciones-api";
import { getProspectos } from "@/lib/prospectos-api";
import {
  createSeguimiento,
  getSeguimientoById,
  updateSeguimiento,
  type SeguimientoMutationInput,
} from "@/lib/seguimientos-api";
import {
  SeguimientoEstado,
  SeguimientoTipo,
  type Cliente,
  type Cotizacion,
  type Prospecto,
  type Seguimiento,
  type SeguimientoRelacionTipo,
} from "@/lib/types";

type SeguimientoFormValues = {
  relacionTipo: SeguimientoRelacionTipo;
  relacionadoId: string;
  tipo: SeguimientoTipo;
  fechaVencimiento: string;
  observaciones: string;
  estado: SeguimientoEstado;
  completado: boolean;
};

type SeguimientoFormErrors = Partial<
  Record<"relacionadoId" | "fechaVencimiento" | "estado", string>
>;

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toIsoDateFromInput(value: string) {
  return `${value}T12:00:00.000Z`;
}

const INITIAL_FORM: SeguimientoFormValues = {
  relacionTipo: "cliente",
  relacionadoId: "",
  tipo: SeguimientoTipo.TAREA,
  fechaVencimiento: toDateInputValue(new Date()),
  observaciones: "",
  estado: SeguimientoEstado.PENDIENTE,
  completado: false,
};

function toOptionalString(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toFormValues(seguimiento: Seguimiento): SeguimientoFormValues {
  return {
    relacionTipo: seguimiento.clienteId
      ? "cliente"
      : seguimiento.prospectoId
        ? "prospecto"
        : "cotizacion",
    relacionadoId:
      seguimiento.clienteId ??
      seguimiento.prospectoId ??
      seguimiento.cotizacionId ??
      "",
    tipo: seguimiento.tipo,
    fechaVencimiento: toDateInputValue(seguimiento.fechaVencimiento),
    observaciones:
      seguimiento.observaciones ??
      seguimiento.descripcion ??
      seguimiento.notas ??
      "",
    estado: seguimiento.estado ?? SeguimientoEstado.PENDIENTE,
    completado: seguimiento.completado,
  };
}

function validateForm(values: SeguimientoFormValues) {
  const errors: SeguimientoFormErrors = {};

  if (!values.relacionadoId) {
    errors.relacionadoId = "Selecciona un cliente, prospecto o cotizacion";
  }

  if (!values.fechaVencimiento) {
    errors.fechaVencimiento = "La fecha de vencimiento es obligatoria";
  }

  if (!values.estado) {
    errors.estado = "Selecciona un estado";
  }

  return errors;
}

function buildPayload(values: SeguimientoFormValues): SeguimientoMutationInput {
  return {
    ...(values.relacionTipo === "cliente"
      ? { clienteId: values.relacionadoId }
      : values.relacionTipo === "prospecto"
        ? { prospectoId: values.relacionadoId }
        : { cotizacionId: values.relacionadoId }),
    tipo: values.tipo,
    fechaVencimiento: toIsoDateFromInput(values.fechaVencimiento),
    observaciones: toOptionalString(values.observaciones),
    estado: values.estado,
    completado: values.completado,
  };
}

function getCotizacionLabel(cotizacion: Cotizacion) {
  const cliente = cotizacion.clienteEmpresa ?? cotizacion.clienteNombre ?? "";
  return cliente
    ? `${cotizacion.numero} - ${cliente}`
    : cotizacion.numero;
}

export default function SeguimientoNuevo() {
  const [isNuevoRoute] = useRoute("/seguimientos/nuevo");
  const [isEditarRoute, editParams] = useRoute("/seguimientos/:id/editar");
  const [, setLocation] = useLocation();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [prospectos, setProspectos] = useState<Prospecto[]>([]);
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [form, setForm] = useState<SeguimientoFormValues>(INITIAL_FORM);
  const [errors, setErrors] = useState<SeguimientoFormErrors>({});
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null);
  const [seguimientoDisponible, setSeguimientoDisponible] = useState(true);

  const seguimientoId = isEditarRoute ? editParams?.id : undefined;
  const esEdicion = Boolean(isEditarRoute && seguimientoId);
  const destinoVolver = "/seguimientos";

  useEffect(() => {
    if (!isNuevoRoute && !isEditarRoute) {
      return;
    }

    let activo = true;

    async function cargarFormulario() {
      setCargando(true);
      setErrors({});
      setErrorGlobal(null);
      setSeguimientoDisponible(true);

      try {
        const [clientesData, prospectosData, cotizacionesData, seguimiento] =
          await Promise.all([
            getClientes(),
            getProspectos(),
            getCotizaciones(),
            esEdicion && seguimientoId
              ? getSeguimientoById(seguimientoId)
              : Promise.resolve(null),
          ]);

        if (!activo) {
          return;
        }

        setClientes(clientesData);
        setProspectos(prospectosData);
        setCotizaciones(cotizacionesData);

        if (esEdicion && seguimientoId) {
          if (!seguimiento) {
            setSeguimientoDisponible(false);
            setErrorGlobal("El seguimiento solicitado no existe");
            return;
          }

          setForm(toFormValues(seguimiento));
        } else {
          setForm(INITIAL_FORM);
        }
      } catch (loadError) {
        if (!activo) {
          return;
        }

        setSeguimientoDisponible(false);
        setErrorGlobal(
          loadError instanceof Error
            ? loadError.message
            : "No se pudo cargar el formulario de seguimientos"
        );
      } finally {
        if (activo) {
          setCargando(false);
        }
      }
    }

    void cargarFormulario();

    return () => {
      activo = false;
    };
  }, [esEdicion, isEditarRoute, isNuevoRoute, seguimientoId]);

  const relatedOptions = useMemo(() => {
    if (form.relacionTipo === "cliente") {
      return clientes.map(cliente => ({
        id: cliente.id,
        label: `${cliente.nombre} - ${cliente.empresa}`,
      }));
    }

    if (form.relacionTipo === "prospecto") {
      return prospectos.map(prospecto => ({
        id: prospecto.id,
        label: `${prospecto.nombre} - ${prospecto.empresa}`,
      }));
    }

    return cotizaciones.map(cotizacion => ({
      id: cotizacion.id,
      label: getCotizacionLabel(cotizacion),
    }));
  }, [clientes, cotizaciones, form.relacionTipo, prospectos]);

  if (!isNuevoRoute && !isEditarRoute) {
    return null;
  }

  function updateField<K extends keyof SeguimientoFormValues>(
    field: K,
    value: SeguimientoFormValues[K]
  ) {
    setForm(current => ({
      ...current,
      [field]: value,
    }));

    setErrors(current => {
      const next = { ...current };
      delete next[field as keyof SeguimientoFormErrors];

      if (field === "relacionTipo") {
        delete next.relacionadoId;
      }

      return next;
    });

    setErrorGlobal(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationErrors = validateForm(form);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      setErrorGlobal("Revisa los campos obligatorios antes de guardar");
      return;
    }

    setGuardando(true);
    setErrorGlobal(null);

    try {
      const payload = buildPayload(form);

      if (esEdicion && seguimientoId) {
        await updateSeguimiento(seguimientoId, payload);
      } else {
        await createSeguimiento(payload);
      }

      toast.success(
        esEdicion ? "Seguimiento actualizado" : "Seguimiento creado"
      );
      setLocation("/seguimientos");
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "No se pudo guardar el seguimiento";

      setErrorGlobal(message);
      toast.error(message);
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <DashboardLayout
        titulo={esEdicion ? "Editar Seguimiento" : "Nuevo Seguimiento"}
        descripcion="Cargando formulario"
        acciones={
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href={destinoVolver}>
              <ArrowLeft size={18} />
              Volver
            </Link>
          </Button>
        }
      >
        <div className="text-center py-12">
          <p className="text-muted-foreground">Cargando formulario...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (esEdicion && !seguimientoDisponible) {
    return (
      <DashboardLayout
        titulo="Seguimiento no encontrado"
        descripcion="No fue posible cargar el formulario"
        acciones={
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href={destinoVolver}>
              <ArrowLeft size={18} />
              Volver
            </Link>
          </Button>
        }
      >
        <div className="bg-card rounded-lg border border-border p-6 shadow-sm">
          <p className="text-muted-foreground">
            {errorGlobal ?? "El seguimiento solicitado no existe"}
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      titulo={esEdicion ? "Editar Seguimiento" : "Nuevo Seguimiento"}
      descripcion={
        esEdicion
          ? "Actualiza la informacion del seguimiento"
          : "Registra un nuevo seguimiento comercial"
      }
      acciones={
        <Button asChild variant="outline" size="sm" className="gap-2">
          <Link href={destinoVolver}>
            <ArrowLeft size={18} />
            Volver
          </Link>
        </Button>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {errorGlobal && (
          <div className="bg-destructive/10 text-destructive rounded-lg border border-destructive/20 px-4 py-3 text-sm">
            {errorGlobal}
          </div>
        )}

        <div className="bg-card rounded-lg border border-border p-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="relacionTipo">Relacion</Label>
              <Select
                value={form.relacionTipo}
                onValueChange={value => {
                  updateField(
                    "relacionTipo",
                    value as SeguimientoRelacionTipo
                  );
                  updateField("relacionadoId", "");
                }}
              >
                <SelectTrigger id="relacionTipo">
                  <SelectValue placeholder="Selecciona una relacion" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cliente">Cliente</SelectItem>
                  <SelectItem value="prospecto">Prospecto</SelectItem>
                  <SelectItem value="cotizacion">Cotizacion</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="relacionadoId">
                {form.relacionTipo === "cliente"
                  ? "Cliente"
                  : form.relacionTipo === "prospecto"
                    ? "Prospecto"
                    : "Cotizacion"}
              </Label>
              <Select
                value={form.relacionadoId}
                onValueChange={value => updateField("relacionadoId", value)}
              >
                <SelectTrigger
                  id="relacionadoId"
                  className={errors.relacionadoId ? "border-destructive" : ""}
                >
                  <SelectValue placeholder="Selecciona una opcion" />
                </SelectTrigger>
                <SelectContent>
                  {relatedOptions.map(option => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.relacionadoId && (
                <p className="text-xs text-destructive">
                  {errors.relacionadoId}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo</Label>
              <Select
                value={form.tipo}
                onValueChange={value =>
                  updateField("tipo", value as SeguimientoTipo)
                }
              >
                <SelectTrigger id="tipo">
                  <SelectValue placeholder="Selecciona un tipo" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(SeguimientoTipo).map(tipo => (
                    <SelectItem key={tipo} value={tipo}>
                      {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="estado">Estado</Label>
              <Select
                value={form.estado}
                onValueChange={value =>
                  updateField("estado", value as SeguimientoEstado)
                }
              >
                <SelectTrigger
                  id="estado"
                  className={errors.estado ? "border-destructive" : ""}
                >
                  <SelectValue placeholder="Selecciona un estado" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(SeguimientoEstado).map(estado => (
                    <SelectItem key={estado} value={estado}>
                      {estado.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.estado && (
                <p className="text-xs text-destructive">{errors.estado}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="fechaVencimiento">Fecha de Vencimiento</Label>
              <Input
                id="fechaVencimiento"
                type="date"
                value={form.fechaVencimiento}
                onChange={event =>
                  updateField("fechaVencimiento", event.target.value)
                }
                className={errors.fechaVencimiento ? "border-destructive" : ""}
              />
              {errors.fechaVencimiento && (
                <p className="text-xs text-destructive">
                  {errors.fechaVencimiento}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="completado">Completado</Label>
              <div className="flex items-center gap-3 rounded-md border border-border px-3 py-2.5">
                <Checkbox
                  id="completado"
                  checked={form.completado}
                  onCheckedChange={checked =>
                    updateField("completado", checked === true)
                  }
                />
                <Label htmlFor="completado" className="font-normal">
                  Marcar seguimiento como completado
                </Label>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border p-6 shadow-sm">
          <div className="space-y-2">
            <Label htmlFor="observaciones">Observaciones</Label>
            <Textarea
              id="observaciones"
              value={form.observaciones}
              onChange={event => updateField("observaciones", event.target.value)}
              rows={6}
              placeholder="Ingresa notas u observaciones del seguimiento"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Button asChild variant="outline">
            <Link href={destinoVolver}>Cancelar</Link>
          </Button>
          <Button type="submit" className="gap-2" disabled={guardando}>
            <Save size={18} />
            {guardando
              ? esEdicion
                ? "Guardando..."
                : "Creando..."
              : esEdicion
                ? "Guardar Cambios"
                : "Crear Seguimiento"}
          </Button>
        </div>
      </form>
    </DashboardLayout>
  );
}
