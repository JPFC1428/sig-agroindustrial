/**
 * DashboardLayout - Layout general para todas las páginas del módulo comercial
 * 
 * Estructura:
 * - Sidebar fijo a la izquierda (240px)
 * - Contenido principal con padding responsivo
 * - Header con información del usuario y acciones
 */

import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Bell, Settings, User } from 'lucide-react';

interface DashboardLayoutProps {
  children: ReactNode;
  titulo?: string;
  descripcion?: string;
  acciones?: ReactNode;
}

export function DashboardLayout({
  children,
  titulo,
  descripcion,
  acciones,
}: DashboardLayoutProps) {
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <Sidebar />

      {/* Contenido Principal */}
      <main className="flex-1 ml-60 flex flex-col overflow-hidden">
        {/* Header */}
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

          {/* Acciones del Header */}
          <div className="flex items-center gap-4">
            {acciones && <div className="flex items-center gap-2">{acciones}</div>}

            {/* Iconos de usuario */}
            <div className="flex items-center gap-3 border-l border-border pl-4">
              <button className="p-2 hover:bg-accent rounded-lg transition-smooth text-muted-foreground hover:text-foreground">
                <Bell size={20} />
              </button>
              <button className="p-2 hover:bg-accent rounded-lg transition-smooth text-muted-foreground hover:text-foreground">
                <Settings size={20} />
              </button>
              <button className="p-2 hover:bg-accent rounded-lg transition-smooth text-muted-foreground hover:text-foreground">
                <User size={20} />
              </button>
            </div>
          </div>
        </header>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-8">{children}</div>
        </div>
      </main>
    </div>
  );
}

export default DashboardLayout;
