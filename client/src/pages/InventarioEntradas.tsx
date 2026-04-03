import { useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, Plus, Save, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
  createInventarioEntrada,
  getInventarioCompras,
  getInventarioEntradas,
  getInventarioProductos,
} from "@/lib/inventario-api";
import {
  InventarioEntradaOrigenTipo,
  InventarioProductoEstado,
  type InventarioCompra,
  type InventarioEntrada,
  type InventarioProducto,
} from "@/lib/types";

type EntradaItemFormValues = {
  productoId: string;
  compraItemId: string;
  cantidad: string;
  costoUnitario: string;
  serial: string;
};

type EntradaFormValues = {
  fecha: string;
  origenTipo: InventarioEntradaOrigenTipo;
  origenId: string;
  compraId: string;
  bodegaId: string;
  observaciones: string;
  items: EntradaItemFormValues[];
};

const INITIAL_ITEM: EntradaItemFormValues = {
  productoId: "",
  compraItemId: "",
  cantidad: "1",
  costoUnitario: "0",
  serial: "",
};

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const INITIAL_FORM: EntradaFormValues = {
  fecha: formatDateInput(new Date()),
  origenTipo: InventarioEntradaOrigenTipo.MANUAL,
  origenId: "",
  compraId: "",
  bodegaId: "",
  observaciones: "",
  items: [{ ...INITIAL_ITEM }],
};

function formatMoney(value: number) {
  return `$${new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(value)}`;
}

function formatDate(value: Date) {
  return value.toLocaleDateString("es-CO");
}

function formatOrigenLabel(origen: InventarioEntradaOrigenTipo) {
  switch (origen) {
    case InventarioEntradaOrigenTipo.MANUAL:
      return "Manual";
    case InventarioEntradaOrigenTipo.COMPRA:
      return "Compra";
    case InventarioEntradaOrigenTipo.AJUSTE:
      return "Ajuste";
    case InventarioEntradaOrigenTipo.SERTEC:
      return "SERTEC";
    case InventarioEntradaOrigenTipo.COMERCIAL:
      return "Comercial";
    case InventarioEntradaOrigenTipo.TRASLADO:
      return "Traslado";
    case InventarioEntradaOrigenTipo.GARANTIA:
      return "Garantia";
    default:
      return origen;
  }
}

export default function InventarioEntradas() {
  const [compras, setCompras] = useState<InventarioCompra[]>([]);
  const [productos, setProductos] = useState<InventarioProducto[]>([]);
  const [entradas, setEntradas] = useState<InventarioEntrada[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [form, setForm] = useState<EntradaFormValues>(INITIAL_FORM);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const productosById = useMemo(
    () => new Map(productos.map(producto => [producto.id, producto])),
    [productos]
  );

  const compraSeleccionada = useMemo(
    () => compras.find(compra => compra.id === form.compraId) ?? null,
    [compras, form.compraId]
  );

  const entradasFiltradas = useMemo(() => {
    const query = busqueda.trim().toLowerCase();

    if (!query) {
      return entradas;
    }

    return entradas.filter(entrada =>
      [
        entrada.numeroEntrada,
        entrada.compraNumero ?? "",
        entrada.origenTipo,
        entrada.observaciones ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [busqueda, entradas]);

  const totalPreview = useMemo(
    () =>
      form.items.reduce((sum, item) => {
        const cantidad = Number(item.cantidad);
        const costoUnitario = Number(item.costoUnitario);

        if (!Number.isFinite(cantidad) || !Number.isFinite(costoUnitario)) {
          return sum;
        }

        return sum + cantidad * costoUnitario;
      }, 0),
    [form.items]
  );

  async function cargarModulo() {
    setCargando(true);

    try {
      const [entradasData, comprasData, productosData] = await Promise.all([
        getInventarioEntradas(),
        getInventarioCompras(),
        getInventarioProductos({ estado: InventarioProductoEstado.ACTIVO }),
      ]);

      setEntradas(entradasData);
      setCompras(comprasData);
      setProductos(productosData);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudo cargar el modulo de entradas"
      );
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void cargarModulo();
  }, []);

  function updateItem(
    index: number,
    field: keyof EntradaItemFormValues,
    value: string
  ) {
    setForm(current => {
      const items = current.items.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        const updatedItem = { ...item, [field]: value };

        if (field === "compraItemId" && compraSeleccionada) {
          const compraItem =
            compraSeleccionada.items.find(compra => compra.id === value) ?? null;

          if (compraItem) {
            updatedItem.productoId = compraItem.productoId;
            updatedItem.cantidad = String(compraItem.pendienteRecibir);
            updatedItem.costoUnitario = String(compraItem.costoUnitario);
          }
        }

        if (field === "productoId") {
          const producto = productosById.get(value);

          if (producto && !updatedItem.compraItemId) {
            updatedItem.costoUnitario =
              item.costoUnitario === "0" || item.costoUnitario === ""
                ? String(producto.costo)
                : item.costoUnitario;
          }
        }

        return updatedItem;
      });

      return { ...current, items };
    });
  }

  function handleAgregarItem() {
    setForm(current => ({
      ...current,
      items: [...current.items, { ...INITIAL_ITEM }],
    }));
  }

  function handleEliminarItem(index: number) {
    setForm(current => ({
      ...current,
      items:
        current.items.length === 1
          ? [{ ...INITIAL_ITEM }]
          : current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function handleCambiarCompra(compraId: string) {
    setForm(current => ({
      ...current,
      compraId,
      origenTipo: compraId
        ? InventarioEntradaOrigenTipo.COMPRA
        : current.origenTipo,
      items: [{ ...INITIAL_ITEM }],
    }));
  }

  function handleCargarPendientesCompra() {
    if (!compraSeleccionada) {
      toast.error("Selecciona una compra para cargar pendientes");
      return;
    }

    const pendientes = compraSeleccionada.items.filter(
      item => item.pendienteRecibir > 0
    );

    if (pendientes.length === 0) {
      toast.error("La compra seleccionada no tiene cantidades pendientes");
      return;
    }

    setForm(current => ({
      ...current,
      origenTipo: InventarioEntradaOrigenTipo.COMPRA,
      items: pendientes.map(item => ({
        productoId: item.productoId,
        compraItemId: item.id,
        cantidad: String(item.pendienteRecibir),
        costoUnitario: String(item.costoUnitario),
        serial: "",
      })),
    }));
  }

  async function handleRegistrarEntrada() {
    setGuardando(true);
    setError(null);

    try {
      const created = await createInventarioEntrada({
        fecha: form.fecha,
        origenTipo: form.origenTipo,
        origenId: form.origenId.trim() || undefined,
        compraId: form.compraId || undefined,
        bodegaId: form.bodegaId.trim() || undefined,
        observaciones: form.observaciones.trim() || undefined,
        items: form.items.map(item => ({
          productoId: item.productoId,
          compraItemId: item.compraItemId || undefined,
          cantidad: Number(item.cantidad),
          costoUnitario: Number(item.costoUnitario),
          serial: item.serial.trim() || undefined,
        })),
      });

      toast.success("Entrada registrada");
      setForm(INITIAL_FORM);
      setEntradas(current => [created, ...current]);
      await cargarModulo();
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "No se pudo registrar la entrada";

      setError(message);
      toast.error(message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <DashboardLayout
      titulo="Entradas"
      descripcion="Ingreso a inventario con aumento de stock y relacion opcional con compras"
    >
      {error && (
        <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.05fr,1.15fr]">
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-foreground">
              Nueva entrada
            </h2>
            <p className="text-sm text-muted-foreground">
              Aumenta stock en transaccion y deja trazabilidad por origen.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
            <div className="space-y-2">
              <Label htmlFor="fechaEntrada">Fecha</Label>
              <Input
                id="fechaEntrada"
                type="date"
                value={form.fecha}
                onChange={event =>
                  setForm(current => ({ ...current, fecha: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="origenEntrada">Origen</Label>
              <Select
                value={form.origenTipo}
                onValueChange={value =>
                  setForm(current => ({
                    ...current,
                    origenTipo: value as InventarioEntradaOrigenTipo,
                  }))
                }
              >
                <SelectTrigger id="origenEntrada">
                  <SelectValue placeholder="Origen" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(InventarioEntradaOrigenTipo).map(origen => (
                    <SelectItem key={origen} value={origen}>
                      {formatOrigenLabel(origen)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2 xl:col-span-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="compraEntrada">Compra relacionada</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCargarPendientesCompra}
                  className="gap-2"
                >
                  <ArrowDownToLine size={14} />
                  Cargar pendientes
                </Button>
              </div>
              <Select
                value={form.compraId || undefined}
                onValueChange={handleCambiarCompra}
              >
                <SelectTrigger id="compraEntrada">
                  <SelectValue placeholder="Selecciona una compra si aplica" />
                </SelectTrigger>
                <SelectContent>
                  {compras.map(compra => (
                    <SelectItem key={compra.id} value={compra.id}>
                      {compra.numeroCompra} - {compra.proveedorNombreRazonSocial}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="origenIdEntrada">Referencia origen</Label>
              <Input
                id="origenIdEntrada"
                value={form.origenId}
                onChange={event =>
                  setForm(current => ({ ...current, origenId: event.target.value }))
                }
                placeholder="Consecutivo externo, OT o referencia"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bodegaEntrada">Bodega</Label>
              <Input
                id="bodegaEntrada"
                value={form.bodegaId}
                onChange={event =>
                  setForm(current => ({ ...current, bodegaId: event.target.value }))
                }
                placeholder="Preparado para futura fase"
              />
            </div>

            <div className="space-y-2 md:col-span-2 xl:col-span-1">
              <Label htmlFor="observacionesEntrada">Observaciones</Label>
              <Textarea
                id="observacionesEntrada"
                value={form.observaciones}
                onChange={event =>
                  setForm(current => ({
                    ...current,
                    observaciones: event.target.value,
                  }))
                }
                placeholder="Notas del ingreso, recepcion o condicion del material"
                rows={3}
              />
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-border bg-background p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-medium text-foreground">Items de entrada</h3>
                <p className="text-sm text-muted-foreground">
                  Si la entrada viene de una compra, relaciona cada linea con su
                  item pendiente.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={handleAgregarItem}
                className="gap-2"
              >
                <Plus size={16} />
                Agregar item
              </Button>
            </div>

            <div className="space-y-4">
              {form.items.map((item, index) => (
                <div
                  key={`entrada-item-${index}`}
                  className="rounded-lg border border-border bg-card p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">
                      Item {index + 1}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEliminarItem(index)}
                      className="gap-2 text-muted-foreground"
                    >
                      <Trash2 size={14} />
                      Quitar
                    </Button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {compraSeleccionada && (
                      <div className="space-y-2 md:col-span-2">
                        <Label>Item de compra</Label>
                        <Select
                          value={item.compraItemId || undefined}
                          onValueChange={value =>
                            updateItem(index, "compraItemId", value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Relaciona con un item de la compra" />
                          </SelectTrigger>
                          <SelectContent>
                            {compraSeleccionada.items
                              .filter(compraItem => compraItem.pendienteRecibir > 0)
                              .map(compraItem => (
                                <SelectItem key={compraItem.id} value={compraItem.id}>
                                  {compraItem.productoCodigo} -{" "}
                                  {compraItem.productoNombre} / pendiente{" "}
                                  {compraItem.pendienteRecibir}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-2 md:col-span-2">
                      <Label>Producto / Equipo</Label>
                      <Select
                        value={item.productoId || undefined}
                        onValueChange={value =>
                          updateItem(index, "productoId", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un producto" />
                        </SelectTrigger>
                        <SelectContent>
                          {productos.map(producto => (
                            <SelectItem key={producto.id} value={producto.id}>
                              {producto.codigo} - {producto.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Cantidad</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.cantidad}
                        onChange={event =>
                          updateItem(index, "cantidad", event.target.value)
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Costo unitario</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.costoUnitario}
                        onChange={event =>
                          updateItem(index, "costoUnitario", event.target.value)
                        }
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label>Serial</Label>
                      <Input
                        value={item.serial}
                        onChange={event =>
                          updateItem(index, "serial", event.target.value)
                        }
                        placeholder="Serial si el producto lo requiere"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between text-sm">
              <p className="text-muted-foreground">
                {productos.length} productos activos disponibles
              </p>
              <p className="font-semibold text-foreground">
                Costo estimado: {formatMoney(totalPreview)}
              </p>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              type="button"
              onClick={() => void handleRegistrarEntrada()}
              disabled={guardando}
              className="gap-2"
            >
              <Save size={16} />
              {guardando ? "Guardando..." : "Registrar Entrada"}
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <div className="relative">
              <Search
                size={18}
                className="absolute left-3 top-3 text-muted-foreground"
              />
              <Input
                value={busqueda}
                onChange={event => setBusqueda(event.target.value)}
                placeholder="Buscar por entrada, compra, origen u observaciones..."
                className="pl-10"
              />
            </div>

            <div className="mt-4 flex items-center justify-end text-sm text-muted-foreground">
              {cargando
                ? "Cargando entradas..."
                : `${entradasFiltradas.length} entrada${entradasFiltradas.length !== 1 ? "s" : ""}`}
            </div>
          </div>

          <div className="space-y-4">
            {entradasFiltradas.length === 0 ? (
              <div className="rounded-lg border border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground shadow-sm">
                {cargando
                  ? "Cargando entradas..."
                  : "No hay entradas registradas con esos criterios"}
              </div>
            ) : (
              entradasFiltradas.map(entrada => (
                <div
                  key={entrada.id}
                  className="rounded-lg border border-border bg-card p-6 shadow-sm"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">
                        {entrada.numeroEntrada}
                      </h2>
                      <p className="mt-1 text-sm text-foreground">
                        {formatOrigenLabel(entrada.origenTipo)}
                        {entrada.compraNumero ? ` - ${entrada.compraNumero}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(entrada.fecha)}
                        {entrada.bodegaId ? ` - Bodega ${entrada.bodegaId}` : ""}
                      </p>
                    </div>

                    <div className="text-left lg:text-right">
                      <p className="text-sm text-muted-foreground">Costo</p>
                      <p className="text-xl font-semibold text-foreground">
                        {formatMoney(entrada.totalCosto)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {entrada.totalItems} unidades
                      </p>
                    </div>
                  </div>

                  {entrada.observaciones && (
                    <div className="mt-4 rounded-lg border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                      {entrada.observaciones}
                    </div>
                  )}

                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border bg-accent">
                          <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                            Item
                          </th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">
                            Cantidad
                          </th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">
                            Costo
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                            Serial
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {entrada.items.map(item => (
                          <tr key={item.id} className="border-b border-border">
                            <td className="px-4 py-3">
                              <p className="text-sm font-medium text-foreground">
                                {item.productoCodigo} - {item.productoNombre}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {item.compraItemId
                                  ? "Relacionado con item de compra"
                                  : "Entrada manual"}
                              </p>
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-foreground">
                              {item.cantidad}
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-foreground">
                              {formatMoney(item.costoUnitario)}
                            </td>
                            <td className="px-4 py-3 text-sm text-foreground">
                              {item.serial || "Sin serial"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
