import { useEffect, useMemo, useState } from "react";
import { Eye, Plus, Search } from "lucide-react";
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
import { getContableNotasCredito } from "@/lib/contable-notas-credito-api";
import { getContableTerceros } from "@/lib/contable-terceros-api";
import {
  ContableNotaCreditoDocumentoTipo,
  ContableNotaCreditoEstado,
  ContableNotaCreditoTipo,
  ContableTerceroTipo,
  type ContableNotaCredito,
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

function formatTipoLabel(tipo: ContableNotaCreditoTipo) {
  return tipo === ContableNotaCreditoTipo.CLIENTE ? "Cliente" : "Proveedor";
}

function formatEstadoLabel(estado: ContableNotaCreditoEstado) {
  switch (estado) {
    case ContableNotaCreditoEstado.BORRADOR:
      return "Borrador";
    case ContableNotaCreditoEstado.EMITIDA:
      return "Emitida";
    case ContableNotaCreditoEstado.APLICADA:
      return "Aplicada";
    case ContableNotaCreditoEstado.ANULADA:
      return "Anulada";
    default:
      return estado;
  }
}

function formatDocumentoRelacionadoLabel(nota: ContableNotaCredito) {
  if (!nota.documentoRelacionadoTipo && !nota.referenciaDocumento) {
    return "Sin relacion";
  }

  if (
    nota.documentoRelacionadoTipo ===
    ContableNotaCreditoDocumentoTipo.FACTURA_COMPRA
  ) {
    return `Factura compra: ${
      nota.documentoRelacionadoNumero ?? nota.referenciaDocumento ?? "Sin numero"
    }`;
  }

  if (
    nota.documentoRelacionadoTipo ===
    ContableNotaCreditoDocumentoTipo.CUENTA_POR_COBRAR
  ) {
    return `CxC: ${nota.documentoRelacionadoNumero ?? nota.referenciaDocumento ?? "Referencia manual"}`;
  }

  return nota.referenciaDocumento ?? "Otro documento";
}

function getEstadoBadge(estado: ContableNotaCreditoEstado) {
  const styles = {
    [ContableNotaCreditoEstado.BORRADOR]: "bg-slate-100 text-slate-800",
    [ContableNotaCreditoEstado.EMITIDA]: "bg-blue-100 text-blue-800",
    [ContableNotaCreditoEstado.APLICADA]: "bg-green-100 text-green-800",
    [ContableNotaCreditoEstado.ANULADA]: "bg-red-100 text-red-800",
  };

  return styles[estado];
}

export default function ContableNotasCredito() {
  const [notas, setNotas] = useState<ContableNotaCredito[]>([]);
  const [terceros, setTerceros] = useState<ContableTercero[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<ContableNotaCreditoTipo | "todos">(
    "todos"
  );
  const [filtroEstado, setFiltroEstado] = useState<
    ContableNotaCreditoEstado | "todos"
  >("todos");
  const [filtroTercero, setFiltroTercero] = useState("todos");
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
        const [notasData, tercerosData] = await Promise.all([
          getContableNotasCredito({
            q: busqueda || undefined,
            tipo: filtroTipo === "todos" ? undefined : filtroTipo,
            estado: filtroEstado === "todos" ? undefined : filtroEstado,
            terceroId: filtroTercero === "todos" ? undefined : filtroTercero,
          }),
          getContableTerceros(),
        ]);

        if (!activo) {
          return;
        }

        setNotas(notasData);
        setTerceros(
          tercerosData.filter(tercero =>
            [ContableTerceroTipo.CLIENTE, ContableTerceroTipo.PROVEEDOR].includes(
              tercero.tipoTercero
            )
          )
        );
      } catch (loadError) {
        if (!activo) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudieron cargar las notas credito"
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
  }, [busqueda, filtroEstado, filtroTercero, filtroTipo]);

  useEffect(() => {
    setPagina(1);
  }, [busqueda, filtroEstado, filtroTercero, filtroTipo]);

  const tercerosDisponibles = useMemo(() => {
    if (filtroTipo === "todos") {
      return terceros;
    }

    const tipoEsperado =
      filtroTipo === ContableNotaCreditoTipo.CLIENTE
        ? ContableTerceroTipo.CLIENTE
        : ContableTerceroTipo.PROVEEDOR;

    return terceros.filter(tercero => tercero.tipoTercero === tipoEsperado);
  }, [filtroTipo, terceros]);

  useEffect(() => {
    if (
      filtroTercero !== "todos" &&
      !tercerosDisponibles.some(tercero => tercero.id === filtroTercero)
    ) {
      setFiltroTercero("todos");
    }
  }, [filtroTercero, tercerosDisponibles]);

  const totalPaginas = Math.max(1, Math.ceil(notas.length / itemsPorPagina));

  useEffect(() => {
    setPagina(actual => Math.min(Math.max(actual, 1), totalPaginas));
  }, [totalPaginas]);

  const notasPaginadas = notas.slice(
    (pagina - 1) * itemsPorPagina,
    pagina * itemsPorPagina
  );

  const desde = notas.length === 0 ? 0 : (pagina - 1) * itemsPorPagina + 1;
  const hasta = notas.length === 0 ? 0 : Math.min(pagina * itemsPorPagina, notas.length);

  return (
    <DashboardLayout
      titulo="Notas Credito"
      descripcion="Registro y seguimiento de notas credito para clientes y proveedores"
      acciones={
        <Button asChild className="gap-2">
          <Link href="/contable/notas-credito/nuevo">
            <Plus size={18} />
            Nueva Nota
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
              placeholder="Buscar por numero, tercero, NIT o motivo..."
              value={busqueda}
              onChange={event => setBusqueda(event.target.value)}
              className="pl-10"
            />
          </div>

          <Select
            value={filtroTipo}
            onValueChange={value =>
              setFiltroTipo(value as ContableNotaCreditoTipo | "todos")
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los tipos</SelectItem>
              {Object.values(ContableNotaCreditoTipo).map(tipo => (
                <SelectItem key={tipo} value={tipo}>
                  {formatTipoLabel(tipo)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filtroEstado}
            onValueChange={value =>
              setFiltroEstado(value as ContableNotaCreditoEstado | "todos")
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              {Object.values(ContableNotaCreditoEstado).map(estado => (
                <SelectItem key={estado} value={estado}>
                  {formatEstadoLabel(estado)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <Select value={filtroTercero} onValueChange={setFiltroTercero}>
              <SelectTrigger>
                <SelectValue placeholder="Tercero" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los terceros</SelectItem>
                {tercerosDisponibles.map(tercero => (
                  <SelectItem key={tercero.id} value={tercero.id}>
                    {tercero.nombreRazonSocial}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2 flex items-center justify-end text-sm text-muted-foreground">
            {cargando
              ? "Cargando notas..."
              : `${notas.length} nota${notas.length !== 1 ? "s" : ""}`}
          </div>
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
                  Nota
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Tercero
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Tipo / Fecha
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Valor
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Estado
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Relacion
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
                    colSpan={7}
                    className="px-6 py-10 text-center text-sm text-muted-foreground"
                  >
                    Cargando notas credito...
                  </td>
                </tr>
              ) : notasPaginadas.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-10 text-center text-sm text-muted-foreground"
                  >
                    No se encontraron notas credito
                  </td>
                </tr>
              ) : (
                notasPaginadas.map((nota, index) => (
                  <tr
                    key={nota.id}
                    className={`border-b border-border transition-smooth hover:bg-accent ${
                      index % 2 === 0 ? "bg-background" : "bg-accent/40"
                    }`}
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-foreground">{nota.numeroNota}</p>
                      <p className="text-xs text-muted-foreground">
                        {nota.motivo}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-foreground">
                        {nota.terceroNombreRazonSocial}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {nota.terceroDocumentoNit}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-foreground">
                        {formatTipoLabel(nota.tipo)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(nota.fecha)}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-foreground">
                        {formatMoney(nota.valor)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {nota.afectaCartera ? "Preparada para cartera" : "Sin afectar cartera"}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${getEstadoBadge(
                          nota.estado
                        )}`}
                      >
                        {formatEstadoLabel(nota.estado)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-foreground">
                        {formatDocumentoRelacionadoLabel(nota)}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <Link
                          href={`/contable/notas-credito/${nota.id}`}
                          className="rounded p-2 text-muted-foreground transition-smooth hover:bg-background hover:text-foreground"
                          title="Ver nota"
                        >
                          <Eye size={18} />
                        </Link>
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
            Mostrando {desde} a {hasta} de {notas.length}
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
