import {
  APP_MODULES,
  type AppModuleDefinition,
  type AppModuleKey,
} from "./module-navigation";
import { UsuarioRol } from "./types";

function matchesPath(pathname: string, prefix: string) {
  return (
    pathname === prefix ||
    pathname.startsWith(`${prefix}/`) ||
    pathname.startsWith(`${prefix}/:`)
  );
}

export function canAccessModule(
  role: UsuarioRol,
  moduleKey: AppModuleKey
) {
  if (role === UsuarioRol.ADMIN) {
    return true;
  }

  switch (role) {
    case UsuarioRol.COMERCIAL:
      return moduleKey === "comercial";
    case UsuarioRol.CONTABLE:
      return moduleKey === "contable";
    case UsuarioRol.SERTEC:
      return moduleKey === "sertec";
    case UsuarioRol.INVENTARIO:
      return moduleKey === "inventario-compras";
    default:
      return false;
  }
}

export function getVisibleModulesForRole(
  role: UsuarioRol
): AppModuleDefinition[] {
  return APP_MODULES.filter(module => canAccessModule(role, module.key));
}

export function getDefaultPathForRole(role: UsuarioRol) {
  switch (role) {
    case UsuarioRol.ADMIN:
    case UsuarioRol.COMERCIAL:
      return "/dashboard";
    case UsuarioRol.CONTABLE:
      return "/contable/dashboard";
    case UsuarioRol.SERTEC:
      return "/sertec";
    case UsuarioRol.INVENTARIO:
      return "/inventario-compras";
    default:
      return "/dashboard";
  }
}

export function canAccessPath(role: UsuarioRol, pathname: string) {
  if (pathname === "/login") {
    return true;
  }

  if (pathname === "/") {
    return true;
  }

  if (matchesPath(pathname, "/configuracion")) {
    return true;
  }

  if (matchesPath(pathname, "/usuarios")) {
    return role === UsuarioRol.ADMIN;
  }

  if (matchesPath(pathname, "/dashboard")) {
    return role === UsuarioRol.ADMIN || role === UsuarioRol.COMERCIAL;
  }

  if (
    matchesPath(pathname, "/clientes") ||
    matchesPath(pathname, "/prospectos") ||
    matchesPath(pathname, "/visitas") ||
    matchesPath(pathname, "/cotizaciones") ||
    matchesPath(pathname, "/seguimientos")
  ) {
    return role === UsuarioRol.ADMIN || role === UsuarioRol.COMERCIAL;
  }

  if (matchesPath(pathname, "/sertec")) {
    return role === UsuarioRol.ADMIN || role === UsuarioRol.SERTEC;
  }

  if (matchesPath(pathname, "/contable")) {
    return role === UsuarioRol.ADMIN || role === UsuarioRol.CONTABLE;
  }

  if (matchesPath(pathname, "/inventario-compras")) {
    return role === UsuarioRol.ADMIN || role === UsuarioRol.INVENTARIO;
  }

  return role === UsuarioRol.ADMIN;
}

export function resolveAuthorizedPathForRole(
  role: UsuarioRol,
  requestedPath?: string | null
) {
  if (requestedPath && canAccessPath(role, requestedPath)) {
    return requestedPath;
  }

  return getDefaultPathForRole(role);
}

export function formatRoleLabel(role: UsuarioRol) {
  switch (role) {
    case UsuarioRol.ADMIN:
      return "Admin";
    case UsuarioRol.COMERCIAL:
      return "Comercial";
    case UsuarioRol.CONTABLE:
      return "Contable";
    case UsuarioRol.SERTEC:
      return "SERTEC";
    case UsuarioRol.INVENTARIO:
      return "Inventario";
    default:
      return role;
  }
}
