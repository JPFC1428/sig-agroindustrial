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
import { deleteReciboCaja, getRecibosCaja } from "@/lib/contable-recibos-caja-api";
import { formatDateOnlyInput } from "@/lib/contable-facturas-compra-api";
import { getContableTerceros } from "@/lib/contable-terceros-api";
import {
  ContableMetodoPago,
  ContableTerceroTipo,
  type ContableReciboCaja,
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

export default function ContableRecibosCaja() {
  const [recibos, setRecibos] = useState<ContableReciboCaja[]>([]);
  const [clientes, setClientes] = useState<ContableTercero[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtroCliente, setFiltroCliente] = useState("todos");
  const [filtroFecha, setFiltroFecha] = useState("");
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
        const [recibosData, clientesData] = await Promise.all([
          getRecibosCaja({
            fecha: filtroFecha || undefined,
            q: busqueda || undefined,
            terceroId: filtroCliente === "todos" ? undefined : filtroCliente,
          }),
          getContableTerceros({ tipo: ContableTerceroTipo.CLIENTE }),
        ]);

        if (!activo) {
          return;
        }

        setRecibos(recibosData);
        setClientes(clientesData);
      } catch (loadError) {
        if (!activo) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudieron cargar los recibos de caja"
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
  }, [busqueda, filtroCliente, filtroFecha]);

  useEffect(() => {
    setPagina(1);
  }, [busqueda, filtroCliente, filtroFecha]);

  const totalPaginas = Math.max(1, Math.ceil(recibos.length / itemsPorPagina));

  useEffect(() => {
    setPagina(actual => Math.min(Math.max(actual, 1), totalPaginas));
  }, [totalPaginas]);

  const recibosPaginados = recibos.slice(
    (pagina - 1) * itemsPorPagina,
    pagina * itemsPorPagina
  );

  const desde = recibos.length === 0 ? 0 : (pagina - 1) * itemsPorPagina + 1;
  const hasta =
    recibos.length === 0 ? 0 : Math.min(pagina * itemsPorPagina, recibos.length);

  async function handleEliminar(recibo: ContableReciboCaja) {
    const confirmado = window.confirm(
      `Eliminar el recibo "${recibo.numeroRecibo}"?`
    );

    if (!confirmado) {
      return;
    }

    setEliminandoId(recibo.id);
    setError(null);

    try {
      await deleteReciboCaja(recibo.id);
      setRecibos(current => current.filter(item => item.id !== recibo.id));
      toast.success("Recibo de caja eliminado");
    } catch (deleteError) {
      const message =
        deleteError instanceof Error
          ? deleteError.message
          : "No se pudo eliminar el recibo de caja";

      setError(message);
      toast.error(message);
    } finally {
      setEliminandoId(null);
    }
  }

  return (
    <DashboardLayout
      titulo="Recibos de Caja"
      descripcion="Registro de ingresos de dinero y base operativa para cartera de clientes"
      acciones={
        <Button asChild className="gap-2">
          <Link href="/contable/recibos-caja/nuevo">
            <Plus size={18} />
            Nuevo Recibo
          </Link>
        </Button>
      }
    >
      <div className="mb-6 rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <div className="relative md:col-span-2">
            <Search
              size={18}
              className="absolute left-3 top-3 text-muted-foreground"
            />
            <Input
              placeholder="Buscar por numero, cliente o documento..."
              value={busqueda}
              onChange={event => setBusqueda(event.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={filtroCliente} onValueChange={setFiltroCliente}>
            <SelectTrigger className="md:col-span-2">
              <SelectValue placeholder="Cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los clientes</SelectItem>
              {clientes.map(cliente => (
                <SelectItem key={cliente.id} value={cliente.id}>
                  {cliente.nombreRazonSocial}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="date"
            value={filtroFecha}
            max={formatDateOnlyInput(new Date(new Date().getFullYear() + 5, 11, 31))}
            onChange={event => setFiltroFecha(event.target.value)}
          />
        </div>

        <div className="mt-4 flex items-center justify-end text-sm text-muted-foreground">
          {cargando
            ? "Cargando recibos..."
            : `${recibos.length} recibo${recibos.length !== 1 ? "s" : ""}`}
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
                  Recibo
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Cliente
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
                    Cargando recibos de caja...
                  </td>
                </tr>
              ) : recibosPaginados.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-10 text-center text-sm text-muted-foreground"
                  >
                    No se encontraron recibos de caja
                  </td>
                </tr>
              ) : (
                recibosPaginados.map((recibo, index) => (
                  <tr
                    key={recibo.id}
                    className={`border-b border-border transition-smooth hover:bg-accent ${
                      index % 2 === 0 ? "bg-background" : "bg-accent/40"
                    }`}
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-foreground">
                        {recibo.numeroRecibo}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {recibo.detalles?.length ?? 0} referencia
                        {(recibo.detalles?.length ?? 0) === 1 ? "" : "s"} aplicada
                        {(recibo.detalles?.length ?? 0) === 1 ? "" : "s"}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-foreground">
                        {recibo.terceroNombreRazonSocial}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {recibo.terceroDocumentoNit}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      {formatDate(recibo.fecha)}
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      {formatMetodoLabel(recibo.metodoPago)}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-foreground">
                      {formatMoney(recibo.valorTotal)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <Link
                          href={`/contable/recibos-caja/${recibo.id}`}
                          className="rounded p-2 text-muted-foreground transition-smooth hover:bg-background hover:text-foreground"
                          title="Ver detalle"
                        >
                          <Eye size={18} />
                        </Link>
                        <button
                          type="button"
                          title="Eliminar recibo"
                          disabled={eliminandoId === recibo.id}
                          onClick={() => void handleEliminar(recibo)}
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
            Mostrando {desde} a {hasta} de {recibos.length}
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
