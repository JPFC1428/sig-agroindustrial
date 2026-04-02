import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Calendar, FileText, Receipt } from "lucide-react";
import { Link, useRoute } from "wouter";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { getContableNotaCreditoById } from "@/lib/contable-notas-credito-api";
import {
  ContableNotaCreditoCarteraEstado,
  ContableNotaCreditoDocumentoTipo,
  ContableNotaCreditoEstado,
  ContableNotaCreditoTipo,
  type ContableNotaCredito,
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

function formatDateTime(value: Date) {
  return value.toLocaleString("es-CO");
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

function formatDocumentoTipoLabel(tipo?: ContableNotaCreditoDocumentoTipo) {
  switch (tipo) {
    case ContableNotaCreditoDocumentoTipo.FACTURA_COMPRA:
      return "Factura de compra";
    case ContableNotaCreditoDocumentoTipo.CUENTA_POR_COBRAR:
      return "Cuenta por cobrar";
    case ContableNotaCreditoDocumentoTipo.OTRO:
      return "Otro documento";
    default:
      return "Sin relacion";
  }
}

function formatCarteraEstadoLabel(estado: ContableNotaCreditoCarteraEstado) {
  switch (estado) {
    case ContableNotaCreditoCarteraEstado.PENDIENTE:
      return "Pendiente";
    case ContableNotaCreditoCarteraEstado.PREPARADA:
      return "Preparada";
    case ContableNotaCreditoCarteraEstado.APLICADA:
      return "Aplicada";
    default:
      return estado;
  }
}

export default function ContableNotaCreditoDetalle() {
  const [match, params] = useRoute("/contable/notas-credito/:id");
  const notaId = params?.id;
  const [nota, setNota] = useState<ContableNotaCredito | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const destinoVolver = "/contable/notas-credito";

  const enlaceDocumento = useMemo(() => {
    if (
      nota?.documentoRelacionadoTipo ===
        ContableNotaCreditoDocumentoTipo.FACTURA_COMPRA &&
      nota.documentoRelacionadoId
    ) {
      return `/contable/facturas-compra/${nota.documentoRelacionadoId}/editar`;
    }

    return null;
  }, [nota]);

  useEffect(() => {
    if (!match || !notaId) {
      return;
    }

    let activo = true;
    const currentNotaId = notaId;

    async function cargar() {
      setCargando(true);
      setError(null);

      try {
        const data = await getContableNotaCreditoById(currentNotaId);

        if (!activo) {
          return;
        }

        if (!data) {
          setNota(null);
          setError("La nota credito solicitada no existe");
          return;
        }

        setNota(data);
      } catch (loadError) {
        if (!activo) {
          return;
        }

        setNota(null);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudo cargar la nota credito"
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
  }, [match, notaId]);

  if (!match) {
    return null;
  }

  if (cargando) {
    return (
      <DashboardLayout
        titulo="Detalle de Nota Credito"
        descripcion="Cargando informacion de la nota"
        acciones={
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href={destinoVolver}>
              <ArrowLeft size={18} />
              Volver
            </Link>
          </Button>
        }
      >
        <div className="py-12 text-center">
          <p className="text-muted-foreground">Cargando nota credito...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!nota) {
    return (
      <DashboardLayout
        titulo="Detalle de Nota Credito"
        descripcion="No fue posible cargar la nota"
        acciones={
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href={destinoVolver}>
              <ArrowLeft size={18} />
              Volver
            </Link>
          </Button>
        }
      >
        <div className="py-12 text-center">
          <p className="mb-4 text-muted-foreground">
            {error ?? "La nota credito solicitada no existe"}
          </p>
          <Button asChild variant="outline">
            <Link href={destinoVolver}>Volver a Notas Credito</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      titulo={`Nota ${nota.numeroNota}`}
      descripcion="Detalle del ajuste contable registrado"
      acciones={
        <Button asChild variant="outline" size="sm" className="gap-2">
          <Link href={destinoVolver}>
            <ArrowLeft size={18} />
            Volver
          </Link>
        </Button>
      }
    >
      {error && (
        <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm lg:col-span-2">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Informacion principal
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Registro del tercero, motivo y valor asociado a la nota credito.
              </p>
            </div>
            <div className="rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
              {formatMoney(nota.valor)}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Tercero
              </p>
              <p className="mt-1 font-medium text-foreground">
                {nota.terceroNombreRazonSocial}
              </p>
              <p className="text-sm text-muted-foreground">
                {nota.terceroDocumentoNit}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Tipo
              </p>
              <p className="mt-1 font-medium text-foreground">
                {formatTipoLabel(nota.tipo)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Fecha de nota
              </p>
              <p className="mt-1 flex items-center gap-2 font-medium text-foreground">
                <Calendar size={16} className="text-muted-foreground" />
                {formatDate(nota.fecha)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Estado
              </p>
              <p className="mt-1 font-medium text-foreground">
                {formatEstadoLabel(nota.estado)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Fecha de registro
              </p>
              <p className="mt-1 flex items-center gap-2 font-medium text-foreground">
                <Receipt size={16} className="text-muted-foreground" />
                {formatDateTime(nota.createdAt)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Ultima actualizacion
              </p>
              <p className="mt-1 flex items-center gap-2 font-medium text-foreground">
                <FileText size={16} className="text-muted-foreground" />
                {formatDateTime(nota.updatedAt)}
              </p>
            </div>
            <div className="md:col-span-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Motivo
              </p>
              <p className="mt-1 text-sm text-foreground">{nota.motivo}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Observaciones
              </p>
              <p className="mt-1 text-sm text-foreground">
                {nota.observaciones || "Sin observaciones registradas"}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">
            Base cartera
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Estado tecnico de preparacion para cruces futuros con cartera.
          </p>

          <div className="mt-6 space-y-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Afecta cartera
              </p>
              <p className="mt-1 font-medium text-foreground">
                {nota.afectaCartera ? "Si" : "No"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Estado cartera
              </p>
              <p className="mt-1 font-medium text-foreground">
                {formatCarteraEstadoLabel(nota.carteraEstado)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Documento relacionado
              </p>
              <p className="mt-1 font-medium text-foreground">
                {formatDocumentoTipoLabel(nota.documentoRelacionadoTipo)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">
          Documento relacionado
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Referencia guardada para trazabilidad del documento base.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Tipo documento
            </p>
            <p className="mt-1 font-medium text-foreground">
              {formatDocumentoTipoLabel(nota.documentoRelacionadoTipo)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Referencia
            </p>
            <p className="mt-1 font-medium text-foreground">
              {nota.documentoRelacionadoNumero ||
                nota.referenciaDocumento ||
                "Sin referencia registrada"}
            </p>
          </div>
          <div className="md:col-span-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Navegacion
            </p>
            {enlaceDocumento ? (
              <Link
                href={enlaceDocumento}
                className="mt-1 inline-flex text-sm font-medium text-primary hover:underline"
              >
                Abrir documento relacionado
              </Link>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                No hay un enlace interno disponible para este documento.
              </p>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
