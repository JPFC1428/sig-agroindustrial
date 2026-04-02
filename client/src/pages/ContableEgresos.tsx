import { useEffect, useState } from "react";
import { Eye, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { deleteEgreso, getEgresos } from "@/lib/contable-egresos-api";
import { getContableTerceros } from "@/lib/contable-terceros-api";
import {
  ContableMetodoPago,
  ContableTerceroTipo,
  type ContableEgreso,
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

function formatMetodoLabel(metodo: ContableMetodoPago) {
  switch (metodo) {
    case ContableMetodoPago.EFECTIVO:
      return "Efectivo";
    case ContableMetodoPago.TRANSFERENCIA:
      return "Transferencia";
    case ContableMetodoPago.CHEQUE:
      return "Cheque";
    case ContableMetodoPago.TARJETA:
      return "Tarjeta";
    case ContableMetodoPago.OTRO:
      return "Otro";
    default:
      return metodo;
  }
}

export default function ContableEgresos() {
  const [egresos, setEgresos] = useState<ContableEgreso[]>([]);
  const [proveedores, setProveedores] = useState<ContableTercero[]>([]);
  const [busqueda, setBusqueda] = useState("");
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
        const [egresosData, proveedoresData] = await Promise.all([
          getEgresos({
            q: busqueda || undefined,
            terceroId: filtroProveedor === "todos" ? undefined : filtroProveedor,
          }),
          getContableTerceros({ tipo: ContableTerceroTipo.PROVEEDOR }),
        ]);

        if (!activo) {
          return;
        }

        setEgresos(egresosData);
        setProveedores(proveedoresData);
      } catch (loadError) {
        if (!activo) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudieron cargar los comprobantes de egreso"
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
  }, [busqueda, filtroProveedor]);

  useEffect(() => {
    setPagina(1);
  }, [busqueda, filtroProveedor]);

  const totalPaginas = Math.max(1, Math.ceil(egresos.length / itemsPorPagina));

  useEffect(() => {
    setPagina(actual => Math.min(Math.max(actual, 1), totalPaginas));
  }, [totalPaginas]);

  const egresosPaginados = egresos.slice(
    (pagina - 1) * itemsPorPagina,
    pagina * itemsPorPagina
  );

  const desde = egresos.length === 0 ? 0 : (pagina - 1) * itemsPorPagina + 1;
  const hasta =
    egresos.length === 0 ? 0 : Math.min(pagina * itemsPorPagina, egresos.length);

  async function handleEliminar(egreso: ContableEgreso) {
    const confirmado = window.confirm(
      `Eliminar el comprobante "${egreso.numeroComprobante}"?\n\nEsta accion restaurara el saldo de las facturas relacionadas.`
    );

    if (!confirmado) {
      return;
    }

    setEliminandoId(egreso.id);
    setError(null);

    try {
      await deleteEgreso(egreso.id);
      setEgresos(current => current.filter(item => item.id !== egreso.id));
      toast.success("Comprobante de egreso eliminado");
    } catch (deleteError) {
      const message =
        deleteError instanceof Error
          ? deleteError.message
          : "No se pudo eliminar el comprobante";

      setError(message);
      toast.error(message);
    } finally {
      setEliminandoId(null);
    }
  }

  return (
    <DashboardLayout
      titulo="Comprobantes de Egreso"
      descripcion="Pagos a proveedores con control de saldo sobre facturas de compra"
      acciones={
        <Button asChild className="gap-2">
          <Link href="/contable/comprobantes-egreso/nuevo">
            <Plus size={18} />
            Nuevo Egreso
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
              placeholder="Buscar por comprobante, proveedor o NIT..."
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
        </div>

        <div className="mt-4 flex items-center justify-end text-sm text-muted-foreground">
          {cargando
            ? "Cargando egresos..."
            : `${egresos.length} comprobante${egresos.length !== 1 ? "s" : ""}`}
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
                  Comprobante
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Proveedor
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Fecha
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Metodo
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Valor
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
                    Cargando comprobantes de egreso...
                  </td>
                </tr>
              ) : egresosPaginados.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-10 text-center text-sm text-muted-foreground"
                  >
                    No se encontraron comprobantes de egreso
                  </td>
                </tr>
              ) : (
                egresosPaginados.map((egreso, index) => (
                  <tr
                    key={egreso.id}
                    className={`border-b border-border transition-smooth hover:bg-accent ${
                      index % 2 === 0 ? "bg-background" : "bg-accent/40"
                    }`}
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-foreground">
                        {egreso.numeroComprobante}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {egreso.detalles?.length ?? 0} factura
                        {(egreso.detalles?.length ?? 0) === 1 ? "" : "s"} relacionada
                        {(egreso.detalles?.length ?? 0) === 1 ? "" : "s"}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-foreground">
                        {egreso.terceroNombreRazonSocial}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {egreso.terceroDocumentoNit}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      {formatDate(egreso.fecha)}
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      {formatMetodoLabel(egreso.metodoPago)}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-foreground">
                      {formatMoney(egreso.valorTotal)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <Link
                          href={`/contable/comprobantes-egreso/${egreso.id}`}
                          className="rounded p-2 text-muted-foreground transition-smooth hover:bg-background hover:text-foreground"
                          title="Ver detalle"
                        >
                          <Eye size={18} />
                        </Link>
                        <button
                          type="button"
                          title="Eliminar comprobante"
                          disabled={eliminandoId === egreso.id}
                          onClick={() => void handleEliminar(egreso)}
                          className="rounded p-2 text-muted-foreground transition-smooth hover:bg-background hover:text-destructive disabled:cursor-not-allowed disabled:opacity-60"
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
            Mostrando {desde} a {hasta} de {egresos.length}
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
