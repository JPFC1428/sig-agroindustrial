import { useEffect, useState } from "react";
import { Edit, Mail, MapPin, Phone, Plus, Search, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  deleteContableTercero,
  getContableTerceros,
} from "@/lib/contable-terceros-api";
import {
  ContableTerceroEstado,
  ContableTerceroTipo,
  type ContableTercero,
} from "@/lib/types";

function getTipoBadge(tipo: ContableTerceroTipo) {
  const styles = {
    [ContableTerceroTipo.CLIENTE]: "bg-blue-100 text-blue-800",
    [ContableTerceroTipo.PROVEEDOR]: "bg-emerald-100 text-emerald-800",
    [ContableTerceroTipo.EMPLEADO]: "bg-amber-100 text-amber-800",
    [ContableTerceroTipo.BANCO]: "bg-violet-100 text-violet-800",
    [ContableTerceroTipo.OTRO]: "bg-slate-100 text-slate-800",
  };

  return styles[tipo];
}

function getEstadoBadge(estado: ContableTerceroEstado) {
  const styles = {
    [ContableTerceroEstado.ACTIVO]: "bg-green-100 text-green-800",
    [ContableTerceroEstado.INACTIVO]: "bg-gray-100 text-gray-800",
  };

  return styles[estado];
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

export default function ContableTerceros() {
  const [terceros, setTerceros] = useState<ContableTercero[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<ContableTerceroTipo | "todos">(
    "todos"
  );
  const [filtroEstado, setFiltroEstado] = useState<
    ContableTerceroEstado | "todos"
  >("todos");
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const itemsPorPagina = 10;

  useEffect(() => {
    let activo = true;

    async function cargar() {
      setCargando(true);
      setError(null);

      try {
        const data = await getContableTerceros({
          estado: filtroEstado === "todos" ? undefined : filtroEstado,
          q: busqueda || undefined,
          tipo: filtroTipo === "todos" ? undefined : filtroTipo,
        });

        if (!activo) {
          return;
        }

        setTerceros(data);
      } catch (loadError) {
        if (!activo) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudieron cargar los terceros"
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
  }, [busqueda, filtroEstado, filtroTipo]);

  useEffect(() => {
    setPagina(1);
  }, [busqueda, filtroEstado, filtroTipo]);

  const totalPaginas = Math.max(1, Math.ceil(terceros.length / itemsPorPagina));

  useEffect(() => {
    setPagina(actual => Math.min(Math.max(actual, 1), totalPaginas));
  }, [totalPaginas]);

  const tercerosPaginados = terceros.slice(
    (pagina - 1) * itemsPorPagina,
    pagina * itemsPorPagina
  );

  const desde = terceros.length === 0 ? 0 : (pagina - 1) * itemsPorPagina + 1;
  const hasta =
    terceros.length === 0 ? 0 : Math.min(pagina * itemsPorPagina, terceros.length);

  async function handleEliminar(tercero: ContableTercero) {
    const confirmado = window.confirm(
      `Eliminar al tercero "${tercero.nombreRazonSocial}"?`
    );

    if (!confirmado) {
      return;
    }

    setEliminandoId(tercero.id);
    setError(null);

    try {
      await deleteContableTercero(tercero.id);
      setTerceros(current => current.filter(item => item.id !== tercero.id));
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "No se pudo eliminar el tercero"
      );
    } finally {
      setEliminandoId(null);
    }
  }

  return (
    <DashboardLayout
      titulo="Terceros"
      descripcion="Catalogo base del modulo Contable para clientes, proveedores y relacionados"
      acciones={
        <Button asChild className="gap-2">
          <Link href="/contable/terceros/nuevo">
            <Plus size={18} />
            Nuevo Tercero
          </Link>
        </Button>
      }
    >
      <div className="mb-6 rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search
              size={18}
              className="absolute left-3 top-3 text-muted-foreground"
            />
            <Input
              placeholder="Buscar por nombre, documento, contacto o ciudad..."
              value={busqueda}
              onChange={event => setBusqueda(event.target.value)}
              className="pl-10"
            />
          </div>

          <Select
            value={filtroTipo}
            onValueChange={value =>
              setFiltroTipo(value as ContableTerceroTipo | "todos")
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Tipo de tercero" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los tipos</SelectItem>
              {Object.values(ContableTerceroTipo).map(tipo => (
                <SelectItem key={tipo} value={tipo}>
                  {formatTipoLabel(tipo)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

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

        <div className="mt-4 flex items-center justify-end text-sm text-muted-foreground">
          {cargando
            ? "Cargando terceros..."
            : `${terceros.length} tercero${terceros.length !== 1 ? "s" : ""}`}
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-accent">
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Tercero
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Documento / NIT
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Tipo
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Ubicacion
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Estado
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
                    colSpan={6}
                    className="px-6 py-10 text-center text-sm text-muted-foreground"
                  >
                    Cargando terceros...
                  </td>
                </tr>
              ) : tercerosPaginados.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-10 text-center text-sm text-muted-foreground"
                  >
                    No se encontraron terceros
                  </td>
                </tr>
              ) : (
                tercerosPaginados.map((tercero, index) => (
                  <tr
                    key={tercero.id}
                    className={`border-b border-border transition-smooth hover:bg-accent ${
                      index % 2 === 0 ? "bg-background" : "bg-accent/40"
                    }`}
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-foreground">
                        {tercero.nombreRazonSocial}
                      </p>
                      <div className="mt-1 space-y-1 text-xs text-muted-foreground">
                        {tercero.contacto && <p>{tercero.contacto}</p>}
                        {tercero.correo && (
                          <p className="flex items-center gap-1">
                            <Mail size={12} />
                            {tercero.correo}
                          </p>
                        )}
                        {tercero.telefono && (
                          <p className="flex items-center gap-1">
                            <Phone size={12} />
                            {tercero.telefono}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-foreground">
                        {tercero.documentoNit}
                      </p>
                      {tercero.direccion && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {tercero.direccion}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${getTipoBadge(
                          tercero.tipoTercero
                        )}`}
                      >
                        {formatTipoLabel(tercero.tipoTercero)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="flex items-center gap-1 text-sm text-foreground">
                        <MapPin size={14} className="text-muted-foreground" />
                        {tercero.ciudad || "Sin ciudad"}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${getEstadoBadge(
                          tercero.estado
                        )}`}
                      >
                        {formatEstadoLabel(tercero.estado)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <Link
                          href={`/contable/terceros/${tercero.id}/editar`}
                          className="rounded p-2 text-muted-foreground transition-smooth hover:bg-background hover:text-foreground"
                          title="Editar tercero"
                        >
                          <Edit size={18} />
                        </Link>
                        <button
                          className="rounded p-2 text-muted-foreground transition-smooth hover:bg-background hover:text-destructive disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={eliminandoId === tercero.id}
                          onClick={() => void handleEliminar(tercero)}
                          title="Eliminar tercero"
                          type="button"
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

        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <p className="text-sm text-muted-foreground">
            Mostrando {desde} a {hasta} de {terceros.length}
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
              disabled={pagina === totalPaginas}
            >
              Siguiente
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
