import { useEffect, useMemo, useState } from "react";
import {
  Image as ImageIcon,
  MessageCircle,
  Package,
  Settings,
  ShoppingCart,
  Store,
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { canAccessPath } from "@/lib/access-control";
import { getMercadoBootstrapData } from "@/lib/mercado-api";
import {
  InventarioProductoEstado,
  MercadoDisponibilidadTipo,
  type InventarioProducto,
  type MercadoBootstrapData,
} from "@/lib/types";

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
              {producto.categoria}
              {producto.marca ? ` | ${producto.marca}` : ""}
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
          <p className="text-[11px] text-muted-foreground">
            {producto.stockActual} {producto.unidad}
          </p>
        </div>
      </div>
    </button>
  );
}

export default function MercadoAgricola() {
  const { user } = useAuth();
  const [data, setData] = useState<MercadoBootstrapData | null>(null);
  const [search, setSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canRequestQuote = user ? canAccessPath(user.rol, "/cotizaciones/nuevo") : false;
  const whatsappNumber =
    data?.whatsappNumero?.trim() ||
    import.meta.env.VITE_MERCADO_WHATSAPP_NUMERO?.trim() ||
    "";
  const whatsappConfigured = Boolean(whatsappNumber);

  async function loadMercado(showLoader = false) {
    if (showLoader) {
      setLoading(true);
    }

    try {
      const nextData = await getMercadoBootstrapData();
      setData(nextData);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudo cargar el catalogo del mercado agricola"
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

  const visibleProducts = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();

    return (data?.productos ?? []).filter(producto => {
      if (
        !producto.visibleEnMercado ||
        producto.estado !== InventarioProductoEstado.ACTIVO
      ) {
        return false;
      }

      if (!searchTerm) {
        return true;
      }

      return [producto.nombre, producto.categoria, producto.marca, producto.descripcion]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(searchTerm));
    });
  }, [data?.productos, search]);

  const selectedProduct =
    visibleProducts.find(producto => producto.id === selectedProductId) ?? null;

  useEffect(() => {
    if (
      selectedProductId &&
      visibleProducts.some(producto => producto.id === selectedProductId)
    ) {
      return;
    }

    setSelectedProductId(visibleProducts[0]?.id ?? null);
  }, [selectedProductId, visibleProducts]);

  function handleWhatsappContact() {
    if (!selectedProduct) {
      return;
    }

    if (!whatsappConfigured) {
      toast.error("Falta configurar el numero de WhatsApp del mercado");
      return;
    }

    const message = encodeURIComponent(
      `Hola, quiero informacion sobre ${selectedProduct.nombre} (${selectedProduct.codigo}).`
    );
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${message}`;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <DashboardLayout
      titulo="Mercado Agricola"
      descripcion="Catalogo comercial conectado a inventario para exhibir productos y solicitar cotizaciones"
    >
      {error && (
        <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mb-6 rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[1.4fr,auto] md:items-end">
          <div>
            <Label htmlFor="mercado-search">Buscar producto</Label>
            <Input
              id="mercado-search"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Buscar por nombre, categoria, marca o descripcion..."
              className="mt-2"
            />
          </div>

          {data?.puedeAdministrar && (
            <Button asChild variant="outline" className="gap-2">
              <Link href="/mercado-agricola/admin">
                <Settings size={16} />
                Administrar articulos
              </Link>
            </Button>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <p>Solo se muestran articulos activos y publicados en el mercado.</p>
          <p>{visibleProducts.length} producto(s) visibles</p>
        </div>
      </div>

      {loading ? (
        <div className="rounded-lg border border-border bg-card px-6 py-12 text-center text-muted-foreground shadow-sm">
          Cargando mercado agricola...
        </div>
      ) : visibleProducts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center shadow-sm">
          <Store size={28} className="mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No hay articulos publicados en el mercado agricola.
          </p>
          {data?.puedeAdministrar && (
            <div className="mt-4">
              <Button asChild className="gap-2">
                <Link href="/mercado-agricola/admin">
                  <Settings size={16} />
                  Crear o publicar articulos
                </Link>
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.35fr,1fr]">
          <section className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleProducts.map(producto => (
                <MercadoProductCard
                  key={producto.id}
                  active={producto.id === selectedProduct?.id}
                  onSelect={() => setSelectedProductId(producto.id)}
                  producto={producto}
                />
              ))}
            </div>
          </section>

          <section className="space-y-6">
            {selectedProduct ? (
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
                        {selectedProduct.marca ? ` | ${selectedProduct.marca}` : ""}
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
                        Codigo
                      </p>
                      <p className="mt-1 text-sm font-semibold text-foreground">
                        {selectedProduct.codigo}
                      </p>
                    </div>

                    <div className="rounded-lg border border-border bg-background px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                        Disponibilidad
                      </p>
                      <p className="mt-1 text-sm font-semibold text-foreground">
                        {formatDisponibilidadLabel(selectedProduct.tipoDisponibilidad)}
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
                      Falta configurar el numero de WhatsApp del mercado.
                    </p>
                  )}
                </div>
              </div>
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
