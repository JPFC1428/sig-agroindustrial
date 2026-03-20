/**
 * Página de Cotizaciones - Gestión de cotizaciones comerciales
 * 
 * Componentes:
 * - Listado de cotizaciones con búsqueda
 * - Filtros por estado, mes, año
 * - Indicadores de estado y monto
 * - Acciones rápidas
 */

import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Search,
  Edit,
  Eye,
  Trash2,
  Download,
  Send,
} from 'lucide-react';
import { cotizacionesMock, clientesMock, prospectosMock } from '@/lib/mock-data';
import { CotizacionEstado } from '@/lib/types';

export default function Cotizaciones() {
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<CotizacionEstado | 'todos'>('todos');
  const [filtroMes, setFiltroMes] = useState('todos');
  const [pagina, setPagina] = useState(1);
  const itemsPorPagina = 10;

  // Obtener meses disponibles
  const mesesDisponibles = Array.from(
    new Set(
      cotizacionesMock.map((c) => {
        const mes = c.fecha.getMonth() + 1;
        const año = c.fecha.getFullYear();
        return `${año}-${mes}`;
      })
    )
  ).sort();

  // Filtrar cotizaciones
  const cotizacionesFiltradas = useMemo(() => {
    return cotizacionesMock.filter((cot) => {
      // Obtener nombre del cliente o prospecto
      let nombre = '';
      if (cot.clienteId) {
        const cliente = clientesMock.find((c) => c.id === cot.clienteId);
        nombre = cliente?.nombre || '';
      } else if (cot.prospectoId) {
        const prospecto = prospectosMock.find((p) => p.id === cot.prospectoId);
        nombre = prospecto?.nombre || '';
      }

      const coincideBusqueda =
        nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        cot.numero.toLowerCase().includes(busqueda.toLowerCase());

      const coincideEstado = filtroEstado === 'todos' || cot.estado === filtroEstado;

      let coincideMes = true;
      if (filtroMes !== 'todos') {
        const mes = cot.fecha.getMonth() + 1;
        const año = cot.fecha.getFullYear();
        coincideMes = `${año}-${mes}` === filtroMes;
      }

      return coincideBusqueda && coincideEstado && coincideMes;
    });
  }, [busqueda, filtroEstado, filtroMes]);

  // Paginación
  const totalPaginas = Math.ceil(cotizacionesFiltradas.length / itemsPorPagina);
  const cotizacionesPaginadas = cotizacionesFiltradas.slice(
    (pagina - 1) * itemsPorPagina,
    pagina * itemsPorPagina
  );

  // Estados de cotización
  const estados = Object.values(CotizacionEstado);

  const getEstadoBadge = (estado: CotizacionEstado) => {
    const estilos = {
      [CotizacionEstado.BORRADOR]: 'bg-gray-100 text-gray-800',
      [CotizacionEstado.ENVIADA]: 'bg-blue-100 text-blue-800',
      [CotizacionEstado.ACEPTADA]: 'bg-green-100 text-green-800',
      [CotizacionEstado.RECHAZADA]: 'bg-red-100 text-red-800',
      [CotizacionEstado.VENCIDA]: 'bg-yellow-100 text-yellow-800',
    };
    return estilos[estado];
  };

  const getNombreContacto = (cot: any) => {
    if (cot.clienteId) {
      const cliente = clientesMock.find((c) => c.id === cot.clienteId);
      return cliente?.nombre || 'Cliente desconocido';
    } else if (cot.prospectoId) {
      const prospecto = prospectosMock.find((p) => p.id === cot.prospectoId);
      return prospecto?.nombre || 'Prospecto desconocido';
    }
    return 'Sin contacto';
  };

  return (
    <DashboardLayout
      titulo="Cotizaciones"
      descripcion="Gestión de cotizaciones y propuestas comerciales"
      acciones={
        <Button className="gap-2">
          <Plus size={18} />
          Nueva Cotización
        </Button>
      }
    >
      {/* Filtros */}
      <div className="bg-card rounded-lg border border-border p-6 mb-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Búsqueda */}
          <div className="relative">
            <Search size={18} className="absolute left-3 top-3 text-muted-foreground" />
            <Input
              placeholder="Buscar cotización..."
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setPagina(1);
              }}
              className="pl-10"
            />
          </div>

          {/* Filtro Estado */}
          <Select value={filtroEstado} onValueChange={(v) => setFiltroEstado(v as any)}>
            <SelectTrigger>
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              {estados.map((estado) => (
                <SelectItem key={estado} value={estado}>
                  {estado.charAt(0).toUpperCase() + estado.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filtro Mes */}
          <Select value={filtroMes} onValueChange={(v) => setFiltroMes(v)}>
            <SelectTrigger>
              <SelectValue placeholder="Mes/Año" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los meses</SelectItem>
              {mesesDisponibles.map((mes) => {
                const [año, mesNum] = mes.split('-');
                const fecha = new Date(parseInt(año), parseInt(mesNum) - 1);
                return (
                  <SelectItem key={mes} value={mes}>
                    {fecha.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          {/* Información */}
          <div className="flex items-center justify-end text-sm text-muted-foreground">
            {cotizacionesFiltradas.length} cotización{cotizacionesFiltradas.length !== 1 ? 'es' : ''}
          </div>
        </div>
      </div>

      {/* Tabla de Cotizaciones */}
      <div className="bg-card rounded-lg border border-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-accent">
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Número
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Contacto
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Fecha
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Monto
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Estado
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Vencimiento
                </th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-foreground">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {cotizacionesPaginadas.map((cot, idx) => (
                <tr
                  key={cot.id}
                  className={`border-b border-border transition-smooth hover:bg-accent ${
                    idx % 2 === 0 ? 'bg-background' : 'bg-accent/50'
                  }`}
                >
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-foreground">{cot.numero}</p>
                      <p className="text-xs text-muted-foreground">{cot.moneda}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-foreground">
                    {getNombreContacto(cot)}
                  </td>
                  <td className="px-6 py-4 text-sm text-foreground">
                    {cot.fecha.toLocaleDateString('es-CO')}
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-foreground">
                      ${(cot.total / 1000000).toFixed(2)}M
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {cot.lineas.length} línea{cot.lineas.length !== 1 ? 's' : ''}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getEstadoBadge(cot.estado)}`}>
                      {cot.estado.charAt(0).toUpperCase() + cot.estado.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-foreground">
                    {cot.fechaVencimiento.toLocaleDateString('es-CO')}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button className="p-2 hover:bg-background rounded transition-smooth text-muted-foreground hover:text-foreground" title="Ver">
                        <Eye size={18} />
                      </button>
                      <button className="p-2 hover:bg-background rounded transition-smooth text-muted-foreground hover:text-foreground" title="Descargar">
                        <Download size={18} />
                      </button>
                      {cot.estado === CotizacionEstado.BORRADOR && (
                        <button className="p-2 hover:bg-background rounded transition-smooth text-muted-foreground hover:text-primary" title="Enviar">
                          <Send size={18} />
                        </button>
                      )}
                      <button className="p-2 hover:bg-background rounded transition-smooth text-muted-foreground hover:text-foreground">
                        <Edit size={18} />
                      </button>
                      <button className="p-2 hover:bg-background rounded transition-smooth text-muted-foreground hover:text-destructive">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {(pagina - 1) * itemsPorPagina + 1} a{' '}
            {Math.min(pagina * itemsPorPagina, cotizacionesFiltradas.length)} de{' '}
            {cotizacionesFiltradas.length}
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
              Página {pagina} de {totalPaginas}
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
      </div>
    </DashboardLayout>
  );
}
