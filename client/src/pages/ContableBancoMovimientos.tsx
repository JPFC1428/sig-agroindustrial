import { useEffect, useState } from "react";
import { ArrowLeft, Calendar, Edit } from "lucide-react";
import { Link, useRoute } from "wouter";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getContableBancoMovimientos } from "@/lib/contable-bancos-api";
import { formatDateOnlyInput } from "@/lib/contable-facturas-compra-api";
import {
  ContableMetodoPago,
  type ContableCuentaBancariaMovimientos,
} from "@/lib/types";

function formatMoney(value: number) {
  return `$${new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(value)}`;
}

function formatDate(value: Date) {
  return value.toLocaleDateString("es-CO");
}

function getReferenciaHref(
  referenciaTipo: "egreso" | "recibo_caja",
  referenciaId: string
) {
  return referenciaTipo === "egreso"
    ? `/contable/comprobantes-egreso/${referenciaId}`
    : `/contable/recibos-caja/${referenciaId}`;
}

function getTipoBadgeClass(tipo: "ingreso" | "egreso") {
  return tipo === "ingreso"
    ? "bg-green-100 text-green-800"
    : "bg-red-100 text-red-800";
}

function formatMetodoLabel(metodo: ContableMetodoPago) {
  switch (metodo) {
    case ContableMetodoPago.EFECTIVO:
      return "Efectivo";
    case ContableMetodoPago.TRANSFERENCIA:
      return "Transferencia";
    case ContableMetodoPago.CHEQUE:
      return "Cheque";
    case ContableMetodoPago.TARJETA:
      return "Tarjeta";
    case ContableMetodoPago.OTRO:
      return "Otro";
    default:
      return metodo;
  }
}

export default function ContableBancoMovimientos() {
  const [match, params] = useRoute("/contable/bancos/:id");
  const cuentaId = params?.id;
  const [movimientosCuenta, setMovimientosCuenta] =
    useState<ContableCuentaBancariaMovimientos | null>(null);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const destinoVolver = "/contable/bancos";

  useEffect(() => {
    if (!match || !cuentaId) {
      return;
    }

    let activo = true;
    const id = cuentaId;

    async function cargar() {
      setCargando(true);
      setError(null);

      try {
        const data = await getContableBancoMovimientos(id, {
          fechaDesde: fechaDesde || undefined,
          fechaHasta: fechaHasta || undefined,
        });

        if (!activo) {
          return;
        }

        if (!data) {
          setMovimientosCuenta(null);
          setError("La cuenta bancaria solicitada no existe");
          return;
        }

        setMovimientosCuenta(data);
      } catch (loadError) {
        if (!activo) {
          return;
        }

        setMovimientosCuenta(null);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudieron cargar los movimientos bancarios"
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
  }, [cuentaId, fechaDesde, fechaHasta, match]);

  if (!match) {
    return null;
  }

  if (cargando) {
    return (
      <DashboardLayout
        titulo="Movimientos Bancarios"
        descripcion="Cargando informacion de la cuenta"
        acciones={
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href={destinoVolver}>
              <ArrowLeft size={18} />
              Volver
            </Link>
          </Button>
        }
      >
        <div className="py-12 text-center">
          <p className="text-muted-foreground">Cargando movimientos...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!movimientosCuenta) {
    return (
      <DashboardLayout
        titulo="Movimientos Bancarios"
        descripcion="No fue posible cargar la cuenta"
        acciones={
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href={destinoVolver}>
              <ArrowLeft size={18} />
              Volver
            </Link>
          </Button>
        }
      >
        <div className="py-12 text-center">
          <p className="mb-4 text-muted-foreground">
            {error ?? "La cuenta bancaria solicitada no existe"}
          </p>
          <Button asChild variant="outline">
            <Link href={destinoVolver}>Volver a Bancos</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const { cuenta } = movimientosCuenta;

  return (
    <DashboardLayout
      titulo={cuenta.nombreCuenta}
      descripcion={`Movimientos bancarios de ${cuenta.nombreBanco} - ${cuenta.numeroCuenta}`}
      acciones={
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href={destinoVolver}>
              <ArrowLeft size={18} />
              Volver
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href={`/contable/bancos/${cuenta.id}/editar`}>
              <Edit size={18} />
              Editar cuenta
            </Link>
          </Button>
        </div>
      }
    >
      <div className="mb-6 rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Banco
            </p>
            <p className="mt-1 font-medium text-foreground">{cuenta.nombreBanco}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Titular
            </p>
            <p className="mt-1 font-medium text-foreground">{cuenta.titular}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Desde
            </p>
            <Input
              type="date"
              value={fechaDesde}
              max={
                fechaHasta ||
                formatDateOnlyInput(
                  new Date(new Date().getFullYear() + 5, 11, 31)
                )
              }
              onChange={event => setFechaDesde(event.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Hasta
            </p>
            <Input
              type="date"
              value={fechaHasta}
              min={fechaDesde || undefined}
              max={formatDateOnlyInput(new Date(new Date().getFullYear() + 5, 11, 31))}
              onChange={event => setFechaHasta(event.target.value)}
              className="mt-1"
            />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                setFechaDesde("");
                setFechaHasta("");
              }}
            >
              Limpiar filtros
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Saldo inicial periodo</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {formatMoney(movimientosCuenta.saldoInicialPeriodo)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Ingresos</p>
          <p className="mt-2 text-2xl font-semibold text-green-700">
            {formatMoney(movimientosCuenta.totalIngresos)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Egresos</p>
          <p className="mt-2 text-2xl font-semibold text-red-700">
            {formatMoney(movimientosCuenta.totalEgresos)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Saldo final</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {formatMoney(movimientosCuenta.saldoFinal)}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            Movimientos de la cuenta
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Entradas desde recibos de caja y salidas desde comprobantes de egreso.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-accent">
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Fecha
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Tipo
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Referencia
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Tercero
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Metodo
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Valor
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Saldo acumulado
                </th>
              </tr>
            </thead>
            <tbody>
              {movimientosCuenta.movimientos.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-10 text-center text-sm text-muted-foreground"
                  >
                    No hay movimientos para los filtros seleccionados
                  </td>
                </tr>
              ) : (
                movimientosCuenta.movimientos.map((movimiento, index) => (
                  <tr
                    key={`${movimiento.referenciaTipo}-${movimiento.referenciaId}`}
                    className={`border-b border-border ${
                      index % 2 === 0 ? "bg-background" : "bg-accent/40"
                    }`}
                  >
                    <td className="px-6 py-4 text-sm text-foreground">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-muted-foreground" />
                        {formatDate(movimiento.fecha)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getTipoBadgeClass(
                          movimiento.tipo
                        )}`}
                      >
                        {movimiento.tipo === "ingreso" ? "Ingreso" : "Egreso"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      <Link
                        href={getReferenciaHref(
                          movimiento.referenciaTipo,
                          movimiento.referenciaId
                        )}
                        className="font-medium text-primary hover:underline"
                      >
                        {movimiento.referenciaNumero}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      <p>{movimiento.terceroNombreRazonSocial}</p>
                      <p className="text-muted-foreground">
                        {movimiento.terceroDocumentoNit}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      {formatMetodoLabel(movimiento.metodoPago)}
                    </td>
                    <td
                      className={`px-6 py-4 text-sm font-medium ${
                        movimiento.tipo === "ingreso"
                          ? "text-green-700"
                          : "text-red-700"
                      }`}
                    >
                      {movimiento.tipo === "ingreso" ? "+" : "-"}
                      {formatMoney(movimiento.valor)}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-foreground">
                      {formatMoney(movimiento.saldoAcumulado)}
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
