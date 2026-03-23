/**
 * Pagina de Prospectos - Gestion de cartera de prospectos
 *
 * Componentes:
 * - Tabla de prospectos con busqueda
 * - Filtros por estado y probabilidad
 * - Botones de accion (crear, editar, ver detalle, eliminar)
 * - Paginacion
 */

import { useEffect, useMemo, useState } from "react";
import { Edit, Eye, Mail, Phone, Plus, Search, Trash2 } from "lucide-react";
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
import { deleteProspecto, getProspectos } from "@/lib/prospectos-api";
import { ProspectoEstado, type Prospecto } from "@/lib/types";

type FiltroProbabilidad = "todos" | "alta" | "media" | "baja";

function matchesProbabilidad(probabilidad: number, filtro: FiltroProbabilidad) {
  if (filtro === "alta") {
    return probabilidad >= 70;
  }

  if (filtro === "media") {
    return probabilidad >= 40 && probabilidad < 70;
  }

  if (filtro === "baja") {
    return probabilidad < 40;
  }

  return true;
}

export default function Prospectos() {
  const [prospectos, setProspectos] = useState<Prospecto[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<ProspectoEstado | "todos">(
    "todos"
  );
  const [filtroProbabilidad, setFiltroProbabilidad] =
    useState<FiltroProbabilidad>("todos");
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
        const data = await getProspectos();

        if (!activo) {
          return;
        }

        setProspectos(data);
      } catch (loadError) {
        if (!activo) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudieron cargar los prospectos"
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
  }, [busqueda, filtroEstado, filtroProbabilidad]);

  const prospectosFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();

    return prospectos.filter(prospecto => {
      const coincideBusqueda =
        termino === "" ||
        [
          prospecto.nombre,
          prospecto.empresa,
          prospecto.email,
          prospecto.telefono,
          prospecto.ciudad,
          prospecto.contactoPrincipal,
          prospecto.fuente,
        ].some(valor => valor.toLowerCase().includes(termino));

      const coincideEstado =
        filtroEstado === "todos" || prospecto.estado === filtroEstado;

      return (
        coincideBusqueda &&
        coincideEstado &&
        matchesProbabilidad(
          prospecto.probabilidadConversion,
          filtroProbabilidad
        )
      );
    });
  }, [prospectos, busqueda, filtroEstado, filtroProbabilidad]);

  const totalPaginas = Math.max(
    1,
    Math.ceil(prospectosFiltrados.length / itemsPorPagina)
  );

  useEffect(() => {
    setPagina(paginaActual =>
      Math.min(Math.max(paginaActual, 1), totalPaginas)
    );
  }, [totalPaginas]);

  const prospectosPaginados = prospectosFiltrados.slice(
    (pagina - 1) * itemsPorPagina,
    pagina * itemsPorPagina
  );

  const desde =
    prospectosFiltrados.length === 0 ? 0 : (pagina - 1) * itemsPorPagina + 1;
  const hasta =
    prospectosFiltrados.length === 0
      ? 0
      : Math.min(pagina * itemsPorPagina, prospectosFiltrados.length);

  const estados = Object.values(ProspectoEstado);

  const getEstadoBadge = (estado: ProspectoEstado) => {
    const estilos = {
      [ProspectoEstado.NUEVO]: "bg-blue-100 text-blue-800",
      [ProspectoEstado.CONTACTADO]: "bg-cyan-100 text-cyan-800",
      [ProspectoEstado.INTERESADO]: "bg-yellow-100 text-yellow-800",
      [ProspectoEstado.NEGOCIACION]: "bg-orange-100 text-orange-800",
      [ProspectoEstado.GANADO]: "bg-green-100 text-green-800",
      [ProspectoEstado.PERDIDO]: "bg-red-100 text-red-800",
    };

    return estilos[estado];
  };

  const getProbabilidadColor = (probabilidad: number) => {
    if (probabilidad >= 70) {
      return "text-green-600";
    }

    if (probabilidad >= 40) {
      return "text-yellow-600";
    }

    return "text-red-600";
  };

  async function handleEliminar(prospecto: Prospecto) {
    const confirmado = window.confirm(
      `Eliminar al prospecto "${prospecto.nombre}"?`
    );

    if (!confirmado) {
      return;
    }

    setEliminandoId(prospecto.id);
    setError(null);

    try {
      await deleteProspecto(prospecto.id);
      const data = await getProspectos();
      setProspectos(data);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "No se pudo eliminar el prospecto"
      );
    } finally {
      setEliminandoId(null);
    }
  }

  return (
    <DashboardLayout
      titulo="Prospectos"
      descripcion="Gestion de cartera de prospectos y oportunidades de venta"
      acciones={
        <Button asChild className="gap-2">
          <Link href="/prospectos/nuevo">
            <Plus size={18} />
            Nuevo Prospecto
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
              placeholder="Buscar prospecto..."
              value={busqueda}
              onChange={event => setBusqueda(event.target.value)}
              className="pl-10"
            />
          </div>

          <Select
            value={filtroEstado}
            onValueChange={value =>
              setFiltroEstado(value as ProspectoEstado | "todos")
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

          <Select
            value={filtroProbabilidad}
            onValueChange={value =>
              setFiltroProbabilidad(value as FiltroProbabilidad)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Probabilidad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              <SelectItem value="alta">Alta (70%+)</SelectItem>
              <SelectItem value="media">Media (40-69%)</SelectItem>
              <SelectItem value="baja">Baja (&lt;40%)</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center justify-end text-sm text-muted-foreground">
            {cargando
              ? "Cargando prospectos..."
              : `${prospectosFiltrados.length} prospecto${
                  prospectosFiltrados.length !== 1 ? "s" : ""
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
                  Estado
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Probabilidad
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Monto Est.
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
                    Cargando prospectos...
                  </td>
                </tr>
              ) : prospectosPaginados.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-10 text-center text-sm text-muted-foreground"
                  >
                    No se encontraron prospectos
                  </td>
                </tr>
              ) : (
                prospectosPaginados.map((prospecto, idx) => (
                  <tr
                    key={prospecto.id}
                    className={`border-b border-border transition-smooth hover:bg-accent ${
                      idx % 2 === 0 ? "bg-background" : "bg-accent/50"
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-foreground">
                          {prospecto.nombre}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {prospecto.fuente.replace("_", " ")}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      {prospecto.empresa}
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-foreground">
                          <Mail size={14} className="text-muted-foreground" />
                          <span className="truncate">
                            {prospecto.email || "-"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-foreground">
                          <Phone size={14} className="text-muted-foreground" />
                          <span>{prospecto.telefono || "-"}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${getEstadoBadge(
                          prospecto.estado
                        )}`}
                      >
                        {prospecto.estado.charAt(0).toUpperCase() +
                          prospecto.estado.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-accent rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{
                              width: `${prospecto.probabilidadConversion}%`,
                            }}
                          />
                        </div>
                        <span
                          className={`text-sm font-semibold ${getProbabilidadColor(
                            prospecto.probabilidadConversion
                          )}`}
                        >
                          {prospecto.probabilidadConversion}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      {prospecto.montoEstimado !== undefined ? (
                        <p className="font-medium">
                          ${(prospecto.montoEstimado / 1000000).toFixed(1)}M
                        </p>
                      ) : (
                        <p className="text-muted-foreground">-</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <Link
                          href={`/prospectos/${prospecto.id}`}
                          className="p-2 hover:bg-background rounded transition-smooth text-muted-foreground hover:text-foreground"
                        >
                          <Eye size={18} />
                        </Link>
                        <Link
                          href={`/prospectos/${prospecto.id}/editar`}
                          className="p-2 hover:bg-background rounded transition-smooth text-muted-foreground hover:text-foreground"
                        >
                          <Edit size={18} />
                        </Link>
                        <button
                          className="p-2 hover:bg-background rounded transition-smooth text-muted-foreground hover:text-destructive disabled:opacity-50"
                          onClick={() => void handleEliminar(prospecto)}
                          disabled={eliminandoId === prospecto.id}
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
            Mostrando {desde} a {hasta} de {prospectosFiltrados.length}
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
                pagina === totalPaginas || prospectosFiltrados.length === 0
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
