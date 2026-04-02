import { useEffect, useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { Link, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { getSertecOrdenById } from "@/lib/sertec-api";
import { SertecOrdenEstado, type SertecOrden } from "@/lib/types";

function formatDateTime(value?: Date) {
  if (!value) {
    return "No disponible";
  }

  return value.toLocaleString("es-CO");
}

function buildPrintTitle(tipo: "entrada" | "salida", orden: SertecOrden) {
  return `${tipo === "entrada" ? "Orden de Entrada" : "Orden de Salida"} ${orden.numero}`;
}

export default function SertecImprimir() {
  const [entradaMatch, entradaParams] = useRoute("/sertec/:id/imprimir-entrada");
  const [salidaMatch, salidaParams] = useRoute("/sertec/:id/imprimir-salida");
  const ordenId = entradaParams?.id ?? salidaParams?.id;
  const tipo = entradaMatch ? "entrada" : salidaMatch ? "salida" : null;
  const [orden, setOrden] = useState<SertecOrden | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [printTriggered, setPrintTriggered] = useState(false);

  useEffect(() => {
    if (!tipo || !ordenId) {
      return;
    }

    let active = true;
    const currentOrdenId = ordenId;

    async function loadOrden() {
      setCargando(true);
      setError(null);
      setPrintTriggered(false);

      try {
        const data = await getSertecOrdenById(currentOrdenId);

        if (!active) {
          return;
        }

        if (!data) {
          setOrden(null);
          setError("La orden SERTEC solicitada no existe");
          return;
        }

        setOrden(data);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setOrden(null);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudo cargar la orden SERTEC"
        );
      } finally {
        if (active) {
          setCargando(false);
        }
      }
    }

    void loadOrden();

    return () => {
      active = false;
    };
  }, [ordenId, tipo]);

  useEffect(() => {
    if (!tipo || !orden) {
      return;
    }

    document.title = buildPrintTitle(tipo, orden);
  }, [orden, tipo]);

  useEffect(() => {
    if (!orden || !tipo || printTriggered) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      window.print();
      setPrintTriggered(true);
    }, 180);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [orden, printTriggered, tipo]);

  if (!tipo) {
    return null;
  }

  const isSalida = tipo === "salida";

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
              Vista de impresion SERTEC
            </p>
            <p className="text-xs text-muted-foreground">
              Se abrira el dialogo de impresion automaticamente al cargar.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href={ordenId ? `/sertec/${ordenId}` : "/sertec"}>
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
              Cargando orden SERTEC...
            </div>
          ) : error ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : !orden ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No se encontro la orden solicitada.
            </div>
          ) : (
            <div className="space-y-8">
              <div className="border-b border-border pb-6">
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  SERTEC
                </p>
                <h1 className="mt-2 text-3xl font-bold text-foreground">
                  {isSalida ? "Orden de Salida" : "Orden de Entrada"}
                </h1>
                <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">Consecutivo:</span>{" "}
                    {orden.numero}
                  </p>
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">Estado:</span>{" "}
                    {orden.estado}
                  </p>
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {isSalida ? "Fecha de salida:" : "Fecha de ingreso:"}
                    </span>{" "}
                    {formatDateTime(
                      isSalida ? orden.fechaSalida ?? orden.updatedAt : orden.fechaIngreso
                    )}
                  </p>
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">Cliente:</span>{" "}
                    {orden.clienteNombre}
                  </p>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-lg border border-border p-4">
                  <h2 className="mb-4 text-base font-semibold text-foreground">
                    Datos del cliente
                  </h2>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>
                      <span className="font-medium text-foreground">Cliente:</span>{" "}
                      {orden.clienteNombre}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Documento:</span>{" "}
                      {orden.clienteDocumento ?? "Sin documento"}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Telefono:</span>{" "}
                      {orden.clienteTelefono ?? "Sin telefono"}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">
                        Origen comercial:
                      </span>{" "}
                      {orden.cotizacionNumero
                        ? `Cotizacion ${orden.cotizacionNumero}`
                        : "Sin origen comercial"}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-border p-4">
                  <h2 className="mb-4 text-base font-semibold text-foreground">
                    Datos del equipo
                  </h2>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>
                      <span className="font-medium text-foreground">Tipo:</span>{" "}
                      {orden.equipoTipo}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Marca:</span>{" "}
                      {orden.equipoMarca ?? "Sin marca"}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Modelo:</span>{" "}
                      {orden.equipoModelo ?? "Sin modelo"}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Serial:</span>{" "}
                      {orden.equipoSerial ?? "Sin serial"}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">
                        Equipo vendido:
                      </span>{" "}
                      {orden.equipoVendidoDescripcion ?? "No asociado"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-lg border border-border p-4">
                  <h2 className="mb-4 text-base font-semibold text-foreground">
                    Garantia
                  </h2>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>
                      <span className="font-medium text-foreground">Aplica:</span>{" "}
                      {orden.garantia?.aplica ? "Si" : "No"}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">
                        Fecha de venta:
                      </span>{" "}
                      {formatDateTime(orden.garantia?.fechaVenta)}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">
                        Garantia en meses:
                      </span>{" "}
                      {orden.garantia?.garantiaMeses ?? "No definida"}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Vigencia:</span>{" "}
                      {formatDateTime(orden.garantia?.vigenteHasta)}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-border p-4">
                  <h2 className="mb-4 text-base font-semibold text-foreground">
                    Estado tecnico
                  </h2>
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <p>
                      <span className="font-medium text-foreground">
                        Falla reportada:
                      </span>{" "}
                      {orden.fallaReportada}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">
                        Diagnostico:
                      </span>{" "}
                      {orden.diagnostico ?? "Sin diagnostico"}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">
                        Trabajo realizado:
                      </span>{" "}
                      {orden.trabajoRealizado ?? "Sin trabajo registrado"}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">
                        Observaciones:
                      </span>{" "}
                      {orden.observaciones ?? "Sin observaciones"}
                    </p>
                  </div>
                </div>
              </div>

              {isSalida && orden.estado !== SertecOrdenEstado.SALIDA && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  La orden aun no ha sido marcada como salida. Esta impresion se
                  genera con el estado actual.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
