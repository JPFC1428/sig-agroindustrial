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
import { getSertecOrdenes } from "@/lib/sertec-api";
import { SertecOrdenEstado, type SertecOrden } from "@/lib/types";

function formatDate(value: Date) {
  return value.toLocaleDateString("es-CO");
}

function getEstadoBadge(estado: SertecOrdenEstado) {
  const styles = {
    [SertecOrdenEstado.ENTRADA]: "bg-blue-100 text-blue-800",
    [SertecOrdenEstado.REPARACION]: "bg-amber-100 text-amber-800",
    [SertecOrdenEstado.SALIDA]: "bg-emerald-100 text-emerald-800",
  };

  return styles[estado];
}

export default function Sertec() {
  const [ordenes, setOrdenes] = useState<SertecOrden[]>([]);
  const [filtroNumero, setFiltroNumero] = useState("");
  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtroSerial, setFiltroSerial] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<SertecOrdenEstado | "todos">(
    "todos"
  );
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
        const data = await getSertecOrdenes({
          cliente: filtroCliente || undefined,
          estado: filtroEstado === "todos" ? undefined : filtroEstado,
          numero: filtroNumero || undefined,
          serial: filtroSerial || undefined,
        });

        if (!activo) {
          return;
        }

        setOrdenes(data);
      } catch (loadError) {
        if (!activo) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudieron cargar las ordenes SERTEC"
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
  }, [filtroCliente, filtroEstado, filtroNumero, filtroSerial]);

  useEffect(() => {
    setPagina(1);
  }, [filtroCliente, filtroEstado, filtroNumero, filtroSerial]);

  const ordenesFiltradas = useMemo(() => ordenes, [ordenes]);

  const totalPaginas = Math.max(
    1,
    Math.ceil(ordenesFiltradas.length / itemsPorPagina)
  );

  useEffect(() => {
    setPagina(actual => Math.min(Math.max(actual, 1), totalPaginas));
  }, [totalPaginas]);

  const ordenesPaginadas = ordenesFiltradas.slice(
    (pagina - 1) * itemsPorPagina,
    pagina * itemsPorPagina
  );

  const desde =
    ordenesFiltradas.length === 0 ? 0 : (pagina - 1) * itemsPorPagina + 1;
  const hasta =
    ordenesFiltradas.length === 0
      ? 0
      : Math.min(pagina * itemsPorPagina, ordenesFiltradas.length);

  const estados = Object.values(SertecOrdenEstado);

  return (
    <DashboardLayout
      titulo="SERTEC"
      descripcion="Ordenes de servicio tecnico, historial y adjuntos"
      acciones={
        <Button asChild className="gap-2">
          <Link href="/sertec/nuevo">
            <Plus size={18} />
            Nueva Orden
          </Link>
        </Button>
      }
    >
      <div className="mb-6 rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-3 text-muted-foreground"
            />
            <Input
              placeholder="Consecutivo"
              value={filtroNumero}
              onChange={event => setFiltroNumero(event.target.value)}
              className="pl-10"
            />
          </div>

          <Input
            placeholder="Cliente"
            value={filtroCliente}
            onChange={event => setFiltroCliente(event.target.value)}
          />

          <Input
            placeholder="Serial"
            value={filtroSerial}
            onChange={event => setFiltroSerial(event.target.value)}
          />

          <Select
            value={filtroEstado}
            onValueChange={value =>
              setFiltroEstado(value as SertecOrdenEstado | "todos")
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              {estados.map(estado => (
                <SelectItem key={estado} value={estado}>
                  {estado.charAt(0).toUpperCase() + estado.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="mt-4 flex items-center justify-end text-sm text-muted-foreground">
          {cargando
            ? "Cargando ordenes..."
            : `${ordenesFiltradas.length} orden${
                ordenesFiltradas.length !== 1 ? "es" : ""
              }`}
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
                  Orden
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Cliente
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Equipo
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Ingreso
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
                    Cargando ordenes SERTEC...
                  </td>
                </tr>
              ) : ordenesPaginadas.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-10 text-center text-sm text-muted-foreground"
                  >
                    No se encontraron ordenes
                  </td>
                </tr>
              ) : (
                ordenesPaginadas.map((orden, index) => (
                  <tr
                    key={orden.id}
                    className={`border-b border-border transition-smooth hover:bg-accent ${
                      index % 2 === 0 ? "bg-background" : "bg-accent/40"
                    }`}
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-foreground">{orden.numero}</p>
                      <p className="text-xs text-muted-foreground">
                        {orden.fallaReportada}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-foreground">
                        {orden.clienteNombre}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {orden.clienteTelefono ?? "Sin telefono"}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-foreground">
                        {orden.equipoTipo}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {[orden.equipoMarca, orden.equipoModelo, orden.equipoSerial]
                          .filter(Boolean)
                          .join(" | ") || "Sin datos adicionales"}
                      </p>
                      {orden.equipoVendidoDescripcion && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Origen comercial: {orden.equipoVendidoDescripcion}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      {formatDate(orden.fechaIngreso)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${getEstadoBadge(
                          orden.estado
                        )}`}
                      >
                        {orden.estado.charAt(0).toUpperCase() + orden.estado.slice(1)}
                      </span>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {orden.garantia?.aplica ? "Garantia aplica" : "Sin garantia"}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center">
                        <Link
                          href={`/sertec/${orden.id}`}
                          className="rounded p-2 text-muted-foreground transition-smooth hover:bg-background hover:text-foreground"
                          title="Ver detalle"
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
            Mostrando {desde} a {hasta} de {ordenesFiltradas.length}
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
              disabled={
                pagina === totalPaginas || ordenesFiltradas.length === 0
              }
            >
              Siguiente
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
