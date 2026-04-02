import { useEffect, useState } from "react";
import { ArrowLeft, Calendar, Receipt, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Link, useLocation, useRoute } from "wouter";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { deleteEgreso, getEgresoById } from "@/lib/contable-egresos-api";
import { ContableMetodoPago, type ContableEgreso } from "@/lib/types";

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

export default function ContableEgresoDetalle() {
  const [match, params] = useRoute("/contable/comprobantes-egreso/:id");
  const [, setLocation] = useLocation();
  const egresoId = params?.id;
  const [egreso, setEgreso] = useState<ContableEgreso | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const destinoVolver = "/contable/comprobantes-egreso";

  useEffect(() => {
    if (!match || !egresoId) {
      return;
    }

    let activo = true;
    const currentEgresoId = egresoId;

    async function cargar() {
      setCargando(true);
      setError(null);

      try {
        const data = await getEgresoById(currentEgresoId);

        if (!activo) {
          return;
        }

        if (!data) {
          setEgreso(null);
          setError("El comprobante de egreso solicitado no existe");
          return;
        }

        setEgreso(data);
      } catch (loadError) {
        if (!activo) {
          return;
        }

        setEgreso(null);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudo cargar el comprobante de egreso"
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
  }, [egresoId, match]);

  async function handleEliminar() {
    if (!egreso) {
      return;
    }

    const confirmado = window.confirm(
      `Eliminar el comprobante "${egreso.numeroComprobante}"?\n\nSe restauraran los saldos de las facturas pagadas por este egreso.`
    );

    if (!confirmado) {
      return;
    }

    setEliminando(true);
    setError(null);

    try {
      await deleteEgreso(egreso.id);
      toast.success("Comprobante de egreso eliminado");
      setLocation(destinoVolver);
    } catch (deleteError) {
      const message =
        deleteError instanceof Error
          ? deleteError.message
          : "No se pudo eliminar el comprobante de egreso";

      setError(message);
      toast.error(message);
    } finally {
      setEliminando(false);
    }
  }

  if (!match) {
    return null;
  }

  if (cargando) {
    return (
      <DashboardLayout
        titulo="Detalle de Egreso"
        descripcion="Cargando informacion del comprobante"
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
          <p className="text-muted-foreground">Cargando comprobante...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!egreso) {
    return (
      <DashboardLayout
        titulo="Detalle de Egreso"
        descripcion="No fue posible cargar el comprobante"
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
            {error ?? "El comprobante de egreso solicitado no existe"}
          </p>
          <Button asChild variant="outline">
            <Link href={destinoVolver}>Volver a Comprobantes de Egreso</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      titulo={`Egreso ${egreso.numeroComprobante}`}
      descripcion="Detalle del pago registrado y facturas relacionadas"
      acciones={
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href={destinoVolver}>
              <ArrowLeft size={18} />
              Volver
            </Link>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-2 text-destructive hover:text-destructive"
            disabled={eliminando}
            onClick={() => void handleEliminar()}
          >
            <Trash2 size={18} />
            {eliminando ? "Eliminando..." : "Eliminar"}
          </Button>
        </div>
      }
    >
      {error && (
        <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm lg:col-span-2">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Informacion principal
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Registro contable del pago realizado al proveedor.
              </p>
            </div>
            <div className="rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
              {formatMoney(egreso.valorTotal)}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Proveedor
              </p>
              <p className="mt-1 font-medium text-foreground">
                {egreso.terceroNombreRazonSocial}
              </p>
              <p className="text-sm text-muted-foreground">
                {egreso.terceroDocumentoNit}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Metodo de pago
              </p>
              <p className="mt-1 font-medium text-foreground">
                {formatMetodoLabel(egreso.metodoPago)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Cuenta bancaria
              </p>
              <p className="mt-1 font-medium text-foreground">
                {egreso.cuentaBancariaNombre
                  ? [egreso.cuentaBancariaBanco, egreso.cuentaBancariaNombre]
                      .filter(Boolean)
                      .join(" - ")
                  : "Sin asociar"}
              </p>
              {egreso.cuentaBancariaNumero && (
                <p className="text-sm text-muted-foreground">
                  {egreso.cuentaBancariaNumero}
                </p>
              )}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Fecha del egreso
              </p>
              <p className="mt-1 flex items-center gap-2 font-medium text-foreground">
                <Calendar size={16} className="text-muted-foreground" />
                {formatDate(egreso.fecha)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Fecha de registro
              </p>
              <p className="mt-1 flex items-center gap-2 font-medium text-foreground">
                <Receipt size={16} className="text-muted-foreground" />
                {formatDateTime(egreso.createdAt)}
              </p>
            </div>
            <div className="md:col-span-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Observaciones
              </p>
              <p className="mt-1 text-sm text-foreground">
                {egreso.observaciones || "Sin observaciones registradas"}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">Control basico</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Si eliminas este egreso, el sistema restaura automaticamente el saldo de las facturas relacionadas.
          </p>
          <div className="mt-6 rounded-lg border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
            Facturas relacionadas: {egreso.detalles?.length ?? 0}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            Detalle aplicado a facturas
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cruce del comprobante contra saldos de facturas de compra.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-accent">
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Factura
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Fechas
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Total factura
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Saldo actual
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Valor pagado
                </th>
              </tr>
            </thead>
            <tbody>
              {egreso.detalles && egreso.detalles.length > 0 ? (
                egreso.detalles.map((detalle, index) => (
                  <tr
                    key={detalle.id}
                    className={`border-b border-border ${
                      index % 2 === 0 ? "bg-background" : "bg-accent/40"
                    }`}
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-foreground">
                        {detalle.facturaNumero}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      <p>Factura: {formatDate(detalle.facturaFecha)}</p>
                      <p className="text-xs text-muted-foreground">
                        Vence: {formatDate(detalle.facturaFechaVencimiento)}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      {formatMoney(detalle.facturaTotal)}
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      {formatMoney(detalle.facturaSaldoActual)}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-foreground">
                      {formatMoney(detalle.valorPagado)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-10 text-center text-sm text-muted-foreground"
                  >
                    Este egreso no tiene detalles registrados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
