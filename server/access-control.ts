export type ActiveUserRole =
  | "admin"
  | "comercial"
  | "contable"
  | "sertec"
  | "inventario";

export type StoredUserRole = ActiveUserRole | "usuario";

export function normalizeUserRole(role: string): ActiveUserRole {
  switch (role) {
    case "admin":
    case "comercial":
    case "contable":
    case "sertec":
    case "inventario":
      return role;
    case "usuario":
      return "comercial";
    default:
      return "comercial";
  }
}

function matchesPath(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function canAccessApiPath(role: ActiveUserRole, pathname: string) {
  if (role === "admin") {
    return true;
  }

  if (matchesPath(pathname, "/api/users")) {
    return false;
  }

  if (matchesPath(pathname, "/api/dashboard")) {
    return role === "comercial";
  }

  if (
    matchesPath(pathname, "/api/clientes") ||
    matchesPath(pathname, "/api/cotizaciones") ||
    matchesPath(pathname, "/api/seguimientos") ||
    matchesPath(pathname, "/api/visitas") ||
    matchesPath(pathname, "/api/prospectos")
  ) {
    return role === "comercial";
  }

  if (matchesPath(pathname, "/api/sertec")) {
    return role === "sertec";
  }

  if (matchesPath(pathname, "/api/contable")) {
    return role === "contable";
  }

  return false;
}
