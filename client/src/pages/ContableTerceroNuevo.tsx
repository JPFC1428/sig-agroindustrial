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
  createContableTercero,
  getContableTerceroById,
  updateContableTercero,
  type ContableTerceroMutationInput,
} from "@/lib/contable-terceros-api";
import {
  ContableTerceroEstado,
  ContableTerceroTipo,
  type ContableTercero,
} from "@/lib/types";

type ContableTerceroFormValues = {
  tipoTercero: ContableTerceroTipo;
  nombreRazonSocial: string;
  documentoNit: string;
  contacto: string;
  telefono: string;
  correo: string;
  ciudad: string;
  direccion: string;
  observaciones: string;
  estado: ContableTerceroEstado;
};

type ContableTerceroFormErrors = Partial<
  Record<keyof ContableTerceroFormValues, string>
>;

const INITIAL_FORM: ContableTerceroFormValues = {
  tipoTercero: ContableTerceroTipo.CLIENTE,
  nombreRazonSocial: "",
  documentoNit: "",
  contacto: "",
  telefono: "",
  correo: "",
  ciudad: "",
  direccion: "",
  observaciones: "",
  estado: ContableTerceroEstado.ACTIVO,
};

function toOptionalString(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toFormValues(tercero: ContableTercero): ContableTerceroFormValues {
  return {
    tipoTercero: tercero.tipoTercero,
    nombreRazonSocial: tercero.nombreRazonSocial,
    documentoNit: tercero.documentoNit,
    contacto: tercero.contacto ?? "",
    telefono: tercero.telefono ?? "",
    correo: tercero.correo ?? "",
    ciudad: tercero.ciudad ?? "",
    direccion: tercero.direccion ?? "",
    observaciones: tercero.observaciones ?? "",
    estado: tercero.estado,
  };
}

function validateForm(values: ContableTerceroFormValues) {
  const errors: ContableTerceroFormErrors = {};

  if (!values.nombreRazonSocial.trim()) {
    errors.nombreRazonSocial = "El nombre o razon social es obligatorio";
  }

  if (!values.documentoNit.trim()) {
    errors.documentoNit = "El documento o NIT es obligatorio";
  }

  if (!values.tipoTercero) {
    errors.tipoTercero = "Selecciona un tipo de tercero";
  }

  if (!values.estado) {
    errors.estado = "Selecciona un estado";
  }

  if (
    values.correo.trim() &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.correo.trim())
  ) {
    errors.correo = "El correo ingresado no es valido";
  }

  return errors;
}

function buildPayload(
  values: ContableTerceroFormValues
): ContableTerceroMutationInput {
  return {
    tipoTercero: values.tipoTercero,
    nombreRazonSocial: values.nombreRazonSocial.trim(),
    documentoNit: values.documentoNit.trim(),
    contacto: toOptionalString(values.contacto),
    telefono: toOptionalString(values.telefono),
    correo: toOptionalString(values.correo),
    ciudad: toOptionalString(values.ciudad),
    direccion: toOptionalString(values.direccion),
    observaciones: toOptionalString(values.observaciones),
    estado: values.estado,
  };
}

function formatTipoLabel(tipo: ContableTerceroTipo) {
  switch (tipo) {
    case ContableTerceroTipo.CLIENTE:
      return "Cliente";
    case ContableTerceroTipo.PROVEEDOR:
      return "Proveedor";
    case ContableTerceroTipo.EMPLEADO:
      return "Empleado";
    case ContableTerceroTipo.BANCO:
      return "Banco";
    case ContableTerceroTipo.OTRO:
      return "Otro";
    default:
      return tipo;
  }
}

function formatEstadoLabel(estado: ContableTerceroEstado) {
  return estado === ContableTerceroEstado.ACTIVO ? "Activo" : "Inactivo";
}

export default function ContableTerceroNuevo() {
  const [isNuevoRoute] = useRoute("/contable/terceros/nuevo");
  const [isEditarRoute, editParams] = useRoute("/contable/terceros/:id/editar");
  const [, setLocation] = useLocation();
  const [form, setForm] = useState<ContableTerceroFormValues>(INITIAL_FORM);
  const [errors, setErrors] = useState<ContableTerceroFormErrors>({});
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null);
  const [terceroDisponible, setTerceroDisponible] = useState(true);

  const terceroId = isEditarRoute ? editParams?.id : undefined;
  const esEdicion = Boolean(isEditarRoute && terceroId);
  const destinoVolver = "/contable/terceros";

  useEffect(() => {
    if (!isNuevoRoute && !isEditarRoute) {
      return;
    }

    if (!esEdicion || !terceroId) {
      setForm(INITIAL_FORM);
      setErrors({});
      setErrorGlobal(null);
      setTerceroDisponible(true);
      setCargando(false);
      return;
    }

    const id = terceroId;
    let activo = true;

    async function cargarTercero() {
      setCargando(true);
      setErrors({});
      setErrorGlobal(null);
      setTerceroDisponible(true);

      try {
        const tercero = await getContableTerceroById(id);

        if (!activo) {
          return;
        }

        if (!tercero) {
          setTerceroDisponible(false);
          setErrorGlobal("El tercero solicitado no existe");
          return;
        }

        setForm(toFormValues(tercero));
      } catch (loadError) {
        if (!activo) {
          return;
        }

        setTerceroDisponible(false);
        setErrorGlobal(
          loadError instanceof Error
            ? loadError.message
            : "No se pudo cargar el tercero para editar"
        );
      } finally {
        if (activo) {
          setCargando(false);
        }
      }
    }

    void cargarTercero();

    return () => {
      activo = false;
    };
  }, [esEdicion, isEditarRoute, isNuevoRoute, terceroId]);

  if (!isNuevoRoute && !isEditarRoute) {
    return null;
  }

  function updateField<K extends keyof ContableTerceroFormValues>(
    field: K,
    value: ContableTerceroFormValues[K]
  ) {
    setForm(current => ({
      ...current,
      [field]: value,
    }));

    setErrors(current => {
      const next = { ...current };
      delete next[field];
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

      if (esEdicion && terceroId) {
        await updateContableTercero(terceroId, payload);
      } else {
        await createContableTercero(payload);
      }

      toast.success(esEdicion ? "Tercero actualizado" : "Tercero creado");
      setLocation(destinoVolver);
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "No se pudo guardar el tercero";

      setErrorGlobal(message);
      toast.error(message);
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <DashboardLayout
        titulo={esEdicion ? "Editar Tercero" : "Nuevo Tercero"}
        descripcion="Cargando informacion del tercero"
        acciones={
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href={destinoVolver}>
              <ArrowLeft size={18} />
              Volver
            </Link>
          </Button>
        }
      >
        <div className="py-12 text-center">
          <p className="text-muted-foreground">Cargando formulario...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (esEdicion && !terceroDisponible) {
    return (
      <DashboardLayout
        titulo="Editar Tercero"
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
        <div className="py-12 text-center">
          <p className="mb-4 text-muted-foreground">
            {errorGlobal ?? "El tercero solicitado no existe"}
          </p>
          <Button asChild variant="outline">
            <Link href={destinoVolver}>Volver a Terceros</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      titulo={esEdicion ? "Editar Tercero" : "Nuevo Tercero"}
      descripcion={
        esEdicion
          ? "Actualiza la informacion base del tercero"
          : "Registro base de terceros para el modulo Contable"
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
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorGlobal}
          </div>
        )}

        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-foreground">
              Informacion principal
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Base compartida para futuras fases contables como compras, cartera y bancos.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tipoTercero">Tipo de tercero</Label>
              <Select
                value={form.tipoTercero}
                onValueChange={value =>
                  updateField("tipoTercero", value as ContableTerceroTipo)
                }
              >
                <SelectTrigger id="tipoTercero">
                  <SelectValue placeholder="Selecciona un tipo" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(ContableTerceroTipo).map(tipo => (
                    <SelectItem key={tipo} value={tipo}>
                      {formatTipoLabel(tipo)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.tipoTercero && (
                <p className="text-sm text-destructive">{errors.tipoTercero}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="estado">Estado</Label>
              <Select
                value={form.estado}
                onValueChange={value =>
                  updateField("estado", value as ContableTerceroEstado)
                }
              >
                <SelectTrigger id="estado">
                  <SelectValue placeholder="Selecciona un estado" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(ContableTerceroEstado).map(estado => (
                    <SelectItem key={estado} value={estado}>
                      {formatEstadoLabel(estado)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.estado && (
                <p className="text-sm text-destructive">{errors.estado}</p>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="nombreRazonSocial">Nombre o razon social</Label>
              <Input
                id="nombreRazonSocial"
                value={form.nombreRazonSocial}
                onChange={event =>
                  updateField("nombreRazonSocial", event.target.value)
                }
                placeholder="Nombre completo o razon social"
              />
              {errors.nombreRazonSocial && (
                <p className="text-sm text-destructive">
                  {errors.nombreRazonSocial}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="documentoNit">Documento o NIT</Label>
              <Input
                id="documentoNit"
                value={form.documentoNit}
                onChange={event =>
                  updateField("documentoNit", event.target.value)
                }
                placeholder="Documento, cedula o NIT"
              />
              {errors.documentoNit && (
                <p className="text-sm text-destructive">{errors.documentoNit}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="contacto">Contacto</Label>
              <Input
                id="contacto"
                value={form.contacto}
                onChange={event => updateField("contacto", event.target.value)}
                placeholder="Nombre del contacto principal"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefono">Telefono</Label>
              <Input
                id="telefono"
                value={form.telefono}
                onChange={event => updateField("telefono", event.target.value)}
                placeholder="Telefono fijo o celular"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="correo">Correo</Label>
              <Input
                id="correo"
                type="email"
                value={form.correo}
                onChange={event => updateField("correo", event.target.value)}
                placeholder="correo@empresa.com"
              />
              {errors.correo && (
                <p className="text-sm text-destructive">{errors.correo}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="ciudad">Ciudad</Label>
              <Input
                id="ciudad"
                value={form.ciudad}
                onChange={event => updateField("ciudad", event.target.value)}
                placeholder="Ciudad principal"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="direccion">Direccion</Label>
              <Input
                id="direccion"
                value={form.direccion}
                onChange={event => updateField("direccion", event.target.value)}
                placeholder="Direccion principal"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="observaciones">Observaciones</Label>
              <Textarea
                id="observaciones"
                value={form.observaciones}
                onChange={event =>
                  updateField("observaciones", event.target.value)
                }
                placeholder="Notas internas, condiciones o comentarios"
                rows={4}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Button asChild type="button" variant="outline">
            <Link href={destinoVolver}>Cancelar</Link>
          </Button>
          <Button type="submit" className="gap-2" disabled={guardando}>
            <Save size={18} />
            {guardando
              ? "Guardando..."
              : esEdicion
                ? "Actualizar Tercero"
                : "Guardar Tercero"}
          </Button>
        </div>
      </form>
    </DashboardLayout>
  );
}
