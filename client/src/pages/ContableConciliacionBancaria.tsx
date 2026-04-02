import { useEffect, useState } from "react";
import { CheckCircle2, SearchX } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Checkbox } from "@/components/ui/checkbox";
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
  getContableBancoConciliacion,
  getContableBancos,
  updateContableBancoConciliacion,
} from "@/lib/contable-bancos-api";
import { formatDateOnlyInput } from "@/lib/contable-facturas-compra-api";
import { ContableMetodoPago, type ContableConciliacionBancaria, type ContableCuentaBancaria, type ContableMovimientoBancario } from "@/lib/types";

function formatMoney(value: number) {
  return `$${new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(value)}`;
}

function formatDate(value: Date) {
  return value.toLocaleDateString("es-CO");
}

function formatDateTime(value?: Date) {
  return value ? value.toLocaleString("es-CO") : "Sin fecha";
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

function getTipoBadgeClass(tipo: "ingreso" | "egreso") {
  return tipo === "ingreso"
    ? "bg-green-100 text-green-800"
    : "bg-red-100 text-red-800";
}

function getConciliadoBadgeClass(conciliado: boolean) {
  return conciliado ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-800";
}

function getReferenciaHref(
  referenciaTipo: "egreso" | "recibo_caja",
  referenciaId: string
) {
  return referenciaTipo === "egreso"
    ? `/contable/comprobantes-egreso/${referenciaId}`
    : `/contable/recibos-caja/${referenciaId}`;
}

export default function ContableConciliacionBancaria() {
  const [cuentas, setCuentas] = useState<ContableCuentaBancaria[]>([]);
  const [cuentaId, setCuentaId] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [data, setData] = useState<ContableConciliacionBancaria | null>(null);
  const [cargandoCuentas, setCargandoCuentas] = useState(true);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actualizandoMovimiento, setActualizandoMovimiento] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;

    async function cargarCuentas() {
      setCargandoCuentas(true);
      setError(null);

      try {
        const cuentasData = await getContableBancos({ activa: true });

        if (!activo) {
          return;
        }

        setCuentas(cuentasData);
        setCuentaId(current => current || cuentasData[0]?.id || "");
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
          setCargandoCuentas(false);
        }
      }
    }

    void cargarCuentas();

    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    if (!cuentaId) {
      setData(null);
      return;
    }

    let activo = true;

    async function cargarConciliacion() {
      setCargando(true);
      setError(null);

      try {
        const conciliacion = await getContableBancoConciliacion(cuentaId, {
          fechaDesde: fechaDesde || undefined,
          fechaHasta: fechaHasta || undefined,
        });

        if (!activo) {
          return;
        }

        if (!conciliacion) {
          setData(null);
          setError("La cuenta bancaria seleccionada no existe");
          return;
        }

        setData(conciliacion);
      } catch (loadError) {
        if (!activo) {
          return;
        }

        setData(null);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudieron cargar los movimientos de conciliacion"
        );
      } finally {
        if (activo) {
          setCargando(false);
        }
      }
    }

    void cargarConciliacion();

    return () => {
      activo = false;
    };
  }, [cuentaId, fechaDesde, fechaHasta]);

  async function toggleConciliacion(movimiento: ContableMovimientoBancario) {
    if (!cuentaId) {
      return;
    }

    setActualizandoMovimiento(`${movimiento.referenciaTipo}-${movimiento.referenciaId}`);
    setError(null);

    try {
      await updateContableBancoConciliacion(cuentaId, {
        conciliado: !movimiento.conciliado,
        referenciaId: movimiento.referenciaId,
        referenciaTipo: movimiento.referenciaTipo,
      });

      const conciliacion = await getContableBancoConciliacion(cuentaId, {
        fechaDesde: fechaDesde || undefined,
        fechaHasta: fechaHasta || undefined,
      });

      if (!conciliacion) {
        throw new Error("No se pudo recargar la conciliacion bancaria");
      }

      setData(conciliacion);
      toast.success(
        movimiento.conciliado ? "Movimiento desmarcado" : "Movimiento conciliado"
      );
    } catch (updateError) {
      const message =
        updateError instanceof Error
          ? updateError.message
          : "No se pudo actualizar la conciliacion";
      setError(message);
      toast.error(message);
    } finally {
      setActualizandoMovimiento(null);
    }
  }

  const sinCuentas = !cargandoCuentas && cuentas.length === 0;

  return (
    <DashboardLayout
      titulo="Conciliaciones Bancarias"
      descripcion="Revision y marcacion de movimientos bancarios conciliados por cuenta"
      acciones={
        <Button asChild variant="outline" className="gap-2">
          <Link href="/contable/bancos">Ver cuentas bancarias</Link>
        </Button>
      }
    >
      {sinCuentas ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center shadow-sm">
          <SearchX className="mx-auto mb-4 text-muted-foreground" size={28} />
          <p className="text-foreground">No hay cuentas bancarias activas para conciliar.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Crea o activa una cuenta en Bancos para empezar la conciliacion.
          </p>
          <div className="mt-6">
            <Button asChild>
              <Link href="/contable/bancos/nuevo">Crear cuenta bancaria</Link>
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-6 rounded-lg border border-border bg-card p-6 shadow-sm">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Cuenta bancaria</p>
                <Select value={cuentaId} onValueChange={setCuentaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una cuenta" />
                  </SelectTrigger>
                  <SelectContent>
                    {cuentas.map(cuenta => (
                      <SelectItem key={cuenta.id} value={cuenta.id}>
                        {cuenta.nombreBanco} - {cuenta.nombreCuenta} - {cuenta.numeroCuenta}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Desde</p>
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
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Hasta</p>
                <Input
                  type="date"
                  value={fechaHasta}
                  min={fechaDesde || undefined}
                  max={formatDateOnlyInput(new Date(new Date().getFullYear() + 5, 11, 31))}
                  onChange={event => setFechaHasta(event.target.value)}
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

          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-5">
            <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <p className="text-sm text-muted-foreground">Total ingresos</p>
              <p className="mt-2 text-2xl font-semibold text-green-700">
                {formatMoney(data?.totalIngresos ?? 0)}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <p className="text-sm text-muted-foreground">Total egresos</p>
              <p className="mt-2 text-2xl font-semibold text-red-700">
                {formatMoney(data?.totalEgresos ?? 0)}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <p className="text-sm text-muted-foreground">Saldo sistema</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {formatMoney(data?.saldoSistema ?? 0)}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <p className="text-sm text-muted-foreground">Saldo conciliado</p>
              <p className="mt-2 text-2xl font-semibold text-blue-700">
                {formatMoney(data?.saldoConciliado ?? 0)}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <p className="text-sm text-muted-foreground">Diferencia</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {formatMoney(data?.diferencia ?? 0)}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card shadow-sm">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold text-foreground">
                Movimientos conciliables
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Marca o desmarca ingresos y egresos conciliados para la cuenta seleccionada.
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
                      Valor
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Saldo
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Estado
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Fecha conciliacion
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-foreground">
                      Marcar
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cargando ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-6 py-10 text-center text-sm text-muted-foreground"
                      >
                        Cargando movimientos de conciliacion...
                      </td>
                    </tr>
                  ) : !data || data.movimientos.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-6 py-10 text-center text-sm text-muted-foreground"
                      >
                        No hay movimientos para los filtros seleccionados
                      </td>
                    </tr>
                  ) : (
                    data.movimientos.map((movimiento, index) => {
                      const updatingKey = `${movimiento.referenciaTipo}-${movimiento.referenciaId}`;

                      return (
                        <tr
                          key={updatingKey}
                          className={`border-b border-border ${
                            index % 2 === 0 ? "bg-background" : "bg-accent/40"
                          }`}
                        >
                          <td className="px-6 py-4 text-sm text-foreground">
                            {formatDate(movimiento.fecha)}
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
                            <p className="text-xs text-muted-foreground">
                              {formatMetodoLabel(movimiento.metodoPago)}
                            </p>
                          </td>
                          <td className="px-6 py-4 text-sm text-foreground">
                            <p>{movimiento.terceroNombreRazonSocial}</p>
                            <p className="text-xs text-muted-foreground">
                              {movimiento.terceroDocumentoNit}
                            </p>
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
                          <td className="px-6 py-4 text-sm text-foreground">
                            {formatMoney(movimiento.saldoAcumulado)}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getConciliadoBadgeClass(
                                movimiento.conciliado
                              )}`}
                            >
                              {movimiento.conciliado ? "Conciliado" : "No conciliado"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-foreground">
                            {movimiento.conciliado ? (
                              <div className="flex items-center gap-2">
                                <CheckCircle2 size={14} className="text-blue-700" />
                                {formatDateTime(movimiento.fechaConciliacion)}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Pendiente</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex justify-center">
                              <Checkbox
                                checked={movimiento.conciliado}
                                disabled={actualizandoMovimiento === updatingKey}
                                onCheckedChange={checked => {
                                  if (typeof checked === "boolean") {
                                    void toggleConciliacion(movimiento);
                                  }
                                }}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
