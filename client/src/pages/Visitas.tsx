import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  Clock,
  Edit,
  Plus,
  Search,
  Trash2,
  Users,
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
import { deleteVisita, getVisitas } from "@/lib/visitas-api";
import { VisitaEstado, VisitaTipo, type Visita } from "@/lib/types";

export default function Visitas() {
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<VisitaTipo | "todos">("todos");
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
        const data = await getVisitas();

        if (!activo) {
          return;
        }

        setVisitas(data);
      } catch (loadError) {
        if (!activo) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudieron cargar las visitas"
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
  }, [busqueda, filtroTipo]);

  const visitasFiltradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();

    return visitas.filter(visita => {
      const nombreRelacionado =
        visita.clienteNombre ??
        visita.prospectoNombre ??
        visita.clienteEmpresa ??
        visita.prospectoEmpresa ??
        "";

      const coincideBusqueda =
        termino === "" ||
        [
          nombreRelacionado,
          visita.objetivo,
          visita.proximaAccion ?? "",
          visita.resultado ?? visita.resultados ?? "",
        ].some(valor => valor.toLowerCase().includes(termino));

      const coincideTipo =
        filtroTipo === "todos" || visita.tipo === filtroTipo;

      return coincideBusqueda && coincideTipo;
    });
  }, [visitas, busqueda, filtroTipo]);

  const totalPaginas = Math.max(
    1,
    Math.ceil(visitasFiltradas.length / itemsPorPagina)
  );

  useEffect(() => {
    setPagina(actual => Math.min(Math.max(actual, 1), totalPaginas));
  }, [totalPaginas]);

  const visitasPaginadas = visitasFiltradas.slice(
    (pagina - 1) * itemsPorPagina,
    pagina * itemsPorPagina
  );

  const tipos = Object.values(VisitaTipo);

  const getTipoBadge = (tipo: VisitaTipo) => {
    const estilos = {
      [VisitaTipo.PROSPECTACION]: "bg-blue-100 text-blue-800",
      [VisitaTipo.SEGUIMIENTO]: "bg-cyan-100 text-cyan-800",
      [VisitaTipo.NEGOCIACION]: "bg-orange-100 text-orange-800",
      [VisitaTipo.SERVICIO]: "bg-green-100 text-green-800",
    };

    return estilos[tipo];
  };

  const getEstadoBadge = (estado: NonNullable<Visita["estado"]>) => {
    const estilos = {
      [VisitaEstado.PROGRAMADA]: "bg-amber-100 text-amber-800",
      [VisitaEstado.REALIZADA]: "bg-emerald-100 text-emerald-800",
      [VisitaEstado.CANCELADA]: "bg-red-100 text-red-800",
    };

    return estilos[estado];
  };

  function getNombreRelacionado(visita: Visita) {
    return visita.clienteNombre ?? visita.prospectoNombre ?? "Sin relacion";
  }

  function getEmpresaRelacionada(visita: Visita) {
    return visita.clienteEmpresa ?? visita.prospectoEmpresa ?? "";
  }

  async function handleEliminar(visita: Visita) {
    const confirmado = window.confirm(
      `¿Eliminar la visita de "${getNombreRelacionado(visita)}"?`
    );

    if (!confirmado) {
      return;
    }

    setEliminandoId(visita.id);
    setError(null);

    try {
      await deleteVisita(visita.id);
      const data = await getVisitas();
      setVisitas(data);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "No se pudo eliminar la visita"
      );
    } finally {
      setEliminandoId(null);
    }
  }

  return (
    <DashboardLayout
      titulo="Visitas"
      descripcion="Gestion de visitas comerciales y seguimientos"
      acciones={
        <Button asChild className="gap-2">
          <Link href="/visitas/nuevo">
            <Plus size={18} />
            Nueva Visita
          </Link>
        </Button>
      }
    >
      <div className="bg-card rounded-lg border border-border p-6 mb-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-3 text-muted-foreground"
            />
            <Input
              placeholder="Buscar visita..."
              value={busqueda}
              onChange={event => setBusqueda(event.target.value)}
              className="pl-10"
            />
          </div>

          <Select
            value={filtroTipo}
            onValueChange={value =>
              setFiltroTipo(value as VisitaTipo | "todos")
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Tipo de visita" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los tipos</SelectItem>
              {tipos.map(tipo => (
                <SelectItem key={tipo} value={tipo}>
                  {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center justify-end text-sm text-muted-foreground">
            {cargando
              ? "Cargando visitas..."
              : `${visitasFiltradas.length} visita${
                  visitasFiltradas.length !== 1 ? "s" : ""
                }`}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive rounded-lg border border-destructive/20 px-4 py-3 mb-6 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {cargando ? (
          <div className="bg-card rounded-lg border border-border p-12 text-center">
            <p className="text-muted-foreground">Cargando visitas...</p>
          </div>
        ) : visitasPaginadas.length > 0 ? (
          visitasPaginadas.map(visita => (
            <div
              key={visita.id}
              className="bg-card rounded-lg border border-border p-6 shadow-sm hover:shadow-md transition-smooth"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <Link href={`/visitas/${visita.id}`}>
                      <h3 className="text-lg font-semibold text-foreground transition-smooth hover:opacity-80">
                        {getNombreRelacionado(visita)}
                      </h3>
                    </Link>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${getTipoBadge(
                        visita.tipo
                      )}`}
                    >
                      {visita.tipo.charAt(0).toUpperCase() + visita.tipo.slice(1)}
                    </span>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${getEstadoBadge(
                        visita.estado ?? VisitaEstado.PROGRAMADA
                      )}`}
                    >
                      {(visita.estado ?? VisitaEstado.PROGRAMADA)
                        .charAt(0)
                        .toUpperCase() +
                        (visita.estado ?? VisitaEstado.PROGRAMADA).slice(1)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    {getEmpresaRelacionada(visita) || "Sin empresa relacionada"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/visitas/${visita.id}/editar`}
                    className="p-2 hover:bg-accent rounded transition-smooth text-muted-foreground hover:text-foreground"
                  >
                    <Edit size={18} />
                  </Link>
                  <button
                    className="p-2 hover:bg-accent rounded transition-smooth text-muted-foreground hover:text-destructive disabled:opacity-50"
                    onClick={() => void handleEliminar(visita)}
                    disabled={eliminandoId === visita.id}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 pb-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Fecha</p>
                    <p className="text-sm font-medium text-foreground">
                      {visita.fecha.toLocaleDateString("es-CO")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Hora</p>
                    <p className="text-sm font-medium text-foreground">
                      {visita.hora}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Relacion</p>
                    <p className="text-sm font-medium text-foreground">
                      {visita.clienteId ? "Cliente" : "Prospecto"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Estado</p>
                    <p className="text-sm font-medium text-foreground capitalize">
                      {visita.estado ?? VisitaEstado.PROGRAMADA}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">
                    Objetivo
                  </h4>
                  <p className="text-sm text-foreground">{visita.objetivo}</p>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">
                    Resultado
                  </h4>
                  <p className="text-sm text-foreground">
                    {visita.resultado ||
                      visita.resultados ||
                      "Sin resultado registrado"}
                  </p>
                </div>

                {(visita.proximaAccion || visita.observaciones) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {visita.proximaAccion && (
                      <div className="p-3 bg-accent rounded">
                        <p className="text-xs text-muted-foreground mb-1">
                          Proxima Accion
                        </p>
                        <p className="text-sm font-medium text-foreground">
                          {visita.proximaAccion}
                        </p>
                      </div>
                    )}
                    {visita.observaciones && (
                      <div className="p-3 bg-accent rounded">
                        <p className="text-xs text-muted-foreground mb-1">
                          Observaciones
                        </p>
                        <p className="text-sm font-medium text-foreground">
                          {visita.observaciones}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="bg-card rounded-lg border border-border p-12 text-center">
            <p className="text-muted-foreground">
              No hay visitas que coincidan con los filtros
            </p>
          </div>
        )}
      </div>

      {totalPaginas > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {(pagina - 1) * itemsPorPagina + 1} a{" "}
            {Math.min(pagina * itemsPorPagina, visitasFiltradas.length)} de{" "}
            {visitasFiltradas.length}
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
      )}
    </DashboardLayout>
  );
}
