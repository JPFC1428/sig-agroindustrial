/**
 * Pagina de Detalle del Cliente - Vista completa del cliente
 *
 * Componentes:
 * - Informacion general del cliente
 * - Historial de visitas
 * - Historial de cotizaciones
 * - Seguimientos pendientes
 * - Botones de accion
 */

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Calendar,
  Edit,
  FileText,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Link, useRoute } from "wouter";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { getCotizaciones } from "@/lib/cotizaciones-api";
import { getClienteById } from "@/lib/clientes-api";
import {
  seguimientosMock,
  visitasMock,
} from "@/lib/mock-data";
import type { Cliente, Cotizacion } from "@/lib/types";

export default function ClienteDetalle() {
  const [match, params] = useRoute("/clientes/:id");
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [cotizacionesCliente, setCotizacionesCliente] = useState<Cotizacion[]>(
    []
  );
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const clienteId = params?.id;

    if (!match || !clienteId) {
      return;
    }

    const id = clienteId;

    let activo = true;

    async function cargarCliente() {
      setCargando(true);
      setError(null);

      try {
        const [data, cotizaciones] = await Promise.all([
          getClienteById(id),
          getCotizaciones(),
        ]);

        if (!activo) {
          return;
        }

        setCliente(data);
        setCotizacionesCliente(
          cotizaciones.filter(cotizacion => cotizacion.clienteId === id)
        );
      } catch (loadError) {
        if (!activo) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudo cargar el cliente"
        );
        setCliente(null);
        setCotizacionesCliente([]);
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
  }, [match, params?.id]);

  if (!match) {
    return null;
  }

  if (cargando) {
    return (
      <DashboardLayout titulo="Cargando cliente">
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            Cargando informacion del cliente...
          </p>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout titulo="Error al cargar cliente">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button asChild variant="outline">
            <Link href="/clientes">Volver a Clientes</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  if (!cliente) {
    return (
      <DashboardLayout titulo="Cliente no encontrado">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            El cliente solicitado no existe
          </p>
          <Button asChild variant="outline">
            <Link href="/clientes">Volver a Clientes</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const visitas = visitasMock.filter(visita => visita.clienteId === cliente.id);
  const seguimientos = seguimientosMock.filter(
    seguimiento => seguimiento.clienteId === cliente.id
  );

  return (
    <DashboardLayout
      titulo={cliente.nombre}
      descripcion={cliente.empresa}
      acciones={
        <Button asChild variant="outline" size="sm" className="gap-2">
          <Link href="/clientes">
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
                {cliente.nombre}
              </h2>
              <p className="text-muted-foreground">{cliente.empresa}</p>
            </div>
            <Button asChild className="gap-2">
              <Link href={`/clientes/${cliente.id}/editar`}>
                <Edit size={18} />
                Editar
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">
                Informacion de Contacto
              </h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Mail size={18} className="text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="text-sm text-foreground">{cliente.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone size={18} className="text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Telefono</p>
                    <p className="text-sm text-foreground">
                      {cliente.telefono}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin size={18} className="text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Ubicacion</p>
                    <p className="text-sm text-foreground">
                      {cliente.ciudad}, {cliente.departamento}
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
                  <p className="text-foreground">{cliente.contactoPrincipal}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cargo</p>
                  <p className="text-foreground">{cliente.cargoContacto}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">NIT</p>
                  <p className="text-foreground">{cliente.nit}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Fecha de Registro
                  </p>
                  <p className="text-foreground">
                    {cliente.fechaRegistro.toLocaleDateString("es-CO")}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {cliente.notas && (
            <div className="mt-6 pt-6 border-t border-border">
              <h3 className="text-sm font-semibold text-foreground mb-2">
                Notas
              </h3>
              <p className="text-sm text-foreground">{cliente.notas}</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-card rounded-lg border border-border p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground mb-4">
              Estadisticas
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground">
                  Total de Compras
                </p>
                <p className="text-2xl font-bold text-primary">
                  {cliente.totalCompras}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Monto Total</p>
                <p className="text-2xl font-bold text-primary">
                  ${(cliente.montoTotalCompras / 1000000).toFixed(1)}M
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ultima Visita</p>
                <p className="text-sm text-foreground">
                  {cliente.ultimaVisita
                    ? formatDistanceToNow(cliente.ultimaVisita, {
                        addSuffix: true,
                        locale: es,
                      })
                    : "Sin visitas"}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg border border-border p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground mb-4">
              Estado
            </h3>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-sm font-medium text-foreground capitalize">
                {cliente.estado}
              </span>
            </div>
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
          <Button asChild size="sm" className="gap-2">
            <Link href={`/cotizaciones/nuevo?clienteId=${cliente.id}`}>
              <FileText size={16} />
              Nueva Cotizacion
            </Link>
          </Button>
        </div>
        {cotizacionesCliente.length > 0 ? (
          <div className="space-y-3">
            {cotizacionesCliente.map(cotizacion => (
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
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Seguimientos
        </h2>
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
