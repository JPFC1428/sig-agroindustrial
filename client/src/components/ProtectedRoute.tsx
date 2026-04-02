import type { ComponentType } from "react";
import { useEffect } from "react";
import { Lock, ShieldAlert } from "lucide-react";
import { Route, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { UsuarioRol } from "@/lib/types";
import {
  canAccessPath,
  formatRoleLabel,
  getDefaultPathForRole,
  resolveAuthorizedPathForRole,
} from "@/lib/access-control";
import { Card, CardContent } from "@/components/ui/card";

const RETURN_TO_STORAGE_KEY = "sig-auth:return-to";

type ProtectedRouteProps = {
  adminOnly?: boolean;
  component: ComponentType;
  path: string;
};

function storeReturnToPath() {
  if (typeof window === "undefined") {
    return;
  }

  const nextPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (nextPath !== "/login") {
    window.sessionStorage.setItem(RETURN_TO_STORAGE_KEY, nextPath);
  }
}

export function consumeStoredReturnToPath(role?: UsuarioRol) {
  if (typeof window === "undefined") {
    return role ? getDefaultPathForRole(role) : "/dashboard";
  }

  const storedPath = window.sessionStorage.getItem(RETURN_TO_STORAGE_KEY);

  window.sessionStorage.removeItem(RETURN_TO_STORAGE_KEY);
  return role
    ? resolveAuthorizedPathForRole(role, storedPath)
    : storedPath || "/dashboard";
}

function FullScreenState({
  description,
  icon,
  title,
}: {
  description: string;
  icon: "lock" | "warning";
  title: string;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
      <Card className="w-full max-w-md border bg-white/90 shadow-lg">
        <CardContent className="py-10 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
            {icon === "lock" ? (
              <Lock className="h-6 w-6 text-slate-700" />
            ) : (
              <ShieldAlert className="h-6 w-6 text-slate-700" />
            )}
          </div>
          <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          <p className="mt-2 text-sm text-slate-600">{description}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function NavigateToLogin() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    storeReturnToPath();
    setLocation("/login");
  }, [setLocation]);

  return (
    <FullScreenState
      description="Redirigiendo al inicio de sesion."
      icon="lock"
      title="Sesion requerida"
    />
  );
}

export function ProtectedRoute({
  adminOnly = false,
  component: Component,
  path,
}: ProtectedRouteProps) {
  const { isLoading, user } = useAuth();

  return (
    <Route path={path}>
      {() => {
        if (isLoading) {
          return (
            <FullScreenState
              description="Validando sesion activa."
              icon="lock"
              title="Cargando"
            />
          );
        }

        if (!user) {
          return <NavigateToLogin />;
        }

        if (adminOnly && user.rol !== UsuarioRol.ADMIN) {
          return (
            <FullScreenState
              description="Esta vista solo esta disponible para usuarios admin."
              icon="warning"
              title="Acceso restringido"
            />
          );
        }

        if (!canAccessPath(user.rol, path)) {
          return (
            <FullScreenState
              description={`Tu rol ${formatRoleLabel(
                user.rol
              )} no tiene permiso para acceder a esta ruta.`}
              icon="warning"
              title="Acceso denegado"
            />
          );
        }

        return <Component />;
      }}
    </Route>
  );
}
