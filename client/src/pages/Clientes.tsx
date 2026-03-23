/**
 * Pagina de Clientes - Gestion de cartera de clientes
 *
 * Componentes:
 * - Tabla de clientes con busqueda
 * - Filtros por estado y ciudad
 * - Botones de accion (crear, editar, ver detalle, eliminar)
 * - Paginacion
 */

import { useEffect, useMemo, useState } from "react";
import {
  Edit,
  Eye,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
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
import { deleteCliente, getClientes } from "@/lib/clientes-api";
import { ClienteEstado, type Cliente } from "@/lib/types";

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<ClienteEstado | "todos">(
    "todos"
  );
  const [filtroCiudad, setFiltroCiudad] = useState("todos");
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
        const data = await getClientes();

        if (!activo) {
          return;
        }

        setClientes(data);
      } catch (loadError) {
        if (!activo) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudieron cargar los clientes"
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
  }, [busqueda, filtroEstado, filtroCiudad]);

  const clientesFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();

    return clientes.filter(cliente => {
      const coincideBusqueda =
        termino === "" ||
        [
          cliente.nombre,
          cliente.empresa,
          cliente.email,
          cliente.telefono,
          cliente.nit ?? "",
        ].some(valor => valor.toLowerCase().includes(termino));

      const coincideEstado =
        filtroEstado === "todos" || cliente.estado === filtroEstado;
      const coincideCiudad =
        filtroCiudad === "todos" || cliente.ciudad === filtroCiudad;

      return coincideBusqueda && coincideEstado && coincideCiudad;
    });
  }, [clientes, busqueda, filtroEstado, filtroCiudad]);

  const totalPaginas = Math.max(
    1,
    Math.ceil(clientesFiltrados.length / itemsPorPagina)
  );

  useEffect(() => {
    setPagina(paginaActual =>
      Math.min(Math.max(paginaActual, 1), totalPaginas)
    );
  }, [totalPaginas]);

  const clientesPaginados = clientesFiltrados.slice(
    (pagina - 1) * itemsPorPagina,
    pagina * itemsPorPagina
  );

  const desde =
    clientesFiltrados.length === 0 ? 0 : (pagina - 1) * itemsPorPagina + 1;
  const hasta =
    clientesFiltrados.length === 0
      ? 0
      : Math.min(pagina * itemsPorPagina, clientesFiltrados.length);

  const ciudades = Array.from(new Set(clientes.map(c => c.ciudad))).sort();
  const estados = Object.values(ClienteEstado);

  const getEstadoBadge = (estado: ClienteEstado) => {
    const estilos = {
      [ClienteEstado.ACTIVO]: "bg-green-100 text-green-800",
      [ClienteEstado.INACTIVO]: "bg-gray-100 text-gray-800",
      [ClienteEstado.SUSPENDIDO]: "bg-red-100 text-red-800",
    };

    return estilos[estado];
  };

  async function handleEliminar(cliente: Cliente) {
    const confirmado = window.confirm(
      `¿Eliminar al cliente "${cliente.nombre}"?`
    );

    if (!confirmado) {
      return;
    }

    setEliminandoId(cliente.id);
    setError(null);

    try {
      await deleteCliente(cliente.id);
      const data = await getClientes();
      setClientes(data);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "No se pudo eliminar el cliente"
      );
    } finally {
      setEliminandoId(null);
    }
  }

  return (
    <DashboardLayout
      titulo="Clientes"
      descripcion="Gestion de cartera de clientes activos"
      acciones={
        <Button asChild className="gap-2">
          <Link href="/clientes/nuevo">
            <Plus size={18} />
            Nuevo Cliente
          </Link>
        </Button>
      }
    >
      <div className="bg-card rounded-lg border border-border p-6 mb-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-3 text-muted-foreground"
            />
            <Input
              placeholder="Buscar cliente..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select
            value={filtroEstado}
            onValueChange={value =>
              setFiltroEstado(value as ClienteEstado | "todos")
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

          <Select value={filtroCiudad} onValueChange={setFiltroCiudad}>
            <SelectTrigger>
              <SelectValue placeholder="Ciudad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas las ciudades</SelectItem>
              {ciudades.map(ciudad => (
                <SelectItem key={ciudad} value={ciudad}>
                  {ciudad}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center justify-end text-sm text-muted-foreground">
            {cargando
              ? "Cargando clientes..."
              : `${clientesFiltrados.length} cliente${
                  clientesFiltrados.length !== 1 ? "s" : ""
                }`}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive rounded-lg border border-destructive/20 px-4 py-3 mb-6 text-sm">
          {error}
        </div>
      )}

      <div className="bg-card rounded-lg border border-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-accent">
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Nombre
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Empresa
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
                  Compras
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
                    Cargando clientes...
                  </td>
                </tr>
              ) : clientesPaginados.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-10 text-center text-sm text-muted-foreground"
                  >
                    No se encontraron clientes
                  </td>
                </tr>
              ) : (
                clientesPaginados.map((cliente, idx) => (
                  <tr
                    key={cliente.id}
                    className={`border-b border-border transition-smooth hover:bg-accent ${
                      idx % 2 === 0 ? "bg-background" : "bg-accent/50"
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-foreground">
                          {cliente.nombre}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {cliente.nit}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      {cliente.empresa}
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-foreground">
                          <Mail size={14} className="text-muted-foreground" />
                          <span className="truncate">{cliente.email}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-foreground">
                          <Phone size={14} className="text-muted-foreground" />
                          <span>{cliente.telefono}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-foreground">
                        <MapPin size={14} className="text-muted-foreground" />
                        {cliente.ciudad}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${getEstadoBadge(
                          cliente.estado
                        )}`}
                      >
                        {cliente.estado.charAt(0).toUpperCase() +
                          cliente.estado.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      <div>
                        <p className="font-medium">{cliente.totalCompras}</p>
                        <p className="text-xs text-muted-foreground">
                          ${(cliente.montoTotalCompras / 1000000).toFixed(1)}M
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <Link
                          href={`/clientes/${cliente.id}`}
                          className="p-2 hover:bg-background rounded transition-smooth text-muted-foreground hover:text-foreground"
                        >
                          <Eye size={18} />
                        </Link>
                        <Link
                          href={`/clientes/${cliente.id}/editar`}
                          className="p-2 hover:bg-background rounded transition-smooth text-muted-foreground hover:text-foreground"
                        >
                          <Edit size={18} />
                        </Link>
                        <button
                          className="p-2 hover:bg-background rounded transition-smooth text-muted-foreground hover:text-destructive disabled:opacity-50"
                          onClick={() => void handleEliminar(cliente)}
                          disabled={eliminandoId === cliente.id}
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
            Mostrando {desde} a {hasta} de {clientesFiltrados.length}
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
                pagina === totalPaginas || clientesFiltrados.length === 0
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
