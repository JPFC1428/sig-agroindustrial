/**
 * Sidebar - Navegacion lateral fija
 *
 * Diseno Minimalismo Corporativo Moderno:
 * - Ancho fijo: 240px
 * - Navegacion vertical clara
 * - Indicador visual del elemento activo
 * - Transiciones suaves
 */

import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  Archive,
  CheckCircle,
  FileText,
  Landmark,
  LayoutDashboard,
  LogOut,
  MapPin,
  MessageSquare,
  Package,
  ShoppingCart,
  Shield,
  Store,
  Target,
  Truck,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  formatRoleLabel,
  getVisibleModulesForRole,
} from "@/lib/access-control";
import {
  APP_MODULES,
  getModuleByPath,
  getVisibleModuleItems,
  type AppModuleKey,
  type ModuleNavItem,
} from "@/lib/module-navigation";
import type { ConteosModulosDashboard } from "@/lib/types";
import { UsuarioRol } from "@/lib/types";

interface SidebarProps {
  conteos?: ConteosModulosDashboard | null;
}

function getModuleIcon(moduleKey: AppModuleKey) {
  switch (moduleKey) {
    case "comercial":
      return <Target size={18} />;
    case "sertec":
      return <Wrench size={18} />;
    case "contable":
      return <Landmark size={18} />;
    case "inventario-compras":
      return <Package size={18} />;
    case "chat-interno":
      return <MessageSquare size={18} />;
    case "mercado-agricola":
      return <Store size={18} />;
    default:
      return <LayoutDashboard size={18} />;
  }
}

function getItemIcon(itemId: string) {
  if (itemId.includes("dashboard")) {
    return <LayoutDashboard size={20} />;
  }

  if (
    itemId.includes("clientes") ||
    itemId.includes("proveedores") ||
    itemId.includes("terceros")
  ) {
    return <Users size={20} />;
  }

  if (itemId.includes("prospectos")) {
    return <Target size={20} />;
  }

  if (itemId.includes("visitas") || itemId.includes("viaticos")) {
    return <MapPin size={20} />;
  }

  if (
    itemId.includes("seguimientos") ||
    itemId.includes("cuadres") ||
    itemId.includes("nomina")
  ) {
    return <CheckCircle size={20} />;
  }

  if (
    itemId.includes("cartera") ||
    itemId.includes("recibos") ||
    itemId.includes("bancos") ||
    itemId.includes("conciliaciones")
  ) {
    return <Wallet size={20} />;
  }

  if (itemId.includes("compras")) {
    return <ShoppingCart size={20} />;
  }

  if (itemId.includes("entradas")) {
    return <Truck size={20} />;
  }

  if (itemId.includes("productos") || itemId.includes("inventario")) {
    return <Package size={20} />;
  }

  if (itemId.includes("archivo")) {
    return <Archive size={20} />;
  }

  if (itemId.includes("chat")) {
    return <MessageSquare size={20} />;
  }

  if (itemId.includes("mercado")) {
    return <Store size={20} />;
  }

  return <FileText size={20} />;
}

function getLinkClasses(active: boolean) {
  return `
    flex items-center justify-between px-4 py-3 rounded-lg transition-smooth
    ${
      active
        ? "bg-sidebar-primary text-sidebar-primary-foreground"
        : "text-sidebar-foreground hover:bg-sidebar-accent"
    }
  `;
}

function SidebarNavLink({
  active,
  badgeValue,
  href,
  icon,
  label,
}: {
  active: boolean;
  badgeValue?: number;
  href: string;
  icon: ReactNode;
  label: string;
}) {
  return (
    <Link href={href} className={getLinkClasses(active)}>
      <div className="flex items-center gap-3">
        <span className={active ? "opacity-100" : "opacity-70"}>{icon}</span>
        <span className="text-sm font-medium">{label}</span>
      </div>
      {badgeValue !== undefined && (
        <span
          className={`
            px-2 py-1 rounded text-xs font-semibold
            ${
              active
                ? "bg-sidebar-primary-foreground text-sidebar-primary"
                : "bg-sidebar-accent text-sidebar-foreground"
            }
          `}
        >
          {badgeValue}
        </span>
      )}
    </Link>
  );
}

export function Sidebar({ conteos }: SidebarProps) {
  const [location, setLocation] = useLocation();
  const { logout, user } = useAuth();
  const visibleModules = user ? getVisibleModulesForRole(user.rol) : APP_MODULES;
  const derivedModule = getModuleByPath(location);
  const currentModule =
    visibleModules.find(module => module.key === derivedModule.key) ??
    visibleModules[0] ??
    derivedModule;
  const currentModuleItems = getVisibleModuleItems(currentModule);
  const systemItems: ModuleNavItem[] =
    user?.rol === UsuarioRol.ADMIN
      ? [
          {
            id: "usuarios",
            label: "Usuarios",
            href: "/usuarios",
            description: "Gestion basica de usuarios del sistema.",
          },
        ]
      : [];

  const isActive = (href: string) => {
    return location === href || location.startsWith(href + "/");
  };

  async function handleLogout() {
    await logout();
    setLocation("/login");
  }

  return (
    <aside className="fixed left-0 top-0 flex h-screen w-60 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="border-b border-sidebar-border px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
            <span className="text-sm font-bold text-sidebar-primary-foreground">
              SIG
            </span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-sidebar-foreground">
              SIG Agroindustrial
            </h1>
            <p className="text-xs text-muted-foreground">
              {currentModule.subtitle}
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="mb-4">
          <p className="px-4 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Modulos
          </p>
          <div className="space-y-1">
            {visibleModules.map(module => (
              <SidebarNavLink
                key={module.key}
                active={module.key === currentModule.key}
                href={module.href}
                icon={getModuleIcon(module.key)}
                label={module.label}
              />
            ))}
          </div>
        </div>

        <div className="mb-4 border-t border-sidebar-border pt-4">
          <p className="px-4 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {currentModule.label}
          </p>
          <div className="space-y-1">
            {currentModuleItems.map(item => {
              const badgeValue =
                item.badgeKey !== undefined ? conteos?.[item.badgeKey] : undefined;

              return (
                <SidebarNavLink
                  key={item.id}
                  active={isActive(item.href)}
                  badgeValue={badgeValue}
                  href={item.href}
                  icon={getItemIcon(item.id)}
                  label={item.label}
                />
              );
            })}
          </div>
        </div>

        {systemItems.length > 0 && (
          <div className="border-t border-sidebar-border pt-4">
            <p className="px-4 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Sistema
            </p>
            <div className="space-y-1">
              {systemItems.map(item => (
                <SidebarNavLink
                  key={item.id}
                  active={isActive(item.href)}
                  href={item.href}
                  icon={<Shield size={20} />}
                  label={item.label}
                />
              ))}
            </div>
          </div>
        )}
      </nav>

      <div className="border-t border-sidebar-border px-3 py-4">
        {user && (
          <div className="px-4 pb-3">
            <p className="truncate text-sm font-medium text-sidebar-foreground">
              {user.nombre}
            </p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            <p className="truncate text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              {formatRoleLabel(user.rol)}
            </p>
          </div>
        )}
        <button
          className="
            w-full flex items-center gap-3 px-4 py-3 rounded-lg
            text-sidebar-foreground hover:bg-sidebar-accent
            transition-smooth text-sm font-medium
          "
          onClick={() => void handleLogout()}
          type="button"
        >
          <LogOut size={20} />
          <span>Cerrar Sesion</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
