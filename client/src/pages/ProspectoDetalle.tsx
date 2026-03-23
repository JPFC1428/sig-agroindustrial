import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Calendar,
  Edit,
  FileText,
  Mail,
  MapPin,
  Phone,
  TrendingUp,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Link, useRoute } from "wouter";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { getProspectoById } from "@/lib/prospectos-api";
import {
  cotizacionesMock,
  seguimientosMock,
  visitasMock,
} from "@/lib/mock-data";
import { ProspectoEstado, type Prospecto } from "@/lib/types";

type ProspectoFuente = Prospecto["fuente"];

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

function formatEstadoLabel(estado: ProspectoEstado) {
  return estado.charAt(0).toUpperCase() + estado.slice(1);
}

function getEstadoBadge(estado: ProspectoEstado) {
  const estilos = {
    [ProspectoEstado.NUEVO]: "bg-blue-100 text-blue-800",
    [ProspectoEstado.CONTACTADO]: "bg-cyan-100 text-cyan-800",
    [ProspectoEstado.INTERESADO]: "bg-yellow-100 text-yellow-800",
    [ProspectoEstado.NEGOCIACION]: "bg-orange-100 text-orange-800",
    [ProspectoEstado.GANADO]: "bg-green-100 text-green-800",
    [ProspectoEstado.PERDIDO]: "bg-red-100 text-red-800",
  };

  return estilos[estado];
}

function getProbabilidadColor(probabilidad: number) {
  if (probabilidad >= 70) {
    return "text-green-600";
  }

  if (probabilidad >= 40) {
    return "text-yellow-600";
  }

  return "text-red-600";
}

export default function ProspectoDetalle() {
  const [match, params] = useRoute("/prospectos/:id");
  const [prospecto, setProspecto] = useState<Prospecto | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const prospectoId = params?.id;

    if (!match || !prospectoId) {
      return;
    }

    const id = prospectoId;
    let activo = true;

    async function cargarProspecto() {
      setCargando(true);
      setError(null);

      try {
        const data = await getProspectoById(id);

        if (!activo) {
          return;
        }

        setProspecto(data);
      } catch (loadError) {
        if (!activo) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudo cargar el prospecto"
        );
        setProspecto(null);
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
  }, [match, params?.id]);

  if (!match) {
    return null;
  }

  if (cargando) {
    return (
      <DashboardLayout titulo="Cargando prospecto">
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            Cargando informacion del prospecto...
          </p>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout titulo="Error al cargar prospecto">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button asChild variant="outline">
            <Link href="/prospectos">Volver a Prospectos</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  if (!prospecto) {
    return (
      <DashboardLayout titulo="Prospecto no encontrado">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            El prospecto solicitado no existe
          </p>
          <Button asChild variant="outline">
            <Link href="/prospectos">Volver a Prospectos</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const visitas = visitasMock.filter(
    visita => visita.prospectoId === prospecto.id
  );
  const cotizaciones = cotizacionesMock.filter(
    cotizacion => cotizacion.prospectoId === prospecto.id
  );
  const seguimientos = seguimientosMock.filter(
    seguimiento => seguimiento.prospectoId === prospecto.id
  );

  return (
    <DashboardLayout
      titulo={prospecto.nombre}
      descripcion={prospecto.empresa}
      acciones={
        <Button asChild variant="outline" size="sm" className="gap-2">
          <Link href="/prospectos">
            <ArrowLeft size={18} />
            Volver
          </Link>
        </Button>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 bg-card rounded-lg border border-border p-6 shadow-sm">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                {prospecto.nombre}
              </h2>
              <p className="text-muted-foreground">{prospecto.empresa}</p>
            </div>
            <Button asChild className="gap-2">
              <Link href={`/prospectos/${prospecto.id}/editar`}>
                <Edit size={18} />
                Editar
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">
                Informacion de Contacto
              </h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Mail size={18} className="text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="text-sm text-foreground">
                      {prospecto.email || "-"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone size={18} className="text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Telefono</p>
                    <p className="text-sm text-foreground">
                      {prospecto.telefono || "-"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin size={18} className="text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Ubicacion</p>
                    <p className="text-sm text-foreground">
                      {prospecto.ciudad}, {prospecto.departamento || "-"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">
                Detalles
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Contacto Principal
                  </p>
                  <p className="text-foreground">
                    {prospecto.contactoPrincipal || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cargo</p>
                  <p className="text-foreground">
                    {prospecto.cargoContacto || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Fuente</p>
                  <p className="text-foreground">
                    {formatFuenteLabel(prospecto.fuente)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Fecha de Captura
                  </p>
                  <p className="text-foreground">
                    {prospecto.fechaCaptura.toLocaleDateString("es-CO")}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Proximo Seguimiento
                  </p>
                  <p className="text-foreground">
                    {prospecto.proximoSeguimiento
                      ? formatDistanceToNow(prospecto.proximoSeguimiento, {
                          addSuffix: true,
                          locale: es,
                        })
                      : "Sin fecha definida"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {prospecto.notas && (
            <div className="mt-6 pt-6 border-t border-border">
              <h3 className="text-sm font-semibold text-foreground mb-2">
                Notas
              </h3>
              <p className="text-sm text-foreground">{prospecto.notas}</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-card rounded-lg border border-border p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground mb-4">
              Conversion
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-2">
                  Probabilidad
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-accent rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${prospecto.probabilidadConversion}%` }}
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
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Monto Estimado</p>
                <p className="text-2xl font-bold text-primary">
                  {prospecto.montoEstimado !== undefined
                    ? `$${(prospecto.montoEstimado / 1000000).toFixed(1)}M`
                    : "Sin estimar"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Asignado A</p>
                <p className="text-sm text-foreground">
                  {prospecto.asignadoA || "Sin asignar"}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg border border-border p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground mb-4">
              Estado
            </h3>
            <span
              className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${getEstadoBadge(
                prospecto.estado
              )}`}
            >
              {formatEstadoLabel(prospecto.estado)}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border p-6 shadow-sm mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">
            Historial de Visitas
          </h2>
          <Button size="sm" className="gap-2">
            <Calendar size={16} />
            Nueva Visita
          </Button>
        </div>
        {visitas.length > 0 ? (
          <div className="space-y-3">
            {visitas.map(visita => (
              <div
                key={visita.id}
                className="flex items-start gap-4 pb-3 border-b border-border last:border-b-0"
              >
                <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-foreground">{visita.tipo}</p>
                  <p className="text-sm text-muted-foreground">
                    {visita.resultados}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {visita.fecha.toLocaleDateString("es-CO")} -{" "}
                    {visita.duracion} min
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No hay visitas registradas
          </p>
        )}
      </div>

      <div className="bg-card rounded-lg border border-border p-6 shadow-sm mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">
            Cotizaciones
          </h2>
          <Button size="sm" className="gap-2">
            <FileText size={16} />
            Nueva Cotizacion
          </Button>
        </div>
        {cotizaciones.length > 0 ? (
          <div className="space-y-3">
            {cotizaciones.map(cotizacion => (
              <div
                key={cotizacion.id}
                className="flex items-start gap-4 pb-3 border-b border-border last:border-b-0"
              >
                <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-foreground">
                    {cotizacion.numero}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    ${(cotizacion.total / 1000000).toFixed(2)}M -{" "}
                    {cotizacion.estado}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {cotizacion.fecha.toLocaleDateString("es-CO")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No hay cotizaciones</p>
        )}
      </div>

      <div className="bg-card rounded-lg border border-border p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">
            Seguimientos
          </h2>
          <div className="flex items-center gap-2 text-primary">
            <TrendingUp size={16} />
            <span className="text-sm font-medium">Actividad comercial</span>
          </div>
        </div>
        {seguimientos.length > 0 ? (
          <div className="space-y-3">
            {seguimientos.map(seguimiento => (
              <div
                key={seguimiento.id}
                className="flex items-start gap-4 pb-3 border-b border-border last:border-b-0"
              >
                <div
                  className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                    seguimiento.completado ? "bg-green-500" : "bg-primary"
                  }`}
                />
                <div className="flex-1">
                  <p className="font-medium text-foreground">
                    {seguimiento.asunto}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {seguimiento.descripcion}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {seguimiento.fecha.toLocaleDateString("es-CO")} -{" "}
                    {seguimiento.tipo}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No hay seguimientos</p>
        )}
      </div>
    </DashboardLayout>
  );
}
