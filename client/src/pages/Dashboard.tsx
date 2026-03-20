/**
 * Dashboard Comercial - Página principal del módulo
 * 
 * Componentes:
 * - Tarjetas de métricas principales
 * - Gráficos de tendencias
 * - Actividad reciente
 * - Próximos seguimientos
 */

import { DashboardLayout } from '@/components/DashboardLayout';
import { DashboardCard } from '@/components/DashboardCard';
import {
  Users,
  Target,
  Calendar,
  FileText,
  TrendingUp,
  Clock,
} from 'lucide-react';
import {
  metricasDashboardMock,
  actividadRecienteMock,
  getVisitasDelDia,
  getCotizacionesDelMes,
} from '@/lib/mock-data';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Dashboard() {
  const metricas = metricasDashboardMock;
  const visitasHoy = getVisitasDelDia();
  const cotizacionesMes = getCotizacionesDelMes();

  return (
    <DashboardLayout
      titulo="Dashboard Comercial"
      descripcion="Resumen de actividad y métricas clave del módulo comercial"
    >
      {/* Grid de Métricas Principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <DashboardCard
          titulo="Total Clientes"
          valor={metricas.totalClientes}
          icono={Users}
          descripcion="Clientes activos"
          acento="primario"
        />
        <DashboardCard
          titulo="Total Prospectos"
          valor={metricas.totalProspectos}
          icono={Target}
          descripcion="En cartera de ventas"
          acento="secundario"
        />
        <DashboardCard
          titulo="Visitas Hoy"
          valor={visitasHoy.length}
          icono={Calendar}
          descripcion="Actividades programadas"
          acento="primario"
        />
        <DashboardCard
          titulo="Cotizaciones Mes"
          valor={cotizacionesMes.length}
          icono={FileText}
          descripcion="Documentos comerciales"
          acento="secundario"
        />
      </div>

      {/* Segunda fila de métricas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <DashboardCard
          titulo="Monto en Prospectos"
          valor={`$${(metricas.montoProspectos / 1000000).toFixed(1)}M`}
          icono={TrendingUp}
          descripcion="Oportunidades potenciales"
          acento="primario"
        />
        <DashboardCard
          titulo="Tasa de Conversión"
          valor={`${metricas.tasaConversion}%`}
          icono={TrendingUp}
          descripcion="Prospectos → Clientes"
          acento="secundario"
        />
        <DashboardCard
          titulo="Próximos Seguimientos"
          valor={metricas.proximosSegumientos}
          icono={Clock}
          descripcion="Acciones pendientes"
          acento="primario"
        />
      </div>

      {/* Actividad Reciente */}
      <div className="bg-card rounded-lg border border-border p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground mb-4">Actividad Reciente</h2>
        <div className="space-y-4">
          {actividadRecienteMock.slice(0, 5).map((actividad) => (
            <div
              key={actividad.id}
              className="flex items-start gap-4 pb-4 border-b border-border last:border-b-0"
            >
              <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground">{actividad.titulo}</p>
                <p className="text-sm text-muted-foreground">{actividad.descripcion}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDistanceToNow(actividad.fecha, {
                    addSuffix: true,
                    locale: es,
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
