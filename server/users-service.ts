import { nanoid } from "nanoid";
import { getSql } from "./neon.js";
import { hashPassword, normalizeEmail } from "./auth-utils.js";
import {
  normalizeUserRole,
  type ActiveUserRole,
  type StoredUserRole,
} from "./access-control.js";

export type UserRole = ActiveUserRole;
export type ThemePreference = "light" | "dark";
export type AccentColor = "blue" | "green" | "orange" | "red" | "teal";

export type AuthUserRecord = {
  email: string;
  id: string;
  nombre: string;
  preferencias: UserVisualPreferencesInput;
  rol: UserRole;
};

export type UserApiRecord = AuthUserRecord & {
  activo: boolean;
  createdAt: string;
  ultimoLoginAt?: string;
  updatedAt: string;
};

type UserRow = {
  activo: boolean;
  accent_color: AccentColor;
  created_at: string | Date;
  email: string;
  id: string;
  nombre: string;
  password_hash: string;
  rol: StoredUserRole;
  theme_preference: ThemePreference;
  updated_at: string | Date;
  ultimo_login_at: string | Date | null;
};

type UserMutationInput = {
  activo: boolean;
  email: string;
  nombre: string;
  password: string;
  rol: UserRole;
};

type UserVisualPreferencesInput = {
  accentColor: AccentColor;
  themePreference: ThemePreference;
};

const USER_CREATION_ROLES = new Set<UserRole>([
  "admin",
  "comercial",
  "contable",
  "sertec",
  "inventario",
]);
const THEME_PREFERENCES = new Set<ThemePreference>(["light", "dark"]);
const ACCENT_COLORS = new Set<AccentColor>([
  "blue",
  "green",
  "orange",
  "red",
  "teal",
]);

function parseDateValue(value: string | Date) {
  const parsed = value instanceof Date ? new Date(value) : new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Fecha invalida en la base de datos");
  }

  return parsed;
}

function readString(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") {
    return value;
  }

  return fallback;
}

function assertPayload(
  payload: unknown
): asserts payload is Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Cuerpo de solicitud invalido");
  }
}

function validateEmail(email: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Email invalido");
  }
}

function validatePassword(password: string) {
  if (password.length < 8) {
    throw new Error("La contrasena debe tener al menos 8 caracteres");
  }
}

function validateThemePreference(themePreference: string) {
  if (!THEME_PREFERENCES.has(themePreference as ThemePreference)) {
    throw new Error("Tema invalido");
  }
}

function validateAccentColor(accentColor: string) {
  if (!ACCENT_COLORS.has(accentColor as AccentColor)) {
    throw new Error("Color principal invalido");
  }
}

function buildUserInput(payload: unknown): UserMutationInput {
  assertPayload(payload);

  const nombre = readString(payload.nombre) ?? "";
  const email = normalizeEmail(readString(payload.email) ?? "");
  const password = readString(payload.password) ?? "";
  const rol = (readString(payload.rol) ?? "comercial") as UserRole;
  const activo = readBoolean(payload.activo, true);

  if (!nombre) {
    throw new Error("El nombre es obligatorio");
  }

  if (!email) {
    throw new Error("El email es obligatorio");
  }

  validateEmail(email);
  validatePassword(password);

  if (!USER_CREATION_ROLES.has(rol)) {
    throw new Error("Rol de usuario invalido");
  }

  return {
    activo,
    email,
    nombre,
    password,
    rol,
  };
}

function buildUserVisualPreferencesInput(
  payload: unknown,
  fallback?: UserVisualPreferencesInput
): UserVisualPreferencesInput {
  assertPayload(payload);

  const themePreference =
    readString(payload.themePreference) ?? fallback?.themePreference ?? "light";
  const accentColor =
    readString(payload.accentColor) ?? fallback?.accentColor ?? "blue";

  validateThemePreference(themePreference);
  validateAccentColor(accentColor);

  return {
    accentColor: accentColor as AccentColor,
    themePreference: themePreference as ThemePreference,
  };
}

function mapAuthUser(row: UserRow): AuthUserRecord {
  return {
    email: row.email,
    id: row.id,
    nombre: row.nombre,
    preferencias: {
      accentColor: row.accent_color,
      themePreference: row.theme_preference,
    },
    rol: normalizeUserRole(row.rol),
  };
}

function mapUser(row: UserRow): UserApiRecord {
  const createdAt = parseDateValue(row.created_at);
  const updatedAt = parseDateValue(row.updated_at);
  const ultimoLoginAt = row.ultimo_login_at
    ? parseDateValue(row.ultimo_login_at)
    : undefined;

  return {
    ...mapAuthUser(row),
    activo: row.activo,
    createdAt: createdAt.toISOString(),
    ...(ultimoLoginAt ? { ultimoLoginAt: ultimoLoginAt.toISOString() } : {}),
    updatedAt: updatedAt.toISOString(),
  };
}

export function isUserValidationError(error: unknown) {
  return (
    error instanceof Error &&
    /obligatorio|invalido|contrasena|Email|existe|Tema|Color/i.test(
      error.message
    )
  );
}

export async function findUserRowByEmail(email: string) {
  const normalizedEmail = normalizeEmail(email);
  const sql = getSql();
  const rows = (await sql`
    SELECT
      id,
      nombre,
      email,
      password_hash,
      rol,
      theme_preference,
      accent_color,
      activo,
      ultimo_login_at,
      created_at,
      updated_at
    FROM users
    WHERE LOWER(email) = ${normalizedEmail}
    LIMIT 1
  `) as UserRow[];

  return rows[0] ?? null;
}

export async function findUserRowById(id: string) {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      id,
      nombre,
      email,
      password_hash,
      rol,
      theme_preference,
      accent_color,
      activo,
      ultimo_login_at,
      created_at,
      updated_at
    FROM users
    WHERE id = ${id}
    LIMIT 1
  `) as UserRow[];

  return rows[0] ?? null;
}

export async function listUsers() {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      id,
      nombre,
      email,
      password_hash,
      rol,
      theme_preference,
      accent_color,
      activo,
      ultimo_login_at,
      created_at,
      updated_at
    FROM users
    ORDER BY created_at DESC, id DESC
  `) as UserRow[];

  return rows.map(mapUser);
}

export async function createUser(payload: unknown) {
  const userInput = buildUserInput(payload);
  const existing = await findUserRowByEmail(userInput.email);

  if (existing) {
    throw new Error("Ya existe un usuario con ese email");
  }

  const passwordHash = await hashPassword(userInput.password);
  const sql = getSql();
  const rows = (await sql`
    INSERT INTO users (
      id,
      nombre,
      email,
      password_hash,
      rol,
      activo
    ) VALUES (
      ${`usr-${nanoid(10)}`},
      ${userInput.nombre},
      ${userInput.email},
      ${passwordHash},
      ${userInput.rol},
      ${userInput.activo}
    )
    RETURNING
      id,
      nombre,
      email,
      password_hash,
      rol,
      theme_preference,
      accent_color,
      activo,
      ultimo_login_at,
      created_at,
      updated_at
  `) as UserRow[];

  return mapUser(rows[0]);
}

export async function recordUserLogin(userId: string) {
  const sql = getSql();
  const rows = (await sql`
    UPDATE users
    SET
      ultimo_login_at = NOW(),
      updated_at = NOW()
    WHERE id = ${userId}
    RETURNING
      id,
      nombre,
      email,
      password_hash,
      rol,
      theme_preference,
      accent_color,
      activo,
      ultimo_login_at,
      created_at,
      updated_at
  `) as UserRow[];

  return rows[0] ? mapAuthUser(rows[0]) : null;
}

export async function updateUserVisualPreferences(
  userId: string,
  payload: unknown
) {
  const existing = await findUserRowById(userId);

  if (!existing) {
    throw new Error("Usuario no encontrado");
  }

  const preferences = buildUserVisualPreferencesInput(payload, {
    accentColor: existing.accent_color,
    themePreference: existing.theme_preference,
  });

  const sql = getSql();
  const rows = (await sql`
    UPDATE users
    SET
      theme_preference = ${preferences.themePreference},
      accent_color = ${preferences.accentColor},
      updated_at = NOW()
    WHERE id = ${userId}
    RETURNING
      id,
      nombre,
      email,
      password_hash,
      rol,
      theme_preference,
      accent_color,
      activo,
      ultimo_login_at,
      created_at,
      updated_at
  `) as UserRow[];

  return rows[0] ? mapAuthUser(rows[0]) : null;
}

export function toAuthUser(row: UserRow) {
  return mapAuthUser(row);
}
