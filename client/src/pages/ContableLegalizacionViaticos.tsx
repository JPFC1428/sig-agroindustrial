import { useEffect, useState } from "react";
import {
  Download,
  Edit,
  Eye,
  FileSpreadsheet,
  Paperclip,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  getContableLegalizacionViaticoSupportUrl,
  downloadContableLegalizacionViaticosExcel,
  downloadContableLegalizacionViaticosPdf,
  getContableLegalizacionViaticos,
  getContableLegalizacionViaticosVendedores,
  updateContableLegalizacionViatico,
} from "@/lib/contable-viaticos-api";
import { canAccessPath } from "@/lib/access-control";
import { useAuth } from "@/contexts/AuthContext";
import {
  ContableLegalizacionViaticoEstado,
  ViaticoTipoGasto,
  type ContableLegalizacionViatico,
  type ContableLegalizacionViaticoVendedor,
} from "@/lib/types";

type FormValues = {
  legalizacionEstado: ContableLegalizacionViaticoEstado;
  legalizacionObservaciones: string;
};

function formatMoney(value: number) {
  return `$${new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(value)}`;
}

function formatDate(value: Date) {
  return value.toLocaleDateString("es-CO");
}

function formatEstadoLabel(estado: ContableLegalizacionViaticoEstado) {
  switch (estado) {
    case ContableLegalizacionViaticoEstado.PENDIENTE:
      return "Pendiente";
    case ContableLegalizacionViaticoEstado.LEGALIZADO:
      return "Legalizado";
    case ContableLegalizacionViaticoEstado.APROBADO:
      return "Aprobado";
    case ContableLegalizacionViaticoEstado.RECHAZADO:
      return "Rechazado";
    default:
      return estado;
  }
}

function getEstadoBadge(estado: ContableLegalizacionViaticoEstado) {
  const styles = {
    [ContableLegalizacionViaticoEstado.PENDIENTE]:
      "bg-amber-100 text-amber-800",
    [ContableLegalizacionViaticoEstado.LEGALIZADO]: "bg-blue-100 text-blue-800",
    [ContableLegalizacionViaticoEstado.APROBADO]:
      "bg-green-100 text-green-800",
    [ContableLegalizacionViaticoEstado.RECHAZADO]: "bg-red-100 text-red-800",
  };

  return styles[estado];
}

function formatTipoLabel(tipo: ViaticoTipoGasto) {
  switch (tipo) {
    case ViaticoTipoGasto.PEAJES:
      return "Peajes";
    case ViaticoTipoGasto.GASOLINA:
      return "Gasolina";
    case ViaticoTipoGasto.ESTADIA:
      return "Estadia";
    case ViaticoTipoGasto.ALIMENTACION:
      return "Alimentacion";
    default:
      return tipo;
  }
}

function getTipoBadge(tipo: ViaticoTipoGasto) {
  const styles = {
    [ViaticoTipoGasto.PEAJES]: "bg-slate-100 text-slate-800",
    [ViaticoTipoGasto.GASOLINA]: "bg-emerald-100 text-emerald-800",
    [ViaticoTipoGasto.ESTADIA]: "bg-violet-100 text-violet-800",
    [ViaticoTipoGasto.ALIMENTACION]: "bg-orange-100 text-orange-800",
  };

  return styles[tipo];
}

function getRelacionadoLabel(item: ContableLegalizacionViatico) {
  const nombre = item.relacionadoNombre ?? "Sin relacionado";
  const empresa = item.relacionadoEmpresa ?? "";
  return empresa ? `${nombre} - ${empresa}` : nombre;
}

function buildInitialForm(
  item: ContableLegalizacionViatico | null
): FormValues | null {
  if (!item) {
    return null;
  }

  return {
    legalizacionEstado: item.legalizacionEstado,
    legalizacionObservaciones: item.legalizacionObservaciones ?? "",
  };
}

export default function ContableLegalizacionViaticos() {
  const { user } = useAuth();
  const [items, setItems] = useState<ContableLegalizacionViatico[]>([]);
  const [vendedores, setVendedores] = useState<
    ContableLegalizacionViaticoVendedor[]
  >([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtroVendedor, setFiltroVendedor] = useState("todos");
  const [filtroEstado, setFiltroEstado] = useState<
    ContableLegalizacionViaticoEstado | "todos"
  >("todos");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [exportandoFormato, setExportandoFormato] = useState<
    "excel" | "pdf" | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [itemEditando, setItemEditando] =
    useState<ContableLegalizacionViatico | null>(null);
  const [form, setForm] = useState<FormValues | null>(null);

  useEffect(() => {
    let activo = true;

    async function cargarVendedores() {
      try {
        const data = await getContableLegalizacionViaticosVendedores();

        if (!activo) {
          return;
        }

        setVendedores(data);
      } catch {
        if (!activo) {
          return;
        }

        setVendedores([]);
      }
    }

    void cargarVendedores();

    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    let activo = true;

    async function cargar() {
      setCargando(true);
      setError(null);

      try {
        const data = await getContableLegalizacionViaticos({
          estado: filtroEstado === "todos" ? undefined : filtroEstado,
          fechaDesde: fechaDesde || undefined,
          fechaHasta: fechaHasta || undefined,
          q: busqueda || undefined,
          vendedorId: filtroVendedor === "todos" ? undefined : filtroVendedor,
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
            : "No se pudo cargar la legalizacion de viaticos"
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
  }, [busqueda, fechaDesde, fechaHasta, filtroEstado, filtroVendedor]);

  const resumen = items.reduce(
    (acc, item) => {
      acc.total += item.valor;
      acc.registros += 1;
      acc.estados[item.legalizacionEstado] += 1;
      acc.tipos[item.tipoGasto] += item.valor;
      return acc;
    },
    {
      estados: {
        [ContableLegalizacionViaticoEstado.PENDIENTE]: 0,
        [ContableLegalizacionViaticoEstado.LEGALIZADO]: 0,
        [ContableLegalizacionViaticoEstado.APROBADO]: 0,
        [ContableLegalizacionViaticoEstado.RECHAZADO]: 0,
      },
      registros: 0,
      tipos: {
        [ViaticoTipoGasto.PEAJES]: 0,
        [ViaticoTipoGasto.GASOLINA]: 0,
        [ViaticoTipoGasto.ESTADIA]: 0,
        [ViaticoTipoGasto.ALIMENTACION]: 0,
      },
      total: 0,
    }
  );

  const gruposMap = new Map<
    string,
    {
      items: ContableLegalizacionViatico[];
      nombre: string;
      total: number;
    }
  >();

  items.forEach(item => {
    const groupKey = item.usuarioId ?? "sin-vendedor";
    const groupName = item.usuarioNombre ?? "Sin vendedor";
    const currentGroup = gruposMap.get(groupKey);

    if (currentGroup) {
      currentGroup.items.push(item);
      currentGroup.total += item.valor;
      return;
    }

    gruposMap.set(groupKey, {
      items: [item],
      nombre: groupName,
      total: item.valor,
    });
  });

  const grupos = Array.from(gruposMap.entries())
    .map(([id, group]) => ({
      id,
      ...group,
      items: [...group.items].sort(
        (left, right) => right.fecha.getTime() - left.fecha.getTime()
      ),
    }))
    .sort((left, right) => left.nombre.localeCompare(right.nombre, "es"));
  const canOpenVisita = user ? canAccessPath(user.rol, "/visitas") : false;

  function abrirDialogo(item: ContableLegalizacionViatico) {
    setItemEditando(item);
    setForm(buildInitialForm(item));
    setDialogoAbierto(true);
  }

  function cerrarDialogo() {
    if (guardando) {
      return;
    }

    setDialogoAbierto(false);
    setItemEditando(null);
    setForm(null);
  }

  function updateField<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setForm(current => (current ? { ...current, [field]: value } : current));
  }

  async function handleGuardar() {
    if (!itemEditando || !form) {
      return;
    }

    setGuardando(true);
    setError(null);

    try {
      const updated = await updateContableLegalizacionViatico(itemEditando.id, {
        legalizacionEstado: form.legalizacionEstado,
        legalizacionObservaciones:
          form.legalizacionObservaciones.trim() || undefined,
      });

      setItems(current =>
        current.map(item => (item.id === updated.id ? updated : item))
      );
      toast.success("Legalizacion actualizada");
      cerrarDialogo();
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "No se pudo actualizar la legalizacion";

      setError(message);
      toast.error(message);
    } finally {
      setGuardando(false);
    }
  }

  async function handleExportar(formato: "excel" | "pdf") {
    setExportandoFormato(formato);
    setError(null);

    try {
      const filters = {
        estado: filtroEstado === "todos" ? undefined : filtroEstado,
        fechaDesde: fechaDesde || undefined,
        fechaHasta: fechaHasta || undefined,
        q: busqueda || undefined,
        vendedorId: filtroVendedor === "todos" ? undefined : filtroVendedor,
      };

      if (formato === "excel") {
        await downloadContableLegalizacionViaticosExcel(filters);
      } else {
        await downloadContableLegalizacionViaticosPdf(filters);
      }
    } catch (exportError) {
      const message =
        exportError instanceof Error
          ? exportError.message
          : "No se pudo exportar la relacion de viaticos";

      setError(message);
      toast.error(message);
    } finally {
      setExportandoFormato(null);
    }
  }

  return (
    <DashboardLayout
      titulo="Legalizacion de Viaticos"
      descripcion="Revision contable de gastos comerciales, soportes y estados de legalizacion"
      acciones={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="gap-2"
            disabled={exportandoFormato !== null || items.length === 0}
            onClick={() => void handleExportar("excel")}
          >
            <FileSpreadsheet size={16} />
            {exportandoFormato === "excel" ? "Exportando..." : "Excel"}
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            disabled={exportandoFormato !== null || items.length === 0}
            onClick={() => void handleExportar("pdf")}
          >
            <Download size={16} />
            {exportandoFormato === "pdf" ? "Exportando..." : "PDF"}
          </Button>
        </div>
      }
    >
      <div className="mb-6 rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
          <div className="relative md:col-span-2">
            <Search
              size={18}
              className="absolute left-3 top-3 text-muted-foreground"
            />
            <Input
              placeholder="Buscar visita, cliente, soporte o descripcion..."
              value={busqueda}
              onChange={event => setBusqueda(event.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={filtroVendedor} onValueChange={setFiltroVendedor}>
            <SelectTrigger className="md:col-span-2">
              <SelectValue placeholder="Vendedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los vendedores</SelectItem>
              {vendedores.map(vendedor => (
                <SelectItem
                  key={vendedor.id ?? vendedor.nombre}
                  value={vendedor.id ?? "sin-vendedor"}
                >
                  {vendedor.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filtroEstado}
            onValueChange={value =>
              setFiltroEstado(value as ContableLegalizacionViaticoEstado | "todos")
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              {Object.values(ContableLegalizacionViaticoEstado).map(estado => (
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
              max={fechaHasta || undefined}
              onChange={event => setFechaDesde(event.target.value)}
            />
            <Input
              type="date"
              value={fechaHasta}
              min={fechaDesde || undefined}
              onChange={event => setFechaHasta(event.target.value)}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end text-sm text-muted-foreground">
          {cargando
            ? "Cargando legalizacion..."
            : `${items.length} gasto${items.length !== 1 ? "s" : ""} en revision`}
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Total general</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {formatMoney(resumen.total)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {resumen.registros} registro{resumen.registros === 1 ? "" : "s"}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Pendientes</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {resumen.estados[ContableLegalizacionViaticoEstado.PENDIENTE]}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Legalizar antes de conectar egresos
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Aprobados</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {resumen.estados[ContableLegalizacionViaticoEstado.APROBADO]}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Listos para cruce contable
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Totales por tipo</p>
          <div className="mt-2 space-y-1 text-sm text-foreground">
            <p>Peajes: {formatMoney(resumen.tipos[ViaticoTipoGasto.PEAJES])}</p>
            <p>
              Gasolina: {formatMoney(resumen.tipos[ViaticoTipoGasto.GASOLINA])}
            </p>
            <p>Estadia: {formatMoney(resumen.tipos[ViaticoTipoGasto.ESTADIA])}</p>
            <p>
              Alimentacion:{" "}
              {formatMoney(resumen.tipos[ViaticoTipoGasto.ALIMENTACION])}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {cargando ? (
          <div className="rounded-lg border border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground shadow-sm">
            Cargando legalizacion de viaticos...
          </div>
        ) : grupos.length === 0 ? (
          <div className="rounded-lg border border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground shadow-sm">
            No se encontraron viaticos para los filtros seleccionados
          </div>
        ) : (
          grupos.map(grupo => (
            <div
              key={grupo.id}
              className="rounded-lg border border-border bg-card shadow-sm"
            >
              <div className="flex flex-col gap-2 border-b border-border px-6 py-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-lg font-semibold text-foreground">
                    {grupo.nombre}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {grupo.items.length} gasto
                    {grupo.items.length === 1 ? "" : "s"} en el rango consultado
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total vendedor</p>
                  <p className="text-lg font-semibold text-foreground">
                    {formatMoney(grupo.total)}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-accent">
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                        Visita
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                        Fecha
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                        Tipo
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                        Valor
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                        Soporte
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                        Estado
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                        Observaciones
                      </th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-foreground">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {grupo.items.map((item, index) => (
                      <tr
                        key={item.id}
                        className={`border-b border-border transition-smooth hover:bg-accent ${
                          index % 2 === 0 ? "bg-background" : "bg-accent/40"
                        }`}
                      >
                        <td className="px-6 py-4">
                          <p className="font-medium text-foreground">
                            {getRelacionadoLabel(item)}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Visita #{item.visitaId}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {item.visitaObjetivo}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-sm text-foreground">
                          <p>Gasto: {formatDate(item.fecha)}</p>
                          <p className="text-xs text-muted-foreground">
                            Visita: {formatDate(item.visitaFecha)}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${getTipoBadge(
                              item.tipoGasto
                            )}`}
                          >
                            {formatTipoLabel(item.tipoGasto)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-foreground">
                          {formatMoney(item.valor)}
                        </td>
                        <td className="px-6 py-4 text-sm text-foreground">
                          {item.soporte ? (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-sm">
                                <Paperclip size={14} className="text-muted-foreground" />
                                <span className="break-all">{item.soporte.fileName}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1 text-xs text-primary transition-smooth hover:underline"
                                  onClick={() =>
                                    window.open(
                                      getContableLegalizacionViaticoSupportUrl(
                                        item.id,
                                        "view"
                                      ),
                                      "_blank",
                                      "noopener,noreferrer"
                                    )
                                  }
                                >
                                  <Eye size={12} />
                                  Ver
                                </button>
                                <a
                                  href={getContableLegalizacionViaticoSupportUrl(
                                    item.id,
                                    "download"
                                  )}
                                  className="inline-flex items-center gap-1 text-xs text-primary transition-smooth hover:underline"
                                >
                                  <Download size={12} />
                                  Descargar
                                </a>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Sin soporte
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-2">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getEstadoBadge(
                                item.legalizacionEstado
                              )}`}
                            >
                              {formatEstadoLabel(item.legalizacionEstado)}
                            </span>
                            {item.contableEgresoId && (
                              <p className="text-xs text-muted-foreground">
                                Vinculado a egreso
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-foreground">
                          <div className="space-y-2">
                            <p>{item.observaciones ?? "Sin observaciones"}</p>
                            <p className="text-xs text-muted-foreground">
                              Contable:{" "}
                              {item.legalizacionObservaciones ??
                                "Sin observaciones contables"}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            {canOpenVisita && (
                              <Link
                                href={`/visitas/${item.visitaId}`}
                                className="rounded p-2 text-muted-foreground transition-smooth hover:bg-background hover:text-foreground"
                                title="Abrir visita"
                              >
                                <Eye size={18} />
                              </Link>
                            )}
                            <button
                              type="button"
                              title="Gestionar legalizacion"
                              onClick={() => abrirDialogo(item)}
                              className="rounded p-2 text-muted-foreground transition-smooth hover:bg-background hover:text-foreground"
                            >
                              <Edit size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={dialogoAbierto} onOpenChange={open => !guardando && !open && cerrarDialogo()}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Gestionar legalizacion</DialogTitle>
            <DialogDescription>
              Actualiza el estado contable y deja observaciones para el cruce
              posterior con comprobantes de egreso.
            </DialogDescription>
          </DialogHeader>

          {itemEditando && form && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-accent/40 p-4 text-sm">
                <p className="font-medium text-foreground">
                  {getRelacionadoLabel(itemEditando)}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {formatTipoLabel(itemEditando.tipoGasto)} por{" "}
                  {formatMoney(itemEditando.valor)} el {formatDate(itemEditando.fecha)}
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="legalizacion-estado">Estado</Label>
                <Select
                  value={form.legalizacionEstado}
                  onValueChange={value =>
                    updateField(
                      "legalizacionEstado",
                      value as ContableLegalizacionViaticoEstado
                    )
                  }
                >
                  <SelectTrigger id="legalizacion-estado">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(ContableLegalizacionViaticoEstado).map(estado => (
                      <SelectItem key={estado} value={estado}>
                        {formatEstadoLabel(estado)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="legalizacion-observaciones">
                  Observaciones contables
                </Label>
                <Textarea
                  id="legalizacion-observaciones"
                  value={form.legalizacionObservaciones}
                  onChange={event =>
                    updateField("legalizacionObservaciones", event.target.value)
                  }
                  rows={5}
                  placeholder="Anota la revision, soportes validados, ajustes o motivo de rechazo"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={cerrarDialogo} disabled={guardando}>
              Cancelar
            </Button>
            <Button onClick={() => void handleGuardar()} disabled={guardando || !form}>
              {guardando ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
