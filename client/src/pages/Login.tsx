import { useEffect, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { useLocation } from "wouter";
import { consumeStoredReturnToPath } from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Login() {
  const { isLoading, login, user } = useAuth();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isLoading || !user) {
      return;
    }

    setLocation(consumeStoredReturnToPath(user.rol));
  }, [isLoading, setLocation, user]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const nextUser = await login(email, password);
      setLocation(consumeStoredReturnToPath(nextUser.rol));
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "No se pudo iniciar sesion"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
      <Card className="w-full max-w-md border bg-white/95 shadow-lg">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
            <LockKeyhole className="h-6 w-6" />
          </div>
          <div>
            <CardTitle className="text-2xl text-slate-900">
              SIG Agroindustrial
            </CardTitle>
            <p className="mt-2 text-sm text-slate-600">
              Inicia sesion para acceder a tu modulo segun el rol asignado.
            </p>
          </div>
        </CardHeader>

        <CardContent>
          <form className="space-y-4" onSubmit={event => void handleSubmit(event)}>
            {error && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                autoComplete="email"
                id="email"
                onChange={event => setEmail(event.target.value)}
                placeholder="admin@sigagroindustrial.com"
                type="email"
                value={email}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contrasena</Label>
              <Input
                autoComplete="current-password"
                id="password"
                onChange={event => setPassword(event.target.value)}
                placeholder="Tu contrasena"
                type="password"
                value={password}
              />
            </div>

            <Button className="w-full" disabled={submitting} type="submit">
              {submitting ? "Ingresando..." : "Ingresar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
