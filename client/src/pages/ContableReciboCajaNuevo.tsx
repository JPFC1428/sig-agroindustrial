import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Link, useLocation, useRoute } from "wouter";
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
import { Textarea } from "@/components/ui/textarea";
import {
  createReciboCaja,
  type ContableReciboCajaMutationInput,
} from "@/lib/contable-recibos-caja-api";
import { getContableBancos } from "@/lib/contable-bancos-api";
import { formatDateOnlyInput } from "@/lib/contable-facturas-compra-api";
import { getContableTerceros } from "@/lib/contable-terceros-api";
import {
  type ContableCuentaBancaria,
  ContableMetodoPago,
  ContableReciboDocumentoTipo,
  ContableTerceroTipo,
  type ContableTercero,
} from "@/lib/types";

type ReciboFormValues = {
  cuentaBancariaId: string;
  fecha: string;
  metodoPago: ContableMetodoPago;
  numeroRecibo: string;
  observaciones: string;
  soporteUrl: string;
  terceroId: string;
  valorTotal: string;
};

type ReciboDetalleFormRow = {
  documentoId: string;
  documentoReferencia: string;
  documentoTipo: ContableReciboDocumentoTipo;
  id: string;
  valorDocumento: string;
  valorPagado: string;
};

type ReciboFormErrors = Partial<
  Record<
    | "detalles"
    | "fecha"
    | "metodoPago"
    | "numeroRecibo"
    | "soporteUrl"
    | "terceroId"
    | "valorTotal",
    string
  >
>;

const INITIAL_FORM: ReciboFormValues = {
  cuentaBancariaId: "",
  fecha: formatDateOnlyInput(new Date()),
  metodoPago: ContableMetodoPago.TRANSFERENCIA,
  numeroRecibo: "",
  observaciones: "",
  soporteUrl: "",
  terceroId: "",
  valorTotal: "",
};

function createEmptyDetalle(): ReciboDetalleFormRow {
  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `detalle-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  return {
    documentoId: "",
    documentoReferencia: "",
    documentoTipo: ContableReciboDocumentoTipo.CUENTA_POR_COBRAR,
    id,
    valorDocumento: "",
    valorPagado: "",
  };
}

function formatMoney(value: number) {
  return `$${new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(value)}`;
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

function parseMoneyInput(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return 0;
  }

  const parsed = Number(trimmed.replace(/,/g, "."));
  return Number.isFinite(parsed) ? parsed : NaN;
}

function toOptionalString(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getActiveDetailRows(detalles: ReciboDetalleFormRow[]) {
  return detalles.filter(detalle => {
    return (
      detalle.documentoId.trim() ||
      detalle.documentoReferencia.trim() ||
      detalle.valorDocumento.trim() ||
      detalle.valorPagado.trim()
    );
  });
}

function validateForm(
  values: ReciboFormValues,
  detalles: ReciboDetalleFormRow[]
): ReciboFormErrors {
  const errors: ReciboFormErrors = {};
  const valorTotal = parseMoneyInput(values.valorTotal);
  const detallesActivos = getActiveDetailRows(detalles);

  if (!values.numeroRecibo.trim()) {
    errors.numeroRecibo = "El numero de recibo es obligatorio";
  }

  if (!values.terceroId.trim()) {
    errors.terceroId = "Debes seleccionar un cliente";
  }

  if (!values.fecha) {
    errors.fecha = "La fecha del recibo es obligatoria";
  }

  if (!values.metodoPago) {
    errors.metodoPago = "Debes seleccionar un metodo de pago";
  }

  if (!Number.isFinite(valorTotal) || valorTotal <= 0) {
    errors.valorTotal = "El valor total debe ser mayor a cero";
  }

  if (values.soporteUrl.trim()) {
    try {
      const parsed = new URL(values.soporteUrl.trim());

      if (!["http:", "https:"].includes(parsed.protocol)) {
        errors.soporteUrl = "La URL del soporte debe usar http o https";
      }
    } catch {
      errors.soporteUrl = "La URL del soporte no es valida";
    }
  }

  if (detallesActivos.length > 0) {
    const totalDetalle = detallesActivos.reduce((accumulator, detalle) => {
      return accumulator + parseMoneyInput(detalle.valorPagado);
    }, 0);
    const uniqueKeys = new Set<string>();

    for (let index = 0; index < detallesActivos.length; index += 1) {
      const detalle = detallesActivos[index];
      const valorDocumento = parseMoneyInput(detalle.valorDocumento);
      const valorPagado = parseMoneyInput(detalle.valorPagado);
      const documentoKey = `${detalle.documentoTipo}::${detalle.documentoId.trim()}::${detalle.documentoReferencia.trim()}`;

      if (!detalle.documentoReferencia.trim() && !detalle.documentoId.trim()) {
        errors.detalles = `Debes indicar una referencia o documento en el detalle ${index + 1}`;
        break;
      }

      if (!Number.isFinite(valorPagado) || valorPagado <= 0) {
        errors.detalles = `El valor aplicado del detalle ${index + 1} debe ser mayor a cero`;
        break;
      }

      if (!Number.isFinite(valorDocumento) || valorDocumento <= 0) {
        errors.detalles = `El valor total del documento en el detalle ${index + 1} debe ser mayor a cero`;
        break;
      }

      if (valorPagado > valorDocumento) {
        errors.detalles = `El valor aplicado del detalle ${index + 1} no puede superar el valor total del documento`;
        break;
      }

      if (uniqueKeys.has(documentoKey)) {
        errors.detalles = "No se puede repetir el mismo documento dentro del recibo";
        break;
      }

      uniqueKeys.add(documentoKey);
    }

    if (!errors.detalles && Math.abs(valorTotal - totalDetalle) > 0.009) {
      errors.detalles =
        "El valor total debe coincidir con la suma del detalle aplicado";
    }
  }

  return errors;
}

function buildPayload(
  values: ReciboFormValues,
  detalles: ReciboDetalleFormRow[]
): ContableReciboCajaMutationInput {
  const detallesActivos = getActiveDetailRows(detalles).map(detalle => ({
    documentoId: toOptionalString(detalle.documentoId),
    documentoReferencia: toOptionalString(detalle.documentoReferencia),
    documentoTipo: detalle.documentoTipo,
    valorDocumento: parseMoneyInput(detalle.valorDocumento),
    valorPagado: parseMoneyInput(detalle.valorPagado),
  }));

  return {
    cuentaBancariaId: toOptionalString(values.cuentaBancariaId),
    detalles: detallesActivos.length > 0 ? detallesActivos : undefined,
    fecha: values.fecha,
    metodoPago: values.metodoPago,
    numeroRecibo: values.numeroRecibo.trim(),
    observaciones: toOptionalString(values.observaciones),
    soporteUrl: toOptionalString(values.soporteUrl),
    terceroId: values.terceroId,
    valorTotal: parseMoneyInput(values.valorTotal),
  };
}

export default function ContableReciboCajaNuevo() {
  const [match] = useRoute("/contable/recibos-caja/nuevo");
  const [, setLocation] = useLocation();
  const [form, setForm] = useState<ReciboFormValues>(INITIAL_FORM);
  const [detalles, setDetalles] = useState<ReciboDetalleFormRow[]>([]);
  const [errors, setErrors] = useState<ReciboFormErrors>({});
  const [clientes, setClientes] = useState<ContableTercero[]>([]);
  const [cuentasBancarias, setCuentasBancarias] = useState<ContableCuentaBancaria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null);
  const destinoVolver = "/contable/recibos-caja";

  useEffect(() => {
    if (!match) {
      return;
    }

    let activo = true;

    async function cargar() {
      setCargando(true);
      setErrorGlobal(null);

      try {
        const [clientesData, cuentasData] = await Promise.all([
          getContableTerceros({
            tipo: ContableTerceroTipo.CLIENTE,
          }),
          getContableBancos({ activa: true }),
        ]);

        if (!activo) {
          return;
        }

        setClientes(clientesData);
        setCuentasBancarias(cuentasData);
        setForm(current => ({
          ...current,
          terceroId: current.terceroId || clientesData[0]?.id || "",
        }));
      } catch (loadError) {
        if (!activo) {
          return;
        }

        setErrorGlobal(
          loadError instanceof Error
            ? loadError.message
            : "No se pudo cargar el formulario de recibos de caja"
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
  }, [match]);

  const totalDetalle = useMemo(() => {
    return getActiveDetailRows(detalles).reduce((accumulator, detalle) => {
      const parsed = parseMoneyInput(detalle.valorPagado);
      return Number.isFinite(parsed) && parsed > 0 ? accumulator + parsed : accumulator;
    }, 0);
  }, [detalles]);

  if (!match) {
    return null;
  }

  function updateField<K extends keyof ReciboFormValues>(
    field: K,
    value: ReciboFormValues[K]
  ) {
    setForm(current => ({
      ...current,
      [field]: value,
    }));

    setErrors(current => {
      const next: ReciboFormErrors = { ...current };
      switch (field) {
        case "numeroRecibo":
          delete next.numeroRecibo;
          break;
        case "terceroId":
          delete next.terceroId;
          break;
        case "cuentaBancariaId":
        case "fecha":
          delete next.fecha;
          break;
        case "metodoPago":
          delete next.metodoPago;
          break;
        case "valorTotal":
          delete next.valorTotal;
          break;
        case "soporteUrl":
          delete next.soporteUrl;
          break;
        default:
          break;
      }
      delete next.detalles;
      return next;
    });

    setErrorGlobal(null);
  }

  function updateDetalle(
    detalleId: string,
    field: keyof ReciboDetalleFormRow,
    value: string
  ) {
    setDetalles(current =>
      current.map(detalle =>
        detalle.id === detalleId
          ? {
              ...detalle,
              [field]: value,
            }
          : detalle
      )
    );

    setErrors(current => {
      const next = { ...current };
      delete next.detalles;
      return next;
    });

    setErrorGlobal(null);
  }

  function handleAgregarDetalle() {
    setDetalles(current => [...current, createEmptyDetalle()]);
  }

  function handleEliminarDetalle(detalleId: string) {
    setDetalles(current => current.filter(detalle => detalle.id !== detalleId));
    setErrors(current => {
      const next = { ...current };
      delete next.detalles;
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationErrors = validateForm(form, detalles);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      setErrorGlobal("Revisa la informacion del recibo antes de guardar");
      return;
    }

    setGuardando(true);
    setErrorGlobal(null);

    try {
      const payload = buildPayload(form, detalles);
      await createReciboCaja(payload);
      toast.success("Recibo de caja creado");
      setLocation(destinoVolver);
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "No se pudo guardar el recibo de caja";

      setErrorGlobal(message);
      toast.error(message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <DashboardLayout
      titulo="Nuevo Recibo de Caja"
      descripcion="Registro de ingresos por cliente con base para cartera y aplicaciones parciales"
      acciones={
        <Button asChild variant="outline" size="sm" className="gap-2">
          <Link href={destinoVolver}>
            <ArrowLeft size={18} />
            Volver
          </Link>
        </Button>
      }
    >
      {cargando ? (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">Cargando formulario...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {errorGlobal && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {errorGlobal}
            </div>
          )}

          <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-foreground">
                Informacion principal
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Esta base queda preparada para cartera clientes y futuras aplicaciones a documentos reales.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="numeroRecibo">Numero de recibo</Label>
                <Input
                  id="numeroRecibo"
                  value={form.numeroRecibo}
                  onChange={event => updateField("numeroRecibo", event.target.value)}
                  placeholder="Consecutivo interno del recibo"
                />
                {errors.numeroRecibo && (
                  <p className="text-sm text-destructive">{errors.numeroRecibo}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="terceroId">Cliente</Label>
                <Select
                  value={form.terceroId}
                  onValueChange={value => updateField("terceroId", value)}
                >
                  <SelectTrigger id="terceroId">
                    <SelectValue placeholder="Selecciona un cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes.map(cliente => (
                      <SelectItem key={cliente.id} value={cliente.id}>
                        {cliente.nombreRazonSocial}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.terceroId && (
                  <p className="text-sm text-destructive">{errors.terceroId}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Cuenta bancaria</Label>
                <Select
                  value={form.cuentaBancariaId || "sin-cuenta"}
                  onValueChange={value =>
                    updateField(
                      "cuentaBancariaId",
                      value === "sin-cuenta" ? "" : value
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin asociar cuenta bancaria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sin-cuenta">
                      Sin asociar cuenta bancaria
                    </SelectItem>
                    {cuentasBancarias.map(cuenta => (
                      <SelectItem key={cuenta.id} value={cuenta.id}>
                        {cuenta.nombreBanco} - {cuenta.nombreCuenta} - {cuenta.numeroCuenta}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fecha">Fecha</Label>
                <Input
                  id="fecha"
                  type="date"
                  value={form.fecha}
                  onChange={event => updateField("fecha", event.target.value)}
                />
                {errors.fecha && (
                  <p className="text-sm text-destructive">{errors.fecha}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="metodoPago">Metodo de pago</Label>
                <Select
                  value={form.metodoPago}
                  onValueChange={value =>
                    updateField("metodoPago", value as ContableMetodoPago)
                  }
                >
                  <SelectTrigger id="metodoPago">
                    <SelectValue placeholder="Selecciona un metodo" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(ContableMetodoPago).map(metodo => (
                      <SelectItem key={metodo} value={metodo}>
                        {formatMetodoLabel(metodo)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.metodoPago && (
                  <p className="text-sm text-destructive">{errors.metodoPago}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="valorTotal">Valor total</Label>
                <Input
                  id="valorTotal"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.valorTotal}
                  onChange={event => updateField("valorTotal", event.target.value)}
                  placeholder="0"
                />
                {errors.valorTotal && (
                  <p className="text-sm text-destructive">{errors.valorTotal}</p>
                )}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="observaciones">Observaciones</Label>
                <Textarea
                  id="observaciones"
                  value={form.observaciones}
                  onChange={event =>
                    updateField("observaciones", event.target.value)
                  }
                  rows={4}
                  placeholder="Notas del recaudo, referencia bancaria o comentarios internos"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="soporteUrl">URL del soporte</Label>
                <Input
                  id="soporteUrl"
                  type="url"
                  value={form.soporteUrl}
                  onChange={event => updateField("soporteUrl", event.target.value)}
                  placeholder="https://..."
                />
                {errors.soporteUrl && (
                  <p className="text-sm text-destructive">{errors.soporteUrl}</p>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Aplicaciones del recibo
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Opcional. Si diligencias este detalle, el total del recibo debe coincidir con la suma aplicada.
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Total detalle
                </p>
                <p className="text-lg font-semibold text-foreground">
                  {formatMoney(totalDetalle)}
                </p>
              </div>
            </div>

            {errors.detalles && (
              <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {errors.detalles}
              </div>
            )}

            {detalles.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                No has agregado aplicaciones. Puedes guardar el recibo solo con valor total o registrar referencias para cartera futura.
              </div>
            ) : (
              <div className="space-y-4">
                {detalles.map((detalle, index) => (
                  <div
                    key={detalle.id}
                    className="rounded-lg border border-border bg-background p-4"
                  >
                    <div className="mb-4 flex items-center justify-between gap-4">
                      <p className="text-sm font-medium text-foreground">
                        Detalle {index + 1}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleEliminarDetalle(detalle.id)}
                        className="rounded p-2 text-muted-foreground transition-smooth hover:bg-accent hover:text-destructive"
                        title="Eliminar detalle"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                      <div className="space-y-2">
                        <Label>Tipo de documento</Label>
                        <Select
                          value={detalle.documentoTipo}
                          onValueChange={value =>
                            updateDetalle(detalle.id, "documentoTipo", value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.values(ContableReciboDocumentoTipo).map(tipo => (
                              <SelectItem key={tipo} value={tipo}>
                                {formatDocumentoTipoLabel(tipo)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Documento ID</Label>
                        <Input
                          value={detalle.documentoId}
                          onChange={event =>
                            updateDetalle(detalle.id, "documentoId", event.target.value)
                          }
                          placeholder="Id interno futuro"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Referencia</Label>
                        <Input
                          value={detalle.documentoReferencia}
                          onChange={event =>
                            updateDetalle(
                              detalle.id,
                              "documentoReferencia",
                              event.target.value
                            )
                          }
                          placeholder="Factura, cuenta o documento"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Valor documento</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={detalle.valorDocumento}
                          onChange={event =>
                            updateDetalle(detalle.id, "valorDocumento", event.target.value)
                          }
                          placeholder="0"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Valor recibido</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={detalle.valorPagado}
                          onChange={event =>
                            updateDetalle(detalle.id, "valorPagado", event.target.value)
                          }
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={handleAgregarDetalle}
              >
                <Plus size={16} />
                Agregar Aplicacion
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <Button asChild type="button" variant="outline">
              <Link href={destinoVolver}>Cancelar</Link>
            </Button>
            <Button type="submit" className="gap-2" disabled={guardando}>
              <Save size={18} />
              {guardando ? "Guardando..." : "Guardar Recibo"}
            </Button>
          </div>
        </form>
      )}
    </DashboardLayout>
  );
}
