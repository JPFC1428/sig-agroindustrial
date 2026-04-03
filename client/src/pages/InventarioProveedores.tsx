import { useEffect, useState } from "react";
import { Save, Search } from "lucide-react";
import { toast } from "sonner";
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
  createInventarioProveedor,
  getInventarioProveedores,
} from "@/lib/inventario-api";
import { ContableTerceroEstado, type ContableTercero } from "@/lib/types";

type ProveedorFormValues = {
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

const INITIAL_FORM: ProveedorFormValues = {
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

function formatDateTime(value: Date) {
  return value.toLocaleString("es-CO");
}

function formatEstadoLabel(estado: ContableTerceroEstado) {
  return estado === ContableTerceroEstado.ACTIVO ? "Activo" : "Inactivo";
}

function getEstadoBadge(estado: ContableTerceroEstado) {
  return estado === ContableTerceroEstado.ACTIVO
    ? "bg-emerald-100 text-emerald-800"
    : "bg-slate-100 text-slate-800";
}

export default function InventarioProveedores() {
  const [proveedores, setProveedores] = useState<ContableTercero[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<
    ContableTerceroEstado | "todos"
  >("todos");
  const [form, setForm] = useState<ProveedorFormValues>(INITIAL_FORM);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cargarProveedores() {
    setCargando(true);

    try {
      const data = await getInventarioProveedores({
        q: busqueda.trim() || undefined,
        estado: filtroEstado === "todos" ? undefined : filtroEstado,
      });

      setProveedores(data);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudieron cargar los proveedores"
      );
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void cargarProveedores();
  }, [busqueda, filtroEstado]);

  async function handleCrearProveedor() {
    setGuardando(true);
    setError(null);

    try {
      const created = await createInventarioProveedor({
        nombreRazonSocial: form.nombreRazonSocial,
        documentoNit: form.documentoNit,
        contacto: form.contacto.trim() || undefined,
        telefono: form.telefono.trim() || undefined,
        correo: form.correo.trim() || undefined,
        ciudad: form.ciudad.trim() || undefined,
        direccion: form.direccion.trim() || undefined,
        observaciones: form.observaciones.trim() || undefined,
        estado: form.estado,
      });

      toast.success("Proveedor registrado");
      setForm(INITIAL_FORM);
      setProveedores(current => [created, ...current]);
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "No se pudo registrar el proveedor";

      setError(message);
      toast.error(message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <DashboardLayout
      titulo="Proveedores"
      descripcion="Base de proveedores para Inventario / Compras reutilizando terceros tipo proveedor"
    >
      {error && (
        <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.35fr,0.95fr]">
        <div className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <div className="grid gap-4 md:grid-cols-[1.3fr,0.7fr]">
              <div className="relative">
                <Search
                  size={18}
                  className="absolute left-3 top-3 text-muted-foreground"
                />
                <Input
                  value={busqueda}
                  onChange={event => setBusqueda(event.target.value)}
                  placeholder="Buscar por proveedor, NIT, contacto o ciudad..."
                  className="pl-10"
                />
              </div>

              <Select
                value={filtroEstado}
                onValueChange={value =>
                  setFiltroEstado(value as ContableTerceroEstado | "todos")
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los estados</SelectItem>
                  {Object.values(ContableTerceroEstado).map(estado => (
                    <SelectItem key={estado} value={estado}>
                      {formatEstadoLabel(estado)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <p>
                Lo que registres aqui queda disponible para compras sin duplicar
                terceros.
              </p>
              <p>
                {cargando
                  ? "Cargando proveedores..."
                  : `${proveedores.length} proveedor${proveedores.length !== 1 ? "es" : ""}`}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-accent">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Proveedor
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Contacto
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Ciudad
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Estado
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Registro
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {proveedores.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-10 text-center text-sm text-muted-foreground"
                      >
                        {cargando
                          ? "Cargando proveedores..."
                          : "No hay proveedores registrados con esos filtros"}
                      </td>
                    </tr>
                  ) : (
                    proveedores.map((proveedor, index) => (
                      <tr
                        key={proveedor.id}
                        className={`border-b border-border ${
                          index % 2 === 0 ? "bg-background" : "bg-accent/40"
                        }`}
                      >
                        <td className="px-6 py-4">
                          <p className="font-medium text-foreground">
                            {proveedor.nombreRazonSocial}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {proveedor.documentoNit}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-sm text-foreground">
                          <p>{proveedor.contacto || "Sin contacto"}</p>
                          <p className="text-xs text-muted-foreground">
                            {proveedor.correo || proveedor.telefono || "Sin dato"}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-sm text-foreground">
                          {proveedor.ciudad || "Sin ciudad"}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getEstadoBadge(proveedor.estado)}`}
                          >
                            {formatEstadoLabel(proveedor.estado)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">
                          {formatDateTime(proveedor.createdAt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-foreground">
              Nuevo proveedor
            </h2>
            <p className="text-sm text-muted-foreground">
              Se guarda en terceros como proveedor y queda listo para compras.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
            <div className="space-y-2">
              <Label htmlFor="nombreRazonSocial">Nombre / Razon social</Label>
              <Input
                id="nombreRazonSocial"
                value={form.nombreRazonSocial}
                onChange={event =>
                  setForm(current => ({
                    ...current,
                    nombreRazonSocial: event.target.value,
                  }))
                }
                placeholder="Proveedor Industrial SAS"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="documentoNit">Documento / NIT</Label>
              <Input
                id="documentoNit"
                value={form.documentoNit}
                onChange={event =>
                  setForm(current => ({
                    ...current,
                    documentoNit: event.target.value,
                  }))
                }
                placeholder="900123456-7"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contacto">Contacto</Label>
              <Input
                id="contacto"
                value={form.contacto}
                onChange={event =>
                  setForm(current => ({ ...current, contacto: event.target.value }))
                }
                placeholder="Nombre del contacto"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefono">Telefono</Label>
              <Input
                id="telefono"
                value={form.telefono}
                onChange={event =>
                  setForm(current => ({ ...current, telefono: event.target.value }))
                }
                placeholder="3000000000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="correo">Correo</Label>
              <Input
                id="correo"
                type="email"
                value={form.correo}
                onChange={event =>
                  setForm(current => ({ ...current, correo: event.target.value }))
                }
                placeholder="compras@proveedor.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ciudad">Ciudad</Label>
              <Input
                id="ciudad"
                value={form.ciudad}
                onChange={event =>
                  setForm(current => ({ ...current, ciudad: event.target.value }))
                }
                placeholder="Bogota"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="direccion">Direccion</Label>
              <Input
                id="direccion"
                value={form.direccion}
                onChange={event =>
                  setForm(current => ({ ...current, direccion: event.target.value }))
                }
                placeholder="Direccion principal"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="estadoProveedor">Estado</Label>
              <Select
                value={form.estado}
                onValueChange={value =>
                  setForm(current => ({
                    ...current,
                    estado: value as ContableTerceroEstado,
                  }))
                }
              >
                <SelectTrigger id="estadoProveedor">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(ContableTerceroEstado).map(estado => (
                    <SelectItem key={estado} value={estado}>
                      {formatEstadoLabel(estado)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2 xl:col-span-1">
              <Label htmlFor="observacionesProveedor">Observaciones</Label>
              <Textarea
                id="observacionesProveedor"
                value={form.observaciones}
                onChange={event =>
                  setForm(current => ({
                    ...current,
                    observaciones: event.target.value,
                  }))
                }
                placeholder="Notas operativas para compras o inventario"
                rows={4}
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              type="button"
              onClick={() => void handleCrearProveedor()}
              disabled={guardando}
              className="gap-2"
            >
              <Save size={16} />
              {guardando ? "Guardando..." : "Registrar Proveedor"}
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
