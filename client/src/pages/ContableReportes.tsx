import { useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, Search } from "lucide-react";
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
import {
  downloadContableReportesExcel,
  downloadContableReportesPdf,
  getContableReportes,
  type ContableReportesFilters,
} from "@/lib/contable-reportes-api";
import { getContableLegalizacionViaticoSupportUrl } from "@/lib/contable-viaticos-api";
import {
  ContableCarteraEstado,
  ContableFacturaCompraEstado,
  ContableLegalizacionViaticoEstado,
  ViaticoTipoGasto,
  type ContableEgreso,
  type ContableFacturaCompra,
  type ContableReporteEstadoFiltro,
  type ContableReporteMovimientoBancario,
  type ContableReportesData,
  type ContableReciboCaja,
} from "@/lib/types";

function formatMoney(value: number) {
  return `$${new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(value)}`;
}

function formatDate(value: Date) {
  return value.toLocaleDateString("es-CO");
}

function formatEstadoFiltroLabel(estado: ContableReporteEstadoFiltro) {
  switch (estado) {
    case "pendiente":
      return "Pendiente";
    case "parcial":
      return "Parcial";
    case "pagado":
      return "Pagado";
    case "vencida":
      return "Vencida";
    case "anulada":
      return "Anulada";
    case "legalizado":
      return "Legalizado";
    case "aprobado":
      return "Aprobado";
    case "rechazado":
      return "Rechazado";
    case "conciliado":
      return "Conciliado";
    case "no_conciliado":
      return "No conciliado";
    default:
      return estado;
  }
}

function formatFacturaEstadoLabel(estado: ContableFacturaCompraEstado) {
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

function formatCarteraEstadoLabel(estado: ContableCarteraEstado) {
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

function formatLegalizacionEstadoLabel(estado: ContableLegalizacionViaticoEstado) {
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

function formatTipoGastoLabel(tipo: ViaticoTipoGasto) {
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

function formatMetodoPagoLabel(value: string) {
  switch (value) {
    case "efectivo":
      return "Efectivo";
    case "transferencia":
      return "Transferencia";
    case "cheque":
      return "Cheque";
    case "tarjeta":
      return "Tarjeta";
    case "otro":
      return "Otro";
    default:
      return value;
  }
}

function getEstadoBadgeClass(value: string) {
  switch (value) {
    case "Pendiente":
      return "bg-amber-100 text-amber-800";
    case "Parcial":
    case "Legalizado":
      return "bg-blue-100 text-blue-800";
    case "Pagado":
    case "Pagada":
    case "Aprobado":
    case "Conciliado":
      return "bg-green-100 text-green-800";
    case "Vencida":
    case "Rechazado":
    case "Anulada":
    case "No conciliado":
      return "bg-red-100 text-red-800";
    default:
      return "bg-slate-100 text-slate-800";
  }
}

function ResumenCard({
  detail,
  label,
  value,
}: {
  detail: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function SectionHeader({
  detail,
  title,
}: {
  detail: string;
  title: string;
}) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}

function EmptyState({ columns, message }: { columns: number; message: string }) {
  return (
    <tr>
      <td
        colSpan={columns}
        className="px-6 py-8 text-center text-sm text-muted-foreground"
      >
        {message}
      </td>
    </tr>
  );
}

function renderTercero(
  item: ContableFacturaCompra | ContableEgreso | ContableReciboCaja
) {
  return (
    <>
      <p className="font-medium text-foreground">{item.terceroNombreRazonSocial}</p>
      <p className="text-sm text-muted-foreground">{item.terceroDocumentoNit}</p>
    </>
  );
}

export default function ContableReportes() {
  const [report, setReport] = useState<ContableReportesData | null>(null);
  const [tercero, setTercero] = useState("");
  const [estado, setEstado] = useState<ContableReporteEstadoFiltro | "todos">(
    "todos"
  );
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportando, setExportando] = useState<"excel" | "pdf" | null>(null);

  const filters = useMemo<ContableReportesFilters>(
    () => ({
      estado: estado === "todos" ? undefined : estado,
      fechaDesde: fechaDesde || undefined,
      fechaHasta: fechaHasta || undefined,
      tercero: tercero || undefined,
    }),
    [estado, fechaDesde, fechaHasta, tercero]
  );

  useEffect(() => {
    let activo = true;

    async function cargar() {
      setCargando(true);
      setError(null);

      try {
        const data = await getContableReportes(filters);

        if (!activo) {
          return;
        }

        setReport(data);
      } catch (loadError) {
        if (!activo) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudieron cargar los reportes contables"
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
  }, [filters]);

  async function handleExport(format: "excel" | "pdf") {
    setExportando(format);

    try {
      if (format === "excel") {
        await downloadContableReportesExcel(filters);
      } else {
        await downloadContableReportesPdf(filters);
      }
    } catch (exportError) {
      toast.error(
        exportError instanceof Error
          ? exportError.message
          : "No se pudo exportar el reporte"
      );
    } finally {
      setExportando(null);
    }
  }

  const resumen = report?.resumen;
  const conciliacion = report?.conciliacion;

  return (
    <DashboardLayout
      titulo="Reportes Contables"
      descripcion="Vista central de facturas, egresos, recibos, cartera, viaticos y movimientos bancarios"
      acciones={
        <>
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => void handleExport("pdf")}
            disabled={exportando !== null}
          >
            <Download size={16} />
            {exportando === "pdf" ? "Exportando..." : "PDF"}
          </Button>
          <Button
            type="button"
            className="gap-2"
            onClick={() => void handleExport("excel")}
            disabled={exportando !== null}
          >
            <FileSpreadsheet size={16} />
            {exportando === "excel" ? "Exportando..." : "Excel"}
          </Button>
        </>
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
              placeholder="Filtrar por tercero, NIT o referencia..."
              value={tercero}
              onChange={event => setTercero(event.target.value)}
              className="pl-10"
            />
          </div>

          <Select
            value={estado}
            onValueChange={value =>
              setEstado(value as ContableReporteEstadoFiltro | "todos")
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              {[
                "pendiente",
                "parcial",
                "pagado",
                "vencida",
                "anulada",
                "legalizado",
                "aprobado",
                "rechazado",
                "conciliado",
                "no_conciliado",
              ].map(item => (
                <SelectItem key={item} value={item}>
                  {formatEstadoFiltroLabel(item as ContableReporteEstadoFiltro)}
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
            min={fechaDesde || undefined}
            onChange={event => setFechaHasta(event.target.value)}
          />
        </div>

        <div className="mt-4 flex items-center justify-end text-sm text-muted-foreground">
          {cargando
            ? "Cargando reportes..."
            : `${(report?.facturasCompra.length ?? 0) +
                (report?.egresos.length ?? 0) +
                (report?.recibosCaja.length ?? 0) +
                (report?.viaticos.length ?? 0)} registros principales cargados`}
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <ResumenCard
          label="Facturas de compra"
          value={formatMoney(resumen?.totalFacturasCompra ?? 0)}
          detail={`${report?.facturasCompra.length ?? 0} registros`}
        />
        <ResumenCard
          label="Egresos"
          value={formatMoney(resumen?.totalEgresos ?? 0)}
          detail={`${report?.egresos.length ?? 0} comprobantes`}
        />
        <ResumenCard
          label="Recibos de caja"
          value={formatMoney(resumen?.totalRecibosCaja ?? 0)}
          detail={`${report?.recibosCaja.length ?? 0} recibos`}
        />
        <ResumenCard
          label="Saldo cartera proveedores"
          value={formatMoney(resumen?.saldoCarteraProveedores ?? 0)}
          detail={`${report?.carteraProveedores.length ?? 0} documentos`}
        />
        <ResumenCard
          label="Saldo cartera clientes"
          value={formatMoney(resumen?.saldoCarteraClientes ?? 0)}
          detail={`${report?.carteraClientes.length ?? 0} cuentas`}
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <ResumenCard
          label="Viaticos"
          value={formatMoney(resumen?.totalViaticos ?? 0)}
          detail={`${report?.viaticos.length ?? 0} gastos`}
        />
        <ResumenCard
          label="Ingresos bancarios"
          value={formatMoney(resumen?.totalIngresosBancarios ?? 0)}
          detail={`${report?.movimientosBancarios.filter(item => item.tipo === "ingreso").length ?? 0} movimientos`}
        />
        <ResumenCard
          label="Egresos bancarios"
          value={formatMoney(resumen?.totalEgresosBancarios ?? 0)}
          detail={`${report?.movimientosBancarios.filter(item => item.tipo === "egreso").length ?? 0} movimientos`}
        />
        <ResumenCard
          label="Saldo sistema"
          value={formatMoney(resumen?.saldoBancarioSistema ?? 0)}
          detail="Calculado sobre movimientos bancarios filtrados"
        />
        <ResumenCard
          label="Diferencia conciliacion"
          value={formatMoney(resumen?.diferenciaConciliacion ?? 0)}
          detail={`${conciliacion?.movimientosPendientes ?? 0} movimientos pendientes`}
        />
      </div>

      <div className="mb-6 rounded-lg border border-border bg-card p-6 shadow-sm">
        <SectionHeader
          title="Resumen de Conciliacion"
          detail="Consolidado de ingresos, egresos y estado de conciliacion bancaria"
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <ResumenCard
            label="Movimientos conciliados"
            value={String(conciliacion?.movimientosConciliados ?? 0)}
            detail="Registros marcados como conciliados"
          />
          <ResumenCard
            label="Movimientos pendientes"
            value={String(conciliacion?.movimientosPendientes ?? 0)}
            detail="Registros aun no conciliados"
          />
          <ResumenCard
            label="Total ingresos"
            value={formatMoney(conciliacion?.totalIngresos ?? 0)}
            detail="Entradas bancarias del periodo filtrado"
          />
          <ResumenCard
            label="Total egresos"
            value={formatMoney(conciliacion?.totalEgresos ?? 0)}
            detail="Salidas bancarias del periodo filtrado"
          />
          <ResumenCard
            label="Saldo conciliado"
            value={formatMoney(conciliacion?.saldoConciliado ?? 0)}
            detail="Solo movimientos conciliados"
          />
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-lg border border-border bg-card shadow-sm">
          <div className="p-6 pb-0">
            <SectionHeader
              title="Facturas de Compra"
              detail={`${report?.facturasCompra.length ?? 0} registros`}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-accent">
                  <th className="px-6 py-4 text-left text-sm font-semibold">Factura</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Proveedor</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Fechas</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Total</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Saldo</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Estado</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Soporte</th>
                </tr>
              </thead>
              <tbody>
                {cargando ? (
                  <EmptyState columns={7} message="Cargando facturas de compra..." />
                ) : report?.facturasCompra.length ? (
                  report.facturasCompra.map(item => {
                    const estadoLabel = formatFacturaEstadoLabel(item.estado);
                    return (
                      <tr key={item.id} className="border-b border-border">
                        <td className="px-6 py-4">
                          <p className="font-medium text-foreground">{item.numeroFactura}</p>
                        </td>
                        <td className="px-6 py-4">{renderTercero(item)}</td>
                        <td className="px-6 py-4 text-sm">
                          <p>{formatDate(item.fechaFactura)}</p>
                          <p className="text-muted-foreground">
                            Vence {formatDate(item.fechaVencimiento)}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-sm">{formatMoney(item.total)}</td>
                        <td className="px-6 py-4 text-sm">{formatMoney(item.saldo)}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getEstadoBadgeClass(estadoLabel)}`}>
                            {estadoLabel}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {item.soporteUrl ? (
                            <a href={item.soporteUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                              Ver soporte
                            </a>
                          ) : (
                            <span className="text-muted-foreground">Sin soporte</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <EmptyState columns={7} message="No hay facturas de compra para los filtros seleccionados." />
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="rounded-lg border border-border bg-card shadow-sm">
            <div className="p-6 pb-0">
              <SectionHeader
                title="Comprobantes de Egreso"
                detail={`${report?.egresos.length ?? 0} registros`}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-accent">
                    <th className="px-6 py-4 text-left text-sm font-semibold">Comprobante</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Proveedor</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Fecha</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Valor</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Soporte</th>
                  </tr>
                </thead>
                <tbody>
                  {cargando ? (
                    <EmptyState columns={5} message="Cargando egresos..." />
                  ) : report?.egresos.length ? (
                    report.egresos.map(item => (
                      <tr key={item.id} className="border-b border-border">
                        <td className="px-6 py-4">
                          <Link href={`/contable/comprobantes-egreso/${item.id}`} className="font-medium text-primary hover:underline">
                            {item.numeroComprobante}
                          </Link>
                          <p className="text-sm text-muted-foreground">
                            {formatMetodoPagoLabel(item.metodoPago)}
                          </p>
                        </td>
                        <td className="px-6 py-4">{renderTercero(item)}</td>
                        <td className="px-6 py-4 text-sm">{formatDate(item.fecha)}</td>
                        <td className="px-6 py-4 text-sm">{formatMoney(item.valorTotal)}</td>
                        <td className="px-6 py-4 text-sm">
                          {item.soporteUrl ? (
                            <a href={item.soporteUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                              Ver soporte
                            </a>
                          ) : (
                            <span className="text-muted-foreground">Sin soporte</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <EmptyState columns={5} message="No hay egresos para los filtros seleccionados." />
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card shadow-sm">
            <div className="p-6 pb-0">
              <SectionHeader
                title="Recibos de Caja"
                detail={`${report?.recibosCaja.length ?? 0} registros`}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-accent">
                    <th className="px-6 py-4 text-left text-sm font-semibold">Recibo</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Cliente</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Fecha</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Valor</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Soporte</th>
                  </tr>
                </thead>
                <tbody>
                  {cargando ? (
                    <EmptyState columns={5} message="Cargando recibos..." />
                  ) : report?.recibosCaja.length ? (
                    report.recibosCaja.map(item => (
                      <tr key={item.id} className="border-b border-border">
                        <td className="px-6 py-4">
                          <Link href={`/contable/recibos-caja/${item.id}`} className="font-medium text-primary hover:underline">
                            {item.numeroRecibo}
                          </Link>
                          <p className="text-sm text-muted-foreground">
                            {formatMetodoPagoLabel(item.metodoPago)}
                          </p>
                        </td>
                        <td className="px-6 py-4">{renderTercero(item)}</td>
                        <td className="px-6 py-4 text-sm">{formatDate(item.fecha)}</td>
                        <td className="px-6 py-4 text-sm">{formatMoney(item.valorTotal)}</td>
                        <td className="px-6 py-4 text-sm">
                          {item.soporteUrl ? (
                            <a href={item.soporteUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                              Ver soporte
                            </a>
                          ) : (
                            <span className="text-muted-foreground">Sin soporte</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <EmptyState columns={5} message="No hay recibos para los filtros seleccionados." />
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card shadow-sm">
          <div className="p-6 pb-0">
            <SectionHeader
              title="Legalizacion de Viaticos"
              detail={`${report?.viaticos.length ?? 0} gastos`}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-accent">
                  <th className="px-6 py-4 text-left text-sm font-semibold">Vendedor / Visita</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Relacionado</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Tipo</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Valor</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Estado</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Soporte</th>
                </tr>
              </thead>
              <tbody>
                {cargando ? (
                  <EmptyState columns={6} message="Cargando viaticos..." />
                ) : report?.viaticos.length ? (
                  report.viaticos.map(item => {
                    const estadoLabel = formatLegalizacionEstadoLabel(item.legalizacionEstado);
                    const relacionado = item.relacionadoEmpresa
                      ? `${item.relacionadoNombre ?? "Sin relacionado"} - ${item.relacionadoEmpresa}`
                      : item.relacionadoNombre ?? "Sin relacionado";

                    return (
                      <tr key={item.id} className="border-b border-border">
                        <td className="px-6 py-4">
                          <p className="font-medium text-foreground">{item.usuarioNombre ?? "Sin vendedor"}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.visitaId} | {formatDate(item.visitaFecha)}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-sm">{relacionado}</td>
                        <td className="px-6 py-4 text-sm">
                          <p>{formatTipoGastoLabel(item.tipoGasto)}</p>
                          <p className="text-muted-foreground">{formatDate(item.fecha)}</p>
                        </td>
                        <td className="px-6 py-4 text-sm">{formatMoney(item.valor)}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getEstadoBadgeClass(estadoLabel)}`}>
                            {estadoLabel}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {item.soporte ? (
                            <a
                              href={getContableLegalizacionViaticoSupportUrl(item.id)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline"
                            >
                              {item.soporte.fileName}
                            </a>
                          ) : (
                            <span className="text-muted-foreground">Sin soporte</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <EmptyState columns={6} message="No hay viaticos para los filtros seleccionados." />
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card shadow-sm">
          <div className="p-6 pb-0">
            <SectionHeader
              title="Movimientos Bancarios"
              detail={`${report?.movimientosBancarios.length ?? 0} movimientos combinados`}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-accent">
                  <th className="px-6 py-4 text-left text-sm font-semibold">Cuenta</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Fecha</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Referencia</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Tercero</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Valor</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Saldo acumulado</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Conciliacion</th>
                </tr>
              </thead>
              <tbody>
                {cargando ? (
                  <EmptyState columns={7} message="Cargando movimientos bancarios..." />
                ) : report?.movimientosBancarios.length ? (
                  report.movimientosBancarios.map((item: ContableReporteMovimientoBancario) => (
                    <tr key={`${item.referenciaTipo}-${item.referenciaId}`} className="border-b border-border">
                      <td className="px-6 py-4 text-sm">
                        <p className="font-medium text-foreground">
                          {item.cuentaBancariaNombre ?? "Cuenta bancaria"}
                        </p>
                        <p className="text-muted-foreground">
                          {[item.cuentaBancariaBanco, item.cuentaBancariaNumero].filter(Boolean).join(" - ")}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-sm">{formatDate(item.fecha)}</td>
                      <td className="px-6 py-4 text-sm">
                        <p>{item.referenciaNumero}</p>
                        <p className="text-muted-foreground">
                          {item.tipo === "ingreso" ? "Ingreso" : "Egreso"}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <p className="font-medium text-foreground">{item.terceroNombreRazonSocial}</p>
                        <p className="text-muted-foreground">{item.terceroDocumentoNit}</p>
                      </td>
                      <td className="px-6 py-4 text-sm">{formatMoney(item.valor)}</td>
                      <td className="px-6 py-4 text-sm">{formatMoney(item.saldoAcumulado)}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getEstadoBadgeClass(item.conciliado ? "Conciliado" : "No conciliado")}`}>
                          {item.conciliado ? "Conciliado" : "No conciliado"}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <EmptyState columns={7} message="No hay movimientos bancarios para los filtros seleccionados." />
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
