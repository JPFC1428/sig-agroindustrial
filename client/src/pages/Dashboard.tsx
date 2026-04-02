import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Users,
  Target,
  Calendar,
  FileText,
  TrendingUp,
  Clock,
} from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { DashboardCard } from '@/components/DashboardCard';
import { getDashboardResumen } from '@/lib/dashboard-api';
import type { DashboardResumen } from '@/lib/types';

function formatMontoProspectos(value: number) {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }

  return new Intl.NumberFormat('es-CO', {
    currency: 'COP',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value);
}

export default function Dashboard() {
  const [resumen, setResumen] = useState<DashboardResumen | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      setLoading(true);
      setError(null);

      try {
        const data = await getDashboardResumen();

        if (!active) {
          return;
        }

        setResumen(data);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : 'No se pudo cargar el dashboard'
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      active = false;
    };
  }, []);

  const metricas = resumen?.metricas;
  const actividadReciente = resumen?.actividadReciente ?? [];

  return (
    <DashboardLayout
      titulo="Dashboard Comercial"
      descripcion="Resumen de actividad y metricas clave del modulo comercial"
    >
      {error && (
        <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <DashboardCard
          titulo="Total Clientes"
          valor={loading ? '...' : metricas?.totalClientes ?? 0}
          icono={Users}
          descripcion="Clientes registrados"
          acento="primario"
        />
        <DashboardCard
          titulo="Total Prospectos"
          valor={loading ? '...' : metricas?.totalProspectos ?? 0}
          icono={Target}
          descripcion="En cartera comercial"
          acento="secundario"
        />
        <DashboardCard
          titulo="Visitas Hoy"
          valor={loading ? '...' : metricas?.visitasHoy ?? 0}
          icono={Calendar}
          descripcion="Agendadas para hoy"
          acento="primario"
        />
        <DashboardCard
          titulo="Cotizaciones Mes"
          valor={loading ? '...' : metricas?.cotizacionesMes ?? 0}
          icono={FileText}
          descripcion="Generadas este mes"
          acento="secundario"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <DashboardCard
          titulo="Monto en Prospectos"
          valor={loading ? '...' : formatMontoProspectos(metricas?.montoProspectos ?? 0)}
          icono={TrendingUp}
          descripcion="Pipeline abierto"
          acento="primario"
        />
        <DashboardCard
          titulo="Tasa de Conversion"
          valor={loading ? '...' : `${metricas?.tasaConversion ?? 0}%`}
          icono={TrendingUp}
          descripcion="Prospectos ganados"
          acento="secundario"
        />
        <DashboardCard
          titulo="Proximos Seguimientos"
          valor={loading ? '...' : metricas?.proximosSegumientos ?? 0}
          icono={Clock}
          descripcion="Siguientes 7 dias"
          acento="primario"
        />
      </div>

      <div className="bg-card rounded-lg border border-border p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Actividad Reciente
        </h2>

        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando actividad...</p>
        ) : actividadReciente.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay actividad reciente registrada.
          </p>
        ) : (
          <div className="space-y-4">
            {actividadReciente.map(actividad => (
              <div
                key={actividad.id}
                className="flex items-start gap-4 pb-4 border-b border-border last:border-b-0"
              >
                <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground">{actividad.titulo}</p>
                  <p className="text-sm text-muted-foreground">
                    {actividad.descripcion}
                  </p>
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
        )}
      </div>
    </DashboardLayout>
  );
}
