import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, Shield, Users } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatRoleLabel } from "@/lib/access-control";
import { createUser, getUsers } from "@/lib/users-api";
import { UsuarioRol, type Usuario } from "@/lib/types";

type UserFormValues = {
  email: string;
  nombre: string;
  password: string;
  rol: UsuarioRol;
};

const INITIAL_FORM: UserFormValues = {
  email: "",
  nombre: "",
  password: "",
  rol: UsuarioRol.COMERCIAL,
};

export default function Usuarios() {
  const [users, setUsers] = useState<Usuario[]>([]);
  const [form, setForm] = useState<UserFormValues>(INITIAL_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadUsers() {
      setLoading(true);
      setError(null);

      try {
        const data = await getUsers();

        if (!active) {
          return;
        }

        setUsers(data);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudieron cargar los usuarios"
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadUsers();

    return () => {
      active = false;
    };
  }, []);

  const admins = useMemo(
    () => users.filter(user => user.rol === UsuarioRol.ADMIN).length,
    [users]
  );

  function updateField<K extends keyof UserFormValues>(
    field: K,
    value: UserFormValues[K]
  ) {
    setForm(current => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const user = await createUser(form);
      setUsers(current => [user, ...current]);
      setForm(INITIAL_FORM);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudo crear el usuario"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardLayout
      titulo="Usuarios"
      descripcion="Gestion basica de accesos para el MVP"
      acciones={
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Shield size={16} />
          {admins} admin{admins !== 1 ? "s" : ""}
        </div>
      }
    >
      {error && (
        <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr]">
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Plus size={18} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Nuevo usuario
              </h2>
              <p className="text-sm text-muted-foreground">
                Creacion rapida para acceso al sistema.
              </p>
            </div>
          </div>

          <form className="space-y-4" onSubmit={event => void handleSubmit(event)}>
            <div className="space-y-2">
              <Label htmlFor="user-nombre">Nombre</Label>
              <Input
                id="user-nombre"
                onChange={event => updateField("nombre", event.target.value)}
                placeholder="Nombre completo"
                value={form.nombre}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="user-email">Email</Label>
              <Input
                id="user-email"
                onChange={event => updateField("email", event.target.value)}
                placeholder="usuario@empresa.com"
                type="email"
                value={form.email}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="user-password">Contrasena</Label>
              <Input
                id="user-password"
                onChange={event => updateField("password", event.target.value)}
                placeholder="Minimo 8 caracteres"
                type="password"
                value={form.password}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="user-rol">Rol</Label>
              <Select
                onValueChange={value => updateField("rol", value as UsuarioRol)}
                value={form.rol}
              >
                <SelectTrigger id="user-rol">
                  <SelectValue placeholder="Rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UsuarioRol.ADMIN}>Admin</SelectItem>
                  <SelectItem value={UsuarioRol.COMERCIAL}>Comercial</SelectItem>
                  <SelectItem value={UsuarioRol.CONTABLE}>Contable</SelectItem>
                  <SelectItem value={UsuarioRol.SERTEC}>SERTEC</SelectItem>
                  <SelectItem value={UsuarioRol.INVENTARIO}>Inventario</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button className="w-full gap-2" disabled={saving} type="submit">
              <Plus size={16} />
              {saving ? "Creando..." : "Crear usuario"}
            </Button>
          </form>
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="border-b border-border px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Users size={18} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Usuarios registrados
                </h2>
                <p className="text-sm text-muted-foreground">
                  {loading
                    ? "Cargando usuarios..."
                    : `${users.length} usuario${users.length !== 1 ? "s" : ""}`}
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-accent border-b border-border">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                    Nombre
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                    Email
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                    Rol
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                    Ultimo acceso
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      className="px-6 py-10 text-center text-sm text-muted-foreground"
                      colSpan={4}
                    >
                      Cargando usuarios...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td
                      className="px-6 py-10 text-center text-sm text-muted-foreground"
                      colSpan={4}
                    >
                      No hay usuarios registrados
                    </td>
                  </tr>
                ) : (
                  users.map((user, index) => (
                    <tr
                      key={user.id}
                      className={`border-b border-border transition-smooth hover:bg-accent ${
                        index % 2 === 0 ? "bg-background" : "bg-accent/50"
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-foreground">
                            {user.nombre}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Creado {user.createdAt.toLocaleDateString("es-CO")}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-foreground">
                        {user.email}
                      </td>
                      <td className="px-6 py-4">
                        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary capitalize">
                          {formatRoleLabel(user.rol)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-foreground">
                        {user.ultimoLoginAt
                          ? formatDistanceToNow(user.ultimoLoginAt, {
                              addSuffix: true,
                              locale: es,
                            })
                          : "Sin ingresos"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
