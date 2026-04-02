import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
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
  createEgreso,
  getFacturasDisponiblesParaEgreso,
  type ContableFacturaDisponibleParaEgreso,
  type ContableEgresoMutationInput,
} from "@/lib/contable-egresos-api";
import { getContableBancos } from "@/lib/contable-bancos-api";
import { formatDateOnlyInput } from "@/lib/contable-facturas-compra-api";
import { getContableTerceros } from "@/lib/contable-terceros-api";
import {
  type ContableCuentaBancaria,
  ContableMetodoPago,
  ContableTerceroTipo,
  type ContableTercero,
} from "@/lib/types";

type EgresoFormValues = {
  numeroComprobante: string;
  terceroId: string;
  cuentaBancariaId: string;
  fecha: string;
  metodoPago: ContableMetodoPago;
  observaciones: string;
  soporteUrl: string;
};

type EgresoFormErrors = Partial<
  Record<
    | "numeroComprobante"
    | "terceroId"
    | "fecha"
    | "metodoPago"
    | "soporteUrl"
    | "detalles",
    string
  >
>;

const INITIAL_FORM: EgresoFormValues = {
  numeroComprobante: "",
  terceroId: "",
  cuentaBancariaId: "",
  fecha: formatDateOnlyInput(new Date()),
  metodoPago: ContableMetodoPago.TRANSFERENCIA,
  observaciones: "",
  soporteUrl: "",
};

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

function buildPayload(
  values: EgresoFormValues,
  valoresPagados: Record<string, string>
): ContableEgresoMutationInput {
  const detalles = Object.entries(valoresPagados)
    .map(([facturaId, valor]) => ({
      facturaId,
      valorPagado: parseMoneyInput(valor),
    }))
    .filter(detalle => Number.isFinite(detalle.valorPagado) && detalle.valorPagado > 0);

  return {
    numeroComprobante: values.numeroComprobante.trim(),
    terceroId: values.terceroId,
    cuentaBancariaId: toOptionalString(values.cuentaBancariaId),
    fecha: values.fecha,
    metodoPago: values.metodoPago,
    observaciones: toOptionalString(values.observaciones),
    soporteUrl: toOptionalString(values.soporteUrl),
    valorTotal: detalles.reduce((accumulator, detalle) => {
      return accumulator + detalle.valorPagado;
    }, 0),
    detalles,
  };
}

function validateForm(
  values: EgresoFormValues,
  facturas: ContableFacturaDisponibleParaEgreso[],
  valoresPagados: Record<string, string>
) {
  const errors: EgresoFormErrors = {};
  const facturasById = new Map(facturas.map(factura => [factura.id, factura]));
  const detalles = Object.entries(valoresPagados).filter(([, value]) => value.trim());

  if (!values.numeroComprobante.trim()) {
    errors.numeroComprobante = "El numero de comprobante es obligatorio";
  }

  if (!values.terceroId.trim()) {
    errors.terceroId = "Debes seleccionar un proveedor";
  }

  if (!values.fecha) {
    errors.fecha = "La fecha del egreso es obligatoria";
  }

  if (!values.metodoPago) {
    errors.metodoPago = "Debes seleccionar un metodo de pago";
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

  if (detalles.length === 0) {
    errors.detalles = "Debes registrar al menos un pago sobre factura";
    return errors;
  }

  for (const [facturaId, value] of detalles) {
    const factura = facturasById.get(facturaId);
    const valorPagado = parseMoneyInput(value);

    if (!factura) {
      errors.detalles = "Una de las facturas seleccionadas ya no esta disponible";
      break;
    }

    if (!Number.isFinite(valorPagado) || valorPagado <= 0) {
      errors.detalles = "Todos los valores pagados deben ser mayores a cero";
      break;
    }

    if (valorPagado > factura.saldo) {
      errors.detalles = `El pago de la factura ${factura.numeroFactura} supera su saldo disponible`;
      break;
    }
  }

  return errors;
}

export default function ContableEgresoNuevo() {
  const [match] = useRoute("/contable/comprobantes-egreso/nuevo");
  const [, setLocation] = useLocation();
  const [form, setForm] = useState<EgresoFormValues>(INITIAL_FORM);
  const [errors, setErrors] = useState<EgresoFormErrors>({});
  const [proveedores, setProveedores] = useState<ContableTercero[]>([]);
  const [cuentasBancarias, setCuentasBancarias] = useState<ContableCuentaBancaria[]>([]);
  const [facturas, setFacturas] = useState<ContableFacturaDisponibleParaEgreso[]>([]);
  const [valoresPagados, setValoresPagados] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(true);
  const [cargandoFacturas, setCargandoFacturas] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null);
  const destinoVolver = "/contable/comprobantes-egreso";

  useEffect(() => {
    if (!match) {
      return;
    }

    let activo = true;

    async function cargar() {
      setCargando(true);
      setErrorGlobal(null);

      try {
        const [proveedoresData, cuentasData] = await Promise.all([
          getContableTerceros({
            tipo: ContableTerceroTipo.PROVEEDOR,
          }),
          getContableBancos({ activa: true }),
        ]);

        if (!activo) {
          return;
        }

        setProveedores(proveedoresData);
        setCuentasBancarias(cuentasData);
        setForm(current => ({
          ...current,
          terceroId: current.terceroId || proveedoresData[0]?.id || "",
        }));
      } catch (loadError) {
        if (!activo) {
          return;
        }

        setErrorGlobal(
          loadError instanceof Error
            ? loadError.message
            : "No se pudo cargar el formulario de egresos"
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

  useEffect(() => {
    if (!match) {
      return;
    }

    if (!form.terceroId) {
      setFacturas([]);
      setValoresPagados({});
      return;
    }

    let activo = true;

    async function cargarFacturas() {
      setCargandoFacturas(true);
      setErrorGlobal(null);

      try {
        const facturasData = await getFacturasDisponiblesParaEgreso(form.terceroId);

        if (!activo) {
          return;
        }

        setFacturas(facturasData);
        setValoresPagados(current => {
          const next: Record<string, string> = {};

          for (const factura of facturasData) {
            if (current[factura.id]?.trim()) {
              next[factura.id] = current[factura.id] ?? "";
            }
          }

          return next;
        });
      } catch (loadError) {
        if (!activo) {
          return;
        }

        setFacturas([]);
        setValoresPagados({});
        setErrorGlobal(
          loadError instanceof Error
            ? loadError.message
            : "No se pudieron cargar las facturas pendientes del proveedor"
        );
      } finally {
        if (activo) {
          setCargandoFacturas(false);
        }
      }
    }

    void cargarFacturas();

    return () => {
      activo = false;
    };
  }, [form.terceroId, match]);

  const totalCalculado = useMemo(() => {
    return Object.values(valoresPagados).reduce((accumulator, value) => {
      const parsed = parseMoneyInput(value);
      return Number.isFinite(parsed) && parsed > 0 ? accumulator + parsed : accumulator;
    }, 0);
  }, [valoresPagados]);

  if (!match) {
    return null;
  }

  function updateField<K extends keyof EgresoFormValues>(
    field: K,
    value: EgresoFormValues[K]
  ) {
    setForm(current => ({
      ...current,
      [field]: value,
    }));

    setErrors(current => {
      const next: EgresoFormErrors = { ...current };
      switch (field) {
        case "numeroComprobante":
          delete next.numeroComprobante;
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

    if (field === "terceroId") {
      setFacturas([]);
      setValoresPagados({});
    }
  }

  function updateValorPagado(facturaId: string, value: string) {
    setValoresPagados(current => {
      if (!value.trim()) {
        const next = { ...current };
        delete next[facturaId];
        return next;
      }

      return {
        ...current,
        [facturaId]: value,
      };
    });

    setErrors(current => {
      const next = { ...current };
      delete next.detalles;
      return next;
    });

    setErrorGlobal(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationErrors = validateForm(form, facturas, valoresPagados);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      setErrorGlobal("Revisa la informacion del comprobante antes de guardar");
      return;
    }

    setGuardando(true);
    setErrorGlobal(null);

    try {
      const payload = buildPayload(form, valoresPagados);
      await createEgreso(payload);
      toast.success("Comprobante de egreso creado");
      setLocation(destinoVolver);
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "No se pudo guardar el comprobante de egreso";

      setErrorGlobal(message);
      toast.error(message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <DashboardLayout
      titulo="Nuevo Comprobante de Egreso"
      descripcion="Registro de pagos a proveedores con cruce directo contra facturas pendientes"
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
                Este registro alimenta cartera proveedores y deja lista la base para egresos posteriores.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="numeroComprobante">Numero de comprobante</Label>
                <Input
                  id="numeroComprobante"
                  value={form.numeroComprobante}
                  onChange={event =>
                    updateField("numeroComprobante", event.target.value)
                  }
                  placeholder="Consecutivo interno del egreso"
                />
                {errors.numeroComprobante && (
                  <p className="text-sm text-destructive">
                    {errors.numeroComprobante}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="terceroId">Proveedor</Label>
                <Select
                  value={form.terceroId}
                  onValueChange={value => updateField("terceroId", value)}
                >
                  <SelectTrigger id="terceroId">
                    <SelectValue placeholder="Selecciona un proveedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {proveedores.map(proveedor => (
                      <SelectItem key={proveedor.id} value={proveedor.id}>
                        {proveedor.nombreRazonSocial}
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

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="observaciones">Observaciones</Label>
                <Textarea
                  id="observaciones"
                  value={form.observaciones}
                  onChange={event =>
                    updateField("observaciones", event.target.value)
                  }
                  rows={4}
                  placeholder="Notas del pago, referencia bancaria o comentarios internos"
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
                  Facturas pendientes del proveedor
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Registra valores parciales o totales. El sistema actualiza saldo y estado automaticamente.
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Total a registrar
                </p>
                <p className="text-lg font-semibold text-foreground">
                  {formatMoney(totalCalculado)}
                </p>
              </div>
            </div>

            {errors.detalles && (
              <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {errors.detalles}
              </div>
            )}

            {cargandoFacturas ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Cargando facturas pendientes...
              </div>
            ) : facturas.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                {form.terceroId
                  ? "El proveedor seleccionado no tiene facturas pendientes"
                  : "Selecciona un proveedor para cargar sus facturas"}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-accent">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                        Factura
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                        Fechas
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                        Total
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                        Saldo
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                        Pago actual
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {facturas.map((factura, index) => (
                      <tr
                        key={factura.id}
                        className={`border-b border-border ${
                          index % 2 === 0 ? "bg-background" : "bg-accent/40"
                        }`}
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">
                            {factura.numeroFactura}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground">
                          <p>Factura: {factura.fechaFactura.toLocaleDateString("es-CO")}</p>
                          <p className="text-xs text-muted-foreground">
                            Vence: {factura.fechaVencimiento.toLocaleDateString("es-CO")}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground">
                          {formatMoney(factura.total)}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-foreground">
                          {formatMoney(factura.saldo)}
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={valoresPagados[factura.id] ?? ""}
                            onChange={event =>
                              updateValorPagado(factura.id, event.target.value)
                            }
                            placeholder="0"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3">
            <Button asChild type="button" variant="outline">
              <Link href={destinoVolver}>Cancelar</Link>
            </Button>
            <Button type="submit" className="gap-2" disabled={guardando}>
              <Save size={18} />
              {guardando ? "Guardando..." : "Guardar Egreso"}
            </Button>
          </div>
        </form>
      )}
    </DashboardLayout>
  );
}
