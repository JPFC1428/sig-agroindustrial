import { useEffect, useState } from "react";
import { ArrowLeft, Calendar, Receipt, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Link, useLocation, useRoute } from "wouter";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  deleteReciboCaja,
  getReciboCajaById,
} from "@/lib/contable-recibos-caja-api";
import {
  ContableMetodoPago,
  ContableReciboDocumentoTipo,
  type ContableReciboCaja,
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

function formatDocumentoTipoLabel(tipo: ContableReciboDocumentoTipo) {
  switch (tipo) {
    case ContableReciboDocumentoTipo.CUENTA_POR_COBRAR:
      return "Cuenta por cobrar";
    case ContableReciboDocumentoTipo.OTRO:
      return "Otro";
    default:
      return tipo;
  }
}

export default function ContableReciboCajaDetalle() {
  const [match, params] = useRoute("/contable/recibos-caja/:id");
  const [, setLocation] = useLocation();
  const reciboId = params?.id;
  const [recibo, setRecibo] = useState<ContableReciboCaja | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const destinoVolver = "/contable/recibos-caja";

  useEffect(() => {
    if (!match || !reciboId) {
      return;
    }

    let activo = true;
    const currentReciboId = reciboId;

    async function cargar() {
      setCargando(true);
      setError(null);

      try {
        const data = await getReciboCajaById(currentReciboId);

        if (!activo) {
          return;
        }

        if (!data) {
          setRecibo(null);
          setError("El recibo de caja solicitado no existe");
          return;
        }

        setRecibo(data);
      } catch (loadError) {
        if (!activo) {
          return;
        }

        setRecibo(null);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudo cargar el recibo de caja"
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
  }, [match, reciboId]);

  async function handleEliminar() {
    if (!recibo) {
      return;
    }

    const confirmado = window.confirm(
      `Eliminar el recibo "${recibo.numeroRecibo}"?`
    );

    if (!confirmado) {
      return;
    }

    setEliminando(true);
    setError(null);

    try {
      await deleteReciboCaja(recibo.id);
      toast.success("Recibo de caja eliminado");
      setLocation(destinoVolver);
    } catch (deleteError) {
      const message =
        deleteError instanceof Error
          ? deleteError.message
          : "No se pudo eliminar el recibo de caja";

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
        titulo="Detalle de Recibo de Caja"
        descripcion="Cargando informacion del recibo"
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
          <p className="text-muted-foreground">Cargando recibo...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!recibo) {
    return (
      <DashboardLayout
        titulo="Detalle de Recibo de Caja"
        descripcion="No fue posible cargar el recibo"
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
            {error ?? "El recibo de caja solicitado no existe"}
          </p>
          <Button asChild variant="outline">
            <Link href={destinoVolver}>Volver a Recibos de Caja</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      titulo={`Recibo ${recibo.numeroRecibo}`}
      descripcion="Detalle del ingreso registrado y referencias aplicadas"
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
                Registro contable del ingreso recibido del cliente.
              </p>
            </div>
            <div className="rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
              {formatMoney(recibo.valorTotal)}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Cliente
              </p>
              <p className="mt-1 font-medium text-foreground">
                {recibo.terceroNombreRazonSocial}
              </p>
              <p className="text-sm text-muted-foreground">
                {recibo.terceroDocumentoNit}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Metodo de pago
              </p>
              <p className="mt-1 font-medium text-foreground">
                {formatMetodoLabel(recibo.metodoPago)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Cuenta bancaria
              </p>
              <p className="mt-1 font-medium text-foreground">
                {recibo.cuentaBancariaNombre
                  ? [recibo.cuentaBancariaBanco, recibo.cuentaBancariaNombre]
                      .filter(Boolean)
                      .join(" - ")
                  : "Sin asociar"}
              </p>
              {recibo.cuentaBancariaNumero && (
                <p className="text-sm text-muted-foreground">
                  {recibo.cuentaBancariaNumero}
                </p>
              )}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Fecha del recibo
              </p>
              <p className="mt-1 flex items-center gap-2 font-medium text-foreground">
                <Calendar size={16} className="text-muted-foreground" />
                {formatDate(recibo.fecha)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Fecha de registro
              </p>
              <p className="mt-1 flex items-center gap-2 font-medium text-foreground">
                <Receipt size={16} className="text-muted-foreground" />
                {formatDateTime(recibo.createdAt)}
              </p>
            </div>
            <div className="md:col-span-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Observaciones
              </p>
              <p className="mt-1 text-sm text-foreground">
                {recibo.observaciones || "Sin observaciones registradas"}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">Base cartera</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Este recibo ya puede conservar aplicaciones por documento para luego conectar cartera clientes sin rehacer el flujo.
          </p>
          <div className="mt-6 rounded-lg border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
            Referencias aplicadas: {recibo.detalles?.length ?? 0}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            Detalle de aplicaciones
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Referencias registradas para control de recaudo y futura cartera.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-accent">
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Tipo
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Documento ID
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Referencia
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Valor documento
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Valor aplicado
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Saldo
                </th>
              </tr>
            </thead>
            <tbody>
              {recibo.detalles && recibo.detalles.length > 0 ? (
                recibo.detalles.map((detalle, index) => (
                  <tr
                    key={detalle.id}
                    className={`border-b border-border ${
                      index % 2 === 0 ? "bg-background" : "bg-accent/40"
                    }`}
                  >
                    <td className="px-6 py-4 text-sm text-foreground">
                      {formatDocumentoTipoLabel(detalle.documentoTipo)}
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      {detalle.documentoId || "Sin ID"}
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      {detalle.documentoReferencia || "Sin referencia"}
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      {formatMoney(detalle.valorDocumento ?? detalle.valorPagado)}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-foreground">
                      {formatMoney(detalle.valorPagado)}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-foreground">
                      {formatMoney(
                        Math.max(
                          (detalle.valorDocumento ?? detalle.valorPagado) -
                            detalle.valorPagado,
                          0
                        )
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-10 text-center text-sm text-muted-foreground"
                  >
                    Este recibo no tiene aplicaciones registradas
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
