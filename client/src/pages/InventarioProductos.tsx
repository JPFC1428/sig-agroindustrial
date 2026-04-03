import { useEffect, useState } from "react";
import { Save, Search } from "lucide-react";
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
import {
  createInventarioProducto,
  getInventarioProductos,
} from "@/lib/inventario-api";
import {
  InventarioProductoEstado,
  InventarioProductoTipoItem,
  type InventarioProducto,
} from "@/lib/types";

type ProductoFormValues = {
  tipoItem: InventarioProductoTipoItem;
  codigo: string;
  nombre: string;
  categoria: string;
  marca: string;
  modelo: string;
  serial: string;
  manejaSerial: "si" | "no";
  unidad: string;
  costo: string;
  precio: string;
  estado: InventarioProductoEstado;
};

const INITIAL_FORM: ProductoFormValues = {
  tipoItem: InventarioProductoTipoItem.PRODUCTO,
  codigo: "",
  nombre: "",
  categoria: "",
  marca: "",
  modelo: "",
  serial: "",
  manejaSerial: "no",
  unidad: "unidad",
  costo: "0",
  precio: "0",
  estado: InventarioProductoEstado.ACTIVO,
};

function formatMoney(value: number) {
  return `$${new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(value)}`;
}

function formatDateTime(value: Date) {
  return value.toLocaleString("es-CO");
}

function formatTipoLabel(tipo: InventarioProductoTipoItem) {
  return tipo === InventarioProductoTipoItem.PRODUCTO ? "Producto" : "Equipo";
}

function formatEstadoLabel(estado: InventarioProductoEstado) {
  switch (estado) {
    case InventarioProductoEstado.ACTIVO:
      return "Activo";
    case InventarioProductoEstado.INACTIVO:
      return "Inactivo";
    case InventarioProductoEstado.DESCONTINUADO:
      return "Descontinuado";
    default:
      return estado;
  }
}

function getEstadoBadge(estado: InventarioProductoEstado) {
  switch (estado) {
    case InventarioProductoEstado.ACTIVO:
      return "bg-emerald-100 text-emerald-800";
    case InventarioProductoEstado.INACTIVO:
      return "bg-amber-100 text-amber-800";
    case InventarioProductoEstado.DESCONTINUADO:
      return "bg-slate-100 text-slate-800";
    default:
      return "bg-slate-100 text-slate-800";
  }
}

export default function InventarioProductos() {
  const [productos, setProductos] = useState<InventarioProducto[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<
    InventarioProductoTipoItem | "todos"
  >("todos");
  const [filtroEstado, setFiltroEstado] = useState<
    InventarioProductoEstado | "todos"
  >("todos");
  const [form, setForm] = useState<ProductoFormValues>(INITIAL_FORM);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cargarProductos() {
    setCargando(true);

    try {
      const data = await getInventarioProductos({
        q: busqueda.trim() || undefined,
        tipoItem: filtroTipo === "todos" ? undefined : filtroTipo,
        estado: filtroEstado === "todos" ? undefined : filtroEstado,
      });

      setProductos(data);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudieron cargar los productos"
      );
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void cargarProductos();
  }, [busqueda, filtroEstado, filtroTipo]);

  async function handleCrearProducto() {
    setGuardando(true);
    setError(null);

    try {
      const created = await createInventarioProducto({
        tipoItem: form.tipoItem,
        codigo: form.codigo,
        nombre: form.nombre,
        categoria: form.categoria,
        marca: form.marca.trim() || undefined,
        modelo: form.modelo.trim() || undefined,
        serial: form.serial.trim() || undefined,
        manejaSerial: form.manejaSerial === "si",
        unidad: form.unidad,
        costo: Number(form.costo),
        precio: Number(form.precio),
        estado: form.estado,
      });

      toast.success("Producto / equipo registrado");
      setForm(INITIAL_FORM);
      setProductos(current => [created, ...current]);
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "No se pudo registrar el producto";

      setError(message);
      toast.error(message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <DashboardLayout
      titulo="Productos / Equipos"
      descripcion="Catalogo inicial para compras, entradas y crecimiento futuro del inventario"
    >
      {error && (
        <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.3fr,1fr]">
        <div className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="relative md:col-span-2">
                <Search
                  size={18}
                  className="absolute left-3 top-3 text-muted-foreground"
                />
                <Input
                  value={busqueda}
                  onChange={event => setBusqueda(event.target.value)}
                  placeholder="Buscar por codigo, nombre, categoria, marca o modelo..."
                  className="pl-10"
                />
              </div>

              <Select
                value={filtroTipo}
                onValueChange={value =>
                  setFiltroTipo(value as InventarioProductoTipoItem | "todos")
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los tipos</SelectItem>
                  {Object.values(InventarioProductoTipoItem).map(tipo => (
                    <SelectItem key={tipo} value={tipo}>
                      {formatTipoLabel(tipo)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filtroEstado}
                onValueChange={value =>
                  setFiltroEstado(value as InventarioProductoEstado | "todos")
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los estados</SelectItem>
                  {Object.values(InventarioProductoEstado).map(estado => (
                    <SelectItem key={estado} value={estado}>
                      {formatEstadoLabel(estado)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <p>
                Queda preparada la referencia futura con SERTEC y Comercial sin
                afectar el catalogo actual.
              </p>
              <p>
                {cargando
                  ? "Cargando catalogo..."
                  : `${productos.length} registro${productos.length !== 1 ? "s" : ""}`}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-accent">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Codigo
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Producto / Equipo
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Categoria
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-foreground">
                      Costo
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-foreground">
                      Precio
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-foreground">
                      Stock
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {productos.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-6 py-10 text-center text-sm text-muted-foreground"
                      >
                        {cargando
                          ? "Cargando productos..."
                          : "No hay productos o equipos registrados con esos filtros"}
                      </td>
                    </tr>
                  ) : (
                    productos.map((producto, index) => (
                      <tr
                        key={producto.id}
                        className={`border-b border-border ${
                          index % 2 === 0 ? "bg-background" : "bg-accent/40"
                        }`}
                      >
                        <td className="px-6 py-4 text-sm font-medium text-foreground">
                          {producto.codigo}
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-foreground">
                            {producto.nombre}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatTipoLabel(producto.tipoItem)}
                            {producto.marca ? ` - ${producto.marca}` : ""}
                            {producto.modelo ? ` / ${producto.modelo}` : ""}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {producto.unidad}
                            {producto.manejaSerial
                              ? ` · Serial${producto.serial ? `: ${producto.serial}` : ""}`
                              : ""}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-sm text-foreground">
                          <p>{producto.categoria}</p>
                          <p className="text-xs text-muted-foreground">
                            Creado: {formatDateTime(producto.createdAt)}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-right text-sm text-foreground">
                          {formatMoney(producto.costo)}
                        </td>
                        <td className="px-6 py-4 text-right text-sm text-foreground">
                          {formatMoney(producto.precio)}
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-medium text-foreground">
                          {producto.stockActual}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getEstadoBadge(producto.estado)}`}
                          >
                            {formatEstadoLabel(producto.estado)}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-foreground">
              Nuevo producto / equipo
            </h2>
            <p className="text-sm text-muted-foreground">
              Base inicial para stock, compras, garantias y futuras integraciones.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
            <div className="space-y-2">
              <Label htmlFor="tipoItemProducto">Tipo</Label>
              <Select
                value={form.tipoItem}
                onValueChange={value =>
                  setForm(current => ({
                    ...current,
                    tipoItem: value as InventarioProductoTipoItem,
                  }))
                }
              >
                <SelectTrigger id="tipoItemProducto">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(InventarioProductoTipoItem).map(tipo => (
                    <SelectItem key={tipo} value={tipo}>
                      {formatTipoLabel(tipo)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="codigoProducto">Codigo</Label>
              <Input
                id="codigoProducto"
                value={form.codigo}
                onChange={event =>
                  setForm(current => ({ ...current, codigo: event.target.value }))
                }
                placeholder="INV-001"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nombreProducto">Nombre</Label>
              <Input
                id="nombreProducto"
                value={form.nombre}
                onChange={event =>
                  setForm(current => ({ ...current, nombre: event.target.value }))
                }
                placeholder="Bomba centrifuga"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoriaProducto">Categoria</Label>
              <Input
                id="categoriaProducto"
                value={form.categoria}
                onChange={event =>
                  setForm(current => ({ ...current, categoria: event.target.value }))
                }
                placeholder="Bombas"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="marcaProducto">Marca</Label>
              <Input
                id="marcaProducto"
                value={form.marca}
                onChange={event =>
                  setForm(current => ({ ...current, marca: event.target.value }))
                }
                placeholder="Marca"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="modeloProducto">Modelo</Label>
              <Input
                id="modeloProducto"
                value={form.modelo}
                onChange={event =>
                  setForm(current => ({ ...current, modelo: event.target.value }))
                }
                placeholder="Modelo"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="serialProducto">Serial</Label>
              <Input
                id="serialProducto"
                value={form.serial}
                onChange={event =>
                  setForm(current => ({ ...current, serial: event.target.value }))
                }
                placeholder="Serial si aplica"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manejaSerialProducto">Maneja serial</Label>
              <Select
                value={form.manejaSerial}
                onValueChange={value =>
                  setForm(current => ({
                    ...current,
                    manejaSerial: value as "si" | "no",
                  }))
                }
              >
                <SelectTrigger id="manejaSerialProducto">
                  <SelectValue placeholder="Maneja serial" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no">No</SelectItem>
                  <SelectItem value="si">Si</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="unidadProducto">Unidad</Label>
              <Input
                id="unidadProducto"
                value={form.unidad}
                onChange={event =>
                  setForm(current => ({ ...current, unidad: event.target.value }))
                }
                placeholder="unidad"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="costoProducto">Costo</Label>
              <Input
                id="costoProducto"
                type="number"
                min="0"
                step="0.01"
                value={form.costo}
                onChange={event =>
                  setForm(current => ({ ...current, costo: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="precioProducto">Precio</Label>
              <Input
                id="precioProducto"
                type="number"
                min="0"
                step="0.01"
                value={form.precio}
                onChange={event =>
                  setForm(current => ({ ...current, precio: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="estadoProducto">Estado</Label>
              <Select
                value={form.estado}
                onValueChange={value =>
                  setForm(current => ({
                    ...current,
                    estado: value as InventarioProductoEstado,
                  }))
                }
              >
                <SelectTrigger id="estadoProducto">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(InventarioProductoEstado).map(estado => (
                    <SelectItem key={estado} value={estado}>
                      {formatEstadoLabel(estado)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              type="button"
              onClick={() => void handleCrearProducto()}
              disabled={guardando}
              className="gap-2"
            >
              <Save size={16} />
              {guardando ? "Guardando..." : "Registrar Producto"}
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
