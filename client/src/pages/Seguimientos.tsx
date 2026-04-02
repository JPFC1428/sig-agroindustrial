import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  CheckSquare,
  Circle,
  Edit,
  Mail,
  MessageSquare,
  Phone,
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
import {
  deleteSeguimiento,
  getSeguimientos,
  updateSeguimiento,
} from "@/lib/seguimientos-api";
import {
  SeguimientoEstado,
  SeguimientoTipo,
  type Seguimiento,
} from "@/lib/types";

export default function Seguimientos() {
  const [seguimientos, setSeguimientos] = useState<Seguimiento[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<SeguimientoTipo | "todos">(
    "todos"
  );
  const [filtroEstado, setFiltroEstado] = useState<
    SeguimientoEstado | "todos"
  >("todos");
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [actualizandoId, setActualizandoId] = useState<string | null>(null);
  const itemsPorPagina = 10;

  useEffect(() => {
    let activo = true;

    async function cargar() {
      setCargando(true);
      setError(null);

      try {
        const data = await getSeguimientos();

        if (!activo) {
          return;
        }

        setSeguimientos(data);
      } catch (loadError) {
        if (!activo) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudieron cargar los seguimientos"
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
  }, [busqueda, filtroEstado, filtroTipo]);

  const seguimientosFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();

    return seguimientos.filter(seguimiento => {
      const coincideBusqueda =
        termino === "" ||
        [
          seguimiento.relacionadoNombre ?? "",
          seguimiento.relacionadoEmpresa ?? "",
          seguimiento.cotizacionNumero ?? "",
          seguimiento.observaciones ?? "",
        ].some(valor => valor.toLowerCase().includes(termino));

      const coincideTipo =
        filtroTipo === "todos" || seguimiento.tipo === filtroTipo;

      const coincideEstado =
        filtroEstado === "todos" || seguimiento.estado === filtroEstado;

      return coincideBusqueda && coincideTipo && coincideEstado;
    });
  }, [seguimientos, busqueda, filtroEstado, filtroTipo]);

  const totalPaginas = Math.max(
    1,
    Math.ceil(seguimientosFiltrados.length / itemsPorPagina)
  );

  useEffect(() => {
    setPagina(actual => Math.min(Math.max(actual, 1), totalPaginas));
  }, [totalPaginas]);

  const seguimientosPaginados = seguimientosFiltrados.slice(
    (pagina - 1) * itemsPorPagina,
    pagina * itemsPorPagina
  );

  function getTipoIcon(tipo: SeguimientoTipo) {
    const iconos = {
      [SeguimientoTipo.LLAMADA]: <Phone size={18} />,
      [SeguimientoTipo.EMAIL]: <Mail size={18} />,
      [SeguimientoTipo.REUNION]: <Users size={18} />,
      [SeguimientoTipo.MENSAJE]: <MessageSquare size={18} />,
      [SeguimientoTipo.TAREA]: <CheckSquare size={18} />,
    };

    return iconos[tipo];
  }

  function getTipoBadge(tipo: SeguimientoTipo) {
    const estilos = {
      [SeguimientoTipo.LLAMADA]: "bg-blue-100 text-blue-800",
      [SeguimientoTipo.EMAIL]: "bg-cyan-100 text-cyan-800",
      [SeguimientoTipo.REUNION]: "bg-purple-100 text-purple-800",
      [SeguimientoTipo.MENSAJE]: "bg-green-100 text-green-800",
      [SeguimientoTipo.TAREA]: "bg-orange-100 text-orange-800",
    };

    return estilos[tipo];
  }

  function getEstadoBadge(estado: SeguimientoEstado) {
    const estilos = {
      [SeguimientoEstado.PENDIENTE]: "bg-amber-100 text-amber-800",
      [SeguimientoEstado.EN_PROCESO]: "bg-sky-100 text-sky-800",
      [SeguimientoEstado.CERRADO]: "bg-emerald-100 text-emerald-800",
      [SeguimientoEstado.CANCELADO]: "bg-red-100 text-red-800",
    };

    return estilos[estado];
  }

  function getRelacionLabel(seguimiento: Seguimiento) {
    if (seguimiento.clienteId) {
      return "Cliente";
    }

    if (seguimiento.prospectoId) {
      return "Prospecto";
    }

    return "Cotizacion";
  }

  function getNombreRelacionado(seguimiento: Seguimiento) {
    return seguimiento.relacionadoNombre ?? "Sin relacion";
  }

  async function recargarSeguimientos() {
    const data = await getSeguimientos();
    setSeguimientos(data);
  }

  async function handleEliminar(seguimiento: Seguimiento) {
    const confirmado = window.confirm(
      `Eliminar el seguimiento de "${getNombreRelacionado(seguimiento)}"?`
    );

    if (!confirmado) {
      return;
    }

    setEliminandoId(seguimiento.id);
    setError(null);

    try {
      await deleteSeguimiento(seguimiento.id);
      await recargarSeguimientos();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "No se pudo eliminar el seguimiento"
      );
    } finally {
      setEliminandoId(null);
    }
  }

  async function handleToggleCompletado(seguimiento: Seguimiento) {
    const completado = !seguimiento.completado;
    const estado = completado
      ? SeguimientoEstado.CERRADO
      : seguimiento.estado === SeguimientoEstado.CANCELADO
        ? SeguimientoEstado.CANCELADO
        : SeguimientoEstado.PENDIENTE;

    setActualizandoId(seguimiento.id);
    setError(null);

    try {
      await updateSeguimiento(seguimiento.id, {
        completado,
        estado,
      });
      await recargarSeguimientos();
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "No se pudo actualizar el seguimiento"
      );
    } finally {
      setActualizandoId(null);
    }
  }

  return (
    <DashboardLayout
      titulo="Seguimientos"
      descripcion="Gestion de seguimientos, tareas y recordatorios"
      acciones={
        <Button asChild className="gap-2">
          <Link href="/seguimientos/nuevo">
            <Plus size={18} />
            Nuevo Seguimiento
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
              placeholder="Buscar seguimiento..."
              value={busqueda}
              onChange={event => setBusqueda(event.target.value)}
              className="pl-10"
            />
          </div>

          <Select
            value={filtroTipo}
            onValueChange={value =>
              setFiltroTipo(value as SeguimientoTipo | "todos")
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los tipos</SelectItem>
              {Object.values(SeguimientoTipo).map(tipo => (
                <SelectItem key={tipo} value={tipo}>
                  {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filtroEstado}
            onValueChange={value =>
              setFiltroEstado(value as SeguimientoEstado | "todos")
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              {Object.values(SeguimientoEstado).map(estado => (
                <SelectItem key={estado} value={estado}>
                  {estado.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center justify-end text-sm text-muted-foreground">
            {cargando
              ? "Cargando seguimientos..."
              : `${seguimientosFiltrados.length} seguimiento${
                  seguimientosFiltrados.length !== 1 ? "s" : ""
                }`}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive rounded-lg border border-destructive/20 px-4 py-3 mb-6 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {cargando ? (
          <div className="bg-card rounded-lg border border-border p-12 text-center">
            <p className="text-muted-foreground">Cargando seguimientos...</p>
          </div>
        ) : seguimientosPaginados.length > 0 ? (
          seguimientosPaginados.map(seguimiento => (
            <div
              key={seguimiento.id}
              className={`bg-card rounded-lg border transition-smooth hover:shadow-md p-4 ${
                seguimiento.completado
                  ? "border-green-200 bg-green-50/30"
                  : "border-border"
              }`}
            >
              <div className="flex items-start gap-4">
                <button
                  onClick={() => void handleToggleCompletado(seguimiento)}
                  className="mt-1 flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                  disabled={actualizandoId === seguimiento.id}
                  title={
                    seguimiento.completado
                      ? "Marcar como pendiente"
                      : "Marcar como completado"
                  }
                >
                  {seguimiento.completado ? (
                    <CheckCircle2 size={20} className="text-green-600" />
                  ) : (
                    <Circle size={20} />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className={`p-2 rounded-lg ${getTipoBadge(seguimiento.tipo)}`}>
                      {getTipoIcon(seguimiento.tipo)}
                    </span>
                    <h3
                      className={`font-semibold ${
                        seguimiento.completado
                          ? "line-through text-muted-foreground"
                          : "text-foreground"
                      }`}
                    >
                      {getNombreRelacionado(seguimiento)}
                    </h3>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${getEstadoBadge(
                        seguimiento.estado
                      )}`}
                    >
                      {seguimiento.estado.replace("_", " ")}
                    </span>
                  </div>

                  {seguimiento.relacionadoEmpresa && (
                    <p className="text-sm text-muted-foreground mb-2">
                      {seguimiento.relacionadoEmpresa}
                    </p>
                  )}

                  <p
                    className={`text-sm mb-3 ${
                      seguimiento.completado
                        ? "text-muted-foreground"
                        : "text-foreground"
                    }`}
                  >
                    {seguimiento.observaciones || "Sin observaciones"}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span>
                      <strong>Relacion:</strong> {getRelacionLabel(seguimiento)}
                    </span>
                    <span>
                      <strong>Tipo:</strong> {seguimiento.tipo}
                    </span>
                    <span>
                      <strong>Vence:</strong>{" "}
                      {seguimiento.fechaVencimiento.toLocaleDateString("es-CO")}
                    </span>
                    <span>
                      <strong>Completado:</strong>{" "}
                      {seguimiento.completado ? "Si" : "No"}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 flex-shrink-0">
                  <Button asChild variant="ghost" size="icon">
                    <Link href={`/seguimientos/${seguimiento.id}/editar`}>
                      <Edit size={18} />
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => void handleEliminar(seguimiento)}
                    disabled={eliminandoId === seguimiento.id}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 size={18} />
                  </Button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-card rounded-lg border border-border p-12 text-center">
            <p className="text-muted-foreground">
              No hay seguimientos que coincidan con los filtros
            </p>
          </div>
        )}
      </div>

      {totalPaginas > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {(pagina - 1) * itemsPorPagina + 1} a{" "}
            {Math.min(pagina * itemsPorPagina, seguimientosFiltrados.length)} de{" "}
            {seguimientosFiltrados.length}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPagina(Math.max(1, pagina - 1))}
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
              onClick={() => setPagina(Math.min(totalPaginas, pagina + 1))}
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
