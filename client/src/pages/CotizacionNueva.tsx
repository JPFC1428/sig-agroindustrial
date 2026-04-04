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
  createCotizacion,
  getCotizacionById,
  updateCotizacion,
  type CotizacionMutationInput,
} from "@/lib/cotizaciones-api";
import { getClientes } from "@/lib/clientes-api";
import { getMercadoProductoById } from "@/lib/mercado-api";
import { CotizacionEstado, type Cliente, type Cotizacion } from "@/lib/types";

type CotizacionLineaForm = {
  id: string;
  descripcion: string;
  cantidad: string;
  precioUnitario: string;
  descuento: string;
};

type CotizacionFormValues = {
  clienteId: string;
  fecha: string;
  fechaVencimiento: string;
  estado: CotizacionEstado;
  moneda: Cotizacion["moneda"];
  impuesto: string;
  descuentoGlobal: string;
  condicionesPago: string;
  notas: string;
  lineas: CotizacionLineaForm[];
};

type CotizacionFormErrors = Partial<
  Record<
    | "clienteId"
    | "fecha"
    | "fechaVencimiento"
    | "impuesto"
    | "descuentoGlobal"
    | "condicionesPago"
    | "lineas",
    string
  >
>;

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toIsoDateFromInput(value: string) {
  return `${value}T12:00:00.000Z`;
}

function createEmptyLinea(): CotizacionLineaForm {
  return {
    id: `linea-${Math.random().toString(36).slice(2, 10)}`,
    descripcion: "",
    cantidad: "1",
    precioUnitario: "0",
    descuento: "0",
  };
}

function createLineaFromMercadoProducto(producto: {
  codigo: string;
  nombre: string;
  precio: number;
  descripcion?: string;
}) {
  return {
    id: `linea-${Math.random().toString(36).slice(2, 10)}`,
    cantidad: "1",
    descripcion:
      producto.descripcion?.trim() || `${producto.codigo} - ${producto.nombre}`,
    descuento: "0",
    precioUnitario: String(producto.precio),
  };
}

const INITIAL_FORM: CotizacionFormValues = {
  clienteId: "",
  fecha: toDateInputValue(new Date()),
  fechaVencimiento: toDateInputValue(addDays(new Date(), 15)),
  estado: CotizacionEstado.BORRADOR,
  moneda: "COP",
  impuesto: "0",
  descuentoGlobal: "0",
  condicionesPago: "Pago contra entrega",
  notas: "",
  lineas: [createEmptyLinea()],
};

function createInitialForm(clienteId = ""): CotizacionFormValues {
  return {
    ...INITIAL_FORM,
    clienteId,
    lineas: [createEmptyLinea()],
  };
}

function toOptionalString(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readNumberString(value: string, fallback = 0) {
  const trimmed = value.trim();

  if (!trimmed) {
    return fallback;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function calculateLineaSubtotal(linea: CotizacionLineaForm) {
  const cantidad = readNumberString(linea.cantidad, 0);
  const precioUnitario = readNumberString(linea.precioUnitario, 0);
  const descuento = readNumberString(linea.descuento, 0);

  return Math.round(
    (cantidad * precioUnitario * (1 - descuento / 100) + Number.EPSILON) * 100
  ) / 100;
}

function formatMoney(value: number, moneda: Cotizacion["moneda"]) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: moneda,
    maximumFractionDigits: 0,
  }).format(value);
}

function toFormValues(cotizacion: Cotizacion): CotizacionFormValues {
  return {
    clienteId: cotizacion.clienteId ?? "",
    fecha: toDateInputValue(cotizacion.fecha),
    fechaVencimiento: toDateInputValue(cotizacion.fechaVencimiento),
    estado: cotizacion.estado,
    moneda: cotizacion.moneda,
    impuesto: String(cotizacion.impuesto),
    descuentoGlobal: String(cotizacion.descuentoGlobal ?? 0),
    condicionesPago: cotizacion.condicionesPago,
    notas: cotizacion.notas ?? "",
    lineas:
      cotizacion.lineas.length > 0
        ? cotizacion.lineas.map(linea => ({
            id: linea.id,
            descripcion: linea.descripcion,
            cantidad: String(linea.cantidad),
            precioUnitario: String(linea.precioUnitario),
            descuento: String(linea.descuento),
          }))
        : [createEmptyLinea()],
  };
}

function validateForm(values: CotizacionFormValues) {
  const errors: CotizacionFormErrors = {};

  if (!values.clienteId) {
    errors.clienteId = "Selecciona un cliente";
  }

  if (!values.fecha) {
    errors.fecha = "La fecha es obligatoria";
  }

  if (!values.fechaVencimiento) {
    errors.fechaVencimiento = "La fecha de vencimiento es obligatoria";
  }

  if (
    values.fecha &&
    values.fechaVencimiento &&
    new Date(values.fechaVencimiento).getTime() < new Date(values.fecha).getTime()
  ) {
    errors.fechaVencimiento =
      "La fecha de vencimiento no puede ser anterior a la fecha";
  }

  if (!values.condicionesPago.trim()) {
    errors.condicionesPago = "Las condiciones de pago son obligatorias";
  }

  const impuesto = Number(values.impuesto);
  if (values.impuesto.trim() && (!Number.isFinite(impuesto) || impuesto < 0)) {
    errors.impuesto = "El impuesto debe ser un numero mayor o igual a cero";
  }

  const descuentoGlobal = Number(values.descuentoGlobal);
  if (
    values.descuentoGlobal.trim() &&
    (!Number.isFinite(descuentoGlobal) || descuentoGlobal < 0)
  ) {
    errors.descuentoGlobal =
      "El descuento global debe ser un numero mayor o igual a cero";
  }

  if (values.lineas.length === 0) {
    errors.lineas = "Debes agregar al menos una linea";
  }

  const lineasInvalidas = values.lineas.some(linea => {
    const cantidad = Number(linea.cantidad);
    const precioUnitario = Number(linea.precioUnitario);
    const descuento = Number(linea.descuento);

    return (
      !linea.descripcion.trim() ||
      !Number.isFinite(cantidad) ||
      cantidad <= 0 ||
      !Number.isFinite(precioUnitario) ||
      precioUnitario < 0 ||
      !Number.isFinite(descuento) ||
      descuento < 0 ||
      descuento > 100
    );
  });

  if (lineasInvalidas) {
    errors.lineas =
      "Revisa descripcion, cantidad, precio y descuento en cada linea";
  }

  return errors;
}

function buildPayload(values: CotizacionFormValues): CotizacionMutationInput {
  return {
    clienteId: values.clienteId,
    fecha: toIsoDateFromInput(values.fecha),
    fechaVencimiento: toIsoDateFromInput(values.fechaVencimiento),
    estado: values.estado,
    moneda: values.moneda,
    impuesto: readNumberString(values.impuesto, 0),
    descuentoGlobal: readNumberString(values.descuentoGlobal, 0),
    condicionesPago: values.condicionesPago.trim(),
    notas: toOptionalString(values.notas),
    lineas: values.lineas.map(linea => ({
      descripcion: linea.descripcion.trim(),
      cantidad: readNumberString(linea.cantidad, 0),
      precioUnitario: readNumberString(linea.precioUnitario, 0),
      descuento: readNumberString(linea.descuento, 0),
    })),
  };
}

export default function CotizacionNueva() {
  const [isNuevoRoute] = useRoute("/cotizaciones/nuevo");
  const [isEditarRoute, editParams] = useRoute("/cotizaciones/:id/editar");
  const [, setLocation] = useLocation();
  const clienteIdPreseleccionado =
    typeof window === "undefined"
      ? ""
      : new URLSearchParams(window.location.search).get("clienteId") ?? "";
  const mercadoProductoIdPreseleccionado =
    typeof window === "undefined"
      ? ""
      : new URLSearchParams(window.location.search).get("mercadoProductoId") ?? "";
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [form, setForm] = useState<CotizacionFormValues>(() =>
    createInitialForm(clienteIdPreseleccionado)
  );
  const [errors, setErrors] = useState<CotizacionFormErrors>({});
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null);
  const [cotizacionDisponible, setCotizacionDisponible] = useState(true);

  const cotizacionId = isEditarRoute ? editParams?.id : undefined;
  const esEdicion = Boolean(isEditarRoute && cotizacionId);
  const destinoVolver = "/cotizaciones";

  useEffect(() => {
    if (!isNuevoRoute && !isEditarRoute) {
      return;
    }

    let activo = true;

    async function cargarFormulario() {
      setCargando(true);
      setErrors({});
      setErrorGlobal(null);
      setCotizacionDisponible(true);

      try {
        const [clientesData, cotizacion, mercadoProducto] = await Promise.all([
          getClientes(),
          esEdicion && cotizacionId
            ? getCotizacionById(cotizacionId)
            : Promise.resolve(null),
          !esEdicion && mercadoProductoIdPreseleccionado
            ? getMercadoProductoById(mercadoProductoIdPreseleccionado).catch(
                () => null
              )
            : Promise.resolve(null),
        ]);

        if (!activo) {
          return;
        }

        setClientes(clientesData);

        if (esEdicion && cotizacionId) {
          if (!cotizacion) {
            setCotizacionDisponible(false);
            setErrorGlobal("La cotizacion solicitada no existe");
            return;
          }

          setForm(toFormValues(cotizacion));
        } else {
          const clienteExiste = clientesData.some(
            cliente => cliente.id === clienteIdPreseleccionado
          );
          const nextForm = createInitialForm(
            clienteExiste ? clienteIdPreseleccionado : ""
          );

          if (mercadoProducto) {
            nextForm.lineas = [createLineaFromMercadoProducto(mercadoProducto)];
          }

          setForm(nextForm);
        }
      } catch (loadError) {
        if (!activo) {
          return;
        }

        setCotizacionDisponible(false);
        setErrorGlobal(
          loadError instanceof Error
            ? loadError.message
            : "No se pudo cargar el formulario de cotizaciones"
        );
      } finally {
        if (activo) {
          setCargando(false);
        }
      }
    }

    void cargarFormulario();

    return () => {
      activo = false;
    };
  }, [
    clienteIdPreseleccionado,
    mercadoProductoIdPreseleccionado,
    cotizacionId,
    esEdicion,
    isEditarRoute,
    isNuevoRoute,
  ]);

  const resumen = useMemo(() => {
    const subtotal = form.lineas.reduce(
      (accumulator, linea) => accumulator + calculateLineaSubtotal(linea),
      0
    );
    const impuesto = readNumberString(form.impuesto, 0);
    const descuentoGlobal = readNumberString(form.descuentoGlobal, 0);
    const total = subtotal - descuentoGlobal + impuesto;

    return {
      subtotal,
      impuesto,
      descuentoGlobal,
      total,
    };
  }, [form.descuentoGlobal, form.impuesto, form.lineas]);

  if (!isNuevoRoute && !isEditarRoute) {
    return null;
  }

  function updateField<K extends keyof CotizacionFormValues>(
    field: K,
    value: CotizacionFormValues[K]
  ) {
    setForm(current => ({
      ...current,
      [field]: value,
    }));

    setErrors(current => {
      const next = { ...current };
      delete next[field as keyof CotizacionFormErrors];
      return next;
    });

    setErrorGlobal(null);
  }

  function updateLinea(
    lineaId: string,
    field: keyof Omit<CotizacionLineaForm, "id">,
    value: string
  ) {
    setForm(current => ({
      ...current,
      lineas: current.lineas.map(linea =>
        linea.id === lineaId ? { ...linea, [field]: value } : linea
      ),
    }));

    setErrors(current => {
      const next = { ...current };
      delete next.lineas;
      return next;
    });

    setErrorGlobal(null);
  }

  function addLinea() {
    setForm(current => ({
      ...current,
      lineas: [...current.lineas, createEmptyLinea()],
    }));
    setErrors(current => {
      const next = { ...current };
      delete next.lineas;
      return next;
    });
  }

  function removeLinea(lineaId: string) {
    setForm(current => {
      const nextLineas = current.lineas.filter(linea => linea.id !== lineaId);

      return {
        ...current,
        lineas: nextLineas.length > 0 ? nextLineas : [createEmptyLinea()],
      };
    });
    setErrors(current => {
      const next = { ...current };
      delete next.lineas;
      return next;
    });
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
      const payload = buildPayload(form);

      if (esEdicion && cotizacionId) {
        await updateCotizacion(cotizacionId, payload);
      } else {
        await createCotizacion(payload);
      }

      toast.success(
        esEdicion ? "Cotizacion actualizada" : "Cotizacion creada"
      );
      setLocation("/cotizaciones");
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "No se pudo guardar la cotizacion";

      setErrorGlobal(message);
      toast.error(message);
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <DashboardLayout
        titulo={esEdicion ? "Editar Cotizacion" : "Nueva Cotizacion"}
        descripcion="Cargando formulario"
        acciones={
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href={destinoVolver}>
              <ArrowLeft size={18} />
              Volver
            </Link>
          </Button>
        }
      >
        <div className="text-center py-12">
          <p className="text-muted-foreground">Cargando formulario...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (esEdicion && !cotizacionDisponible) {
    return (
      <DashboardLayout
        titulo="Editar Cotizacion"
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
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            {errorGlobal ?? "La cotizacion solicitada no existe"}
          </p>
          <Button asChild variant="outline">
            <Link href={destinoVolver}>Volver a Cotizaciones</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      titulo={esEdicion ? "Editar Cotizacion" : "Nueva Cotizacion"}
      descripcion={
        esEdicion
          ? "Actualiza la cotizacion seleccionada"
          : "Registro de cotizaciones comerciales para clientes"
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
      <div className="max-w-6xl">
        {errorGlobal && (
          <div className="bg-destructive/10 text-destructive rounded-lg border border-destructive/20 px-4 py-3 mb-6 text-sm">
            {errorGlobal}
          </div>
        )}

        <form onSubmit={event => void handleSubmit(event)}>
          <div className="grid grid-cols-1 xl:grid-cols-[1.7fr_0.9fr] gap-6">
            <div className="bg-card rounded-lg border border-border p-6 shadow-sm space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clienteId">Cliente</Label>
                  <Select
                    value={form.clienteId}
                    onValueChange={value => updateField("clienteId", value)}
                  >
                    <SelectTrigger id="clienteId">
                      <SelectValue placeholder="Selecciona un cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientes.map(cliente => (
                        <SelectItem key={cliente.id} value={cliente.id}>
                          {cliente.nombre} - {cliente.empresa}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.clienteId && (
                    <p className="text-xs text-destructive">
                      {errors.clienteId}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="estado">Estado</Label>
                  <Select
                    value={form.estado}
                    onValueChange={value =>
                      updateField("estado", value as CotizacionEstado)
                    }
                  >
                    <SelectTrigger id="estado">
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(CotizacionEstado).map(estado => (
                        <SelectItem key={estado} value={estado}>
                          {estado.charAt(0).toUpperCase() + estado.slice(1)}
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
                    <p className="text-xs text-destructive">{errors.fecha}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fechaVencimiento">Fecha Vencimiento</Label>
                  <Input
                    id="fechaVencimiento"
                    type="date"
                    value={form.fechaVencimiento}
                    onChange={event =>
                      updateField("fechaVencimiento", event.target.value)
                    }
                  />
                  {errors.fechaVencimiento && (
                    <p className="text-xs text-destructive">
                      {errors.fechaVencimiento}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="moneda">Moneda</Label>
                  <Select
                    value={form.moneda}
                    onValueChange={value =>
                      updateField("moneda", value as Cotizacion["moneda"])
                    }
                  >
                    <SelectTrigger id="moneda">
                      <SelectValue placeholder="Moneda" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="COP">COP</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="impuesto">Impuesto</Label>
                  <Input
                    id="impuesto"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.impuesto}
                    onChange={event =>
                      updateField("impuesto", event.target.value)
                    }
                  />
                  {errors.impuesto && (
                    <p className="text-xs text-destructive">
                      {errors.impuesto}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="descuentoGlobal">Descuento Global</Label>
                  <Input
                    id="descuentoGlobal"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.descuentoGlobal}
                    onChange={event =>
                      updateField("descuentoGlobal", event.target.value)
                    }
                  />
                  {errors.descuentoGlobal && (
                    <p className="text-xs text-destructive">
                      {errors.descuentoGlobal}
                    </p>
                  )}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="condicionesPago">Condiciones de Pago</Label>
                  <Input
                    id="condicionesPago"
                    value={form.condicionesPago}
                    onChange={event =>
                      updateField("condicionesPago", event.target.value)
                    }
                    placeholder="Ej. Pago a 30 dias"
                  />
                  {errors.condicionesPago && (
                    <p className="text-xs text-destructive">
                      {errors.condicionesPago}
                    </p>
                  )}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="notas">Notas</Label>
                  <Textarea
                    id="notas"
                    value={form.notas}
                    onChange={event => updateField("notas", event.target.value)}
                    placeholder="Observaciones adicionales de la cotizacion"
                  />
                </div>
              </div>

              <div className="border-t border-border pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      Lineas de cotizacion
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Agrega productos o servicios con sus valores unitarios.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={addLinea}
                  >
                    <Plus size={16} />
                    Agregar linea
                  </Button>
                </div>

                {errors.lineas && (
                  <div className="bg-destructive/10 text-destructive rounded-lg border border-destructive/20 px-4 py-3 mb-4 text-sm">
                    {errors.lineas}
                  </div>
                )}

                <div className="space-y-4">
                  {form.lineas.map((linea, index) => (
                    <div
                      key={linea.id}
                      className="rounded-lg border border-border p-4"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-foreground">
                          Linea {index + 1}
                        </h3>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => removeLinea(linea.id)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-[2fr_0.8fr_1fr_0.8fr_auto] gap-3 items-end">
                        <div className="space-y-2">
                          <Label>Descripcion</Label>
                          <Input
                            value={linea.descripcion}
                            onChange={event =>
                              updateLinea(
                                linea.id,
                                "descripcion",
                                event.target.value
                              )
                            }
                            placeholder="Producto o servicio"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Cantidad</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={linea.cantidad}
                            onChange={event =>
                              updateLinea(
                                linea.id,
                                "cantidad",
                                event.target.value
                              )
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Precio Unitario</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={linea.precioUnitario}
                            onChange={event =>
                              updateLinea(
                                linea.id,
                                "precioUnitario",
                                event.target.value
                              )
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Descuento %</Label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={linea.descuento}
                            onChange={event =>
                              updateLinea(
                                linea.id,
                                "descuento",
                                event.target.value
                              )
                            }
                          />
                        </div>

                        <div className="rounded-lg bg-accent px-4 py-3 text-sm font-medium text-foreground">
                          {formatMoney(
                            calculateLineaSubtotal(linea),
                            form.moneda
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-card rounded-lg border border-border p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-foreground mb-4">
                  Resumen
                </h2>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium text-foreground">
                      {formatMoney(resumen.subtotal, form.moneda)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Impuesto</span>
                    <span className="font-medium text-foreground">
                      {formatMoney(resumen.impuesto, form.moneda)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Descuento</span>
                    <span className="font-medium text-foreground">
                      {formatMoney(resumen.descuentoGlobal, form.moneda)}
                    </span>
                  </div>
                  <div className="border-t border-border pt-3 flex items-center justify-between">
                    <span className="font-semibold text-foreground">Total</span>
                    <span className="text-lg font-bold text-primary">
                      {formatMoney(resumen.total, form.moneda)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-card rounded-lg border border-border p-6 shadow-sm">
                <div className="flex items-center justify-end gap-3">
                  <Button asChild variant="outline">
                    <Link href={destinoVolver}>Cancelar</Link>
                  </Button>
                  <Button type="submit" className="gap-2" disabled={guardando}>
                    <Save size={16} />
                    {guardando
                      ? esEdicion
                        ? "Guardando..."
                        : "Creando..."
                      : esEdicion
                        ? "Guardar cambios"
                        : "Crear cotizacion"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
