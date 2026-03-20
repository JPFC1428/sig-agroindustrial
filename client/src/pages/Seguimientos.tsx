/**
 * Página de Seguimientos - Gestión de seguimientos y tareas
 * 
 * Componentes:
 * - Listado de seguimientos con búsqueda
 * - Filtros por tipo, estado (completado/pendiente)
 * - Indicadores visuales de prioridad
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
  Trash2,
  CheckCircle2,
  Circle,
  Phone,
  Mail,
  Users,
  CheckSquare,
  MessageSquare,
} from 'lucide-react';
import { seguimientosMock, clientesMock, prospectosMock } from '@/lib/mock-data';
import { SeguimientoTipo } from '@/lib/types';

export default function Seguimientos() {
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<SeguimientoTipo | 'todos'>('todos');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [pagina, setPagina] = useState(1);
  const itemsPorPagina = 10;

  // Filtrar seguimientos
  const seguimientosFiltrados = useMemo(() => {
    return seguimientosMock.filter((seg) => {
      // Obtener nombre del cliente o prospecto
      let nombre = '';
      if (seg.clienteId) {
        const cliente = clientesMock.find((c) => c.id === seg.clienteId);
        nombre = cliente?.nombre || '';
      } else if (seg.prospectoId) {
        const prospecto = prospectosMock.find((p) => p.id === seg.prospectoId);
        nombre = prospecto?.nombre || '';
      }

      const coincideBusqueda =
        nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        seg.asunto.toLowerCase().includes(busqueda.toLowerCase()) ||
        seg.descripcion.toLowerCase().includes(busqueda.toLowerCase());

      const coincideTipo = filtroTipo === 'todos' || seg.tipo === filtroTipo;

      let coincideEstado = true;
      if (filtroEstado === 'completado') {
        coincideEstado = seg.completado;
      } else if (filtroEstado === 'pendiente') {
        coincideEstado = !seg.completado;
      }

      return coincideBusqueda && coincideTipo && coincideEstado;
    });
  }, [busqueda, filtroTipo, filtroEstado]);

  // Paginación
  const totalPaginas = Math.ceil(seguimientosFiltrados.length / itemsPorPagina);
  const seguimientosPaginados = seguimientosFiltrados.slice(
    (pagina - 1) * itemsPorPagina,
    pagina * itemsPorPagina
  );

  // Tipos de seguimiento
  const tipos = Object.values(SeguimientoTipo);

  const getTipoIcon = (tipo: SeguimientoTipo) => {
    const iconos = {
      [SeguimientoTipo.LLAMADA]: <Phone size={18} />,
      [SeguimientoTipo.EMAIL]: <Mail size={18} />,
      [SeguimientoTipo.REUNION]: <Users size={18} />,
      [SeguimientoTipo.MENSAJE]: <MessageSquare size={18} />,
      [SeguimientoTipo.TAREA]: <CheckSquare size={18} />,
    };
    return iconos[tipo];
  };

  const getTipoBadge = (tipo: SeguimientoTipo) => {
    const estilos = {
      [SeguimientoTipo.LLAMADA]: 'bg-blue-100 text-blue-800',
      [SeguimientoTipo.EMAIL]: 'bg-cyan-100 text-cyan-800',
      [SeguimientoTipo.REUNION]: 'bg-purple-100 text-purple-800',
      [SeguimientoTipo.MENSAJE]: 'bg-green-100 text-green-800',
      [SeguimientoTipo.TAREA]: 'bg-orange-100 text-orange-800',
    };
    return estilos[tipo];
  };

  const getNombreContacto = (seg: any) => {
    if (seg.clienteId) {
      const cliente = clientesMock.find((c) => c.id === seg.clienteId);
      return cliente?.nombre || 'Cliente desconocido';
    } else if (seg.prospectoId) {
      const prospecto = prospectosMock.find((p) => p.id === seg.prospectoId);
      return prospecto?.nombre || 'Prospecto desconocido';
    }
    return 'Sin contacto';
  };

  const toggleCompletado = (id: string) => {
    // Esta función sería para marcar como completado
    console.log('Marcar como completado:', id);
  };

  return (
    <DashboardLayout
      titulo="Seguimientos"
      descripcion="Gestión de seguimientos, tareas y recordatorios"
      acciones={
        <Button className="gap-2">
          <Plus size={18} />
          Nuevo Seguimiento
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
              placeholder="Buscar seguimiento..."
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
              <SelectValue placeholder="Tipo" />
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

          {/* Filtro Estado */}
          <Select value={filtroEstado} onValueChange={(v) => setFiltroEstado(v)}>
            <SelectTrigger>
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pendiente">Pendientes</SelectItem>
              <SelectItem value="completado">Completados</SelectItem>
            </SelectContent>
          </Select>

          {/* Información */}
          <div className="flex items-center justify-end text-sm text-muted-foreground">
            {seguimientosFiltrados.length} seguimiento{seguimientosFiltrados.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Listado de Seguimientos */}
      <div className="space-y-3">
        {seguimientosPaginados.length > 0 ? (
          seguimientosPaginados.map((seg) => (
            <div
              key={seg.id}
              className={`bg-card rounded-lg border transition-smooth hover:shadow-md p-4 ${
                seg.completado ? 'border-green-200 bg-green-50/30' : 'border-border'
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Checkbox */}
                <button
                  onClick={() => toggleCompletado(seg.id)}
                  className="mt-1 flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {seg.completado ? (
                    <CheckCircle2 size={20} className="text-green-600" />
                  ) : (
                    <Circle size={20} />
                  )}
                </button>

                {/* Contenido */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`p-2 rounded-lg ${getTipoBadge(seg.tipo)}`}>
                      {getTipoIcon(seg.tipo)}
                    </span>
                    <h3 className={`font-semibold ${seg.completado ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                      {seg.asunto}
                    </h3>
                  </div>

                  <p className={`text-sm mb-2 ${seg.completado ? 'text-muted-foreground' : 'text-foreground'}`}>
                    {seg.descripcion}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span>
                      <strong>Contacto:</strong> {getNombreContacto(seg)}
                    </span>
                    <span>
                      <strong>Fecha:</strong> {seg.fecha.toLocaleDateString('es-CO')}
                    </span>
                    {seg.proximoSeguimiento && (
                      <span>
                        <strong>Próximo:</strong> {seg.proximoSeguimiento.toLocaleDateString('es-CO')}
                      </span>
                    )}
                    {seg.resultado && (
                      <span>
                        <strong>Resultado:</strong> {seg.resultado}
                      </span>
                    )}
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex gap-2 flex-shrink-0">
                  <button className="p-2 hover:bg-accent rounded transition-smooth text-muted-foreground hover:text-foreground">
                    <Edit size={18} />
                  </button>
                  <button className="p-2 hover:bg-accent rounded transition-smooth text-muted-foreground hover:text-destructive">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-card rounded-lg border border-border p-12 text-center">
            <p className="text-muted-foreground">No hay seguimientos que coincidan con los filtros</p>
          </div>
        )}
      </div>

      {/* Paginación */}
      {totalPaginas > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {(pagina - 1) * itemsPorPagina + 1} a{' '}
            {Math.min(pagina * itemsPorPagina, seguimientosFiltrados.length)} de{' '}
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
