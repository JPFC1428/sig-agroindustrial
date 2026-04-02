import { useEffect, useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { Link, useLocation, useRoute } from "wouter";
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
import {
  createVisita,
  getVisitaById,
  updateVisita,
  type VisitaMutationInput,
} from "@/lib/visitas-api";
import { getClientes } from "@/lib/clientes-api";
import { getProspectos } from "@/lib/prospectos-api";
import {
  VisitaEstado,
  VisitaTipo,
  type Cliente,
  type Prospecto,
  type Visita,
} from "@/lib/types";

type RelacionTipo = "cliente" | "prospecto";

type VisitaFormValues = {
  relacionTipo: RelacionTipo;
  relacionadoId: string;
  tipo: VisitaTipo;
  fecha: string;
  hora: string;
  objetivo: string;
  resultado: string;
  observaciones: string;
  proximaAccion: string;
  estado: VisitaEstado;
};

type VisitaFormErrors = Partial<
  Record<
    | "relacionadoId"
    | "fecha"
    | "hora"
    | "objetivo"
    | "resultado"
    | "estado",
    string
  >
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

const INITIAL_FORM: VisitaFormValues = {
  relacionTipo: "cliente",
  relacionadoId: "",
  tipo: VisitaTipo.SEGUIMIENTO,
  fecha: toDateInputValue(new Date()),
  hora: "08:00",
  objetivo: "",
  resultado: "",
  observaciones: "",
  proximaAccion: "",
  estado: VisitaEstado.PROGRAMADA,
};

function toOptionalString(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toFormValues(visita: Visita): VisitaFormValues {
  return {
    relacionTipo: visita.clienteId ? "cliente" : "prospecto",
    relacionadoId: visita.clienteId ?? visita.prospectoId ?? "",
    tipo: visita.tipo,
    fecha: toDateInputValue(visita.fecha),
    hora: visita.hora,
    objetivo: visita.objetivo,
    resultado: visita.resultado ?? visita.resultados ?? "",
    observaciones: visita.observaciones ?? visita.notas ?? "",
    proximaAccion: visita.proximaAccion ?? "",
    estado: visita.estado ?? VisitaEstado.PROGRAMADA,
  };
}

function validateForm(values: VisitaFormValues) {
  const errors: VisitaFormErrors = {};

  if (!values.relacionadoId) {
    errors.relacionadoId = "Selecciona un cliente o un prospecto";
  }

  if (!values.fecha) {
    errors.fecha = "La fecha es obligatoria";
  }

  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(values.hora)) {
    errors.hora = "La hora es invalida";
  }

  if (!values.objetivo.trim()) {
    errors.objetivo = "El objetivo es obligatorio";
  }

  if (
    values.estado === VisitaEstado.REALIZADA &&
    !values.resultado.trim()
  ) {
    errors.resultado = "Debes registrar un resultado para una visita realizada";
  }

  if (!values.estado) {
    errors.estado = "Selecciona un estado";
  }

  return errors;
}

function buildPayload(values: VisitaFormValues): VisitaMutationInput {
  return {
    ...(values.relacionTipo === "cliente"
      ? { clienteId: values.relacionadoId }
      : { prospectoId: values.relacionadoId }),
    tipo: values.tipo,
    fecha: toIsoDateFromInput(values.fecha),
    hora: values.hora,
    objetivo: values.objetivo.trim(),
    resultado: toOptionalString(values.resultado),
    observaciones: toOptionalString(values.observaciones),
    proximaAccion: toOptionalString(values.proximaAccion),
    estado: values.estado,
  };
}

export default function VisitaNueva() {
  const [isNuevoRoute] = useRoute("/visitas/nuevo");
  const [isEditarRoute, editParams] = useRoute("/visitas/:id/editar");
  const [, setLocation] = useLocation();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [prospectos, setProspectos] = useState<Prospecto[]>([]);
  const [form, setForm] = useState<VisitaFormValues>(INITIAL_FORM);
  const [errors, setErrors] = useState<VisitaFormErrors>({});
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null);
  const [visitaDisponible, setVisitaDisponible] = useState(true);

  const visitaId = isEditarRoute ? editParams?.id : undefined;
  const esEdicion = Boolean(isEditarRoute && visitaId);
  const destinoVolver = "/visitas";

  useEffect(() => {
    if (!isNuevoRoute && !isEditarRoute) {
      return;
    }

    let activo = true;

    async function cargarFormulario() {
      setCargando(true);
      setErrors({});
      setErrorGlobal(null);
      setVisitaDisponible(true);

      try {
        const [clientesData, prospectosData, visita] = await Promise.all([
          getClientes(),
          getProspectos(),
          esEdicion && visitaId ? getVisitaById(visitaId) : Promise.resolve(null),
        ]);

        if (!activo) {
          return;
        }

        setClientes(clientesData);
        setProspectos(prospectosData);

        if (esEdicion && visitaId) {
          if (!visita) {
            setVisitaDisponible(false);
            setErrorGlobal("La visita solicitada no existe");
            return;
          }

          setForm(toFormValues(visita));
        } else {
          setForm(INITIAL_FORM);
        }
      } catch (loadError) {
        if (!activo) {
          return;
        }

        setVisitaDisponible(false);
        setErrorGlobal(
          loadError instanceof Error
            ? loadError.message
            : "No se pudo cargar el formulario de visitas"
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
  }, [esEdicion, isEditarRoute, isNuevoRoute, visitaId]);

  if (!isNuevoRoute && !isEditarRoute) {
    return null;
  }

  function updateField<K extends keyof VisitaFormValues>(
    field: K,
    value: VisitaFormValues[K]
  ) {
    setForm(current => ({
      ...current,
      [field]: value,
    }));

    setErrors(current => {
      const next = { ...current };
      delete next[field as keyof VisitaFormErrors];

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

      if (esEdicion && visitaId) {
        await updateVisita(visitaId, payload);
      } else {
        await createVisita(payload);
      }

      toast.success(esEdicion ? "Visita actualizada" : "Visita creada");
      setLocation("/visitas");
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "No se pudo guardar la visita";

      setErrorGlobal(message);
      toast.error(message);
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <DashboardLayout
        titulo={esEdicion ? "Editar Visita" : "Nueva Visita"}
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

  if (esEdicion && !visitaDisponible) {
    return (
      <DashboardLayout
        titulo="Editar Visita"
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
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            {errorGlobal ?? "La visita solicitada no existe"}
          </p>
          <Button asChild variant="outline">
            <Link href={destinoVolver}>Volver a Visitas</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const opcionesRelacion =
    form.relacionTipo === "cliente" ? clientes : prospectos;

  return (
    <DashboardLayout
      titulo={esEdicion ? "Editar Visita" : "Nueva Visita"}
      descripcion={
        esEdicion
          ? "Actualiza la informacion principal de la visita"
          : "Registro de nuevas visitas comerciales"
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
      <div className="max-w-5xl">
        {errorGlobal && (
          <div className="bg-destructive/10 text-destructive rounded-lg border border-destructive/20 px-4 py-3 mb-6 text-sm">
            {errorGlobal}
          </div>
        )}

        <form onSubmit={event => void handleSubmit(event)}>
          <div className="bg-card rounded-lg border border-border p-6 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="relacionTipo">Relacionar con</Label>
                <Select
                  value={form.relacionTipo}
                  onValueChange={value => {
                    updateField("relacionTipo", value as RelacionTipo);
                    updateField("relacionadoId", "");
                  }}
                >
                  <SelectTrigger id="relacionTipo">
                    <SelectValue placeholder="Selecciona el tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cliente">Cliente</SelectItem>
                    <SelectItem value="prospecto">Prospecto</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="relacionadoId">
                  {form.relacionTipo === "cliente" ? "Cliente" : "Prospecto"}
                </Label>
                <Select
                  value={form.relacionadoId}
                  onValueChange={value => updateField("relacionadoId", value)}
                >
                  <SelectTrigger id="relacionadoId">
                    <SelectValue placeholder="Selecciona un registro" />
                  </SelectTrigger>
                  <SelectContent>
                    {opcionesRelacion.map(registro => (
                      <SelectItem key={registro.id} value={registro.id}>
                        {registro.nombre} - {registro.empresa}
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
                    updateField("tipo", value as VisitaTipo)
                  }
                >
                  <SelectTrigger id="tipo">
                    <SelectValue placeholder="Tipo de visita" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(VisitaTipo).map(tipo => (
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
                    updateField("estado", value as VisitaEstado)
                  }
                >
                  <SelectTrigger id="estado">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(VisitaEstado).map(estado => (
                      <SelectItem key={estado} value={estado}>
                        {estado.charAt(0).toUpperCase() + estado.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.estado && (
                  <p className="text-xs text-destructive">{errors.estado}</p>
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
                {errors.fecha && (
                  <p className="text-xs text-destructive">{errors.fecha}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="hora">Hora</Label>
                <Input
                  id="hora"
                  type="time"
                  value={form.hora}
                  onChange={event => updateField("hora", event.target.value)}
                />
                {errors.hora && (
                  <p className="text-xs text-destructive">{errors.hora}</p>
                )}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="objetivo">Objetivo</Label>
                <Textarea
                  id="objetivo"
                  value={form.objetivo}
                  onChange={event => updateField("objetivo", event.target.value)}
                  placeholder="Objetivo principal de la visita"
                />
                {errors.objetivo && (
                  <p className="text-xs text-destructive">{errors.objetivo}</p>
                )}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="resultado">Resultado</Label>
                <Textarea
                  id="resultado"
                  value={form.resultado}
                  onChange={event => updateField("resultado", event.target.value)}
                  placeholder="Resultado de la visita"
                />
                {errors.resultado && (
                  <p className="text-xs text-destructive">{errors.resultado}</p>
                )}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="observaciones">Observaciones</Label>
                <Textarea
                  id="observaciones"
                  value={form.observaciones}
                  onChange={event =>
                    updateField("observaciones", event.target.value)
                  }
                  placeholder="Observaciones adicionales"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="proximaAccion">Proxima Accion</Label>
                <Input
                  id="proximaAccion"
                  value={form.proximaAccion}
                  onChange={event =>
                    updateField("proximaAccion", event.target.value)
                  }
                  placeholder="Siguiente accion recomendada"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-6 mt-6 border-t border-border">
              <Button asChild variant="outline">
                <Link href={destinoVolver}>Cancelar</Link>
              </Button>
              <Button type="submit" className="gap-2" disabled={guardando}>
                <Save size={16} />
                {guardando
                  ? esEdicion
                    ? "Guardando cambios..."
                    : "Creando visita..."
                  : esEdicion
                    ? "Guardar cambios"
                    : "Crear visita"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
