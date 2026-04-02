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
  createFacturaCompra,
  formatDateOnlyInput,
  getFacturaCompraById,
  updateFacturaCompra,
  type ContableFacturaCompraMutationInput,
} from "@/lib/contable-facturas-compra-api";
import { getContableTerceros } from "@/lib/contable-terceros-api";
import {
  ContableFacturaCompraEstado,
  ContableTerceroTipo,
  type ContableFacturaCompra,
  type ContableTercero,
} from "@/lib/types";

type FacturaCompraFormValues = {
  numeroFactura: string;
  terceroId: string;
  fechaFactura: string;
  fechaVencimiento: string;
  subtotal: string;
  iva: string;
  saldo: string;
  estado: ContableFacturaCompraEstado;
  observaciones: string;
  soporteUrl: string;
};

type FacturaCompraFormErrors = Partial<Record<keyof FacturaCompraFormValues, string>>;

function todayInputValue() {
  return formatDateOnlyInput(new Date());
}

const INITIAL_FORM: FacturaCompraFormValues = {
  numeroFactura: "",
  terceroId: "",
  fechaFactura: todayInputValue(),
  fechaVencimiento: todayInputValue(),
  subtotal: "0",
  iva: "0",
  saldo: "0",
  estado: ContableFacturaCompraEstado.PENDIENTE,
  observaciones: "",
  soporteUrl: "",
};

function formatEstadoLabel(estado: ContableFacturaCompraEstado) {
  switch (estado) {
    case ContableFacturaCompraEstado.PENDIENTE:
      return "Pendiente";
    case ContableFacturaCompraEstado.PARCIAL:
      return "Parcial";
    case ContableFacturaCompraEstado.PAGADA:
      return "Pagada";
    case ContableFacturaCompraEstado.VENCIDA:
      return "Vencida";
    case ContableFacturaCompraEstado.ANULADA:
      return "Anulada";
    default:
      return estado;
  }
}

function formatMoney(value: number) {
  return `$${new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(value)}`;
}

function toOptionalString(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseMoneyValue(value: string) {
  const normalized = value.replace(/,/g, ".").trim();

  if (!normalized) {
    return 0;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function formatInputNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function toFormValues(factura: ContableFacturaCompra): FacturaCompraFormValues {
  return {
    numeroFactura: factura.numeroFactura,
    terceroId: factura.terceroId,
    fechaFactura: formatDateOnlyInput(factura.fechaFactura),
    fechaVencimiento: formatDateOnlyInput(factura.fechaVencimiento),
    subtotal: formatInputNumber(factura.subtotal),
    iva: formatInputNumber(factura.iva),
    saldo: formatInputNumber(factura.saldo),
    estado: factura.estado,
    observaciones: factura.observaciones ?? "",
    soporteUrl: factura.soporteUrl ?? "",
  };
}

function validateForm(values: FacturaCompraFormValues, total: number) {
  const errors: FacturaCompraFormErrors = {};
  const subtotal = parseMoneyValue(values.subtotal);
  const iva = parseMoneyValue(values.iva);
  const saldo = parseMoneyValue(values.saldo);

  if (!values.numeroFactura.trim()) {
    errors.numeroFactura = "El numero de factura es obligatorio";
  }

  if (!values.terceroId.trim()) {
    errors.terceroId = "Debes seleccionar un proveedor";
  }

  if (!values.fechaFactura) {
    errors.fechaFactura = "La fecha de factura es obligatoria";
  }

  if (!values.fechaVencimiento) {
    errors.fechaVencimiento = "La fecha de vencimiento es obligatoria";
  }

  if (!Number.isFinite(subtotal) || subtotal < 0) {
    errors.subtotal = "El subtotal debe ser un valor valido";
  }

  if (!Number.isFinite(iva) || iva < 0) {
    errors.iva = "El IVA debe ser un valor valido";
  }

  if (!Number.isFinite(saldo) || saldo < 0) {
    errors.saldo = "El saldo debe ser un valor valido";
  }

  if (Number.isFinite(saldo) && saldo > total) {
    errors.saldo = "El saldo no puede ser mayor al total";
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

  return errors;
}

function buildPayload(
  values: FacturaCompraFormValues,
  total: number
): ContableFacturaCompraMutationInput {
  return {
    numeroFactura: values.numeroFactura.trim(),
    terceroId: values.terceroId,
    fechaFactura: values.fechaFactura,
    fechaVencimiento: values.fechaVencimiento,
    subtotal: parseMoneyValue(values.subtotal),
    iva: parseMoneyValue(values.iva),
    total,
    saldo: parseMoneyValue(values.saldo),
    estado: values.estado,
    observaciones: toOptionalString(values.observaciones),
    soporteUrl: toOptionalString(values.soporteUrl),
  };
}

export default function ContableFacturaCompraNueva() {
  const [isNuevoRoute] = useRoute("/contable/facturas-compra/nuevo");
  const [isEditarRoute, editParams] = useRoute(
    "/contable/facturas-compra/:id/editar"
  );
  const [, setLocation] = useLocation();
  const [form, setForm] = useState<FacturaCompraFormValues>(INITIAL_FORM);
  const [errors, setErrors] = useState<FacturaCompraFormErrors>({});
  const [proveedores, setProveedores] = useState<ContableTercero[]>([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null);
  const [facturaDisponible, setFacturaDisponible] = useState(true);

  const facturaId = isEditarRoute ? editParams?.id : undefined;
  const esEdicion = Boolean(isEditarRoute && facturaId);
  const destinoVolver = "/contable/facturas-compra";

  const subtotalValue = useMemo(() => parseMoneyValue(form.subtotal), [form.subtotal]);
  const ivaValue = useMemo(() => parseMoneyValue(form.iva), [form.iva]);
  const totalCalculado = useMemo(() => {
    const subtotal = Number.isFinite(subtotalValue) ? subtotalValue : 0;
    const iva = Number.isFinite(ivaValue) ? ivaValue : 0;
    return Math.round((subtotal + iva + Number.EPSILON) * 100) / 100;
  }, [ivaValue, subtotalValue]);

  useEffect(() => {
    if (!isNuevoRoute && !isEditarRoute) {
      return;
    }

    const id = facturaId;
    let activo = true;

    async function cargar() {
      setCargando(true);
      setErrors({});
      setErrorGlobal(null);
      setFacturaDisponible(true);

      try {
        const [proveedoresData, factura] = await Promise.all([
          getContableTerceros({ tipo: ContableTerceroTipo.PROVEEDOR }),
          esEdicion && id ? getFacturaCompraById(id) : Promise.resolve(null),
        ]);

        if (!activo) {
          return;
        }

        setProveedores(proveedoresData);

        if (esEdicion) {
          if (!factura) {
            setFacturaDisponible(false);
            setErrorGlobal("La factura de compra solicitada no existe");
            return;
          }

          setForm(toFormValues(factura));
        } else {
          setForm(current => ({
            ...INITIAL_FORM,
            terceroId:
              current.terceroId || proveedoresData[0]?.id || INITIAL_FORM.terceroId,
          }));
        }
      } catch (loadError) {
        if (!activo) {
          return;
        }

        setFacturaDisponible(false);
        setErrorGlobal(
          loadError instanceof Error
            ? loadError.message
            : "No se pudo cargar el formulario de factura"
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
  }, [esEdicion, facturaId, isEditarRoute, isNuevoRoute]);

  if (!isNuevoRoute && !isEditarRoute) {
    return null;
  }

  function updateField<K extends keyof FacturaCompraFormValues>(
    field: K,
    value: FacturaCompraFormValues[K]
  ) {
    setForm(current => ({
      ...current,
      [field]: value,
    }));

    setErrors(current => {
      const next = { ...current };
      delete next[field];
      return next;
    });

    setErrorGlobal(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationErrors = validateForm(form, totalCalculado);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      setErrorGlobal("Revisa los campos obligatorios antes de guardar");
      return;
    }

    setGuardando(true);
    setErrorGlobal(null);

    try {
      const payload = buildPayload(form, totalCalculado);

      if (esEdicion && facturaId) {
        await updateFacturaCompra(facturaId, payload);
      } else {
        await createFacturaCompra(payload);
      }

      toast.success(
        esEdicion
          ? "Factura de compra actualizada"
          : "Factura de compra creada"
      );
      setLocation(destinoVolver);
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "No se pudo guardar la factura de compra";

      setErrorGlobal(message);
      toast.error(message);
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <DashboardLayout
        titulo={esEdicion ? "Editar Factura de Compra" : "Nueva Factura de Compra"}
        descripcion="Cargando informacion de la factura"
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
          <p className="text-muted-foreground">Cargando formulario...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (esEdicion && !facturaDisponible) {
    return (
      <DashboardLayout
        titulo="Editar Factura de Compra"
        descripcion="No fue posible cargar el formulario"
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
            {errorGlobal ?? "La factura de compra solicitada no existe"}
          </p>
          <Button asChild variant="outline">
            <Link href={destinoVolver}>Volver a Facturas de Compra</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      titulo={esEdicion ? "Editar Factura de Compra" : "Nueva Factura de Compra"}
      descripcion={
        esEdicion
          ? "Actualiza la informacion principal de la factura"
          : "Registro base de compras relacionadas con proveedores"
      }
      acciones={
        <Button asChild variant="outline" size="sm" className="gap-2">
          <Link href={destinoVolver}>
            <ArrowLeft size={18} />
            Volver
          </Link>
        </Button>
      }
    >
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
              Esta base queda lista para conectar luego egresos y cartera de proveedores.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="numeroFactura">Numero de factura</Label>
              <Input
                id="numeroFactura"
                value={form.numeroFactura}
                onChange={event =>
                  updateField("numeroFactura", event.target.value)
                }
                placeholder="Numero del documento"
              />
              {errors.numeroFactura && (
                <p className="text-sm text-destructive">{errors.numeroFactura}</p>
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
              <Label htmlFor="fechaFactura">Fecha de factura</Label>
              <Input
                id="fechaFactura"
                type="date"
                value={form.fechaFactura}
                onChange={event => updateField("fechaFactura", event.target.value)}
              />
              {errors.fechaFactura && (
                <p className="text-sm text-destructive">{errors.fechaFactura}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="fechaVencimiento">Fecha de vencimiento</Label>
              <Input
                id="fechaVencimiento"
                type="date"
                value={form.fechaVencimiento}
                onChange={event =>
                  updateField("fechaVencimiento", event.target.value)
                }
              />
              {errors.fechaVencimiento && (
                <p className="text-sm text-destructive">
                  {errors.fechaVencimiento}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="subtotal">Subtotal</Label>
              <Input
                id="subtotal"
                type="number"
                min="0"
                step="0.01"
                value={form.subtotal}
                onChange={event => updateField("subtotal", event.target.value)}
                placeholder="0"
              />
              {errors.subtotal && (
                <p className="text-sm text-destructive">{errors.subtotal}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="iva">IVA</Label>
              <Input
                id="iva"
                type="number"
                min="0"
                step="0.01"
                value={form.iva}
                onChange={event => updateField("iva", event.target.value)}
                placeholder="0"
              />
              {errors.iva && (
                <p className="text-sm text-destructive">{errors.iva}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="totalCalculado">Total</Label>
              <Input
                id="totalCalculado"
                value={formatMoney(totalCalculado)}
                readOnly
                disabled
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="saldo">Saldo</Label>
              <Input
                id="saldo"
                type="number"
                min="0"
                step="0.01"
                value={form.saldo}
                onChange={event => updateField("saldo", event.target.value)}
                placeholder="0"
              />
              {errors.saldo && (
                <p className="text-sm text-destructive">{errors.saldo}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="estado">Estado</Label>
              <Select
                value={form.estado}
                onValueChange={value =>
                  updateField("estado", value as ContableFacturaCompraEstado)
                }
              >
                <SelectTrigger id="estado">
                  <SelectValue placeholder="Selecciona un estado" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(ContableFacturaCompraEstado).map(estado => (
                    <SelectItem key={estado} value={estado}>
                      {formatEstadoLabel(estado)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
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

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="observaciones">Observaciones</Label>
              <Textarea
                id="observaciones"
                value={form.observaciones}
                onChange={event =>
                  updateField("observaciones", event.target.value)
                }
                rows={4}
                placeholder="Comentarios internos o notas sobre la factura"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Button asChild type="button" variant="outline">
            <Link href={destinoVolver}>Cancelar</Link>
          </Button>
          <Button type="submit" className="gap-2" disabled={guardando}>
            <Save size={18} />
            {guardando
              ? "Guardando..."
              : esEdicion
                ? "Actualizar Factura"
                : "Guardar Factura"}
          </Button>
        </div>
      </form>
    </DashboardLayout>
  );
}
