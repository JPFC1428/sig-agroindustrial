import { useEffect, useState } from "react";
import { Edit, Eye, Plus, Power, Search } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getContableBancos,
  updateContableBanco,
} from "@/lib/contable-bancos-api";
import {
  ContableCuentaBancariaTipo,
  type ContableCuentaBancaria,
} from "@/lib/types";

function formatMoney(value: number) {
  return `$${new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(value)}`;
}

function formatCuentaTipoLabel(tipo: ContableCuentaBancariaTipo) {
  switch (tipo) {
    case ContableCuentaBancariaTipo.AHORROS:
      return "Ahorros";
    case ContableCuentaBancariaTipo.CORRIENTE:
      return "Corriente";
    case ContableCuentaBancariaTipo.OTRA:
      return "Otra";
    default:
      return tipo;
  }
}

function getEstadoBadgeClass(activa: boolean) {
  return activa ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800";
}

export default function ContableBancos() {
  const [cuentas, setCuentas] = useState<ContableCuentaBancaria[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<
    "todas" | "activas" | "inactivas"
  >("todas");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actualizandoId, setActualizandoId] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;

    async function cargar() {
      setCargando(true);
      setError(null);

      try {
        const data = await getContableBancos({
          activa:
            filtroEstado === "todas"
              ? undefined
              : filtroEstado === "activas",
          q: busqueda || undefined,
        });

        if (!activo) {
          return;
        }

        setCuentas(data);
      } catch (loadError) {
        if (!activo) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudieron cargar las cuentas bancarias"
        );
      } finally {
        if (activo) {
          setCargando(false);
        }
      }
    }

    void cargar();

    return () => {
      activo = false;
    };
  }, [busqueda, filtroEstado]);

  async function toggleCuenta(cuenta: ContableCuentaBancaria) {
    setActualizandoId(cuenta.id);
    setError(null);

    try {
      const actualizada = await updateContableBanco(cuenta.id, {
        activa: !cuenta.activa,
      });

      setCuentas(current =>
        current.map(item => (item.id === actualizada.id ? actualizada : item))
      );
      toast.success(
        actualizada.activa ? "Cuenta activada" : "Cuenta desactivada"
      );
    } catch (updateError) {
      const message =
        updateError instanceof Error
          ? updateError.message
          : "No se pudo actualizar la cuenta bancaria";
      setError(message);
      toast.error(message);
    } finally {
      setActualizandoId(null);
    }
  }

  return (
    <DashboardLayout
      titulo="Bancos"
      descripcion="Catalogo de cuentas bancarias y punto de partida para movimientos y conciliacion"
      acciones={
        <Button asChild className="gap-2">
          <Link href="/contable/bancos/nuevo">
            <Plus size={18} />
            Nueva Cuenta
          </Link>
        </Button>
      }
    >
      <div className="mb-6 rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="relative md:col-span-3">
            <Search
              size={18}
              className="absolute left-3 top-3 text-muted-foreground"
            />
            <Input
              placeholder="Buscar por banco, cuenta, numero o titular..."
              value={busqueda}
              onChange={event => setBusqueda(event.target.value)}
              className="pl-10"
            />
          </div>

          <Select
            value={filtroEstado}
            onValueChange={value =>
              setFiltroEstado(value as "todas" | "activas" | "inactivas")
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="activas">Activas</SelectItem>
              <SelectItem value="inactivas">Inactivas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="mt-4 flex items-center justify-end text-sm text-muted-foreground">
          {cargando
            ? "Cargando cuentas..."
            : `${cuentas.length} cuenta${cuentas.length !== 1 ? "s" : ""}`}
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-accent">
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Cuenta
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Banco / Tipo
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Titular
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Saldo inicial
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Estado
                </th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-foreground">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-10 text-center text-sm text-muted-foreground"
                  >
                    Cargando cuentas bancarias...
                  </td>
                </tr>
              ) : cuentas.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-10 text-center text-sm text-muted-foreground"
                  >
                    No se encontraron cuentas bancarias
                  </td>
                </tr>
              ) : (
                cuentas.map((cuenta, index) => (
                  <tr
                    key={cuenta.id}
                    className={`border-b border-border ${
                      index % 2 === 0 ? "bg-background" : "bg-accent/40"
                    }`}
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-foreground">
                        {cuenta.nombreCuenta}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        #{cuenta.numeroCuenta}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      <p>{cuenta.nombreBanco}</p>
                      <p className="text-muted-foreground">
                        {formatCuentaTipoLabel(cuenta.tipoCuenta)}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      {cuenta.titular}
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      {formatMoney(cuenta.saldoInicial)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getEstadoBadgeClass(
                          cuenta.activa
                        )}`}
                      >
                        {cuenta.activa ? "Activa" : "Inactiva"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/contable/bancos/${cuenta.id}`}>
                            <Eye size={16} />
                            Movimientos
                          </Link>
                        </Button>
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/contable/bancos/${cuenta.id}/editar`}>
                            <Edit size={16} />
                            Editar
                          </Link>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          disabled={actualizandoId === cuenta.id}
                          onClick={() => void toggleCuenta(cuenta)}
                        >
                          <Power size={16} />
                          {cuenta.activa ? "Desactivar" : "Activar"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
