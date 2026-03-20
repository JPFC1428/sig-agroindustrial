/**
 * DashboardCard - Componente de tarjeta para métricas
 * 
 * Diseño Minimalismo Corporativo Moderno:
 * - Bordes sutiles con sombra mínima
 * - Números grandes en color primario
 * - Iconografía consistente
 * - Transiciones suaves en hover
 */

import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

interface DashboardCardProps {
  titulo: string;
  valor: string | number;
  icono: LucideIcon;
  descripcion?: string;
  acento?: 'primario' | 'secundario' | 'destructivo';
  onClick?: () => void;
  className?: string;
}

export function DashboardCard({
  titulo,
  valor,
  icono: Icon,
  descripcion,
  acento = 'primario',
  onClick,
  className = '',
}: DashboardCardProps) {
  const acentoClases = {
    primario: 'text-primary',
    secundario: 'text-secondary',
    destructivo: 'text-destructive',
  };

  return (
    <div
      onClick={onClick}
      className={`
        card-metric cursor-pointer group
        ${onClick ? 'hover:shadow-lg' : ''}
        ${className}
      `}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground mb-2">{titulo}</p>
          <p className="text-3xl font-bold text-foreground mb-1">{valor}</p>
          {descripcion && (
            <p className="text-xs text-muted-foreground">{descripcion}</p>
          )}
        </div>
        <div className={`${acentoClases[acento]} opacity-80 group-hover:opacity-100 transition-opacity`}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  );
}

export default DashboardCard;
