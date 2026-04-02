import { useEffect, useState } from "react";
import { Edit, Link2, Plus, Search, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  deleteFacturaCompra,
  getFacturasCompra,
} from "@/lib/contable-facturas-compra-api";
import { getContableTerceros } from "@/lib/contable-terceros-api";
import {
  ContableFacturaCompraEstado,
  ContableTerceroTipo,
  type ContableFacturaCompra,
  type ContableTercero,
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

function getEstadoBadge(estado: ContableFacturaCompraEstado) {
  const styles = {
    [ContableFacturaCompraEstado.PENDIENTE]: "bg-amber-100 text-amber-800",
    [ContableFacturaCompraEstado.PARCIAL]: "bg-blue-100 text-blue-800",
    [ContableFacturaCompraEstado.PAGADA]: "bg-green-100 text-green-800",
    [ContableFacturaCompraEstado.VENCIDA]: "bg-red-100 text-red-800",
    [ContableFacturaCompraEstado.ANULADA]: "bg-gray-100 text-gray-800",
  };

  return styles[estado];
}

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

export default function ContableFacturasCompra() {
  const [facturas, setFacturas] = useState<ContableFacturaCompra[]>([]);
  const [proveedores, setProveedores] = useState<ContableTercero[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<
    ContableFacturaCompraEstado | "todos"
  >("todos");
  const [filtroProveedor, setFiltroProveedor] = useState("todos");
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const itemsPorPagina = 10;

  useEffect(() => {
    let activo = true;

    async function cargar() {
      setCargando(true);
      setError(null);

      try {
        const [facturasData, proveedoresData] = await Promise.all([
          getFacturasCompra({
            estado: filtroEstado === "todos" ? undefined : filtroEstado,
            q: busqueda || undefined,
            terceroId: filtroProveedor === "todos" ? undefined : filtroProveedor,
          }),
          getContableTerceros({
            tipo: ContableTerceroTipo.PROVEEDOR,
          }),
        ]);

        if (!activo) {
          return;
        }

        setFacturas(facturasData);
        setProveedores(proveedoresData);
      } catch (loadError) {
        if (!activo) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudieron cargar las facturas de compra"
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
  }, [busqueda, filtroEstado, filtroProveedor]);

  useEffect(() => {
    setPagina(1);
  }, [busqueda, filtroEstado, filtroProveedor]);

  const totalPaginas = Math.max(1, Math.ceil(facturas.length / itemsPorPagina));

  useEffect(() => {
    setPagina(actual => Math.min(Math.max(actual, 1), totalPaginas));
  }, [totalPaginas]);

  const facturasPaginadas = facturas.slice(
    (pagina - 1) * itemsPorPagina,
    pagina * itemsPorPagina
  );

  const desde = facturas.length === 0 ? 0 : (pagina - 1) * itemsPorPagina + 1;
  const hasta =
    facturas.length === 0 ? 0 : Math.min(pagina * itemsPorPagina, facturas.length);

  async function handleEliminar(factura: ContableFacturaCompra) {
    const confirmado = window.confirm(
      `Eliminar la factura de compra "${factura.numeroFactura}"?`
    );

    if (!confirmado) {
      return;
    }

    setEliminandoId(factura.id);
    setError(null);

    try {
      await deleteFacturaCompra(factura.id);
      setFacturas(current => current.filter(item => item.id !== factura.id));
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "No se pudo eliminar la factura de compra"
      );
    } finally {
      setEliminandoId(null);
    }
  }

  return (
    <DashboardLayout
      titulo="Facturas de Compra"
      descripcion="Registro, vencimientos y saldos de compras por proveedor"
      acciones={
        <Button asChild className="gap-2">
          <Link href="/contable/facturas-compra/nuevo">
            <Plus size={18} />
            Nueva Factura
          </Link>
        </Button>
      }
    >
      <div className="mb-6 rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search
              size={18}
              className="absolute left-3 top-3 text-muted-foreground"
            />
            <Input
              placeholder="Buscar por numero, proveedor o NIT..."
              value={busqueda}
              onChange={event => setBusqueda(event.target.value)}
              className="pl-10"
            />
          </div>

          <Select
            value={filtroEstado}
            onValueChange={value =>
              setFiltroEstado(value as ContableFacturaCompraEstado | "todos")
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              {Object.values(ContableFacturaCompraEstado).map(estado => (
                <SelectItem key={estado} value={estado}>
                  {formatEstadoLabel(estado)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filtroProveedor} onValueChange={setFiltroProveedor}>
            <SelectTrigger>
              <SelectValue placeholder="Proveedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los proveedores</SelectItem>
              {proveedores.map(proveedor => (
                <SelectItem key={proveedor.id} value={proveedor.id}>
                  {proveedor.nombreRazonSocial}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-4 flex items-center justify-end text-sm text-muted-foreground">
          {cargando
            ? "Cargando facturas..."
            : `${facturas.length} factura${facturas.length !== 1 ? "s" : ""}`}
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-accent">
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Factura
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Proveedor
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Fechas
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Valores
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Estado
                </th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-foreground">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-10 text-center text-sm text-muted-foreground"
                  >
                    Cargando facturas de compra...
                  </td>
                </tr>
              ) : facturasPaginadas.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-10 text-center text-sm text-muted-foreground"
                  >
                    No se encontraron facturas de compra
                  </td>
                </tr>
              ) : (
                facturasPaginadas.map((factura, index) => (
                  <tr
                    key={factura.id}
                    className={`border-b border-border transition-smooth hover:bg-accent ${
                      index % 2 === 0 ? "bg-background" : "bg-accent/40"
                    }`}
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-foreground">
                        {factura.numeroFactura}
                      </p>
                      {factura.soporteUrl && (
                        <a
                          href={factura.soporteUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <Link2 size={12} />
                          Ver soporte
                        </a>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-foreground">
                        {factura.terceroNombreRazonSocial}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {factura.terceroDocumentoNit}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-foreground">
                        Factura: {formatDate(factura.fechaFactura)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Vence: {formatDate(factura.fechaVencimiento)}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-foreground">
                        Total: {formatMoney(factura.total)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Saldo: {formatMoney(factura.saldo)}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${getEstadoBadge(
                          factura.estado
                        )}`}
                      >
                        {formatEstadoLabel(factura.estado)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <Link
                          href={`/contable/facturas-compra/${factura.id}/editar`}
                          className="rounded p-2 text-muted-foreground transition-smooth hover:bg-background hover:text-foreground"
                          title="Editar factura"
                        >
                          <Edit size={18} />
                        </Link>
                        <button
                          className="rounded p-2 text-muted-foreground transition-smooth hover:bg-background hover:text-destructive disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={eliminandoId === factura.id}
                          onClick={() => void handleEliminar(factura)}
                          title="Eliminar factura"
                          type="button"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <p className="text-sm text-muted-foreground">
            Mostrando {desde} a {hasta} de {facturas.length}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPagina(actual => Math.max(1, actual - 1))}
              disabled={pagina === 1}
            >
              Anterior
            </Button>
            <span className="flex items-center px-3 text-sm text-foreground">
              Pagina {pagina} de {totalPaginas}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setPagina(actual => Math.min(totalPaginas, actual + 1))
              }
              disabled={pagina === totalPaginas}
            >
              Siguiente
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
