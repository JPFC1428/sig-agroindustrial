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
  createCliente,
  getClienteById,
  updateCliente,
  type ClienteMutationInput,
} from "@/lib/clientes-api";
import { ClienteEstado, type Cliente } from "@/lib/types";

type ClienteFormValues = {
  nombre: string;
  empresa: string;
  email: string;
  telefono: string;
  ciudad: string;
  departamento: string;
  direccion: string;
  estado: ClienteEstado;
  nit: string;
  contactoPrincipal: string;
  cargoContacto: string;
  notas: string;
};

type ClienteFormErrors = Partial<Record<keyof ClienteFormValues, string>>;

const INITIAL_FORM: ClienteFormValues = {
  nombre: "",
  empresa: "",
  email: "",
  telefono: "",
  ciudad: "",
  departamento: "",
  direccion: "",
  estado: ClienteEstado.ACTIVO,
  nit: "",
  contactoPrincipal: "",
  cargoContacto: "",
  notas: "",
};

function toOptionalString(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toFormValues(cliente: Cliente): ClienteFormValues {
  return {
    nombre: cliente.nombre,
    empresa: cliente.empresa,
    email: cliente.email,
    telefono: cliente.telefono,
    ciudad: cliente.ciudad,
    departamento: cliente.departamento,
    direccion: cliente.direccion,
    estado: cliente.estado,
    nit: cliente.nit ?? "",
    contactoPrincipal: cliente.contactoPrincipal,
    cargoContacto: cliente.cargoContacto,
    notas: cliente.notas ?? "",
  };
}

function validateForm(values: ClienteFormValues) {
  const errors: ClienteFormErrors = {};

  if (!values.nombre.trim()) {
    errors.nombre = "El nombre es obligatorio";
  }

  if (!values.empresa.trim()) {
    errors.empresa = "La empresa es obligatoria";
  }

  if (!values.ciudad.trim()) {
    errors.ciudad = "La ciudad es obligatoria";
  }

  if (!values.estado) {
    errors.estado = "Selecciona un estado";
  }

  if (!values.email.trim() && !values.contactoPrincipal.trim()) {
    errors.email = "Ingresa email o contacto principal";
    errors.contactoPrincipal = "Ingresa contacto principal o email";
  }

  return errors;
}

function buildPayload(values: ClienteFormValues): ClienteMutationInput {
  return {
    nombre: values.nombre.trim(),
    empresa: values.empresa.trim(),
    ciudad: values.ciudad.trim(),
    estado: values.estado,
    email: toOptionalString(values.email),
    telefono: toOptionalString(values.telefono),
    departamento: toOptionalString(values.departamento),
    direccion: toOptionalString(values.direccion),
    nit: toOptionalString(values.nit),
    contactoPrincipal: toOptionalString(values.contactoPrincipal),
    cargoContacto: toOptionalString(values.cargoContacto),
    notas: toOptionalString(values.notas),
    tipoCliente: "empresa",
  };
}

export default function ClienteNuevo() {
  const [isNuevoRoute] = useRoute("/clientes/nuevo");
  const [isEditarRoute, editParams] = useRoute("/clientes/:id/editar");
  const [, setLocation] = useLocation();
  const [form, setForm] = useState<ClienteFormValues>(INITIAL_FORM);
  const [errors, setErrors] = useState<ClienteFormErrors>({});
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null);
  const [clienteDisponible, setClienteDisponible] = useState(true);

  const clienteId = isEditarRoute ? editParams?.id : undefined;
  const esEdicion = Boolean(isEditarRoute && clienteId);
  const destinoVolver =
    esEdicion && clienteId ? `/clientes/${clienteId}` : "/clientes";

  useEffect(() => {
    if (!isNuevoRoute && !isEditarRoute) {
      return;
    }

    if (!esEdicion || !clienteId) {
      setForm(INITIAL_FORM);
      setErrors({});
      setErrorGlobal(null);
      setClienteDisponible(true);
      setCargando(false);
      return;
    }

    const id = clienteId;
    let activo = true;

    async function cargarCliente() {
      setCargando(true);
      setErrors({});
      setErrorGlobal(null);
      setClienteDisponible(true);

      try {
        const cliente = await getClienteById(id);

        if (!activo) {
          return;
        }

        if (!cliente) {
          setClienteDisponible(false);
          setErrorGlobal("El cliente solicitado no existe");
          return;
        }

        setClienteDisponible(true);
        setForm(toFormValues(cliente));
      } catch (loadError) {
        if (!activo) {
          return;
        }

        setClienteDisponible(false);
        setErrorGlobal(
          loadError instanceof Error
            ? loadError.message
            : "No se pudo cargar el cliente para editar"
        );
      } finally {
        if (activo) {
          setCargando(false);
        }
      }
    }

    void cargarCliente();

    return () => {
      activo = false;
    };
  }, [clienteId, esEdicion, isEditarRoute, isNuevoRoute]);

  if (!isNuevoRoute && !isEditarRoute) {
    return null;
  }

  function updateField<K extends keyof ClienteFormValues>(
    field: K,
    value: ClienteFormValues[K]
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
      const cliente =
        esEdicion && clienteId
          ? await updateCliente(clienteId, payload)
          : await createCliente(payload);

      toast.success(esEdicion ? "Cliente actualizado" : "Cliente creado");
      setLocation(`/clientes/${cliente.id}`);
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "No se pudo guardar el cliente";

      setErrorGlobal(message);
      toast.error(message);
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <DashboardLayout
        titulo={esEdicion ? "Editar Cliente" : "Nuevo Cliente"}
        descripcion="Cargando informacion del cliente"
        acciones={
          <Link href={destinoVolver}>
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft size={18} />
              Volver
            </Button>
          </Link>
        }
      >
        <div className="text-center py-12">
          <p className="text-muted-foreground">Cargando formulario...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (esEdicion && !clienteDisponible) {
    return (
      <DashboardLayout
        titulo="Editar Cliente"
        descripcion="No fue posible cargar el formulario"
        acciones={
          <Link href="/clientes">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft size={18} />
              Volver
            </Button>
          </Link>
        }
      >
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            {errorGlobal ?? "El cliente solicitado no existe"}
          </p>
          <Link href="/clientes">
            <Button variant="outline">Volver a Clientes</Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      titulo={esEdicion ? "Editar Cliente" : "Nuevo Cliente"}
      descripcion={
        esEdicion
          ? "Actualiza la informacion principal del cliente"
          : "Registro de nuevos clientes"
      }
      acciones={
        <Link href={destinoVolver}>
          <Button variant="outline" size="sm" className="gap-2">
            <ArrowLeft size={18} />
            Volver
          </Button>
        </Link>
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
                  onChange={e => updateField("nombre", e.target.value)}
                  placeholder="Nombre del cliente"
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
                  onChange={e => updateField("empresa", e.target.value)}
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
                  onChange={e =>
                    updateField("contactoPrincipal", e.target.value)
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
                  onChange={e => updateField("email", e.target.value)}
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
                  onChange={e => updateField("telefono", e.target.value)}
                  placeholder="Telefono de contacto"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="estado">Estado</Label>
                <Select
                  value={form.estado}
                  onValueChange={value =>
                    updateField("estado", value as ClienteEstado)
                  }
                >
                  <SelectTrigger id="estado">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(ClienteEstado).map(estado => (
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
                <Label htmlFor="ciudad">Ciudad</Label>
                <Input
                  id="ciudad"
                  value={form.ciudad}
                  onChange={e => updateField("ciudad", e.target.value)}
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
                  onChange={e => updateField("departamento", e.target.value)}
                  placeholder="Departamento"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="direccion">Direccion</Label>
                <Input
                  id="direccion"
                  value={form.direccion}
                  onChange={e => updateField("direccion", e.target.value)}
                  placeholder="Direccion"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nit">NIT</Label>
                <Input
                  id="nit"
                  value={form.nit}
                  onChange={e => updateField("nit", e.target.value)}
                  placeholder="NIT"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cargoContacto">Cargo del Contacto</Label>
                <Input
                  id="cargoContacto"
                  value={form.cargoContacto}
                  onChange={e => updateField("cargoContacto", e.target.value)}
                  placeholder="Cargo"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="notas">Notas</Label>
                <Textarea
                  id="notas"
                  value={form.notas}
                  onChange={e => updateField("notas", e.target.value)}
                  placeholder="Observaciones del cliente"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-6 mt-6 border-t border-border">
              <Link href={destinoVolver}>
                <Button variant="outline" type="button">
                  Cancelar
                </Button>
              </Link>
              <Button type="submit" className="gap-2" disabled={guardando}>
                <Save size={16} />
                {guardando
                  ? esEdicion
                    ? "Guardando cambios..."
                    : "Creando cliente..."
                  : esEdicion
                    ? "Guardar cambios"
                    : "Crear cliente"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
