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
  createProspecto,
  getProspectoById,
  updateProspecto,
  type ProspectoMutationInput,
} from "@/lib/prospectos-api";
import { ProspectoEstado, type Prospecto } from "@/lib/types";

type ProspectoFuente = Prospecto["fuente"];

type ProspectoFormValues = {
  nombre: string;
  empresa: string;
  email: string;
  telefono: string;
  ciudad: string;
  departamento: string;
  contactoPrincipal: string;
  cargoContacto: string;
  estado: ProspectoEstado;
  fuente: ProspectoFuente;
  probabilidadConversion: string;
  montoEstimado: string;
  proximoSeguimiento: string;
  asignadoA: string;
  notas: string;
};

type ProspectoFormErrors = Partial<Record<keyof ProspectoFormValues, string>>;

const FUENTE_OPTIONS: ProspectoFuente[] = [
  "referencia",
  "web",
  "evento",
  "llamada_fria",
  "otro",
];

const INITIAL_FORM: ProspectoFormValues = {
  nombre: "",
  empresa: "",
  email: "",
  telefono: "",
  ciudad: "",
  departamento: "",
  contactoPrincipal: "",
  cargoContacto: "",
  estado: ProspectoEstado.NUEVO,
  fuente: "otro",
  probabilidadConversion: "50",
  montoEstimado: "",
  proximoSeguimiento: "",
  asignadoA: "",
  notas: "",
};

function toOptionalString(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toOptionalNumber(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toDateInputValue(date?: Date) {
  if (!date) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateInput(value: string) {
  const trimmed = value.trim();
  return trimmed ? new Date(`${trimmed}T00:00:00`) : undefined;
}

function formatFuenteLabel(fuente: ProspectoFuente) {
  const labels: Record<ProspectoFuente, string> = {
    referencia: "Referencia",
    web: "Web",
    evento: "Evento",
    llamada_fria: "Llamada fria",
    otro: "Otro",
  };

  return labels[fuente];
}

function toFormValues(prospecto: Prospecto): ProspectoFormValues {
  return {
    nombre: prospecto.nombre,
    empresa: prospecto.empresa,
    email: prospecto.email,
    telefono: prospecto.telefono,
    ciudad: prospecto.ciudad,
    departamento: prospecto.departamento,
    contactoPrincipal: prospecto.contactoPrincipal,
    cargoContacto: prospecto.cargoContacto,
    estado: prospecto.estado,
    fuente: prospecto.fuente,
    probabilidadConversion: String(prospecto.probabilidadConversion),
    montoEstimado:
      prospecto.montoEstimado !== undefined
        ? String(prospecto.montoEstimado)
        : "",
    proximoSeguimiento: toDateInputValue(prospecto.proximoSeguimiento),
    asignadoA: prospecto.asignadoA ?? "",
    notas: prospecto.notas ?? "",
  };
}

function validateForm(values: ProspectoFormValues) {
  const errors: ProspectoFormErrors = {};

  if (!values.nombre.trim()) {
    errors.nombre = "El nombre es obligatorio";
  }

  if (!values.empresa.trim()) {
    errors.empresa = "La empresa es obligatoria";
  }

  if (!values.ciudad.trim()) {
    errors.ciudad = "La ciudad es obligatoria";
  }

  if (!values.email.trim() && !values.contactoPrincipal.trim()) {
    errors.email = "Ingresa email o contacto principal";
    errors.contactoPrincipal = "Ingresa contacto principal o email";
  }

  if (!values.estado) {
    errors.estado = "Selecciona un estado";
  }

  if (!values.fuente) {
    errors.fuente = "Selecciona una fuente";
  }

  if (!values.probabilidadConversion.trim()) {
    errors.probabilidadConversion =
      "La probabilidad de conversion es obligatoria";
  } else {
    const probabilidad = Number(values.probabilidadConversion);

    if (
      !Number.isFinite(probabilidad) ||
      probabilidad < 0 ||
      probabilidad > 100
    ) {
      errors.probabilidadConversion = "Ingresa un valor entre 0 y 100";
    }
  }

  if (values.montoEstimado.trim()) {
    const monto = Number(values.montoEstimado);

    if (!Number.isFinite(monto) || monto < 0) {
      errors.montoEstimado = "Ingresa un monto valido";
    }
  }

  return errors;
}

function buildPayload(values: ProspectoFormValues): ProspectoMutationInput {
  return {
    nombre: values.nombre.trim(),
    empresa: values.empresa.trim(),
    ciudad: values.ciudad.trim(),
    estado: values.estado,
    fuente: values.fuente,
    email: toOptionalString(values.email),
    telefono: toOptionalString(values.telefono),
    departamento: toOptionalString(values.departamento),
    contactoPrincipal: toOptionalString(values.contactoPrincipal),
    cargoContacto: toOptionalString(values.cargoContacto),
    probabilidadConversion: Math.round(Number(values.probabilidadConversion)),
    montoEstimado: toOptionalNumber(values.montoEstimado),
    proximoSeguimiento: parseDateInput(values.proximoSeguimiento),
    asignadoA: toOptionalString(values.asignadoA),
    notas: toOptionalString(values.notas),
  };
}

export default function ProspectoNuevo() {
  const [isNuevoRoute] = useRoute("/prospectos/nuevo");
  const [isEditarRoute, editParams] = useRoute("/prospectos/:id/editar");
  const [, setLocation] = useLocation();
  const [form, setForm] = useState<ProspectoFormValues>(INITIAL_FORM);
  const [errors, setErrors] = useState<ProspectoFormErrors>({});
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null);
  const [prospectoDisponible, setProspectoDisponible] = useState(true);

  const prospectoId = isEditarRoute ? editParams?.id : undefined;
  const esEdicion = Boolean(isEditarRoute && prospectoId);
  const destinoVolver =
    esEdicion && prospectoId ? `/prospectos/${prospectoId}` : "/prospectos";

  useEffect(() => {
    if (!isNuevoRoute && !isEditarRoute) {
      return;
    }

    if (!esEdicion || !prospectoId) {
      setForm(INITIAL_FORM);
      setErrors({});
      setErrorGlobal(null);
      setProspectoDisponible(true);
      setCargando(false);
      return;
    }

    const id = prospectoId;
    let activo = true;

    async function cargarProspecto() {
      setCargando(true);
      setErrors({});
      setErrorGlobal(null);
      setProspectoDisponible(true);

      try {
        const prospecto = await getProspectoById(id);

        if (!activo) {
          return;
        }

        if (!prospecto) {
          setProspectoDisponible(false);
          setErrorGlobal("El prospecto solicitado no existe");
          return;
        }

        setProspectoDisponible(true);
        setForm(toFormValues(prospecto));
      } catch (loadError) {
        if (!activo) {
          return;
        }

        setProspectoDisponible(false);
        setErrorGlobal(
          loadError instanceof Error
            ? loadError.message
            : "No se pudo cargar el prospecto para editar"
        );
      } finally {
        if (activo) {
          setCargando(false);
        }
      }
    }

    void cargarProspecto();

    return () => {
      activo = false;
    };
  }, [esEdicion, isEditarRoute, isNuevoRoute, prospectoId]);

  if (!isNuevoRoute && !isEditarRoute) {
    return null;
  }

  function updateField<K extends keyof ProspectoFormValues>(
    field: K,
    value: ProspectoFormValues[K]
  ) {
    setForm(current => ({
      ...current,
      [field]: value,
    }));

    setErrors(current => {
      const next = { ...current };
      delete next[field];

      if (field === "email" || field === "contactoPrincipal") {
        delete next.email;
        delete next.contactoPrincipal;
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
      const prospecto =
        esEdicion && prospectoId
          ? await updateProspecto(prospectoId, payload)
          : await createProspecto(payload);

      toast.success(esEdicion ? "Prospecto actualizado" : "Prospecto creado");
      setLocation(`/prospectos/${prospecto.id}`);
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "No se pudo guardar el prospecto";

      setErrorGlobal(message);
      toast.error(message);
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <DashboardLayout
        titulo={esEdicion ? "Editar Prospecto" : "Nuevo Prospecto"}
        descripcion="Cargando informacion del prospecto"
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

  if (esEdicion && !prospectoDisponible) {
    return (
      <DashboardLayout
        titulo="Editar Prospecto"
        descripcion="No fue posible cargar el formulario"
        acciones={
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/prospectos">
              <ArrowLeft size={18} />
              Volver
            </Link>
          </Button>
        }
      >
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            {errorGlobal ?? "El prospecto solicitado no existe"}
          </p>
          <Button asChild variant="outline">
            <Link href="/prospectos">Volver a Prospectos</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      titulo={esEdicion ? "Editar Prospecto" : "Nuevo Prospecto"}
      descripcion={
        esEdicion
          ? "Actualiza la informacion principal del prospecto"
          : "Registro de nuevos prospectos"
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
                <Label htmlFor="nombre">Nombre</Label>
                <Input
                  id="nombre"
                  value={form.nombre}
                  onChange={event => updateField("nombre", event.target.value)}
                  placeholder="Nombre del prospecto"
                />
                {errors.nombre && (
                  <p className="text-xs text-destructive">{errors.nombre}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="empresa">Empresa</Label>
                <Input
                  id="empresa"
                  value={form.empresa}
                  onChange={event => updateField("empresa", event.target.value)}
                  placeholder="Empresa"
                />
                {errors.empresa && (
                  <p className="text-xs text-destructive">{errors.empresa}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactoPrincipal">Contacto Principal</Label>
                <Input
                  id="contactoPrincipal"
                  value={form.contactoPrincipal}
                  onChange={event =>
                    updateField("contactoPrincipal", event.target.value)
                  }
                  placeholder="Nombre del contacto"
                />
                {errors.contactoPrincipal && (
                  <p className="text-xs text-destructive">
                    {errors.contactoPrincipal}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={event => updateField("email", event.target.value)}
                  placeholder="correo@empresa.com"
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefono">Telefono</Label>
                <Input
                  id="telefono"
                  value={form.telefono}
                  onChange={event =>
                    updateField("telefono", event.target.value)
                  }
                  placeholder="Telefono de contacto"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="estado">Estado</Label>
                <Select
                  value={form.estado}
                  onValueChange={value =>
                    updateField("estado", value as ProspectoEstado)
                  }
                >
                  <SelectTrigger id="estado">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(ProspectoEstado).map(estado => (
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
                <Label htmlFor="fuente">Fuente</Label>
                <Select
                  value={form.fuente}
                  onValueChange={value =>
                    updateField("fuente", value as ProspectoFuente)
                  }
                >
                  <SelectTrigger id="fuente">
                    <SelectValue placeholder="Fuente" />
                  </SelectTrigger>
                  <SelectContent>
                    {FUENTE_OPTIONS.map(fuente => (
                      <SelectItem key={fuente} value={fuente}>
                        {formatFuenteLabel(fuente)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.fuente && (
                  <p className="text-xs text-destructive">{errors.fuente}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="probabilidadConversion">
                  Probabilidad de Conversion
                </Label>
                <Input
                  id="probabilidadConversion"
                  type="number"
                  min="0"
                  max="100"
                  value={form.probabilidadConversion}
                  onChange={event =>
                    updateField("probabilidadConversion", event.target.value)
                  }
                  placeholder="0 a 100"
                />
                {errors.probabilidadConversion && (
                  <p className="text-xs text-destructive">
                    {errors.probabilidadConversion}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="ciudad">Ciudad</Label>
                <Input
                  id="ciudad"
                  value={form.ciudad}
                  onChange={event => updateField("ciudad", event.target.value)}
                  placeholder="Ciudad"
                />
                {errors.ciudad && (
                  <p className="text-xs text-destructive">{errors.ciudad}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="departamento">Departamento</Label>
                <Input
                  id="departamento"
                  value={form.departamento}
                  onChange={event =>
                    updateField("departamento", event.target.value)
                  }
                  placeholder="Departamento"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cargoContacto">Cargo del Contacto</Label>
                <Input
                  id="cargoContacto"
                  value={form.cargoContacto}
                  onChange={event =>
                    updateField("cargoContacto", event.target.value)
                  }
                  placeholder="Cargo"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="montoEstimado">Monto Estimado</Label>
                <Input
                  id="montoEstimado"
                  type="number"
                  min="0"
                  step="1000"
                  value={form.montoEstimado}
                  onChange={event =>
                    updateField("montoEstimado", event.target.value)
                  }
                  placeholder="Monto estimado"
                />
                {errors.montoEstimado && (
                  <p className="text-xs text-destructive">
                    {errors.montoEstimado}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="proximoSeguimiento">Proximo Seguimiento</Label>
                <Input
                  id="proximoSeguimiento"
                  type="date"
                  value={form.proximoSeguimiento}
                  onChange={event =>
                    updateField("proximoSeguimiento", event.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="asignadoA">Asignado A</Label>
                <Input
                  id="asignadoA"
                  value={form.asignadoA}
                  onChange={event =>
                    updateField("asignadoA", event.target.value)
                  }
                  placeholder="Responsable comercial"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="notas">Notas</Label>
                <Textarea
                  id="notas"
                  value={form.notas}
                  onChange={event => updateField("notas", event.target.value)}
                  placeholder="Observaciones del prospecto"
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
                    : "Creando prospecto..."
                  : esEdicion
                    ? "Guardar cambios"
                    : "Crear prospecto"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
