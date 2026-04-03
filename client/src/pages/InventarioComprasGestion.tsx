import { useEffect, useMemo, useState } from "react";
import { Plus, Save, Search, Trash2 } from "lucide-react";
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
  createInventarioCompra,
  getInventarioCompras,
  getInventarioProductos,
  getInventarioProveedores,
} from "@/lib/inventario-api";
import {
  ContableTerceroEstado,
  InventarioProductoEstado,
  type ContableTercero,
  type InventarioCompra,
  type InventarioProducto,
} from "@/lib/types";

type CompraItemFormValues = {
  productoId: string;
  descripcion: string;
  cantidad: string;
  costoUnitario: string;
};

type CompraFormValues = {
  proveedorId: string;
  fecha: string;
  observaciones: string;
  items: CompraItemFormValues[];
};

const INITIAL_ITEM: CompraItemFormValues = {
  productoId: "",
  descripcion: "",
  cantidad: "1",
  costoUnitario: "0",
};

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const INITIAL_FORM: CompraFormValues = {
  proveedorId: "",
  fecha: formatDateInput(new Date()),
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

function formatEstadoLabel(estado: InventarioCompra["estado"]) {
  switch (estado) {
    case "registrada":
      return "Registrada";
    case "parcial":
      return "Parcial";
    case "recibida":
      return "Recibida";
    case "anulada":
      return "Anulada";
    default:
      return estado;
  }
}

function getEstadoBadge(estado: InventarioCompra["estado"]) {
  switch (estado) {
    case "registrada":
      return "bg-blue-100 text-blue-800";
    case "parcial":
      return "bg-amber-100 text-amber-800";
    case "recibida":
      return "bg-emerald-100 text-emerald-800";
    case "anulada":
      return "bg-slate-100 text-slate-800";
    default:
      return "bg-slate-100 text-slate-800";
  }
}

export default function InventarioComprasGestion() {
  const [proveedores, setProveedores] = useState<ContableTercero[]>([]);
  const [productos, setProductos] = useState<InventarioProducto[]>([]);
  const [compras, setCompras] = useState<InventarioCompra[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [form, setForm] = useState<CompraFormValues>(INITIAL_FORM);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const productosById = useMemo(
    () => new Map(productos.map(producto => [producto.id, producto])),
    [productos]
  );

  const comprasFiltradas = useMemo(() => {
    const query = busqueda.trim().toLowerCase();

    if (!query) {
      return compras;
    }

    return compras.filter(compra => {
      const fullText = [
        compra.numeroCompra,
        compra.proveedorNombreRazonSocial,
        compra.proveedorDocumentoNit,
        compra.observaciones ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return fullText.includes(query);
    });
  }, [busqueda, compras]);

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
      const [comprasData, proveedoresData, productosData] = await Promise.all([
        getInventarioCompras(),
        getInventarioProveedores({ estado: ContableTerceroEstado.ACTIVO }),
        getInventarioProductos({ estado: InventarioProductoEstado.ACTIVO }),
      ]);

      setCompras(comprasData);
      setProveedores(proveedoresData);
      setProductos(productosData);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudo cargar el modulo de compras"
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
    field: keyof CompraItemFormValues,
    value: string
  ) {
    setForm(current => {
      const items = current.items.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        const updatedItem = { ...item, [field]: value };

        if (field === "productoId") {
          const producto = productosById.get(value);

          if (producto) {
            updatedItem.descripcion =
              updatedItem.descripcion || `${producto.codigo} - ${producto.nombre}`;
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

  async function handleRegistrarCompra() {
    setGuardando(true);
    setError(null);

    try {
      const created = await createInventarioCompra({
        proveedorId: form.proveedorId,
        fecha: form.fecha,
        observaciones: form.observaciones.trim() || undefined,
        items: form.items.map(item => ({
          productoId: item.productoId,
          descripcion: item.descripcion.trim() || undefined,
          cantidad: Number(item.cantidad),
          costoUnitario: Number(item.costoUnitario),
        })),
      });

      toast.success("Compra registrada");
      setForm(INITIAL_FORM);
      setCompras(current => [created, ...current]);
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "No se pudo registrar la compra";

      setError(message);
      toast.error(message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <DashboardLayout
      titulo="Compras"
      descripcion="Registro de compras por proveedor con items reutilizando productos del catalogo"
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
              Nueva compra
            </h2>
            <p className="text-sm text-muted-foreground">
              La compra se registra sin mover stock. El ingreso real ocurre en
              Entradas.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
            <div className="space-y-2">
              <Label htmlFor="proveedorCompra">Proveedor</Label>
              <Select
                value={form.proveedorId || undefined}
                onValueChange={value =>
                  setForm(current => ({ ...current, proveedorId: value }))
                }
              >
                <SelectTrigger id="proveedorCompra">
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="fechaCompra">Fecha</Label>
              <Input
                id="fechaCompra"
                type="date"
                value={form.fecha}
                onChange={event =>
                  setForm(current => ({ ...current, fecha: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2 md:col-span-2 xl:col-span-1">
              <Label htmlFor="observacionesCompra">Observaciones</Label>
              <Textarea
                id="observacionesCompra"
                value={form.observaciones}
                onChange={event =>
                  setForm(current => ({
                    ...current,
                    observaciones: event.target.value,
                  }))
                }
                placeholder="Condiciones, referencia del proveedor o notas de la compra"
                rows={3}
              />
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-border bg-background p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-medium text-foreground">Items comprados</h3>
                <p className="text-sm text-muted-foreground">
                  Usa productos existentes para no duplicar catalogo.
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
                  key={`compra-item-${index}`}
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

                    <div className="space-y-2 md:col-span-2">
                      <Label>Descripcion</Label>
                      <Input
                        value={item.descripcion}
                        onChange={event =>
                          updateItem(index, "descripcion", event.target.value)
                        }
                        placeholder="Descripcion operativa del item"
                      />
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
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between text-sm">
              <p className="text-muted-foreground">
                {productos.length} productos activos disponibles
              </p>
              <p className="font-semibold text-foreground">
                Total estimado: {formatMoney(totalPreview)}
              </p>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              type="button"
              onClick={() => void handleRegistrarCompra()}
              disabled={guardando}
              className="gap-2"
            >
              <Save size={16} />
              {guardando ? "Guardando..." : "Registrar Compra"}
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
                placeholder="Buscar por compra, proveedor, NIT u observaciones..."
                className="pl-10"
              />
            </div>

            <div className="mt-4 flex items-center justify-end text-sm text-muted-foreground">
              {cargando
                ? "Cargando compras..."
                : `${comprasFiltradas.length} compra${comprasFiltradas.length !== 1 ? "s" : ""}`}
            </div>
          </div>

          <div className="space-y-4">
            {comprasFiltradas.length === 0 ? (
              <div className="rounded-lg border border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground shadow-sm">
                {cargando
                  ? "Cargando compras..."
                  : "No hay compras registradas con esos criterios"}
              </div>
            ) : (
              comprasFiltradas.map(compra => (
                <div
                  key={compra.id}
                  className="rounded-lg border border-border bg-card p-6 shadow-sm"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="text-lg font-semibold text-foreground">
                          {compra.numeroCompra}
                        </h2>
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getEstadoBadge(compra.estado)}`}
                        >
                          {formatEstadoLabel(compra.estado)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-foreground">
                        {compra.proveedorNombreRazonSocial}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {compra.proveedorDocumentoNit} - {formatDate(compra.fecha)}
                      </p>
                    </div>

                    <div className="text-left lg:text-right">
                      <p className="text-sm text-muted-foreground">Total</p>
                      <p className="text-xl font-semibold text-foreground">
                        {formatMoney(compra.total)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {compra.items.length} item
                        {compra.items.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>

                  {compra.observaciones && (
                    <div className="mt-4 rounded-lg border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                      {compra.observaciones}
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
                          <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">
                            Pendiente
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {compra.items.map(item => (
                          <tr key={item.id} className="border-b border-border">
                            <td className="px-4 py-3">
                              <p className="text-sm font-medium text-foreground">
                                {item.productoCodigo} - {item.productoNombre}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {item.descripcion}
                              </p>
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-foreground">
                              {item.cantidad}
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-foreground">
                              {formatMoney(item.costoUnitario)}
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-foreground">
                              {item.pendienteRecibir}
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
