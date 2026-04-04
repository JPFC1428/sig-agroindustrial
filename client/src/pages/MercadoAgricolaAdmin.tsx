import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import {
  Eye,
  EyeOff,
  Image as ImageIcon,
  Package,
  Plus,
  Save,
  Store,
} from "lucide-react";
import { Link } from "wouter";
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
  createMercadoProducto,
  getMercadoBootstrapData,
  updateMercadoProducto,
} from "@/lib/mercado-api";
import {
  MercadoDisponibilidadTipo,
  type InventarioProducto,
  type MercadoBootstrapData,
} from "@/lib/types";

type MercadoFormState = {
  categoria: string;
  descripcion: string;
  imagenUrl: string;
  marca: string;
  nombre: string;
  precio: string;
  stockActual: string;
  tipoDisponibilidad: MercadoDisponibilidadTipo;
  visibleEnMercado: boolean;
};

const EMPTY_FORM: MercadoFormState = {
  categoria: "",
  descripcion: "",
  imagenUrl: "",
  marca: "",
  nombre: "",
  precio: "0",
  stockActual: "0",
  tipoDisponibilidad: MercadoDisponibilidadTipo.STOCK,
  visibleEnMercado: true,
};

const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDisponibilidadLabel(tipo: MercadoDisponibilidadTipo) {
  return tipo === MercadoDisponibilidadTipo.STOCK ? "En stock" : "Bajo pedido";
}

function getDisponibilidadBadge(tipo: MercadoDisponibilidadTipo) {
  return tipo === MercadoDisponibilidadTipo.STOCK
    ? "bg-emerald-100 text-emerald-800"
    : "bg-amber-100 text-amber-800";
}

function buildForm(producto?: InventarioProducto | null): MercadoFormState {
  if (!producto) {
    return EMPTY_FORM;
  }

  return {
    categoria: producto.categoria,
    descripcion: producto.descripcion ?? "",
    imagenUrl: producto.imagenUrl ?? "",
    marca: producto.marca ?? "",
    nombre: producto.nombre,
    precio: String(producto.precio),
    stockActual: String(producto.stockActual),
    tipoDisponibilidad: producto.tipoDisponibilidad,
    visibleEnMercado: producto.visibleEnMercado,
  };
}

function readImageFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  });
}

function MercadoAdminProductCard({
  active,
  onSelect,
  producto,
}: {
  active: boolean;
  onSelect: () => void;
  producto: InventarioProducto;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`overflow-hidden rounded-lg border text-left shadow-sm transition-smooth ${
        active
          ? "border-primary/30 bg-primary/5"
          : "border-border bg-card hover:border-primary/20 hover:bg-accent"
      }`}
    >
      <div className="flex h-32 items-center justify-center border-b border-border bg-muted/40">
        {producto.imagenUrl ? (
          <img
            src={producto.imagenUrl}
            alt={producto.nombre}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <ImageIcon size={22} />
            <span className="text-xs">Sin imagen</span>
          </div>
        )}
      </div>

      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {producto.nombre}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {producto.codigo} | {producto.categoria}
            </p>
          </div>
          <span
            className={`rounded-full px-2 py-1 text-[11px] font-semibold ${getDisponibilidadBadge(
              producto.tipoDisponibilidad
            )}`}
          >
            {formatDisponibilidadLabel(producto.tipoDisponibilidad)}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{formatMoney(producto.precio)}</span>
          <span>
            {producto.stockActual} {producto.unidad}
          </span>
        </div>

        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          {producto.visibleEnMercado ? (
            <span className="inline-flex items-center gap-1">
              <Eye size={12} />
              Visible
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <EyeOff size={12} />
              Oculto
            </span>
          )}

          <span className="capitalize">{producto.estado}</span>
        </div>
      </div>
    </button>
  );
}

export default function MercadoAgricolaAdmin() {
  const [data, setData] = useState<MercadoBootstrapData | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<MercadoFormState>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<MercadoFormState>(EMPTY_FORM);
  const [search, setSearch] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState<
    "todos" | "visibles" | "ocultos"
  >("todos");
  const [loading, setLoading] = useState(true);
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [uploadingCreateImage, setUploadingCreateImage] = useState(false);
  const [uploadingEditImage, setUploadingEditImage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadMercado(showLoader = false) {
    if (showLoader) {
      setLoading(true);
    }

    try {
      const nextData = await getMercadoBootstrapData();
      setData(nextData);
      setError(null);
      setSelectedProductId(currentSelected => {
        if (
          currentSelected &&
          nextData.productos.some(producto => producto.id === currentSelected)
        ) {
          return currentSelected;
        }

        return nextData.productos[0]?.id ?? null;
      });
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudo cargar la administracion del mercado"
      );
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    void loadMercado(true);
  }, []);

  const filteredProducts = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();

    return (data?.productos ?? []).filter(producto => {
      const matchesSearch =
        searchTerm.length === 0 ||
        [
          producto.codigo,
          producto.nombre,
          producto.categoria,
          producto.marca,
          producto.descripcion,
        ]
          .filter(Boolean)
          .some(value => String(value).toLowerCase().includes(searchTerm));
      const matchesVisibility =
        visibilityFilter === "todos" ||
        (visibilityFilter === "visibles" && producto.visibleEnMercado) ||
        (visibilityFilter === "ocultos" && !producto.visibleEnMercado);

      return matchesSearch && matchesVisibility;
    });
  }, [data?.productos, search, visibilityFilter]);

  const selectedProduct =
    filteredProducts.find(producto => producto.id === selectedProductId) ??
    data?.productos.find(producto => producto.id === selectedProductId) ??
    null;

  useEffect(() => {
    if (!selectedProduct) {
      setEditForm(EMPTY_FORM);
      return;
    }

    setEditForm(buildForm(selectedProduct));
  }, [selectedProduct]);

  useEffect(() => {
    if (
      selectedProductId &&
      filteredProducts.some(producto => producto.id === selectedProductId)
    ) {
      return;
    }

    setSelectedProductId(filteredProducts[0]?.id ?? null);
  }, [filteredProducts, selectedProductId]);

  async function handleImageUpload(
    event: ChangeEvent<HTMLInputElement>,
    target: "create" | "edit"
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Selecciona un archivo de imagen valido");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      toast.error("La imagen no puede superar 2 MB");
      event.target.value = "";
      return;
    }

    try {
      if (target === "create") {
        setUploadingCreateImage(true);
      } else {
        setUploadingEditImage(true);
      }

      const dataUrl = await readImageFileAsDataUrl(file);

      if (target === "create") {
        setCreateForm(current => ({ ...current, imagenUrl: dataUrl }));
      } else {
        setEditForm(current => ({ ...current, imagenUrl: dataUrl }));
      }

      toast.success("Imagen cargada en el articulo");
    } catch (uploadError) {
      toast.error(
        uploadError instanceof Error
          ? uploadError.message
          : "No se pudo cargar la imagen"
      );
    } finally {
      if (target === "create") {
        setUploadingCreateImage(false);
      } else {
        setUploadingEditImage(false);
      }

      event.target.value = "";
    }
  }

  async function handleCreateProduct() {
    setSavingCreate(true);
    setError(null);

    try {
      const created = await createMercadoProducto({
        categoria: createForm.categoria.trim(),
        descripcion: createForm.descripcion.trim() || undefined,
        imagenUrl: createForm.imagenUrl.trim() || undefined,
        marca: createForm.marca.trim() || undefined,
        nombre: createForm.nombre.trim(),
        precio: Number(createForm.precio),
        stockActual: Number(createForm.stockActual),
        stockInicial: Number(createForm.stockActual),
        tipoDisponibilidad: createForm.tipoDisponibilidad,
        visibleEnMercado: createForm.visibleEnMercado,
      });

      setData(currentData => {
        if (!currentData) {
          return currentData;
        }

        return {
          ...currentData,
          productos: [created, ...currentData.productos],
        };
      });
      setCreateForm(EMPTY_FORM);
      setSelectedProductId(created.id);
      toast.success("Articulo creado en mercado e inventario");
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "No se pudo crear el articulo";

      setError(message);
      toast.error(message);
    } finally {
      setSavingCreate(false);
    }
  }

  async function handleUpdateProduct() {
    if (!selectedProduct) {
      return;
    }

    setSavingUpdate(true);
    setError(null);

    try {
      const updated = await updateMercadoProducto(selectedProduct.id, {
        categoria: editForm.categoria.trim(),
        descripcion: editForm.descripcion.trim() || undefined,
        imagenUrl: editForm.imagenUrl.trim() || undefined,
        marca: editForm.marca.trim() || undefined,
        nombre: editForm.nombre.trim(),
        precio: Number(editForm.precio),
        stockActual: Number(editForm.stockActual),
        tipoDisponibilidad: editForm.tipoDisponibilidad,
        visibleEnMercado: editForm.visibleEnMercado,
      });

      setData(currentData => {
        if (!currentData) {
          return currentData;
        }

        return {
          ...currentData,
          productos: currentData.productos.map(producto =>
            producto.id === updated.id ? updated : producto
          ),
        };
      });
      setSelectedProductId(updated.id);
      toast.success("Articulo actualizado");
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "No se pudo actualizar el articulo";

      setError(message);
      toast.error(message);
    } finally {
      setSavingUpdate(false);
    }
  }

  return (
    <DashboardLayout
      titulo="Mercado Agricola / Administracion"
      descripcion="Gestion real de articulos publicados en el mercado agricola reutilizando inventario_productos"
    >
      {error && (
        <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mb-6 rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              Cada articulo del mercado es el mismo registro del inventario. Aqui
              controlas nombre comercial, precio, imagen, stock y visibilidad sin
              duplicar productos.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/mercado-agricola">Ver catalogo cliente</Link>
          </Button>
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-foreground">Nuevo articulo</h2>
          <p className="text-sm text-muted-foreground">
            Crea el producto en inventario y dejalo listo para publicarse en el
            mercado agricola.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="mercado-create-nombre">Nombre</Label>
            <Input
              id="mercado-create-nombre"
              value={createForm.nombre}
              onChange={event =>
                setCreateForm(current => ({ ...current, nombre: event.target.value }))
              }
              placeholder="Nombre del articulo"
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="mercado-create-categoria">Categoria</Label>
            <Input
              id="mercado-create-categoria"
              value={createForm.categoria}
              onChange={event =>
                setCreateForm(current => ({
                  ...current,
                  categoria: event.target.value,
                }))
              }
              placeholder="Categoria comercial"
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="mercado-create-marca">Marca</Label>
            <Input
              id="mercado-create-marca"
              value={createForm.marca}
              onChange={event =>
                setCreateForm(current => ({ ...current, marca: event.target.value }))
              }
              placeholder="Marca del articulo"
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="mercado-create-precio">Precio</Label>
            <Input
              id="mercado-create-precio"
              type="number"
              min="0"
              step="0.01"
              value={createForm.precio}
              onChange={event =>
                setCreateForm(current => ({ ...current, precio: event.target.value }))
              }
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="mercado-create-stock">Stock inicial</Label>
            <Input
              id="mercado-create-stock"
              type="number"
              min="0"
              step="0.01"
              value={createForm.stockActual}
              onChange={event =>
                setCreateForm(current => ({
                  ...current,
                  stockActual: event.target.value,
                }))
              }
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="mercado-create-disponibilidad">
              Tipo de disponibilidad
            </Label>
            <Select
              value={createForm.tipoDisponibilidad}
              onValueChange={value =>
                setCreateForm(current => ({
                  ...current,
                  tipoDisponibilidad: value as MercadoDisponibilidadTipo,
                }))
              }
            >
              <SelectTrigger id="mercado-create-disponibilidad" className="mt-2">
                <SelectValue placeholder="Selecciona disponibilidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={MercadoDisponibilidadTipo.STOCK}>
                  En stock
                </SelectItem>
                <SelectItem value={MercadoDisponibilidadTipo.BAJO_PEDIDO}>
                  Bajo pedido
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="mercado-create-imagen-url">URL de imagen</Label>
            <Input
              id="mercado-create-imagen-url"
              value={createForm.imagenUrl}
              onChange={event =>
                setCreateForm(current => ({
                  ...current,
                  imagenUrl: event.target.value,
                }))
              }
              placeholder="https://..."
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="mercado-create-imagen-file">Subir imagen</Label>
            <Input
              id="mercado-create-imagen-file"
              type="file"
              accept="image/*"
              onChange={event => void handleImageUpload(event, "create")}
              className="mt-2"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              JPG, PNG o WEBP. Maximo 2 MB. Se guarda como `image_url`.
            </p>
          </div>
        </div>

        <div className="mt-4">
          <Label htmlFor="mercado-create-descripcion">Descripcion</Label>
          <Textarea
            id="mercado-create-descripcion"
            value={createForm.descripcion}
            onChange={event =>
              setCreateForm(current => ({
                ...current,
                descripcion: event.target.value,
              }))
            }
            placeholder="Resumen claro del producto, usos y beneficios..."
            className="mt-2 min-h-28"
          />
        </div>

        <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              Visible en mercado
            </p>
            <p className="text-xs text-muted-foreground">
              Si esta activo, el articulo aparece en el catalogo cliente.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={createForm.visibleEnMercado}
              onChange={event =>
                setCreateForm(current => ({
                  ...current,
                  visibleEnMercado: event.target.checked,
                }))
              }
            />
            {createForm.visibleEnMercado ? "Visible" : "Oculto"}
          </label>
        </div>

        <div className="mt-5 flex justify-end">
          <Button
            type="button"
            onClick={() => void handleCreateProduct()}
            disabled={savingCreate || uploadingCreateImage}
            className="gap-2"
          >
            <Plus size={16} />
            {savingCreate
              ? "Creando..."
              : uploadingCreateImage
                ? "Procesando imagen..."
                : "Crear articulo"}
          </Button>
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[1.4fr,220px]">
          <div>
            <Label htmlFor="mercado-search">Buscar articulo</Label>
            <Input
              id="mercado-search"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Buscar por codigo, nombre, categoria o marca..."
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="mercado-visibilidad">Visibilidad</Label>
            <Select
              value={visibilityFilter}
              onValueChange={value =>
                setVisibilityFilter(value as "todos" | "visibles" | "ocultos")
              }
            >
              <SelectTrigger id="mercado-visibilidad" className="mt-2">
                <SelectValue placeholder="Filtrar visibilidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="visibles">Solo visibles</SelectItem>
                <SelectItem value="ocultos">Solo ocultos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <p>Los articulos siguen conectados al stock real del inventario.</p>
          <p>{filteredProducts.length} articulo(s) en la vista actual</p>
        </div>
      </div>

      {loading ? (
        <div className="rounded-lg border border-border bg-card px-6 py-12 text-center text-muted-foreground shadow-sm">
          Cargando administracion del mercado...
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.2fr,1fr]">
          <section className="space-y-4">
            {filteredProducts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center shadow-sm">
                <Store size={28} className="mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No hay articulos con los filtros actuales.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {filteredProducts.map(producto => (
                  <MercadoAdminProductCard
                    key={producto.id}
                    active={producto.id === selectedProduct?.id}
                    onSelect={() => setSelectedProductId(producto.id)}
                    producto={producto}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-6">
            {selectedProduct ? (
              <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">
                      Editar articulo
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Actualiza contenido comercial y stock del articulo
                      seleccionado.
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${getDisponibilidadBadge(
                      editForm.tipoDisponibilidad
                    )}`}
                  >
                    {formatDisponibilidadLabel(editForm.tipoDisponibilidad)}
                  </span>
                </div>

                <div className="mb-5 flex h-48 items-center justify-center rounded-lg border border-border bg-muted/40">
                  {editForm.imagenUrl ? (
                    <img
                      src={editForm.imagenUrl}
                      alt={selectedProduct.nombre}
                      className="h-full w-full rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Package size={28} />
                      <span className="text-sm">Sin imagen comercial</span>
                    </div>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="mercado-edit-nombre">Nombre</Label>
                    <Input
                      id="mercado-edit-nombre"
                      value={editForm.nombre}
                      onChange={event =>
                        setEditForm(current => ({
                          ...current,
                          nombre: event.target.value,
                        }))
                      }
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label htmlFor="mercado-edit-categoria">Categoria</Label>
                    <Input
                      id="mercado-edit-categoria"
                      value={editForm.categoria}
                      onChange={event =>
                        setEditForm(current => ({
                          ...current,
                          categoria: event.target.value,
                        }))
                      }
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label htmlFor="mercado-edit-marca">Marca</Label>
                    <Input
                      id="mercado-edit-marca"
                      value={editForm.marca}
                      onChange={event =>
                        setEditForm(current => ({
                          ...current,
                          marca: event.target.value,
                        }))
                      }
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label htmlFor="mercado-edit-precio">Precio</Label>
                    <Input
                      id="mercado-edit-precio"
                      type="number"
                      min="0"
                      step="0.01"
                      value={editForm.precio}
                      onChange={event =>
                        setEditForm(current => ({
                          ...current,
                          precio: event.target.value,
                        }))
                      }
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label htmlFor="mercado-edit-stock">Stock actual</Label>
                    <Input
                      id="mercado-edit-stock"
                      type="number"
                      min="0"
                      step="0.01"
                      value={editForm.stockActual}
                      onChange={event =>
                        setEditForm(current => ({
                          ...current,
                          stockActual: event.target.value,
                        }))
                      }
                      className="mt-2"
                    />
                    <p className="mt-2 text-xs text-muted-foreground">
                      Este campo actualiza el stock actual del inventario. Los
                      movimientos posteriores deben seguir entrando por
                      Inventario / Compras.
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="mercado-edit-disponibilidad">
                      Tipo de disponibilidad
                    </Label>
                    <Select
                      value={editForm.tipoDisponibilidad}
                      onValueChange={value =>
                        setEditForm(current => ({
                          ...current,
                          tipoDisponibilidad: value as MercadoDisponibilidadTipo,
                        }))
                      }
                    >
                      <SelectTrigger
                        id="mercado-edit-disponibilidad"
                        className="mt-2"
                      >
                        <SelectValue placeholder="Selecciona disponibilidad" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={MercadoDisponibilidadTipo.STOCK}>
                          En stock
                        </SelectItem>
                        <SelectItem value={MercadoDisponibilidadTipo.BAJO_PEDIDO}>
                          Bajo pedido
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="mercado-edit-imagen-url">URL de imagen</Label>
                    <Input
                      id="mercado-edit-imagen-url"
                      value={editForm.imagenUrl}
                      onChange={event =>
                        setEditForm(current => ({
                          ...current,
                          imagenUrl: event.target.value,
                        }))
                      }
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label htmlFor="mercado-edit-imagen-file">Subir imagen</Label>
                    <Input
                      id="mercado-edit-imagen-file"
                      type="file"
                      accept="image/*"
                      onChange={event => void handleImageUpload(event, "edit")}
                      className="mt-2"
                    />
                    <p className="mt-2 text-xs text-muted-foreground">
                      JPG, PNG o WEBP. Maximo 2 MB.
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <Label htmlFor="mercado-edit-descripcion">Descripcion</Label>
                  <Textarea
                    id="mercado-edit-descripcion"
                    value={editForm.descripcion}
                    onChange={event =>
                      setEditForm(current => ({
                        ...current,
                        descripcion: event.target.value,
                      }))
                    }
                    className="mt-2 min-h-28"
                  />
                </div>

                <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Visible en mercado
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Controla si el articulo aparece en el catalogo cliente.
                    </p>
                  </div>

                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={editForm.visibleEnMercado}
                      onChange={event =>
                        setEditForm(current => ({
                          ...current,
                          visibleEnMercado: event.target.checked,
                        }))
                      }
                    />
                    {editForm.visibleEnMercado ? "Visible" : "Oculto"}
                  </label>
                </div>

                <div className="mt-5 flex justify-end">
                  <Button
                    type="button"
                    onClick={() => void handleUpdateProduct()}
                    disabled={savingUpdate || uploadingEditImage}
                    className="gap-2"
                  >
                    <Save size={16} />
                    {savingUpdate
                      ? "Guardando..."
                      : uploadingEditImage
                        ? "Procesando imagen..."
                        : "Guardar cambios"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center shadow-sm">
                <Store size={28} className="mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Selecciona un articulo para editarlo.
                </p>
              </div>
            )}
          </section>
        </div>
      )}
    </DashboardLayout>
  );
}
