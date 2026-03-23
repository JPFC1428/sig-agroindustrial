/**
 * Sidebar - Navegación lateral fija
 * 
 * Diseño Minimalismo Corporativo Moderno:
 * - Ancho fijo: 240px
 * - Navegación vertical clara
 * - Indicador visual del elemento activo
 * - Transiciones suaves
 */

import { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import {
  LayoutDashboard,
  Users,
  Target,
  MapPin,
  FileText,
  CheckCircle,
  LogOut,
} from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: ReactNode;
  badge?: number;
}

const navItems: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/dashboard',
    icon: <LayoutDashboard size={20} />,
  },
  {
    id: 'clientes',
    label: 'Clientes',
    href: '/clientes',
    icon: <Users size={20} />,
  },
  {
    id: 'prospectos',
    label: 'Prospectos',
    href: '/prospectos',
    icon: <Target size={20} />,
    badge: 3,
  },
  {
    id: 'visitas',
    label: 'Visitas',
    href: '/visitas',
    icon: <MapPin size={20} />,
  },
  {
    id: 'cotizaciones',
    label: 'Cotizaciones',
    href: '/cotizaciones',
    icon: <FileText size={20} />,
    badge: 2,
  },
  {
    id: 'seguimientos',
    label: 'Seguimientos',
    href: '/seguimientos',
    icon: <CheckCircle size={20} />,
  },
];

export function Sidebar() {
  const [location] = useLocation();

  const isActive = (href: string) => {
    return location === href || location.startsWith(href + '/');
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Header */}
      <div className="px-6 py-6 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-sidebar-primary rounded-lg flex items-center justify-center">
            <span className="text-sidebar-primary-foreground font-bold text-sm">SIG</span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-sidebar-foreground">SIG Agroindustrial</h1>
            <p className="text-xs text-muted-foreground">Módulo Comercial</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={`
              flex items-center justify-between px-4 py-3 rounded-lg transition-smooth
              ${
                isActive(item.href)
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent'
              }
            `}
          >
            <div className="flex items-center gap-3">
              <span className={isActive(item.href) ? 'opacity-100' : 'opacity-70'}>
                {item.icon}
              </span>
              <span className="text-sm font-medium">{item.label}</span>
            </div>
            {item.badge && (
              <span
                className={`
                  px-2 py-1 rounded text-xs font-semibold
                  ${
                    isActive(item.href)
                      ? 'bg-sidebar-primary-foreground text-sidebar-primary'
                      : 'bg-sidebar-accent text-sidebar-foreground'
                  }
                `}
              >
                {item.badge}
              </span>
            )}
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-sidebar-border">
        <button
          className="
            w-full flex items-center gap-3 px-4 py-3 rounded-lg
            text-sidebar-foreground hover:bg-sidebar-accent
            transition-smooth text-sm font-medium
          "
        >
          <LogOut size={20} />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
