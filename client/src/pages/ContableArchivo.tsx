import { useEffect, useState } from "react";
import { Download, Eye, Search } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getContableArchivo } from "@/lib/contable-archivo-api";
import {
  ContableArchivoDocumentoTipo,
  type ContableArchivoDocumento,
} from "@/lib/types";

function formatDate(value: Date) {
  return value.toLocaleDateString("es-CO");
}

function formatTipoLabel(tipo: ContableArchivoDocumentoTipo) {
  switch (tipo) {
    case ContableArchivoDocumentoTipo.FACTURA_COMPRA:
      return "Factura de Compra";
    case ContableArchivoDocumentoTipo.EGRESO:
      return "Comprobante de Egreso";
    case ContableArchivoDocumentoTipo.RECIBO_CAJA:
      return "Recibo de Caja";
    case ContableArchivoDocumentoTipo.VIATICO:
      return "Viatico";
    default:
      return tipo;
  }
}

function getTipoBadge(tipo: ContableArchivoDocumentoTipo) {
  const styles = {
    [ContableArchivoDocumentoTipo.FACTURA_COMPRA]:
      "bg-amber-100 text-amber-800",
    [ContableArchivoDocumentoTipo.EGRESO]: "bg-rose-100 text-rose-800",
    [ContableArchivoDocumentoTipo.RECIBO_CAJA]: "bg-emerald-100 text-emerald-800",
    [ContableArchivoDocumentoTipo.VIATICO]: "bg-blue-100 text-blue-800",
  };

  return styles[tipo];
}

export default function ContableArchivo() {
  const [items, setItems] = useState<ContableArchivoDocumento[]>([]);
  const [filtroTipo, setFiltroTipo] = useState<
    ContableArchivoDocumentoTipo | "todos"
  >("todos");
  const [filtroTercero, setFiltroTercero] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;

    async function cargar() {
      setCargando(true);
      setError(null);

      try {
        const data = await getContableArchivo({
          tipoDocumento: filtroTipo === "todos" ? undefined : filtroTipo,
          tercero: filtroTercero || undefined,
          fechaDesde: fechaDesde || undefined,
          fechaHasta: fechaHasta || undefined,
        });

        if (!activo) {
          return;
        }

        setItems(data);
      } catch (loadError) {
        if (!activo) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudo cargar el archivo contable"
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
  }, [filtroTipo, filtroTercero, fechaDesde, fechaHasta]);

  return (
    <DashboardLayout
      titulo="Archivo Contable"
      descripcion="Consulta central de documentos y soportes del modulo contable"
    >
      <div className="mb-6 rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <div className="relative md:col-span-2">
            <Search
              size={18}
              className="absolute left-3 top-3 text-muted-foreground"
            />
            <Input
              placeholder="Buscar tercero, cliente, proveedor o documento..."
              value={filtroTercero}
              onChange={event => setFiltroTercero(event.target.value)}
              className="pl-10"
            />
          </div>

          <Select
            value={filtroTipo}
            onValueChange={value =>
              setFiltroTipo(value as ContableArchivoDocumentoTipo | "todos")
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Tipo de documento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los tipos</SelectItem>
              {Object.values(ContableArchivoDocumentoTipo).map(tipo => (
                <SelectItem key={tipo} value={tipo}>
                  {formatTipoLabel(tipo)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="date"
            value={fechaDesde}
            onChange={event => setFechaDesde(event.target.value)}
          />

          <Input
            type="date"
            value={fechaHasta}
            onChange={event => setFechaHasta(event.target.value)}
          />
        </div>

        <div className="mt-4 flex items-center justify-end text-sm text-muted-foreground">
          {cargando
            ? "Cargando archivo..."
            : `${items.length} documento${items.length !== 1 ? "s" : ""}`}
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
                  Tipo
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Tercero relacionado
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Fecha
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Referencia
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Soporte
                </th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-10 text-center text-sm text-muted-foreground"
                  >
                    Cargando archivo contable...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-10 text-center text-sm text-muted-foreground"
                  >
                    No se encontraron documentos para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                items.map((item, index) => (
                  <tr
                    key={`${item.tipoDocumento}-${item.id}`}
                    className={`border-b border-border ${
                      index % 2 === 0 ? "bg-background" : "bg-accent/40"
                    }`}
                  >
                    <td className="px-6 py-4 align-top">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getTipoBadge(
                          item.tipoDocumento
                        )}`}
                      >
                        {formatTipoLabel(item.tipoDocumento)}
                      </span>
                    </td>
                    <td className="px-6 py-4 align-top">
                      <p className="font-medium text-foreground">
                        {item.terceroNombreRazonSocial ?? "Sin tercero relacionado"}
                      </p>
                      {item.terceroDocumentoNit && (
                        <p className="text-sm text-muted-foreground">
                          {item.terceroDocumentoNit}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 align-top text-sm text-foreground">
                      {formatDate(item.fecha)}
                    </td>
                    <td className="px-6 py-4 align-top">
                      <p className="text-sm font-medium text-foreground">
                        {item.referencia}
                      </p>
                    </td>
                    <td className="px-6 py-4 align-top">
                      {item.soporteViewUrl ? (
                        <div className="space-y-2">
                          <p className="text-sm text-foreground">
                            {item.soporteNombre ?? "Soporte disponible"}
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <a
                              href={item.soporteViewUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-foreground transition-smooth hover:bg-accent"
                            >
                              <Eye size={16} />
                              Ver
                            </a>
                            <a
                              href={item.soporteDownloadUrl ?? item.soporteViewUrl}
                              target="_blank"
                              rel="noreferrer"
                              download
                              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-foreground transition-smooth hover:bg-accent"
                            >
                              <Download size={16} />
                              Descargar
                            </a>
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Sin soporte
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
