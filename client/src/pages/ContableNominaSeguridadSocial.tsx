import { useEffect, useMemo, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import {
  createContableNominaEmpleado,
  createContableNominaLiquidacion,
  createContableNominaPeriodo,
  formatDateOnlyInput,
  getContableNominaData,
} from "@/lib/contable-nomina-api";
import {
  ContableNominaPeriodoEstado,
  ContableNominaPeriodoTipo,
  ContableNominaTipoContrato,
  ContableTerceroEstado,
  type ContableNominaData,
} from "@/lib/types";

type EmpleadoFormValues = {
  nombreRazonSocial: string;
  documentoNit: string;
  cargo: string;
  tipoContrato: ContableNominaTipoContrato;
  fechaIngreso: string;
  salarioBasico: string;
  auxilioTransporte: string;
  aplicaAuxilioTransporte: "si" | "no";
  eps: string;
  fondoPension: string;
  arl: string;
  cajaCompensacion: string;
  porcentajeArl: string;
  contacto: string;
  telefono: string;
  correo: string;
  estado: ContableTerceroEstado;
};

type PeriodoFormValues = {
  codigoPeriodo: string;
  tipo: ContableNominaPeriodoTipo;
  fechaInicio: string;
  fechaFin: string;
  estado: ContableNominaPeriodoEstado;
  observaciones: string;
};

type LiquidacionFormValues = {
  periodoId: string;
  empleadoId: string;
  diasTrabajados: string;
};

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

function parseMoneyValue(value: string) {
  const normalized = value.replace(/,/g, ".").trim();

  if (!normalized) {
    return 0;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function parseIntegerValue(value: string) {
  const parsed = Number(value.trim());
  return Number.isInteger(parsed) ? parsed : NaN;
}

function toOptionalString(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function formatTipoContratoLabel(tipo: ContableNominaTipoContrato) {
  switch (tipo) {
    case ContableNominaTipoContrato.INDEFINIDO:
      return "Indefinido";
    case ContableNominaTipoContrato.FIJO:
      return "Fijo";
    case ContableNominaTipoContrato.OTRO:
      return "Otro";
    default:
      return tipo;
  }
}

function formatPeriodoTipoLabel(tipo: ContableNominaPeriodoTipo) {
  return tipo === ContableNominaPeriodoTipo.MENSUAL ? "Mensual" : "Quincenal";
}

function formatPeriodoEstadoLabel(estado: ContableNominaPeriodoEstado) {
  return estado === ContableNominaPeriodoEstado.ABIERTO ? "Abierto" : "Cerrado";
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

function getCurrentMonthStart() {
  const today = new Date();
  return formatDateOnlyInput(new Date(today.getFullYear(), today.getMonth(), 1));
}

function getCurrentMonthEnd() {
  const today = new Date();
  return formatDateOnlyInput(new Date(today.getFullYear(), today.getMonth() + 1, 0));
}

const INITIAL_EMPLEADO_FORM: EmpleadoFormValues = {
  nombreRazonSocial: "",
  documentoNit: "",
  cargo: "",
  tipoContrato: ContableNominaTipoContrato.INDEFINIDO,
  fechaIngreso: formatDateOnlyInput(new Date()),
  salarioBasico: "0",
  auxilioTransporte: "0",
  aplicaAuxilioTransporte: "si",
  eps: "",
  fondoPension: "",
  arl: "",
  cajaCompensacion: "",
  porcentajeArl: "0.00522",
  contacto: "",
  telefono: "",
  correo: "",
  estado: ContableTerceroEstado.ACTIVO,
};

const INITIAL_PERIODO_FORM: PeriodoFormValues = {
  codigoPeriodo: "",
  tipo: ContableNominaPeriodoTipo.MENSUAL,
  fechaInicio: getCurrentMonthStart(),
  fechaFin: getCurrentMonthEnd(),
  estado: ContableNominaPeriodoEstado.ABIERTO,
  observaciones: "",
};

const INITIAL_LIQUIDACION_FORM: LiquidacionFormValues = {
  periodoId: "",
  empleadoId: "",
  diasTrabajados: "30",
};

export default function ContableNominaSeguridadSocial() {
  const [data, setData] = useState<ContableNominaData | null>(null);
  const [empleadoForm, setEmpleadoForm] =
    useState<EmpleadoFormValues>(INITIAL_EMPLEADO_FORM);
  const [periodoForm, setPeriodoForm] =
    useState<PeriodoFormValues>(INITIAL_PERIODO_FORM);
  const [liquidacionForm, setLiquidacionForm] =
    useState<LiquidacionFormValues>(INITIAL_LIQUIDACION_FORM);
  const [cargando, setCargando] = useState(true);
  const [guardandoEmpleado, setGuardandoEmpleado] = useState(false);
  const [guardandoPeriodo, setGuardandoPeriodo] = useState(false);
  const [guardandoLiquidacion, setGuardandoLiquidacion] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const empleados = data?.empleados ?? [];
  const periodos = data?.periodos ?? [];
  const liquidaciones = data?.liquidaciones ?? [];
  const seguridadSocial = data?.seguridadSocial ?? [];

  const periodosAbiertos = useMemo(
    () =>
      periodos.filter(
        periodo => periodo.estado === ContableNominaPeriodoEstado.ABIERTO
      ),
    [periodos]
  );

  const empleadoSeleccionado =
    empleados.find(item => item.id === liquidacionForm.empleadoId) ?? null;
  const periodoSeleccionado =
    periodos.find(item => item.id === liquidacionForm.periodoId) ?? null;

  const previewLiquidacion = useMemo(() => {
    if (!empleadoSeleccionado || !periodoSeleccionado) {
      return null;
    }

    const diasTrabajados = parseIntegerValue(liquidacionForm.diasTrabajados);
    const maxDias =
      periodoSeleccionado.tipo === ContableNominaPeriodoTipo.QUINCENAL ? 15 : 30;

    if (
      !Number.isInteger(diasTrabajados) ||
      diasTrabajados <= 0 ||
      diasTrabajados > maxDias
    ) {
      return null;
    }

    const salarioDevengado =
      Math.round(
        ((empleadoSeleccionado.salarioBasico / 30) * diasTrabajados +
          Number.EPSILON) *
          100
      ) / 100;
    const auxilioTransporte = empleadoSeleccionado.aplicaAuxilioTransporte
      ? Math.round(
          ((empleadoSeleccionado.auxilioTransporte / 30) * diasTrabajados +
            Number.EPSILON) *
            100
        ) / 100
      : 0;
    const ibc = salarioDevengado;
    const salud = Math.round((ibc * 0.04 + Number.EPSILON) * 100) / 100;
    const pension = Math.round((ibc * 0.04 + Number.EPSILON) * 100) / 100;
    const devengado =
      Math.round((salarioDevengado + auxilioTransporte + Number.EPSILON) * 100) /
      100;
    const neto =
      Math.round((devengado - salud - pension + Number.EPSILON) * 100) / 100;

    return {
      diasTrabajados,
      salarioDevengado,
      auxilioTransporte,
      devengado,
      salud,
      pension,
      neto,
      ibc,
    };
  }, [empleadoSeleccionado, liquidacionForm.diasTrabajados, periodoSeleccionado]);

  async function cargarNomina() {
    setCargando(true);

    try {
      const nominaData = await getContableNominaData();
      setData(nominaData);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudo cargar el modulo de nomina"
      );
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void cargarNomina();
  }, []);

  useEffect(() => {
    if (!liquidacionForm.empleadoId && empleados[0]) {
      setLiquidacionForm(current => ({
        ...current,
        empleadoId: empleados[0]?.id ?? "",
      }));
    }
  }, [empleados, liquidacionForm.empleadoId]);

  useEffect(() => {
    if (!liquidacionForm.periodoId && periodosAbiertos[0]) {
      setLiquidacionForm(current => ({
        ...current,
        periodoId: periodosAbiertos[0]?.id ?? "",
      }));
    }
  }, [liquidacionForm.periodoId, periodosAbiertos]);

  useEffect(() => {
    setLiquidacionForm(current => ({
      ...current,
      diasTrabajados:
        periodoSeleccionado?.tipo === ContableNominaPeriodoTipo.QUINCENAL
          ? "15"
          : "30",
    }));
  }, [periodoSeleccionado?.id, periodoSeleccionado?.tipo]);

  async function handleCrearEmpleado(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGuardandoEmpleado(true);
    setError(null);

    try {
      await createContableNominaEmpleado({
        nombreRazonSocial: empleadoForm.nombreRazonSocial.trim(),
        documentoNit: empleadoForm.documentoNit.trim(),
        cargo: empleadoForm.cargo.trim(),
        tipoContrato: empleadoForm.tipoContrato,
        fechaIngreso: empleadoForm.fechaIngreso,
        salarioBasico: parseMoneyValue(empleadoForm.salarioBasico),
        auxilioTransporte: parseMoneyValue(empleadoForm.auxilioTransporte),
        aplicaAuxilioTransporte: empleadoForm.aplicaAuxilioTransporte === "si",
        eps: toOptionalString(empleadoForm.eps),
        fondoPension: toOptionalString(empleadoForm.fondoPension),
        arl: toOptionalString(empleadoForm.arl),
        cajaCompensacion: toOptionalString(empleadoForm.cajaCompensacion),
        porcentajeArl: parseMoneyValue(empleadoForm.porcentajeArl),
        contacto: toOptionalString(empleadoForm.contacto),
        telefono: toOptionalString(empleadoForm.telefono),
        correo: toOptionalString(empleadoForm.correo),
        estado: empleadoForm.estado,
      });

      toast.success("Empleado registrado");
      setEmpleadoForm(INITIAL_EMPLEADO_FORM);
      await cargarNomina();
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "No se pudo registrar el empleado";

      setError(message);
      toast.error(message);
    } finally {
      setGuardandoEmpleado(false);
    }
  }

  async function handleCrearPeriodo(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGuardandoPeriodo(true);
    setError(null);

    try {
      await createContableNominaPeriodo({
        codigoPeriodo: periodoForm.codigoPeriodo.trim(),
        tipo: periodoForm.tipo,
        fechaInicio: periodoForm.fechaInicio,
        fechaFin: periodoForm.fechaFin,
        estado: periodoForm.estado,
        observaciones: toOptionalString(periodoForm.observaciones),
      });

      toast.success("Periodo de nomina creado");
      setPeriodoForm(INITIAL_PERIODO_FORM);
      await cargarNomina();
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "No se pudo crear el periodo";

      setError(message);
      toast.error(message);
    } finally {
      setGuardandoPeriodo(false);
    }
  }

  async function handleCrearLiquidacion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGuardandoLiquidacion(true);
    setError(null);

    try {
      await createContableNominaLiquidacion({
        periodoId: liquidacionForm.periodoId,
        empleadoId: liquidacionForm.empleadoId,
        diasTrabajados: parseIntegerValue(liquidacionForm.diasTrabajados),
      });

      toast.success("Liquidacion creada y seguridad social registrada");
      await cargarNomina();
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "No se pudo crear la liquidacion";

      setError(message);
      toast.error(message);
    } finally {
      setGuardandoLiquidacion(false);
    }
  }

  return (
    <DashboardLayout
      titulo="Nomina y Seguridad Social"
      descripcion="Fase 1 de estructura base: empleados, periodos, liquidacion inicial y seguridad social basica"
    >
      {error && (
        <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-4">
        <ResumenCard
          label="Empleados"
          value={String(empleados.length)}
          detail="Base de empleados de fase 1"
        />
        <ResumenCard
          label="Periodos"
          value={String(periodos.length)}
          detail={`${periodosAbiertos.length} abiertos`}
        />
        <ResumenCard
          label="Liquidaciones"
          value={String(liquidaciones.length)}
          detail="Calculo basico inicial"
        />
        <ResumenCard
          label="Seguridad Social"
          value={String(seguridadSocial.length)}
          detail="Registros generados desde liquidacion"
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <form
          onSubmit={handleCrearEmpleado}
          className="rounded-lg border border-border bg-card p-6 shadow-sm"
        >
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-foreground">
              Registrar Empleado
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Crea el tercero tipo empleado y su ficha base de nomina.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input placeholder="Nombre completo" value={empleadoForm.nombreRazonSocial} onChange={event => setEmpleadoForm(current => ({ ...current, nombreRazonSocial: event.target.value }))} />
            <Input placeholder="Documento" value={empleadoForm.documentoNit} onChange={event => setEmpleadoForm(current => ({ ...current, documentoNit: event.target.value }))} />
            <Input placeholder="Cargo" value={empleadoForm.cargo} onChange={event => setEmpleadoForm(current => ({ ...current, cargo: event.target.value }))} />
            <Select value={empleadoForm.tipoContrato} onValueChange={value => setEmpleadoForm(current => ({ ...current, tipoContrato: value as ContableNominaTipoContrato }))}>
              <SelectTrigger><SelectValue placeholder="Tipo contrato" /></SelectTrigger>
              <SelectContent>
                {Object.values(ContableNominaTipoContrato).map(tipo => (
                  <SelectItem key={tipo} value={tipo}>{formatTipoContratoLabel(tipo)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="date" value={empleadoForm.fechaIngreso} onChange={event => setEmpleadoForm(current => ({ ...current, fechaIngreso: event.target.value }))} />
            <Select value={empleadoForm.estado} onValueChange={value => setEmpleadoForm(current => ({ ...current, estado: value as ContableTerceroEstado }))}>
              <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ContableTerceroEstado.ACTIVO}>Activo</SelectItem>
                <SelectItem value={ContableTerceroEstado.INACTIVO}>Inactivo</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Salario basico" inputMode="decimal" value={empleadoForm.salarioBasico} onChange={event => setEmpleadoForm(current => ({ ...current, salarioBasico: event.target.value }))} />
            <Input placeholder="Auxilio transporte" inputMode="decimal" value={empleadoForm.auxilioTransporte} onChange={event => setEmpleadoForm(current => ({ ...current, auxilioTransporte: event.target.value }))} />
            <Select value={empleadoForm.aplicaAuxilioTransporte} onValueChange={value => setEmpleadoForm(current => ({ ...current, aplicaAuxilioTransporte: value as "si" | "no" }))}>
              <SelectTrigger><SelectValue placeholder="Auxilio transporte" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="si">Aplica auxilio</SelectItem>
                <SelectItem value="no">No aplica</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Porcentaje ARL" inputMode="decimal" value={empleadoForm.porcentajeArl} onChange={event => setEmpleadoForm(current => ({ ...current, porcentajeArl: event.target.value }))} />
            <Input placeholder="EPS" value={empleadoForm.eps} onChange={event => setEmpleadoForm(current => ({ ...current, eps: event.target.value }))} />
            <Input placeholder="Fondo pension" value={empleadoForm.fondoPension} onChange={event => setEmpleadoForm(current => ({ ...current, fondoPension: event.target.value }))} />
            <Input placeholder="ARL" value={empleadoForm.arl} onChange={event => setEmpleadoForm(current => ({ ...current, arl: event.target.value }))} />
            <Input placeholder="Caja compensacion" value={empleadoForm.cajaCompensacion} onChange={event => setEmpleadoForm(current => ({ ...current, cajaCompensacion: event.target.value }))} />
            <Input placeholder="Contacto" value={empleadoForm.contacto} onChange={event => setEmpleadoForm(current => ({ ...current, contacto: event.target.value }))} />
            <Input placeholder="Telefono" value={empleadoForm.telefono} onChange={event => setEmpleadoForm(current => ({ ...current, telefono: event.target.value }))} />
            <div className="md:col-span-2">
              <Input placeholder="Correo" value={empleadoForm.correo} onChange={event => setEmpleadoForm(current => ({ ...current, correo: event.target.value }))} />
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button type="submit" className="gap-2" disabled={guardandoEmpleado}>
              <Save size={18} />
              {guardandoEmpleado ? "Guardando..." : "Registrar Empleado"}
            </Button>
          </div>
        </form>

        <form
          onSubmit={handleCrearPeriodo}
          className="rounded-lg border border-border bg-card p-6 shadow-sm"
        >
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-foreground">
              Crear Periodo de Nomina
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Periodos simples para liquidacion mensual o quincenal.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input placeholder="Codigo periodo" value={periodoForm.codigoPeriodo} onChange={event => setPeriodoForm(current => ({ ...current, codigoPeriodo: event.target.value }))} />
            <Select value={periodoForm.tipo} onValueChange={value => setPeriodoForm(current => ({ ...current, tipo: value as ContableNominaPeriodoTipo }))}>
              <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                {Object.values(ContableNominaPeriodoTipo).map(tipo => (
                  <SelectItem key={tipo} value={tipo}>{formatPeriodoTipoLabel(tipo)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="date" value={periodoForm.fechaInicio} onChange={event => setPeriodoForm(current => ({ ...current, fechaInicio: event.target.value }))} />
            <Input type="date" value={periodoForm.fechaFin} onChange={event => setPeriodoForm(current => ({ ...current, fechaFin: event.target.value }))} />
            <Select value={periodoForm.estado} onValueChange={value => setPeriodoForm(current => ({ ...current, estado: value as ContableNominaPeriodoEstado }))}>
              <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ContableNominaPeriodoEstado.ABIERTO}>Abierto</SelectItem>
                <SelectItem value={ContableNominaPeriodoEstado.CERRADO}>Cerrado</SelectItem>
              </SelectContent>
            </Select>
            <div className="md:col-span-2">
              <Textarea rows={4} placeholder="Observaciones del periodo" value={periodoForm.observaciones} onChange={event => setPeriodoForm(current => ({ ...current, observaciones: event.target.value }))} />
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button type="submit" className="gap-2" disabled={guardandoPeriodo}>
              <Save size={18} />
              {guardandoPeriodo ? "Guardando..." : "Crear Periodo"}
            </Button>
          </div>
        </form>
      </div>

      <div className="mb-6 rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-foreground">
            Liquidacion Basica Inicial
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Fase 1: salario proporcional por dias, auxilio de transporte, salud,
            pension y registro automatico de seguridad social basica.
          </p>
        </div>

        <form
          onSubmit={handleCrearLiquidacion}
          className="grid grid-cols-1 gap-4 md:grid-cols-3"
        >
          <Select
            value={liquidacionForm.periodoId}
            onValueChange={value =>
              setLiquidacionForm(current => ({ ...current, periodoId: value }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Periodo abierto" />
            </SelectTrigger>
            <SelectContent>
              {periodosAbiertos.map(periodo => (
                <SelectItem key={periodo.id} value={periodo.id}>
                  {periodo.codigoPeriodo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={liquidacionForm.empleadoId}
            onValueChange={value =>
              setLiquidacionForm(current => ({ ...current, empleadoId: value }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Empleado" />
            </SelectTrigger>
            <SelectContent>
              {empleados.map(empleado => (
                <SelectItem key={empleado.id} value={empleado.id}>
                  {empleado.nombreRazonSocial}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            placeholder="Dias trabajados"
            inputMode="numeric"
            value={liquidacionForm.diasTrabajados}
            onChange={event =>
              setLiquidacionForm(current => ({
                ...current,
                diasTrabajados: event.target.value,
              }))
            }
          />

          <div className="md:col-span-3 flex justify-end">
            <Button
              type="submit"
              className="gap-2"
              disabled={
                guardandoLiquidacion ||
                empleados.length === 0 ||
                periodosAbiertos.length === 0 ||
                !previewLiquidacion
              }
            >
              <Save size={18} />
              {guardandoLiquidacion ? "Liquidando..." : "Crear Liquidacion"}
            </Button>
          </div>
        </form>

        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-4">
          <ResumenCard
            label="Salario Devengado"
            value={formatMoney(previewLiquidacion?.salarioDevengado ?? 0)}
            detail="Base proporcional por dias"
          />
          <ResumenCard
            label="Auxilio Transporte"
            value={formatMoney(previewLiquidacion?.auxilioTransporte ?? 0)}
            detail="Aplicado segun ficha del empleado"
          />
          <ResumenCard
            label="Deducciones"
            value={formatMoney(
              (previewLiquidacion?.salud ?? 0) +
                (previewLiquidacion?.pension ?? 0)
            )}
            detail="Salud 4% + pension 4%"
          />
          <ResumenCard
            label="Neto a Pagar"
            value={formatMoney(previewLiquidacion?.neto ?? 0)}
            detail={`IBC ${formatMoney(previewLiquidacion?.ibc ?? 0)}`}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-lg border border-border bg-card shadow-sm">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-lg font-semibold text-foreground">
              Liquidaciones
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-accent">
                  <th className="px-6 py-4 text-left text-sm font-semibold">
                    Empleado
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">
                    Periodo
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">
                    Neto
                  </th>
                </tr>
              </thead>
              <tbody>
                {cargando ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-6 py-10 text-center text-sm text-muted-foreground"
                    >
                      Cargando liquidaciones...
                    </td>
                  </tr>
                ) : liquidaciones.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-6 py-10 text-center text-sm text-muted-foreground"
                    >
                      Aun no hay liquidaciones registradas
                    </td>
                  </tr>
                ) : (
                  liquidaciones.map((item, index) => (
                    <tr
                      key={item.id}
                      className={`border-b border-border ${
                        index % 2 === 0 ? "bg-background" : "bg-accent/40"
                      }`}
                    >
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-foreground">
                          {item.empleadoNombreRazonSocial}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.empleadoDocumentoNit}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-sm text-foreground">
                        {item.periodoCodigo}
                        <p className="text-xs text-muted-foreground">
                          {item.diasTrabajados} dias
                        </p>
                      </td>
                      <td className="px-6 py-4 text-sm text-foreground">
                        {formatMoney(item.netoPagar)}
                        <p className="text-xs text-muted-foreground">
                          Devengado {formatMoney(item.devengado)}
                        </p>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card shadow-sm">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-lg font-semibold text-foreground">
              Seguridad Social Basica
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-accent">
                  <th className="px-6 py-4 text-left text-sm font-semibold">
                    Empleado
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">
                    IBC
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">
                    Total aportes
                  </th>
                </tr>
              </thead>
              <tbody>
                {cargando ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-6 py-10 text-center text-sm text-muted-foreground"
                    >
                      Cargando seguridad social...
                    </td>
                  </tr>
                ) : seguridadSocial.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-6 py-10 text-center text-sm text-muted-foreground"
                    >
                      Aun no hay registros de seguridad social
                    </td>
                  </tr>
                ) : (
                  seguridadSocial.map((item, index) => (
                    <tr
                      key={item.id}
                      className={`border-b border-border ${
                        index % 2 === 0 ? "bg-background" : "bg-accent/40"
                      }`}
                    >
                      <td className="px-6 py-4 text-sm text-foreground">
                        {item.empleadoNombreRazonSocial}
                        <p className="text-xs text-muted-foreground">
                          {item.periodoCodigo}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-sm text-foreground">
                        {formatMoney(item.ibc)}
                        <p className="text-xs text-muted-foreground">
                          ARL {formatMoney(item.arl)}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-sm text-foreground">
                        {formatMoney(item.totalAportes)}
                        <p className="text-xs text-muted-foreground">
                          Salud emp. {formatMoney(item.saludEmpleado)} / pens.
                          emp. {formatMoney(item.pensionEmpleado)}
                        </p>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
