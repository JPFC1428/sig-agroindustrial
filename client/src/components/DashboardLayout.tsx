/**
 * DashboardLayout - Layout general para todas las paginas del modulo comercial
 *
 * Estructura:
 * - Sidebar fijo a la izquierda (240px)
 * - Contenido principal con padding responsivo
 * - Header con informacion del usuario y acciones
 */

import { ReactNode, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Bell, LogOut, Settings, User } from 'lucide-react';
import { useLocation } from 'wouter';
import { Sidebar } from './Sidebar';
import { Badge } from '@/components/ui/badge';
import { canAccessPath, formatRoleLabel } from '@/lib/access-control';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { getDashboardResumen } from '@/lib/dashboard-api';
import { subscribeDashboardDataChanged } from '@/lib/dashboard-events';
import type {
  AlertaSeguimientoDashboard,
  ConteosModulosDashboard,
} from '@/lib/types';

interface DashboardLayoutProps {
  children: ReactNode;
  titulo?: string;
  descripcion?: string;
  acciones?: ReactNode;
}

function buildRelacionLabel(alerta: AlertaSeguimientoDashboard) {
  if (alerta.relacionadoEmpresa && alerta.relacionadoNombre) {
    return `${alerta.relacionadoEmpresa} - ${alerta.relacionadoNombre}`;
  }

  return (
    alerta.relacionadoEmpresa ||
    alerta.relacionadoNombre ||
    alerta.cotizacionNumero ||
    'Sin relacion'
  );
}

export function DashboardLayout({
  children,
  titulo,
  descripcion,
  acciones,
}: DashboardLayoutProps) {
  const [location, setLocation] = useLocation();
  const { logout, user } = useAuth();
  const [alertasSeguimiento, setAlertasSeguimiento] = useState<
    AlertaSeguimientoDashboard[]
  >([]);
  const [conteos, setConteos] = useState<ConteosModulosDashboard | null>(null);
  const [loadingAlertas, setLoadingAlertas] = useState(true);
  const [errorAlertas, setErrorAlertas] = useState<string | null>(null);
  const canAccessComercial = user ? canAccessPath(user.rol, '/dashboard') : false;
  const canAccessSeguimientos = user
    ? canAccessPath(user.rol, '/seguimientos')
    : false;

  useEffect(() => {
    let active = true;

    if (!user) {
      setAlertasSeguimiento([]);
      setConteos(null);
      setLoadingAlertas(false);
      setErrorAlertas(null);
      return () => {
        active = false;
      };
    }

    if (!canAccessComercial) {
      setAlertasSeguimiento([]);
      setConteos(null);
      setLoadingAlertas(false);
      setErrorAlertas(null);
      return () => {
        active = false;
      };
    }

    async function loadAlertas() {
      setLoadingAlertas(true);
      setErrorAlertas(null);

      try {
        const data = await getDashboardResumen();

        if (!active) {
          return;
        }

        setConteos(data.conteos);
        setAlertasSeguimiento(data.alertasSeguimiento);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setErrorAlertas(
          loadError instanceof Error
            ? loadError.message
            : 'No se pudieron cargar los seguimientos'
        );
      } finally {
        if (active) {
          setLoadingAlertas(false);
        }
      }
    }

    void loadAlertas();

    const unsubscribe = subscribeDashboardDataChanged(() => {
      if (!active) {
        return;
      }

      void loadAlertas();
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [canAccessComercial, location, user]);

  async function handleLogout() {
    await logout();
    setLocation('/login');
  }

  function goToConfiguracion() {
    setLocation('/configuracion');
  }

  function goToSeguimientos() {
    setLocation('/seguimientos');
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar conteos={conteos} />

      <main className="flex-1 ml-60 flex flex-col overflow-hidden">
        <header className="bg-card border-b border-border px-8 py-4 flex items-center justify-between shadow-sm">
          <div className="flex-1">
            {titulo && (
              <>
                <h1 className="text-2xl font-bold text-foreground">{titulo}</h1>
                {descripcion && (
                  <p className="text-sm text-muted-foreground mt-1">{descripcion}</p>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-4">
            {acciones && <div className="flex items-center gap-2">{acciones}</div>}

            <div className="flex items-center gap-3 border-l border-border pl-4">
              {canAccessSeguimientos && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-2 hover:bg-accent rounded-lg transition-smooth text-muted-foreground hover:text-foreground">
                      <Bell size={20} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-80">
                    <DropdownMenuLabel>Seguimientos pendientes</DropdownMenuLabel>
                    <DropdownMenuSeparator />

                    {loadingAlertas ? (
                      <div className="px-2 py-3 text-sm text-muted-foreground">
                        Cargando seguimientos...
                      </div>
                    ) : errorAlertas ? (
                      <div className="px-2 py-3 text-sm text-destructive">
                        {errorAlertas}
                      </div>
                    ) : alertasSeguimiento.length === 0 ? (
                      <div className="px-2 py-3 text-sm text-muted-foreground">
                        No hay seguimientos pendientes o proximos.
                      </div>
                    ) : (
                      alertasSeguimiento.map(alerta => (
                        <DropdownMenuItem
                          key={alerta.id}
                          className="items-start"
                          onSelect={goToSeguimientos}
                        >
                          <div className="flex flex-col gap-1 whitespace-normal">
                            <span className="font-medium text-foreground">
                              {buildRelacionLabel(alerta)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {alerta.tipo} | {format(alerta.fechaVencimiento, 'dd MMM yyyy HH:mm', { locale: es })}
                            </span>
                            {alerta.observaciones && (
                              <span className="text-xs text-muted-foreground">
                                {alerta.observaciones}
                              </span>
                            )}
                          </div>
                        </DropdownMenuItem>
                      ))
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <button
                className="p-2 hover:bg-accent rounded-lg transition-smooth text-muted-foreground hover:text-foreground"
                onClick={goToConfiguracion}
                type="button"
              >
                <Settings size={20} />
              </button>

              {user && (
                <div className="hidden md:flex items-center gap-3 border-r border-border pr-4">
                  <div className="text-right">
                    <p className="text-sm font-medium text-foreground">{user.nombre}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {formatRoleLabel(user.rol)}
                  </Badge>
                </div>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-2 hover:bg-accent rounded-lg transition-smooth text-muted-foreground hover:text-foreground">
                    <User size={20} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">
                        {user?.nombre ?? 'Usuario'}
                      </span>
                      <span className="text-xs font-normal text-muted-foreground">
                        {user?.email ?? 'Sin sesion'}
                      </span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="gap-2"
                    onSelect={() => {
                      void handleLogout();
                    }}
                  >
                    <LogOut size={16} />
                    Cerrar sesion
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="p-8">{children}</div>
        </div>
      </main>
    </div>
  );
}

export default DashboardLayout;
