/**
 * Página de Prospectos - Gestión de cartera de prospectos
 * 
 * Componentes:
 * - Tabla de prospectos con búsqueda
 * - Filtros por estado, probabilidad, fuente
 * - Indicadores visuales de estado
 * - Paginación
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
  TrendingUp,
  Mail,
  Phone,
} from 'lucide-react';
import { prospectosMock } from '@/lib/mock-data';
import { Prospecto, ProspectoEstado } from '@/lib/types';
import { Link } from 'wouter';

export default function Prospectos() {
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<ProspectoEstado | 'todos'>('todos');
  const [filtroProbabilidad, setFiltroProbabilidad] = useState('todos');
  const [pagina, setPagina] = useState(1);
  const itemsPorPagina = 10;

  // Filtrar prospectos
  const prospectosFiltrados = useMemo(() => {
    return prospectosMock.filter((prospecto) => {
      const coincideBusqueda =
        prospecto.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        prospecto.empresa.toLowerCase().includes(busqueda.toLowerCase()) ||
        prospecto.email.toLowerCase().includes(busqueda.toLowerCase());

      const coincideEstado =
        filtroEstado === 'todos' || prospecto.estado === filtroEstado;

      let coincideProbabilidad = true;
      if (filtroProbabilidad !== 'todos') {
        if (filtroProbabilidad === 'alta' && prospecto.probabilidadConversion < 70)
          coincideProbabilidad = false;
        if (filtroProbabilidad === 'media' && (prospecto.probabilidadConversion < 40 || prospecto.probabilidadConversion >= 70))
          coincideProbabilidad = false;
        if (filtroProbabilidad === 'baja' && prospecto.probabilidadConversion >= 40)
          coincideProbabilidad = false;
      }

      return coincideBusqueda && coincideEstado && coincideProbabilidad;
    });
  }, [busqueda, filtroEstado, filtroProbabilidad]);

  // Paginación
  const totalPaginas = Math.ceil(prospectosFiltrados.length / itemsPorPagina);
  const prospectosPaginados = prospectosFiltrados.slice(
    (pagina - 1) * itemsPorPagina,
    pagina * itemsPorPagina
  );

  // Estados de prospecto
  const estados = Object.values(ProspectoEstado);

  const getEstadoBadge = (estado: ProspectoEstado) => {
    const estilos = {
      [ProspectoEstado.NUEVO]: 'bg-blue-100 text-blue-800',
      [ProspectoEstado.CONTACTADO]: 'bg-cyan-100 text-cyan-800',
      [ProspectoEstado.INTERESADO]: 'bg-yellow-100 text-yellow-800',
      [ProspectoEstado.NEGOCIACION]: 'bg-orange-100 text-orange-800',
      [ProspectoEstado.GANADO]: 'bg-green-100 text-green-800',
      [ProspectoEstado.PERDIDO]: 'bg-red-100 text-red-800',
    };
    return estilos[estado];
  };

  const getProbabilidadColor = (prob: number) => {
    if (prob >= 70) return 'text-green-600';
    if (prob >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <DashboardLayout
      titulo="Prospectos"
      descripcion="Gestión de cartera de prospectos y oportunidades de venta"
      acciones={
        <Link href="/prospectos/nuevo">
          <Button className="gap-2">
            <Plus size={18} />
            Nuevo Prospecto
          </Button>
        </Link>
      }
    >
      {/* Filtros */}
      <div className="bg-card rounded-lg border border-border p-6 mb-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Búsqueda */}
          <div className="relative">
            <Search size={18} className="absolute left-3 top-3 text-muted-foreground" />
            <Input
              placeholder="Buscar prospecto..."
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

          {/* Filtro Probabilidad */}
          <Select value={filtroProbabilidad} onValueChange={(v) => setFiltroProbabilidad(v)}>
            <SelectTrigger>
              <SelectValue placeholder="Probabilidad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              <SelectItem value="alta">Alta (70%+)</SelectItem>
              <SelectItem value="media">Media (40-69%)</SelectItem>
              <SelectItem value="baja">Baja (-40%)</SelectItem>
            </SelectContent>
          </Select>

          {/* Información */}
          <div className="flex items-center justify-end text-sm text-muted-foreground">
            {prospectosFiltrados.length} prospecto{prospectosFiltrados.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Tabla de Prospectos */}
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
              {prospectosPaginados.map((prospecto, idx) => (
                <tr
                  key={prospecto.id}
                  className={`border-b border-border transition-smooth hover:bg-accent ${
                    idx % 2 === 0 ? 'bg-background' : 'bg-accent/50'
                  }`}
                >
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-foreground">{prospecto.nombre}</p>
                      <p className="text-xs text-muted-foreground">{prospecto.fuente}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-foreground">{prospecto.empresa}</td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-foreground">
                        <Mail size={14} className="text-muted-foreground" />
                        <span className="truncate">{prospecto.email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-foreground">
                        <Phone size={14} className="text-muted-foreground" />
                        <span>{prospecto.telefono}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getEstadoBadge(prospecto.estado)}`}>
                      {prospecto.estado.charAt(0).toUpperCase() + prospecto.estado.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-accent rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${prospecto.probabilidadConversion}%` }}
                        />
                      </div>
                      <span className={`text-sm font-semibold ${getProbabilidadColor(prospecto.probabilidadConversion)}`}>
                        {prospecto.probabilidadConversion}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-foreground">
                    {prospecto.montoEstimado ? (
                      <div>
                        <p className="font-medium">${(prospecto.montoEstimado / 1000000).toFixed(1)}M</p>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">-</p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <Link href={`/prospectos/${prospecto.id}`}>
                        <button className="p-2 hover:bg-background rounded transition-smooth text-muted-foreground hover:text-foreground">
                          <Eye size={18} />
                        </button>
                      </Link>
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
            {Math.min(pagina * itemsPorPagina, prospectosFiltrados.length)} de{' '}
            {prospectosFiltrados.length}
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
