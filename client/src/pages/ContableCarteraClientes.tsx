import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getCarteraClientes } from "@/lib/contable-cartera-api";
import { getContableTerceros } from "@/lib/contable-terceros-api";
import {
  ContableCarteraEstado,
  ContableReciboDocumentoTipo,
  ContableTerceroTipo,
  type ContableCarteraClienteItem,
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

function formatDocumentoTipoLabel(tipo: ContableReciboDocumentoTipo) {
  switch (tipo) {
    case ContableReciboDocumentoTipo.CUENTA_POR_COBRAR:
      return "Cuenta por cobrar";
    case ContableReciboDocumentoTipo.OTRO:
      return "Otro";
    default:
      return tipo;
  }
}

export default function ContableCarteraClientes() {
  const [items, setItems] = useState<ContableCarteraClienteItem[]>([]);
  const [clientes, setClientes] = useState<ContableTercero[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtroCliente, setFiltroCliente] = useState("todos");
  const [filtroEstado, setFiltroEstado] = useState<
    ContableCarteraEstado | "todos"
  >("todos");
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
        const [carteraData, clientesData] = await Promise.all([
          getCarteraClientes({
            estado: filtroEstado === "todos" ? undefined : filtroEstado,
            q: busqueda || undefined,
            terceroId: filtroCliente === "todos" ? undefined : filtroCliente,
          }),
          getContableTerceros({ tipo: ContableTerceroTipo.CLIENTE }),
        ]);

        if (!activo) {
          return;
        }

        setItems(carteraData);
        setClientes(clientesData);
      } catch (loadError) {
        if (!activo) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudo cargar la cartera de clientes"
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
  }, [busqueda, filtroCliente, filtroEstado]);

  useEffect(() => {
    setPagina(1);
  }, [busqueda, filtroCliente, filtroEstado]);

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
      titulo="Cartera Clientes"
      descripcion="Cuentas por cobrar construidas desde las aplicaciones registradas en recibos de caja"
    >
      <div className="mb-6 rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search
              size={18}
              className="absolute left-3 top-3 text-muted-foreground"
            />
            <Input
              placeholder="Buscar cliente, documento o referencia..."
              value={busqueda}
              onChange={event => setBusqueda(event.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={filtroCliente} onValueChange={setFiltroCliente}>
            <SelectTrigger>
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
        </div>

        <div className="mt-4 flex items-center justify-end text-sm text-muted-foreground">
          {cargando
            ? "Cargando cartera..."
            : `${items.length} cuenta${items.length !== 1 ? "s" : ""} en cartera`}
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
                  Cliente
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Documento
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Ultimo movimiento
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Total
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Recibido
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
                    Cargando cartera de clientes...
                  </td>
                </tr>
              ) : itemsPaginados.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-10 text-center text-sm text-muted-foreground"
                  >
                    No se encontraron cuentas por cobrar
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
                        {item.clienteNombreRazonSocial}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.clienteDocumentoNit}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      <p>{item.documentoReferencia || "Sin referencia"}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDocumentoTipoLabel(item.documentoTipo)}
                        {item.documentoId ? ` · ${item.documentoId}` : ""}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      {formatDate(item.fechaUltimoMovimiento)}
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      {formatMoney(item.total)}
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      {formatMoney(item.valorRecibido)}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-foreground">
                      {formatMoney(item.saldo)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${getEstadoBadge(
                          item.estado
                        )}`}
                      >
                        {formatEstadoLabel(item.estado)}
                      </span>
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
