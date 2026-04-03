import { useEffect, useState } from "react";
import { ArrowRight, Package, ShoppingCart, Truck, Users } from "lucide-react";
import { Link } from "wouter";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { getInventarioDashboardData } from "@/lib/inventario-api";
import type {
  InventarioCompra,
  InventarioDashboardData,
  InventarioEntrada,
  InventarioProducto,
} from "@/lib/types";

function formatMoney(value: number) {
  return `$${new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(value)}`;
}

function formatDate(value: Date) {
  return value.toLocaleDateString("es-CO");
}

function SummaryCard({
  description,
  title,
  value,
}: {
  description: string;
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-2 text-3xl font-semibold text-foreground">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function RecentPurchases({ compras }: { compras: InventarioCompra[] }) {
  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      <div className="border-b border-border px-6 py-4">
        <h2 className="text-lg font-semibold text-foreground">Compras recientes</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-accent">
              <th className="px-6 py-4 text-left text-sm font-semibold">Compra</th>
              <th className="px-6 py-4 text-left text-sm font-semibold">
                Proveedor
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold">Fecha</th>
              <th className="px-6 py-4 text-left text-sm font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {compras.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-6 py-8 text-center text-sm text-muted-foreground"
                >
                  Aun no hay compras registradas
                </td>
              </tr>
            ) : (
              compras.map(compra => (
                <tr key={compra.id} className="border-b border-border">
                  <td className="px-6 py-4 text-sm text-foreground">
                    <p className="font-medium">{compra.numeroCompra}</p>
                    <p className="text-xs text-muted-foreground">{compra.estado}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-foreground">
                    {compra.proveedorNombreRazonSocial}
                  </td>
                  <td className="px-6 py-4 text-sm text-foreground">
                    {formatDate(compra.fecha)}
                  </td>
                  <td className="px-6 py-4 text-sm text-foreground">
                    {formatMoney(compra.total)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RecentEntries({ entradas }: { entradas: InventarioEntrada[] }) {
  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      <div className="border-b border-border px-6 py-4">
        <h2 className="text-lg font-semibold text-foreground">Entradas recientes</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-accent">
              <th className="px-6 py-4 text-left text-sm font-semibold">Entrada</th>
              <th className="px-6 py-4 text-left text-sm font-semibold">Origen</th>
              <th className="px-6 py-4 text-left text-sm font-semibold">Fecha</th>
              <th className="px-6 py-4 text-left text-sm font-semibold">Costo</th>
            </tr>
          </thead>
          <tbody>
            {entradas.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-6 py-8 text-center text-sm text-muted-foreground"
                >
                  Aun no hay entradas registradas
                </td>
              </tr>
            ) : (
              entradas.map(entrada => (
                <tr key={entrada.id} className="border-b border-border">
                  <td className="px-6 py-4 text-sm text-foreground">
                    <p className="font-medium">{entrada.numeroEntrada}</p>
                    <p className="text-xs text-muted-foreground">
                      {entrada.totalItems} unidades
                    </p>
                  </td>
                  <td className="px-6 py-4 text-sm text-foreground">
                    <p className="capitalize">{entrada.origenTipo}</p>
                    {entrada.compraNumero && (
                      <p className="text-xs text-muted-foreground">
                        {entrada.compraNumero}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-foreground">
                    {formatDate(entrada.fecha)}
                  </td>
                  <td className="px-6 py-4 text-sm text-foreground">
                    {formatMoney(entrada.totalCosto)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RecentProducts({ productos }: { productos: InventarioProducto[] }) {
  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Productos / Equipos recientes
          </h2>
          <p className="text-sm text-muted-foreground">
            Base inicial para stock, entradas y compras.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {productos.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            Aun no hay productos o equipos registrados
          </div>
        ) : (
          productos.map(producto => (
            <div
              key={producto.id}
              className="rounded-lg border border-border bg-background px-4 py-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-foreground">{producto.nombre}</p>
                  <p className="text-sm text-muted-foreground">
                    {producto.codigo} · {producto.categoria}
                  </p>
                </div>
                <div className="text-right text-sm text-foreground">
                  <p>{producto.stockActual} unidades</p>
                  <p className="text-muted-foreground">
                    {formatMoney(producto.costo)}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function InventarioCompras() {
  const [data, setData] = useState<InventarioDashboardData | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;

    async function cargar() {
      setCargando(true);
      setError(null);

      try {
        const dashboardData = await getInventarioDashboardData();

        if (!activo) {
          return;
        }

        setData(dashboardData);
      } catch (loadError) {
        if (!activo) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudo cargar el dashboard de inventario"
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
  }, []);

  return (
    <DashboardLayout
      titulo="Inventario / Compras"
      descripcion="Base operativa inicial para proveedores, productos, compras y entradas"
      acciones={
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/inventario-compras/productos">
              <Package size={16} />
              Productos / Equipos
            </Link>
          </Button>
          <Button asChild>
            <Link href="/inventario-compras/compras">
              <ShoppingCart size={16} />
              Nueva Compra
            </Link>
          </Button>
        </div>
      }
    >
      {error && (
        <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Proveedores"
          value={cargando ? "..." : String(data?.resumen.proveedores ?? 0)}
          description="Proveedores reutilizados desde Terceros."
        />
        <SummaryCard
          title="Productos / Equipos"
          value={cargando ? "..." : String(data?.resumen.productos ?? 0)}
          description="Catalogo inicial para inventario y compras."
        />
        <SummaryCard
          title="Stock Total"
          value={cargando ? "..." : String(data?.resumen.stockTotal ?? 0)}
          description="Unidades acumuladas por entradas registradas."
        />
        <SummaryCard
          title="Valor Inventario"
          value={cargando ? "..." : formatMoney(data?.resumen.valorInventario ?? 0)}
          description="Stock valorizado al costo actual."
        />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-4">
        <Link
          href="/inventario-compras/proveedores"
          className="rounded-lg border border-border bg-card p-5 shadow-sm transition-smooth hover:bg-accent"
        >
          <div className="flex items-center justify-between">
            <Users size={20} className="text-muted-foreground" />
            <ArrowRight size={16} className="text-muted-foreground" />
          </div>
          <h2 className="mt-4 font-semibold text-foreground">Proveedores</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Crear y consultar proveedores reutilizando terceros.
          </p>
        </Link>

        <Link
          href="/inventario-compras/productos"
          className="rounded-lg border border-border bg-card p-5 shadow-sm transition-smooth hover:bg-accent"
        >
          <div className="flex items-center justify-between">
            <Package size={20} className="text-muted-foreground" />
            <ArrowRight size={16} className="text-muted-foreground" />
          </div>
          <h2 className="mt-4 font-semibold text-foreground">
            Productos / Equipos
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Catalogo base con codigo, costo, precio y stock.
          </p>
        </Link>

        <Link
          href="/inventario-compras/compras"
          className="rounded-lg border border-border bg-card p-5 shadow-sm transition-smooth hover:bg-accent"
        >
          <div className="flex items-center justify-between">
            <ShoppingCart size={20} className="text-muted-foreground" />
            <ArrowRight size={16} className="text-muted-foreground" />
          </div>
          <h2 className="mt-4 font-semibold text-foreground">Compras</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Registro de compras por proveedor con items comprados.
          </p>
        </Link>

        <Link
          href="/inventario-compras/entradas"
          className="rounded-lg border border-border bg-card p-5 shadow-sm transition-smooth hover:bg-accent"
        >
          <div className="flex items-center justify-between">
            <Truck size={20} className="text-muted-foreground" />
            <ArrowRight size={16} className="text-muted-foreground" />
          </div>
          <h2 className="mt-4 font-semibold text-foreground">Entradas</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ingreso a inventario con aumento de stock en transaccion.
          </p>
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr,1fr]">
        <div className="space-y-6">
          <RecentPurchases compras={data?.comprasRecientes ?? []} />
          <RecentEntries entradas={data?.entradasRecientes ?? []} />
        </div>
        <RecentProducts productos={data?.productosRecientes ?? []} />
      </div>
    </DashboardLayout>
  );
}
