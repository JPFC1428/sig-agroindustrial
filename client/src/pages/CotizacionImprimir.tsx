import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { Link, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { getCotizacionById } from "@/lib/cotizaciones-api";
import { type Cotizacion, type LineaCotizacion } from "@/lib/types";

function formatMoney(value: number, moneda: Cotizacion["moneda"]) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: moneda,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number) {
  if (!value) {
    return "0%";
  }

  return `${value}%`;
}

function buildClienteLabel(cotizacion: Cotizacion) {
  return cotizacion.clienteEmpresa ?? cotizacion.clienteNombre ?? "Sin cliente";
}

function getLineSubtotal(linea: LineaCotizacion, moneda: Cotizacion["moneda"]) {
  return formatMoney(linea.subtotal, moneda);
}

export default function CotizacionImprimir() {
  const [match, params] = useRoute("/cotizaciones/:id/imprimir");
  const cotizacionId = params?.id;
  const [cotizacion, setCotizacion] = useState<Cotizacion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [printTriggered, setPrintTriggered] = useState(false);

  useEffect(() => {
    if (!match || !cotizacionId) {
      return;
    }

    let active = true;
    const currentCotizacionId = cotizacionId;

    async function loadCotizacion() {
      setCargando(true);
      setError(null);
      setPrintTriggered(false);

      try {
        const data = await getCotizacionById(currentCotizacionId);

        if (!active) {
          return;
        }

        if (!data) {
          setCotizacion(null);
          setError("La cotizacion solicitada no existe");
          return;
        }

        setCotizacion(data);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setCotizacion(null);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudo cargar la cotizacion"
        );
      } finally {
        if (active) {
          setCargando(false);
        }
      }
    }

    void loadCotizacion();

    return () => {
      active = false;
    };
  }, [cotizacionId, match]);

  useEffect(() => {
    if (!cotizacion) {
      return;
    }

    document.title = `Imprimir ${cotizacion.numero}`;
  }, [cotizacion]);

  useEffect(() => {
    if (!cotizacion || printTriggered) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      window.print();
      setPrintTriggered(true);
    }, 180);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [cotizacion, printTriggered]);

  const resumen = useMemo(() => {
    if (!cotizacion) {
      return null;
    }

    return {
      descuentoGlobal: cotizacion.descuentoGlobal ?? 0,
      impuesto: cotizacion.impuesto,
      subtotal: cotizacion.subtotal,
      total: cotizacion.total,
    };
  }, [cotizacion]);

  if (!match) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <style>{`
        @media print {
          @page {
            size: auto;
            margin: 14mm;
          }

          body {
            background: white !important;
          }

          .print-toolbar {
            display: none !important;
          }

          .print-shell {
            padding: 0 !important;
          }

          .print-card {
            box-shadow: none !important;
            border-color: #d4d4d8 !important;
          }
        }
      `}</style>

      <div className="print-toolbar sticky top-0 z-10 border-b border-border bg-card/95 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              Vista de impresion de cotizacion
            </p>
            <p className="text-xs text-muted-foreground">
              Se abrira el dialogo de impresion automaticamente al cargar.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/cotizaciones">
                <ArrowLeft size={16} />
                Volver
              </Link>
            </Button>
            <Button onClick={() => window.print()} className="gap-2">
              <Printer size={16} />
              Imprimir
            </Button>
          </div>
        </div>
      </div>

      <div className="print-shell px-6 py-8">
        <div className="print-card mx-auto w-full max-w-5xl rounded-lg border border-border bg-card p-8 shadow-sm">
          {cargando ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              Cargando cotizacion...
            </div>
          ) : error ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : !cotizacion || !resumen ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No se encontro la cotizacion solicitada.
            </div>
          ) : (
            <div className="space-y-8">
              <div className="flex flex-col gap-6 border-b border-border pb-6 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    Cotizacion
                  </p>
                  <h1 className="text-3xl font-bold text-foreground">
                    {cotizacion.numero}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Generada el {cotizacion.fecha.toLocaleDateString("es-CO")}
                  </p>
                </div>

                <div className="grid gap-4 text-sm md:grid-cols-2 md:text-right">
                  <div>
                    <p className="font-medium text-foreground">Cliente</p>
                    <p className="text-muted-foreground">
                      {buildClienteLabel(cotizacion)}
                    </p>
                    {cotizacion.clienteNombre &&
                      cotizacion.clienteEmpresa &&
                      cotizacion.clienteNombre !== cotizacion.clienteEmpresa && (
                        <p className="text-muted-foreground">
                          Contacto: {cotizacion.clienteNombre}
                        </p>
                      )}
                  </div>

                  <div>
                    <p className="font-medium text-foreground">Estado</p>
                    <p className="text-muted-foreground">
                      {cotizacion.estado.charAt(0).toUpperCase() +
                        cotizacion.estado.slice(1)}
                    </p>
                    <p className="text-muted-foreground">
                      Vence el{" "}
                      {cotizacion.fechaVencimiento.toLocaleDateString("es-CO")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-accent">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                        Descripcion
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">
                        Cantidad
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">
                        Precio unitario
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">
                        Desc.
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">
                        Subtotal
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {cotizacion.lineas.map((linea, index) => (
                      <tr
                        key={linea.id}
                        className={`border-t border-border ${
                          index % 2 === 0 ? "bg-background" : "bg-accent/30"
                        }`}
                      >
                        <td className="px-4 py-3 text-sm text-foreground">
                          {linea.descripcion}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-foreground">
                          {linea.cantidad}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-foreground">
                          {formatMoney(linea.precioUnitario, cotizacion.moneda)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-foreground">
                          {formatPercent(linea.descuento)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium text-foreground">
                          {getLineSubtotal(linea, cotizacion.moneda)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-6 md:grid-cols-[1.5fr,1fr]">
                <div className="space-y-6">
                  <div className="rounded-lg border border-border p-4">
                    <p className="mb-2 text-sm font-semibold text-foreground">
                      Condiciones de pago
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {cotizacion.condicionesPago}
                    </p>
                  </div>

                  <div className="rounded-lg border border-border p-4">
                    <p className="mb-2 text-sm font-semibold text-foreground">
                      Observaciones
                    </p>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {cotizacion.notas?.trim() || "Sin observaciones"}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-border p-4">
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-medium text-foreground">
                        {formatMoney(resumen.subtotal, cotizacion.moneda)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Impuesto</span>
                      <span className="font-medium text-foreground">
                        {formatMoney(resumen.impuesto, cotizacion.moneda)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">
                        Descuento global
                      </span>
                      <span className="font-medium text-foreground">
                        {formatMoney(resumen.descuentoGlobal, cotizacion.moneda)}
                      </span>
                    </div>
                    <div className="border-t border-border pt-3">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-base font-semibold text-foreground">
                          Total
                        </span>
                        <span className="text-base font-bold text-foreground">
                          {formatMoney(resumen.total, cotizacion.moneda)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
