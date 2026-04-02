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
  createContableNotaCredito,
  formatDateOnlyInput,
  type ContableNotaCreditoMutationInput,
} from "@/lib/contable-notas-credito-api";
import { getFacturasCompra } from "@/lib/contable-facturas-compra-api";
import { getContableTerceros } from "@/lib/contable-terceros-api";
import {
  ContableNotaCreditoDocumentoTipo,
  ContableNotaCreditoEstado,
  ContableNotaCreditoTipo,
  ContableTerceroTipo,
  type ContableFacturaCompra,
  type ContableTercero,
} from "@/lib/types";

type NotaCreditoFormValues = {
  numeroNota: string;
  terceroId: string;
  tipo: ContableNotaCreditoTipo;
  fecha: string;
  valor: string;
  motivo: string;
  referenciaDocumento: string;
  observaciones: string;
  estado: ContableNotaCreditoEstado;
  tipoRelacion: ContableNotaCreditoDocumentoTipo | "sin_relacion";
  facturaRelacionadaId: string;
};

type NotaCreditoFormErrors = Partial<Record<keyof NotaCreditoFormValues, string>>;

const SIN_RELACION = "sin_relacion" as const;

function todayInputValue() {
  return formatDateOnlyInput(new Date());
}

const INITIAL_FORM: NotaCreditoFormValues = {
  numeroNota: "",
  terceroId: "",
  tipo: ContableNotaCreditoTipo.CLIENTE,
  fecha: todayInputValue(),
  valor: "0",
  motivo: "",
  referenciaDocumento: "",
  observaciones: "",
  estado: ContableNotaCreditoEstado.BORRADOR,
  tipoRelacion: SIN_RELACION,
  facturaRelacionadaId: "",
};

function formatTipoLabel(tipo: ContableNotaCreditoTipo) {
  return tipo === ContableNotaCreditoTipo.CLIENTE ? "Cliente" : "Proveedor";
}

function formatEstadoLabel(estado: ContableNotaCreditoEstado) {
  switch (estado) {
    case ContableNotaCreditoEstado.BORRADOR:
      return "Borrador";
    case ContableNotaCreditoEstado.EMITIDA:
      return "Emitida";
    case ContableNotaCreditoEstado.APLICADA:
      return "Aplicada";
    case ContableNotaCreditoEstado.ANULADA:
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

function parseMoneyValue(value: string) {
  const normalized = value.replace(/,/g, ".").trim();

  if (!normalized) {
    return 0;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function toOptionalString(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function validateForm(values: NotaCreditoFormValues) {
  const errors: NotaCreditoFormErrors = {};
  const valor = parseMoneyValue(values.valor);

  if (!values.numeroNota.trim()) {
    errors.numeroNota = "El numero de nota es obligatorio";
  }

  if (!values.terceroId.trim()) {
    errors.terceroId = "Debes seleccionar un tercero";
  }

  if (!values.fecha) {
    errors.fecha = "La fecha es obligatoria";
  }

  if (!Number.isFinite(valor) || valor <= 0) {
    errors.valor = "El valor debe ser mayor a cero";
  }

  if (!values.motivo.trim()) {
    errors.motivo = "El motivo es obligatorio";
  }

  if (
    values.tipoRelacion === ContableNotaCreditoDocumentoTipo.FACTURA_COMPRA &&
    !values.facturaRelacionadaId
  ) {
    errors.facturaRelacionadaId = "Debes seleccionar la factura relacionada";
  }

  if (
    values.tipoRelacion !== SIN_RELACION &&
    values.tipoRelacion !== ContableNotaCreditoDocumentoTipo.FACTURA_COMPRA &&
    !values.referenciaDocumento.trim()
  ) {
    errors.referenciaDocumento =
      "Debes registrar la referencia del documento relacionado";
  }

  return errors;
}

function buildPayload(
  values: NotaCreditoFormValues
): ContableNotaCreditoMutationInput {
  return {
    numeroNota: values.numeroNota.trim(),
    terceroId: values.terceroId,
    tipo: values.tipo,
    fecha: values.fecha,
    valor: parseMoneyValue(values.valor),
    motivo: values.motivo.trim(),
    referenciaDocumento: toOptionalString(values.referenciaDocumento),
    observaciones: toOptionalString(values.observaciones),
    estado: values.estado,
    documentoRelacionadoTipo:
      values.tipoRelacion === SIN_RELACION ? undefined : values.tipoRelacion,
    documentoRelacionadoId:
      values.tipoRelacion === ContableNotaCreditoDocumentoTipo.FACTURA_COMPRA
        ? values.facturaRelacionadaId || undefined
        : undefined,
  };
}

export default function ContableNotaCreditoNueva() {
  const [match] = useRoute("/contable/notas-credito/nuevo");
  const [, setLocation] = useLocation();
  const [form, setForm] = useState<NotaCreditoFormValues>(INITIAL_FORM);
  const [errors, setErrors] = useState<NotaCreditoFormErrors>({});
  const [terceros, setTerceros] = useState<ContableTercero[]>([]);
  const [facturasRelacionadas, setFacturasRelacionadas] = useState<
    ContableFacturaCompra[]
  >([]);
  const [cargando, setCargando] = useState(true);
  const [cargandoFacturas, setCargandoFacturas] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null);
  const destinoVolver = "/contable/notas-credito";

  const tercerosDisponibles = useMemo(() => {
    const tipoEsperado =
      form.tipo === ContableNotaCreditoTipo.CLIENTE
        ? ContableTerceroTipo.CLIENTE
        : ContableTerceroTipo.PROVEEDOR;

    return terceros.filter(tercero => tercero.tipoTercero === tipoEsperado);
  }, [form.tipo, terceros]);

  const opcionesRelacion = useMemo(() => {
    if (form.tipo === ContableNotaCreditoTipo.PROVEEDOR) {
      return [
        { value: SIN_RELACION, label: "Sin relacion" },
        {
          value: ContableNotaCreditoDocumentoTipo.FACTURA_COMPRA,
          label: "Factura de compra",
        },
        { value: ContableNotaCreditoDocumentoTipo.OTRO, label: "Otro documento" },
      ];
    }

    return [
      { value: SIN_RELACION, label: "Sin relacion" },
      {
        value: ContableNotaCreditoDocumentoTipo.CUENTA_POR_COBRAR,
        label: "Cuenta por cobrar",
      },
      { value: ContableNotaCreditoDocumentoTipo.OTRO, label: "Otro documento" },
    ];
  }, [form.tipo]);

  const facturaSeleccionada = useMemo(
    () =>
      facturasRelacionadas.find(
        factura => factura.id === form.facturaRelacionadaId
      ) ?? null,
    [facturasRelacionadas, form.facturaRelacionadaId]
  );

  useEffect(() => {
    if (!match) {
      return;
    }

    let activo = true;

    async function cargar() {
      setCargando(true);
      setErrors({});
      setErrorGlobal(null);

      try {
        const tercerosData = await getContableTerceros();

        if (!activo) {
          return;
        }

        const tercerosFiltrados = tercerosData.filter(tercero =>
          [ContableTerceroTipo.CLIENTE, ContableTerceroTipo.PROVEEDOR].includes(
            tercero.tipoTercero
          )
        );

        const primerCliente = tercerosFiltrados.find(
          tercero => tercero.tipoTercero === ContableTerceroTipo.CLIENTE
        );

        setTerceros(tercerosFiltrados);
        setForm(current => ({
          ...current,
          terceroId: current.terceroId || primerCliente?.id || "",
        }));
      } catch (loadError) {
        if (!activo) {
          return;
        }

        setErrorGlobal(
          loadError instanceof Error
            ? loadError.message
            : "No se pudo cargar el formulario de la nota credito"
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
    if (
      form.terceroId &&
      tercerosDisponibles.some(tercero => tercero.id === form.terceroId)
    ) {
      return;
    }

    setForm(current => ({
      ...current,
      terceroId: tercerosDisponibles[0]?.id ?? "",
      facturaRelacionadaId: "",
    }));
  }, [form.terceroId, tercerosDisponibles]);

  useEffect(() => {
    const relacionValida = opcionesRelacion.some(
      option => option.value === form.tipoRelacion
    );

    if (relacionValida) {
      return;
    }

    setForm(current => ({
      ...current,
      tipoRelacion: SIN_RELACION,
      facturaRelacionadaId: "",
      referenciaDocumento: "",
    }));
  }, [form.tipoRelacion, opcionesRelacion]);

  useEffect(() => {
    if (
      form.tipo !== ContableNotaCreditoTipo.PROVEEDOR ||
      form.tipoRelacion !== ContableNotaCreditoDocumentoTipo.FACTURA_COMPRA ||
      !form.terceroId
    ) {
      setFacturasRelacionadas([]);
      setCargandoFacturas(false);

      if (form.facturaRelacionadaId) {
        setForm(current => ({
          ...current,
          facturaRelacionadaId: "",
        }));
      }

      return;
    }

    let activo = true;

    async function cargarFacturas() {
      setCargandoFacturas(true);
      setErrorGlobal(null);

      try {
        const facturas = await getFacturasCompra({ terceroId: form.terceroId });

        if (!activo) {
          return;
        }

        setFacturasRelacionadas(facturas);
      } catch (loadError) {
        if (!activo) {
          return;
        }

        setFacturasRelacionadas([]);
        setErrorGlobal(
          loadError instanceof Error
            ? loadError.message
            : "No se pudieron cargar las facturas relacionadas"
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
  }, [form.terceroId, form.tipo, form.tipoRelacion]);

  if (!match) {
    return null;
  }

  function updateField<K extends keyof NotaCreditoFormValues>(
    field: K,
    value: NotaCreditoFormValues[K]
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

  function handleFacturaRelacionadaChange(facturaId: string) {
    const factura = facturasRelacionadas.find(item => item.id === facturaId);

    setForm(current => ({
      ...current,
      facturaRelacionadaId: facturaId,
      referenciaDocumento:
        factura?.numeroFactura ?? current.referenciaDocumento,
    }));

    setErrors(current => {
      const next = { ...current };
      delete next.facturaRelacionadaId;
      delete next.referenciaDocumento;
      return next;
    });

    setErrorGlobal(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationErrors = validateForm(form);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      setErrorGlobal("Revisa los campos obligatorios antes de guardar");
      return;
    }

    setGuardando(true);
    setErrorGlobal(null);

    try {
      const nota = await createContableNotaCredito(buildPayload(form));
      toast.success("Nota credito creada");
      setLocation(`/contable/notas-credito/${nota.id}`);
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "No se pudo guardar la nota credito";

      setErrorGlobal(message);
      toast.error(message);
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <DashboardLayout
        titulo="Nueva Nota Credito"
        descripcion="Cargando formulario de registro"
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

  return (
    <DashboardLayout
      titulo="Nueva Nota Credito"
      descripcion="Registro contable de ajustes y devoluciones para terceros"
      acciones={
        <Button asChild variant="outline" size="sm" className="gap-2">
          <Link href={destinoVolver}>
            <ArrowLeft size={18} />
            Volver
          </Link>
        </Button>
      }
    >
      {errorGlobal && (
        <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorGlobal}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-foreground">
              Informacion principal
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Define el tercero, la fecha y el valor base de la nota credito.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="numeroNota">Numero de nota</Label>
              <Input
                id="numeroNota"
                value={form.numeroNota}
                onChange={event => updateField("numeroNota", event.target.value)}
                placeholder="NC-0001"
              />
              {errors.numeroNota && (
                <p className="text-sm text-destructive">{errors.numeroNota}</p>
              )}
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
              <Label>Tipo</Label>
              <Select
                value={form.tipo}
                onValueChange={value =>
                  updateField("tipo", value as ContableNotaCreditoTipo)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona el tipo" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(ContableNotaCreditoTipo).map(tipo => (
                    <SelectItem key={tipo} value={tipo}>
                      {formatTipoLabel(tipo)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tercero</Label>
              <Select
                value={form.terceroId || undefined}
                onValueChange={value => updateField("terceroId", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un tercero" />
                </SelectTrigger>
                <SelectContent>
                  {tercerosDisponibles.map(tercero => (
                    <SelectItem key={tercero.id} value={tercero.id}>
                      {tercero.nombreRazonSocial}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.terceroId && (
                <p className="text-sm text-destructive">{errors.terceroId}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="valor">Valor</Label>
              <Input
                id="valor"
                inputMode="decimal"
                value={form.valor}
                onChange={event => updateField("valor", event.target.value)}
                placeholder="0"
              />
              {errors.valor && (
                <p className="text-sm text-destructive">{errors.valor}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Estado</Label>
              <Select
                value={form.estado}
                onValueChange={value =>
                  updateField("estado", value as ContableNotaCreditoEstado)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona el estado" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(ContableNotaCreditoEstado).map(estado => (
                    <SelectItem key={estado} value={estado}>
                      {formatEstadoLabel(estado)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="motivo">Motivo</Label>
              <Textarea
                id="motivo"
                value={form.motivo}
                onChange={event => updateField("motivo", event.target.value)}
                placeholder="Describe la devolucion, descuento o ajuste que origina la nota"
                rows={3}
              />
              {errors.motivo && (
                <p className="text-sm text-destructive">{errors.motivo}</p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-foreground">
              Documento relacionado
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              La nota puede quedar asociada a una factura o documento base para
              cartera futura.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo de relacion</Label>
              <Select
                value={form.tipoRelacion}
                onValueChange={value =>
                  updateField(
                    "tipoRelacion",
                    value as NotaCreditoFormValues["tipoRelacion"]
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una relacion" />
                </SelectTrigger>
                <SelectContent>
                  {opcionesRelacion.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.tipoRelacion ===
              ContableNotaCreditoDocumentoTipo.FACTURA_COMPRA && (
              <div className="space-y-2">
                <Label>Factura de compra relacionada</Label>
                <Select
                  value={form.facturaRelacionadaId || undefined}
                  onValueChange={handleFacturaRelacionadaChange}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        cargandoFacturas
                          ? "Cargando facturas..."
                          : "Selecciona una factura"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {facturasRelacionadas.map(factura => (
                      <SelectItem key={factura.id} value={factura.id}>
                        {factura.numeroFactura}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.facturaRelacionadaId && (
                  <p className="text-sm text-destructive">
                    {errors.facturaRelacionadaId}
                  </p>
                )}
                {facturaSeleccionada && (
                  <p className="text-xs text-muted-foreground">
                    Total relacionado: {formatMoney(facturaSeleccionada.total)}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="referenciaDocumento">Referencia documento</Label>
              <Input
                id="referenciaDocumento"
                value={form.referenciaDocumento}
                onChange={event =>
                  updateField("referenciaDocumento", event.target.value)
                }
                placeholder="Factura, cuenta por cobrar u otra referencia"
              />
              {errors.referenciaDocumento && (
                <p className="text-sm text-destructive">
                  {errors.referenciaDocumento}
                </p>
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
                placeholder="Informacion adicional para seguimiento o auditoria"
                rows={4}
              />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Base preparada para cartera
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Se guardan el documento relacionado y el tercero para aplicar
                cartera en una etapa posterior sin recalcular este registro.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button asChild type="button" variant="outline">
                <Link href={destinoVolver}>Cancelar</Link>
              </Button>
              <Button type="submit" className="gap-2" disabled={guardando}>
                <Save size={18} />
                {guardando ? "Guardando..." : "Guardar Nota"}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </DashboardLayout>
  );
}
