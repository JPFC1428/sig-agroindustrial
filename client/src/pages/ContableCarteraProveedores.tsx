import { useEffect, useState } from "react";
import { AlertTriangle, Search } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getCarteraProveedores } from "@/lib/contable-cartera-api";
import { formatDateOnlyInput } from "@/lib/contable-facturas-compra-api";
import { getContableTerceros } from "@/lib/contable-terceros-api";
import {
  ContableCarteraEstado,
  ContableTerceroTipo,
  type ContableCarteraProveedorItem,
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

function formatEstadoLabel(estado: ContableCarteraEstado) {
  switch (estado) {
    case ContableCarteraEstado.PENDIENTE:
      return "Pendiente";
    case ContableCarteraEstado.PARCIAL:
      return "Parcial";
    case ContableCarteraEstado.PAGADO:
      return "Pagado";
    default:
      return estado;
  }
}

function getEstadoBadge(estado: ContableCarteraEstado) {
  const styles = {
    [ContableCarteraEstado.PENDIENTE]: "bg-amber-100 text-amber-800",
    [ContableCarteraEstado.PARCIAL]: "bg-blue-100 text-blue-800",
    [ContableCarteraEstado.PAGADO]: "bg-green-100 text-green-800",
  };

  return styles[estado];
}

export default function ContableCarteraProveedores() {
  const [items, setItems] = useState<ContableCarteraProveedorItem[]>([]);
  const [proveedores, setProveedores] = useState<ContableTercero[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtroProveedor, setFiltroProveedor] = useState("todos");
  const [filtroEstado, setFiltroEstado] = useState<
    ContableCarteraEstado | "todos"
  >("todos");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const itemsPorPagina = 10;

  useEffect(() => {
    let activo = true;

    async function cargar() {
      setCargando(true);
      setError(null);

      try {
        const [carteraData, proveedoresData] = await Promise.all([
          getCarteraProveedores({
            estado: filtroEstado === "todos" ? undefined : filtroEstado,
            fechaDesde: fechaDesde || undefined,
            fechaHasta: fechaHasta || undefined,
            q: busqueda || undefined,
            terceroId: filtroProveedor === "todos" ? undefined : filtroProveedor,
          }),
          getContableTerceros({ tipo: ContableTerceroTipo.PROVEEDOR }),
        ]);

        if (!activo) {
          return;
        }

        setItems(carteraData);
        setProveedores(proveedoresData);
      } catch (loadError) {
        if (!activo) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudo cargar la cartera de proveedores"
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
  }, [busqueda, fechaDesde, fechaHasta, filtroEstado, filtroProveedor]);

  useEffect(() => {
    setPagina(1);
  }, [busqueda, fechaDesde, fechaHasta, filtroEstado, filtroProveedor]);

  const totalPaginas = Math.max(1, Math.ceil(items.length / itemsPorPagina));

  useEffect(() => {
    setPagina(actual => Math.min(Math.max(actual, 1), totalPaginas));
  }, [totalPaginas]);

  const itemsPaginados = items.slice(
    (pagina - 1) * itemsPorPagina,
    pagina * itemsPorPagina
  );

  const desde = items.length === 0 ? 0 : (pagina - 1) * itemsPorPagina + 1;
  const hasta =
    items.length === 0 ? 0 : Math.min(pagina * itemsPorPagina, items.length);

  return (
    <DashboardLayout
      titulo="Cartera Proveedores"
      descripcion="Control de cuentas por pagar basado en facturas de compra y egresos registrados"
    >
      <div className="mb-6 rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
          <div className="relative md:col-span-2">
            <Search
              size={18}
              className="absolute left-3 top-3 text-muted-foreground"
            />
            <Input
              placeholder="Buscar factura, proveedor o NIT..."
              value={busqueda}
              onChange={event => setBusqueda(event.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={filtroProveedor} onValueChange={setFiltroProveedor}>
            <SelectTrigger className="md:col-span-2">
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

          <Select
            value={filtroEstado}
            onValueChange={value =>
              setFiltroEstado(value as ContableCarteraEstado | "todos")
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              {Object.values(ContableCarteraEstado).map(estado => (
                <SelectItem key={estado} value={estado}>
                  {formatEstadoLabel(estado)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="grid grid-cols-2 gap-2 md:col-span-6">
            <Input
              type="date"
              value={fechaDesde}
              max={fechaHasta || formatDateOnlyInput(new Date(new Date().getFullYear() + 5, 11, 31))}
              onChange={event => setFechaDesde(event.target.value)}
            />
            <Input
              type="date"
              value={fechaHasta}
              min={fechaDesde || undefined}
              max={formatDateOnlyInput(new Date(new Date().getFullYear() + 5, 11, 31))}
              onChange={event => setFechaHasta(event.target.value)}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end text-sm text-muted-foreground">
          {cargando
            ? "Cargando cartera..."
            : `${items.length} factura${items.length !== 1 ? "s" : ""} en cartera`}
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
                  Proveedor
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Factura
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Fechas
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Total
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Pagado
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Saldo
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-10 text-center text-sm text-muted-foreground"
                  >
                    Cargando cartera de proveedores...
                  </td>
                </tr>
              ) : itemsPaginados.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-10 text-center text-sm text-muted-foreground"
                  >
                    No se encontraron registros de cartera
                  </td>
                </tr>
              ) : (
                itemsPaginados.map((item, index) => (
                  <tr
                    key={item.id}
                    className={`border-b border-border transition-smooth hover:bg-accent ${
                      index % 2 === 0 ? "bg-background" : "bg-accent/40"
                    }`}
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-foreground">
                        {item.proveedorNombreRazonSocial}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.proveedorDocumentoNit}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-foreground">
                      {item.numeroFactura}
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      <p>Factura: {formatDate(item.fechaFactura)}</p>
                      <p className="text-xs text-muted-foreground">
                        Vence: {formatDate(item.fechaVencimiento)}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      {formatMoney(item.total)}
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      {formatMoney(item.valorPagado)}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-foreground">
                      {formatMoney(item.saldo)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-start gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${getEstadoBadge(
                            item.estado
                          )}`}
                        >
                          {formatEstadoLabel(item.estado)}
                        </span>
                        {item.vencida && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">
                            <AlertTriangle size={12} />
                            Vencida
                          </span>
                        )}
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
            Mostrando {desde} a {hasta} de {items.length}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-md border border-input px-3 py-2 text-sm disabled:opacity-50"
              onClick={() => setPagina(actual => Math.max(1, actual - 1))}
              disabled={pagina === 1}
            >
              Anterior
            </button>
            <span className="flex items-center px-3 text-sm text-foreground">
              Pagina {pagina} de {totalPaginas}
            </span>
            <button
              type="button"
              className="rounded-md border border-input px-3 py-2 text-sm disabled:opacity-50"
              onClick={() =>
                setPagina(actual => Math.min(totalPaginas, actual + 1))
              }
              disabled={pagina === totalPaginas}
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
