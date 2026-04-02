import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createContableCuadreCaja,
  formatDateOnlyInput,
  getContableCuadreCajaResumen,
  getContableCuadresCaja,
} from "@/lib/contable-cuadres-caja-api";
import { ContableMetodoPago, type ContableCuadreCaja, type ContableCuadreCajaMovimiento, type ContableCuadreCajaResumen } from "@/lib/types";

function formatMoney(value: number) {
  return `$${new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(value)}`;
}

function formatDate(value: Date) {
  return value.toLocaleDateString("es-CO");
}

function formatDateTime(value: Date) {
  return value.toLocaleString("es-CO");
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

function getCurrentMonthStart() {
  const today = new Date();
  return formatDateOnlyInput(new Date(today.getFullYear(), today.getMonth(), 1));
}

function getTodayInputValue() {
  return formatDateOnlyInput(new Date());
}

function ResumenCard({
  detail,
  label,
  value,
}: {
  detail: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function MovimientosTable({
  emptyMessage,
  items,
  title,
}: {
  emptyMessage: string;
  items: ContableCuadreCajaMovimiento[];
  title: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">
          Movimientos consolidados dentro del rango seleccionado.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-accent">
              <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                Documento
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                Tercero
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                Fecha
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                Metodo
              </th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">
                Valor
              </th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              items.map((item, index) => (
                <tr
                  key={`${item.tipo}-${item.id}`}
                  className={`border-b border-border ${
                    index % 2 === 0 ? "bg-background" : "bg-accent/40"
                  }`}
                >
                  <td className="px-4 py-3 text-sm font-medium text-foreground">
                    {item.numero}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-foreground">
                      {item.terceroNombreRazonSocial}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.terceroDocumentoNit}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {formatDate(item.fecha)}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {formatMetodoLabel(item.metodoPago)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-foreground">
                    {formatMoney(item.valor)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ContableCuadresCaja() {
  const [fechaDesde, setFechaDesde] = useState(getCurrentMonthStart());
  const [fechaHasta, setFechaHasta] = useState(getTodayInputValue());
  const [observaciones, setObservaciones] = useState("");
  const [resumen, setResumen] = useState<ContableCuadreCajaResumen | null>(null);
  const [historial, setHistorial] = useState<ContableCuadreCaja[]>([]);
  const [cargandoResumen, setCargandoResumen] = useState(true);
  const [cargandoHistorial, setCargandoHistorial] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cierreExistente = historial.find(
    item =>
      formatDateOnlyInput(item.fechaDesde) === fechaDesde &&
      formatDateOnlyInput(item.fechaHasta) === fechaHasta
  );

  async function cargarHistorial() {
    setCargandoHistorial(true);

    try {
      const data = await getContableCuadresCaja();
      setHistorial(data);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudo cargar el historial de cierres"
      );
    } finally {
      setCargandoHistorial(false);
    }
  }

  useEffect(() => {
    if (fechaDesde > fechaHasta) {
      setResumen(null);
      setCargandoResumen(false);
      setError("La fecha inicial no puede ser mayor que la fecha final");
      return;
    }

    let activo = true;

    async function cargarResumen() {
      setCargandoResumen(true);
      setError(null);

      try {
        const data = await getContableCuadreCajaResumen({
          fechaDesde,
          fechaHasta,
        });

        if (!activo) {
          return;
        }

        setResumen(data);
      } catch (loadError) {
        if (!activo) {
          return;
        }

        setResumen(null);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudo consolidar el cuadre de caja"
        );
      } finally {
        if (activo) {
          setCargandoResumen(false);
        }
      }
    }

    void cargarResumen();

    return () => {
      activo = false;
    };
  }, [fechaDesde, fechaHasta]);

  useEffect(() => {
    void cargarHistorial();
  }, []);

  async function handleRegistrarCierre() {
    if (fechaDesde > fechaHasta) {
      setError("La fecha inicial no puede ser mayor que la fecha final");
      return;
    }

    if (cierreExistente) {
      setError("Ya existe un cierre registrado para ese rango");
      return;
    }

    setGuardando(true);
    setError(null);

    try {
      await createContableCuadreCaja({
        fechaDesde,
        fechaHasta,
        observaciones: observaciones.trim() || undefined,
      });

      toast.success("Cierre de caja registrado");
      setObservaciones("");
      await cargarHistorial();
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "No se pudo registrar el cierre de caja";

      setError(message);
      toast.error(message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <DashboardLayout
      titulo="Cuadres de Caja"
      descripcion="Consolidado por rango de fechas usando recibos de caja y egresos ya registrados"
    >
      <div className="mb-6 rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="fechaDesde">Fecha desde</Label>
            <Input
              id="fechaDesde"
              type="date"
              value={fechaDesde}
              onChange={event => setFechaDesde(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fechaHasta">Fecha hasta</Label>
            <Input
              id="fechaHasta"
              type="date"
              value={fechaHasta}
              onChange={event => setFechaHasta(event.target.value)}
            />
          </div>

          <div className="flex items-end justify-end text-sm text-muted-foreground">
            {cargandoResumen
              ? "Consolidando movimientos..."
              : resumen
                ? `${resumen.cantidadIngresos} ingresos y ${resumen.cantidadSalidas} salidas`
                : "Sin resumen disponible"}
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-3">
        <ResumenCard
          label="Ingresos"
          value={formatMoney(resumen?.totalIngresos ?? 0)}
          detail={`${
            resumen?.cantidadIngresos ?? 0
          } recibo${(resumen?.cantidadIngresos ?? 0) === 1 ? "" : "s"} en el rango`}
        />
        <ResumenCard
          label="Salidas"
          value={formatMoney(resumen?.totalSalidas ?? 0)}
          detail={`${
            resumen?.cantidadSalidas ?? 0
          } egreso${(resumen?.cantidadSalidas ?? 0) === 1 ? "" : "s"} en el rango`}
        />
        <ResumenCard
          label="Saldo Esperado"
          value={formatMoney(resumen?.saldoEsperado ?? 0)}
          detail={`Periodo ${fechaDesde} a ${fechaHasta}`}
        />
      </div>

      {cierreExistente && (
        <div className="mb-6 rounded-lg border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
          Ya existe un cierre registrado para este rango:{" "}
          {formatDateTime(cierreExistente.createdAt)}
        </div>
      )}

      <div className="mb-6 rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-foreground">
            Registrar cierre de caja
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            El sistema guarda solo el snapshot agregado del periodo. Los
            movimientos siguen viviendo en recibos de caja y egresos.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-accent/40 p-4">
            <p className="text-sm text-muted-foreground">Periodo a cerrar</p>
            <p className="mt-2 text-base font-semibold text-foreground">
              {fechaDesde} a {fechaHasta}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Saldo esperado actual:{" "}
              <span className="font-medium text-foreground">
                {formatMoney(resumen?.saldoEsperado ?? 0)}
              </span>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observaciones">Observaciones del cierre</Label>
            <Textarea
              id="observaciones"
              value={observaciones}
              onChange={event => setObservaciones(event.target.value)}
              placeholder="Observaciones, diferencias manuales o contexto del cierre"
              rows={4}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button
            type="button"
            className="gap-2"
            disabled={
              guardando ||
              cargandoResumen ||
              !resumen ||
              Boolean(cierreExistente)
            }
            onClick={() => void handleRegistrarCierre()}
          >
            <Save size={18} />
            {guardando ? "Registrando..." : "Registrar Cierre"}
          </Button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <MovimientosTable
          title="Ingresos del Rango"
          items={resumen?.ingresos ?? []}
          emptyMessage="No hay recibos de caja en el rango seleccionado"
        />
        <MovimientosTable
          title="Salidas del Rango"
          items={resumen?.salidas ?? []}
          emptyMessage="No hay egresos en el rango seleccionado"
        />
      </div>

      <div className="rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            Historial de Cuadres
          </h2>
          <p className="text-sm text-muted-foreground">
            Cierres registrados sin duplicar movimientos operativos.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-accent">
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Cierre
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Periodo
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Ingresos
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Salidas
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Saldo
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Observaciones
                </th>
              </tr>
            </thead>
            <tbody>
              {cargandoHistorial ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-10 text-center text-sm text-muted-foreground"
                  >
                    Cargando historial de cuadres...
                  </td>
                </tr>
              ) : historial.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-10 text-center text-sm text-muted-foreground"
                  >
                    Aun no hay cierres de caja registrados
                  </td>
                </tr>
              ) : (
                historial.map((item, index) => (
                  <tr
                    key={item.id}
                    className={`border-b border-border ${
                      index % 2 === 0 ? "bg-background" : "bg-accent/40"
                    }`}
                  >
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-foreground">
                        {formatDateTime(item.createdAt)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.cantidadIngresos} ingresos / {item.cantidadSalidas} salidas
                      </p>
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      {formatDate(item.fechaDesde)} a {formatDate(item.fechaHasta)}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-foreground">
                      {formatMoney(item.totalIngresos)}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-foreground">
                      {formatMoney(item.totalSalidas)}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-foreground">
                      {formatMoney(item.saldoEsperado)}
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      {item.observaciones || "Sin observaciones"}
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
