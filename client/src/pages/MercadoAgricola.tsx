import { useEffect, useMemo, useState } from "react";
import {
  Eye,
  EyeOff,
  Image as ImageIcon,
  MessageCircle,
  Package,
  Save,
  ShoppingCart,
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
import { useAuth } from "@/contexts/AuthContext";
import { canAccessPath } from "@/lib/access-control";
import { getMercadoBootstrapData, updateMercadoProducto } from "@/lib/mercado-api";
import {
  MercadoDisponibilidadTipo,
  UsuarioRol,
  type InventarioProducto,
  type MercadoBootstrapData,
} from "@/lib/types";

type MercadoAdminForm = {
  descripcion: string;
  imagenUrl: string;
  precio: string;
  tipoDisponibilidad: MercadoDisponibilidadTipo;
  visibleEnMercado: boolean;
};

const EMPTY_ADMIN_FORM: MercadoAdminForm = {
  descripcion: "",
  imagenUrl: "",
  precio: "0",
  tipoDisponibilidad: MercadoDisponibilidadTipo.STOCK,
  visibleEnMercado: false,
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function canManageMercado(role?: UsuarioRol) {
  return (
    role === UsuarioRol.ADMIN ||
    role === UsuarioRol.COMERCIAL ||
    role === UsuarioRol.INVENTARIO
  );
}

function formatDisponibilidadLabel(tipo: MercadoDisponibilidadTipo) {
  return tipo === MercadoDisponibilidadTipo.STOCK ? "En stock" : "Bajo pedido";
}

function getDisponibilidadBadge(tipo: MercadoDisponibilidadTipo) {
  return tipo === MercadoDisponibilidadTipo.STOCK
    ? "bg-emerald-100 text-emerald-800"
    : "bg-amber-100 text-amber-800";
}

function buildInitialAdminForm(producto?: InventarioProducto | null): MercadoAdminForm {
  if (!producto) {
    return EMPTY_ADMIN_FORM;
  }

  return {
    descripcion: producto.descripcion ?? "",
    imagenUrl: producto.imagenUrl ?? "",
    precio: String(producto.precio),
    tipoDisponibilidad: producto.tipoDisponibilidad,
    visibleEnMercado: producto.visibleEnMercado,
  };
}

function MercadoProductCard({
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
      <div className="flex h-40 items-center justify-center border-b border-border bg-muted/40">
        {producto.imagenUrl ? (
          <img
            src={producto.imagenUrl}
            alt={producto.nombre}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <ImageIcon size={26} />
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

        <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">
          {producto.descripcion?.trim() || "Sin descripcion comercial cargada."}
        </p>

        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">
            {formatMoney(producto.precio)}
          </p>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            {producto.visibleEnMercado ? (
              <>
                <Eye size={13} />
                Visible
              </>
            ) : (
              <>
                <EyeOff size={13} />
                Oculto
              </>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

export default function MercadoAgricola() {
  const { user } = useAuth();
  const [data, setData] = useState<MercadoBootstrapData | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [adminForm, setAdminForm] = useState<MercadoAdminForm>(EMPTY_ADMIN_FORM);
  const [search, setSearch] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState<
    "todos" | "visibles" | "ocultos"
  >("todos");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roleCanManage = canManageMercado(user?.rol);
  const canRequestQuote = user ? canAccessPath(user.rol, "/cotizaciones/nuevo") : false;
  const whatsappNumber = import.meta.env.VITE_MERCADO_WHATSAPP_NUMERO?.trim() ?? "";
  const whatsappConfigured =
    Boolean(whatsappNumber) || Boolean(data?.whatsappNumeroConfigurado);

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
          : "No se pudo cargar el mercado agricola"
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
    const productos = data?.productos ?? [];

    return productos.filter(producto => {
      const matchesSearch =
        search.trim().length === 0 ||
        [producto.codigo, producto.nombre, producto.categoria, producto.descripcion]
          .filter(Boolean)
          .some(value =>
            String(value).toLowerCase().includes(search.trim().toLowerCase())
          );
      const matchesVisibility =
        !roleCanManage ||
        visibilityFilter === "todos" ||
        (visibilityFilter === "visibles" && producto.visibleEnMercado) ||
        (visibilityFilter === "ocultos" && !producto.visibleEnMercado);

      return matchesSearch && matchesVisibility;
    });
  }, [data?.productos, roleCanManage, search, visibilityFilter]);

  const selectedProduct =
    filteredProducts.find(producto => producto.id === selectedProductId) ??
    data?.productos.find(producto => producto.id === selectedProductId) ??
    null;

  useEffect(() => {
    if (!selectedProduct) {
      setAdminForm(EMPTY_ADMIN_FORM);
      return;
    }

    setAdminForm(buildInitialAdminForm(selectedProduct));
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

  function handleWhatsappContact() {
    if (!selectedProduct) {
      return;
    }

    if (!whatsappConfigured || !whatsappNumber) {
      toast.error("Configura VITE_MERCADO_WHATSAPP_NUMERO para habilitar WhatsApp");
      return;
    }

    const message = encodeURIComponent(
      `Hola, quiero informacion sobre ${selectedProduct.nombre} (${selectedProduct.codigo}).`
    );
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${message}`;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  }

  async function handleSaveMarketSettings() {
    if (!selectedProduct) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updated = await updateMercadoProducto(selectedProduct.id, {
        descripcion: adminForm.descripcion.trim() || undefined,
        imagenUrl: adminForm.imagenUrl.trim() || undefined,
        precio: Number(adminForm.precio),
        tipoDisponibilidad: adminForm.tipoDisponibilidad,
        visibleEnMercado: adminForm.visibleEnMercado,
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
      toast.success("Configuracion de mercado actualizada");
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "No se pudo actualizar el producto";

      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardLayout
      titulo="Mercado Agricola"
      descripcion="Catalogo conectado a inventario para visibilidad comercial y solicitud de cotizaciones"
    >
      {error && (
        <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mb-6 rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[1.4fr,220px]">
          <div>
            <Label htmlFor="mercado-search">Buscar producto</Label>
            <Input
              id="mercado-search"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Buscar por codigo, nombre, categoria o descripcion..."
              className="mt-2"
            />
          </div>

          {roleCanManage && (
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
          )}
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <p>
            Los productos provienen de inventario y conservan precio y stock reales.
          </p>
          <p>{filteredProducts.length} producto(s) en la vista actual</p>
        </div>
      </div>

      {loading ? (
        <div className="rounded-lg border border-border bg-card px-6 py-12 text-center text-muted-foreground shadow-sm">
          Cargando mercado agricola...
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.35fr,1fr]">
          <section className="space-y-4">
            {filteredProducts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center shadow-sm">
                <Store size={28} className="mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No hay productos disponibles para el mercado con los filtros
                  actuales.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredProducts.map(producto => (
                  <MercadoProductCard
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
              <>
                <div className="rounded-lg border border-border bg-card shadow-sm">
                  <div className="flex h-60 items-center justify-center border-b border-border bg-muted/40">
                    {selectedProduct.imagenUrl ? (
                      <img
                        src={selectedProduct.imagenUrl}
                        alt={selectedProduct.nombre}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Package size={32} />
                        <span className="text-sm">Imagen no disponible</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-5 p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-2xl font-semibold text-foreground">
                          {selectedProduct.nombre}
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {selectedProduct.codigo} | {selectedProduct.categoria}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${getDisponibilidadBadge(
                          selectedProduct.tipoDisponibilidad
                        )}`}
                      >
                        {formatDisponibilidadLabel(selectedProduct.tipoDisponibilidad)}
                      </span>
                    </div>

                    <div className="rounded-lg border border-border bg-background px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                        Precio
                      </p>
                      <p className="mt-1 text-2xl font-semibold text-foreground">
                        {formatMoney(selectedProduct.precio)}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Descripcion
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                        {selectedProduct.descripcion?.trim() ||
                          "Este producto aun no tiene descripcion comercial publicada."}
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border border-border bg-background px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                          Stock actual
                        </p>
                        <p className="mt-1 text-sm font-semibold text-foreground">
                          {selectedProduct.stockActual} {selectedProduct.unidad}
                        </p>
                      </div>

                      <div className="rounded-lg border border-border bg-background px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                          Estado inventario
                        </p>
                        <p className="mt-1 text-sm font-semibold capitalize text-foreground">
                          {selectedProduct.estado}
                        </p>
                      </div>

                      <div className="rounded-lg border border-border bg-background px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                          Marca / modelo
                        </p>
                        <p className="mt-1 text-sm font-semibold text-foreground">
                          {selectedProduct.marca || "Sin marca"} |{" "}
                          {selectedProduct.modelo || "Sin modelo"}
                        </p>
                      </div>

                      <div className="rounded-lg border border-border bg-background px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                          Mercado
                        </p>
                        <p className="mt-1 text-sm font-semibold text-foreground">
                          {selectedProduct.visibleEnMercado ? "Visible" : "Oculto"}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      {canRequestQuote ? (
                        <Button asChild className="gap-2">
                          <Link
                            href={`/cotizaciones/nuevo?mercadoProductoId=${encodeURIComponent(
                              selectedProduct.id
                            )}`}
                          >
                            <ShoppingCart size={16} />
                            Solicitar cotizacion
                          </Link>
                        </Button>
                      ) : (
                        <Button disabled className="gap-2">
                          <ShoppingCart size={16} />
                          Solicitar cotizacion
                        </Button>
                      )}

                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleWhatsappContact}
                        className="gap-2"
                      >
                        <MessageCircle size={16} />
                        Contactar por WhatsApp
                      </Button>
                    </div>

                    {!canRequestQuote && (
                      <p className="text-xs text-muted-foreground">
                        Tu rol no tiene acceso directo al modulo de cotizaciones.
                      </p>
                    )}
                    {!whatsappConfigured && (
                      <p className="text-xs text-muted-foreground">
                        Falta configurar `VITE_MERCADO_WHATSAPP_NUMERO` para
                        habilitar el contacto por WhatsApp.
                      </p>
                    )}
                  </div>
                </div>

                {roleCanManage && (
                  <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
                    <div className="mb-5">
                      <h3 className="text-lg font-semibold text-foreground">
                        Administracion de mercado
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Configura visibilidad, disponibilidad, precio e imagen sin
                        duplicar el producto en otra tabla.
                      </p>
                    </div>

                    <div className="grid gap-4">
                      <div className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            Visible en mercado
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Controla si el producto aparece en el catalogo.
                          </p>
                        </div>

                        <label className="flex items-center gap-2 text-sm text-foreground">
                          <input
                            type="checkbox"
                            checked={adminForm.visibleEnMercado}
                            onChange={event =>
                              setAdminForm(current => ({
                                ...current,
                                visibleEnMercado: event.target.checked,
                              }))
                            }
                          />
                          {adminForm.visibleEnMercado ? "Visible" : "Oculto"}
                        </label>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <Label htmlFor="mercado-precio">Precio comercial</Label>
                          <Input
                            id="mercado-precio"
                            type="number"
                            min="0"
                            step="0.01"
                            value={adminForm.precio}
                            onChange={event =>
                              setAdminForm(current => ({
                                ...current,
                                precio: event.target.value,
                              }))
                            }
                            className="mt-2"
                          />
                        </div>

                        <div>
                          <Label htmlFor="mercado-disponibilidad">
                            Tipo de disponibilidad
                          </Label>
                          <Select
                            value={adminForm.tipoDisponibilidad}
                            onValueChange={value =>
                              setAdminForm(current => ({
                                ...current,
                                tipoDisponibilidad: value as MercadoDisponibilidadTipo,
                              }))
                            }
                          >
                            <SelectTrigger id="mercado-disponibilidad" className="mt-2">
                              <SelectValue placeholder="Selecciona disponibilidad" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={MercadoDisponibilidadTipo.STOCK}>
                                En stock
                              </SelectItem>
                              <SelectItem
                                value={MercadoDisponibilidadTipo.BAJO_PEDIDO}
                              >
                                Bajo pedido
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="mercado-imagen">URL de imagen</Label>
                        <Input
                          id="mercado-imagen"
                          value={adminForm.imagenUrl}
                          onChange={event =>
                            setAdminForm(current => ({
                              ...current,
                              imagenUrl: event.target.value,
                            }))
                          }
                          placeholder="https://..."
                          className="mt-2"
                        />
                      </div>

                      <div>
                        <Label htmlFor="mercado-descripcion">
                          Descripcion comercial
                        </Label>
                        <Textarea
                          id="mercado-descripcion"
                          value={adminForm.descripcion}
                          onChange={event =>
                            setAdminForm(current => ({
                              ...current,
                              descripcion: event.target.value,
                            }))
                          }
                          placeholder="Resumen claro del producto, usos y beneficios..."
                          className="mt-2 min-h-28"
                        />
                      </div>

                      <div className="flex justify-end">
                        <Button
                          type="button"
                          onClick={() => void handleSaveMarketSettings()}
                          disabled={saving}
                          className="gap-2"
                        >
                          <Save size={16} />
                          {saving ? "Guardando..." : "Guardar configuracion"}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center shadow-sm">
                <Store size={28} className="mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Selecciona un producto para ver su detalle comercial.
                </p>
              </div>
            )}
          </section>
        </div>
      )}
    </DashboardLayout>
  );
}
