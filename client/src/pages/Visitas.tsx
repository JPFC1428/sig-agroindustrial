/**
 * Página de Visitas - Gestión de visitas comerciales
 * 
 * Componentes:
 * - Listado de visitas con filtros
 * - Búsqueda por cliente/prospecto
 * - Indicadores de tipo de visita
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
  Calendar,
  Clock,
  MapPin,
  Users,
} from 'lucide-react';
import { visitasMock, clientesMock, prospectosMock } from '@/lib/mock-data';
import { VisitaTipo } from '@/lib/types';

export default function Visitas() {
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<VisitaTipo | 'todos'>('todos');
  const [pagina, setPagina] = useState(1);
  const itemsPorPagina = 10;

  // Filtrar visitas
  const visitasFiltradas = useMemo(() => {
    return visitasMock.filter((visita) => {
      // Obtener nombre del cliente o prospecto
      let nombre = '';
      if (visita.clienteId) {
        const cliente = clientesMock.find((c) => c.id === visita.clienteId);
        nombre = cliente?.nombre || '';
      } else if (visita.prospectoId) {
        const prospecto = prospectosMock.find((p) => p.id === visita.prospectoId);
        nombre = prospecto?.nombre || '';
      }

      const coincideBusqueda =
        nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        visita.lugar.toLowerCase().includes(busqueda.toLowerCase());

      const coincideTipo = filtroTipo === 'todos' || visita.tipo === filtroTipo;

      return coincideBusqueda && coincideTipo;
    });
  }, [busqueda, filtroTipo]);

  // Paginación
  const totalPaginas = Math.ceil(visitasFiltradas.length / itemsPorPagina);
  const visitasPaginadas = visitasFiltradas.slice(
    (pagina - 1) * itemsPorPagina,
    pagina * itemsPorPagina
  );

  // Tipos de visita
  const tipos = Object.values(VisitaTipo);

  const getTipoBadge = (tipo: VisitaTipo) => {
    const estilos = {
      [VisitaTipo.PROSPECTACION]: 'bg-blue-100 text-blue-800',
      [VisitaTipo.SEGUIMIENTO]: 'bg-cyan-100 text-cyan-800',
      [VisitaTipo.NEGOCIACION]: 'bg-orange-100 text-orange-800',
      [VisitaTipo.SERVICIO]: 'bg-green-100 text-green-800',
    };
    return estilos[tipo];
  };

  const getNombreContacto = (visita: any) => {
    if (visita.clienteId) {
      const cliente = clientesMock.find((c) => c.id === visita.clienteId);
      return cliente?.nombre || 'Cliente desconocido';
    } else if (visita.prospectoId) {
      const prospecto = prospectosMock.find((p) => p.id === visita.prospectoId);
      return prospecto?.nombre || 'Prospecto desconocido';
    }
    return 'Sin contacto';
  };

  return (
    <DashboardLayout
      titulo="Visitas"
      descripcion="Gestión de visitas comerciales y seguimientos"
      acciones={
        <Button className="gap-2">
          <Plus size={18} />
          Nueva Visita
        </Button>
      }
    >
      {/* Filtros */}
      <div className="bg-card rounded-lg border border-border p-6 mb-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Búsqueda */}
          <div className="relative">
            <Search size={18} className="absolute left-3 top-3 text-muted-foreground" />
            <Input
              placeholder="Buscar visita..."
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setPagina(1);
              }}
              className="pl-10"
            />
          </div>

          {/* Filtro Tipo */}
          <Select value={filtroTipo} onValueChange={(v) => setFiltroTipo(v as any)}>
            <SelectTrigger>
              <SelectValue placeholder="Tipo de visita" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los tipos</SelectItem>
              {tipos.map((tipo) => (
                <SelectItem key={tipo} value={tipo}>
                  {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Información */}
          <div className="flex items-center justify-end text-sm text-muted-foreground">
            {visitasFiltradas.length} visita{visitasFiltradas.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Listado de Visitas */}
      <div className="space-y-4">
        {visitasPaginadas.length > 0 ? (
          visitasPaginadas.map((visita) => (
            <div
              key={visita.id}
              className="bg-card rounded-lg border border-border p-6 shadow-sm hover:shadow-md transition-smooth"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-foreground">
                      {getNombreContacto(visita)}
                    </h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getTipoBadge(visita.tipo)}`}>
                      {visita.tipo.charAt(0).toUpperCase() + visita.tipo.slice(1)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{visita.lugar}</p>
                </div>
                <div className="flex gap-2">
                  <button className="p-2 hover:bg-accent rounded transition-smooth text-muted-foreground hover:text-foreground">
                    <Eye size={18} />
                  </button>
                  <button className="p-2 hover:bg-accent rounded transition-smooth text-muted-foreground hover:text-foreground">
                    <Edit size={18} />
                  </button>
                  <button className="p-2 hover:bg-accent rounded transition-smooth text-muted-foreground hover:text-destructive">
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
                      {visita.fecha.toLocaleDateString('es-CO')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Hora</p>
                    <p className="text-sm font-medium text-foreground">{visita.hora}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Duración</p>
                    <p className="text-sm font-medium text-foreground">{visita.duracion} min</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Asistentes</p>
                    <p className="text-sm font-medium text-foreground">{visita.asistentes.length}</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2">Resultados</h4>
                <p className="text-sm text-foreground">{visita.resultados}</p>
                {visita.proximaAccion && (
                  <div className="mt-3 p-3 bg-accent rounded">
                    <p className="text-xs text-muted-foreground mb-1">Próxima Acción</p>
                    <p className="text-sm font-medium text-foreground">{visita.proximaAccion}</p>
                    {visita.proximaFecha && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {visita.proximaFecha.toLocaleDateString('es-CO')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="bg-card rounded-lg border border-border p-12 text-center">
            <p className="text-muted-foreground">No hay visitas que coincidan con los filtros</p>
          </div>
        )}
      </div>

      {/* Paginación */}
      {totalPaginas > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {(pagina - 1) * itemsPorPagina + 1} a{' '}
            {Math.min(pagina * itemsPorPagina, visitasFiltradas.length)} de{' '}
            {visitasFiltradas.length}
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
      )}
    </DashboardLayout>
  );
}
