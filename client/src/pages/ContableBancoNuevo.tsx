import { useEffect, useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { Link, useLocation, useRoute } from "wouter";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
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
  createContableBanco,
  getContableBancoById,
  updateContableBanco,
  type ContableCuentaBancariaMutationInput,
} from "@/lib/contable-bancos-api";
import {
  ContableCuentaBancariaTipo,
  type ContableCuentaBancaria,
} from "@/lib/types";

type BancoFormValues = {
  activa: "activa" | "inactiva";
  nombreBanco: string;
  nombreCuenta: string;
  numeroCuenta: string;
  observaciones: string;
  saldoInicial: string;
  titular: string;
  tipoCuenta: ContableCuentaBancariaTipo;
};

type BancoFormErrors = Partial<Record<keyof BancoFormValues, string>>;

const INITIAL_FORM: BancoFormValues = {
  activa: "activa",
  nombreBanco: "",
  nombreCuenta: "",
  numeroCuenta: "",
  observaciones: "",
  saldoInicial: "0",
  titular: "",
  tipoCuenta: ContableCuentaBancariaTipo.AHORROS,
};

function formatCuentaTipoLabel(tipo: ContableCuentaBancariaTipo) {
  switch (tipo) {
    case ContableCuentaBancariaTipo.AHORROS:
      return "Ahorros";
    case ContableCuentaBancariaTipo.CORRIENTE:
      return "Corriente";
    case ContableCuentaBancariaTipo.OTRA:
      return "Otra";
    default:
      return tipo;
  }
}

function parseMoneyInput(value: string) {
  const normalized = value.trim().replace(/,/g, ".");

  if (!normalized) {
    return 0;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function toOptionalString(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toFormValues(cuenta: ContableCuentaBancaria): BancoFormValues {
  return {
    activa: cuenta.activa ? "activa" : "inactiva",
    nombreBanco: cuenta.nombreBanco,
    nombreCuenta: cuenta.nombreCuenta,
    numeroCuenta: cuenta.numeroCuenta,
    observaciones: cuenta.observaciones ?? "",
    saldoInicial: String(cuenta.saldoInicial),
    titular: cuenta.titular,
    tipoCuenta: cuenta.tipoCuenta,
  };
}

function validateForm(values: BancoFormValues) {
  const errors: BancoFormErrors = {};
  const saldoInicial = parseMoneyInput(values.saldoInicial);

  if (!values.nombreBanco.trim()) {
    errors.nombreBanco = "El nombre del banco es obligatorio";
  }

  if (!values.nombreCuenta.trim()) {
    errors.nombreCuenta = "El nombre de la cuenta es obligatorio";
  }

  if (!values.numeroCuenta.trim()) {
    errors.numeroCuenta = "El numero de cuenta es obligatorio";
  }

  if (!values.titular.trim()) {
    errors.titular = "El titular es obligatorio";
  }

  if (!Number.isFinite(saldoInicial) || saldoInicial < 0) {
    errors.saldoInicial = "El saldo inicial debe ser un valor valido";
  }

  return errors;
}

function buildPayload(values: BancoFormValues): ContableCuentaBancariaMutationInput {
  return {
    activa: values.activa === "activa",
    nombreBanco: values.nombreBanco.trim(),
    nombreCuenta: values.nombreCuenta.trim(),
    numeroCuenta: values.numeroCuenta.trim(),
    observaciones: toOptionalString(values.observaciones),
    saldoInicial: parseMoneyInput(values.saldoInicial),
    titular: values.titular.trim(),
    tipoCuenta: values.tipoCuenta,
  };
}

export default function ContableBancoNuevo() {
  const [isNuevoRoute] = useRoute("/contable/bancos/nuevo");
  const [isEditarRoute, editParams] = useRoute("/contable/bancos/:id/editar");
  const [, setLocation] = useLocation();
  const [form, setForm] = useState<BancoFormValues>(INITIAL_FORM);
  const [errors, setErrors] = useState<BancoFormErrors>({});
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null);
  const [cuentaDisponible, setCuentaDisponible] = useState(true);

  const cuentaId = isEditarRoute ? editParams?.id : undefined;
  const esEdicion = Boolean(isEditarRoute && cuentaId);
  const destinoVolver = "/contable/bancos";

  useEffect(() => {
    if (!isNuevoRoute && !isEditarRoute) {
      return;
    }

    if (!esEdicion || !cuentaId) {
      setForm(INITIAL_FORM);
      setErrors({});
      setErrorGlobal(null);
      setCuentaDisponible(true);
      setCargando(false);
      return;
    }

    let activo = true;
    const id = cuentaId;

    async function cargar() {
      setCargando(true);
      setErrors({});
      setErrorGlobal(null);
      setCuentaDisponible(true);

      try {
        const cuenta = await getContableBancoById(id);

        if (!activo) {
          return;
        }

        if (!cuenta) {
          setCuentaDisponible(false);
          setErrorGlobal("La cuenta bancaria solicitada no existe");
          return;
        }

        setForm(toFormValues(cuenta));
      } catch (loadError) {
        if (!activo) {
          return;
        }

        setCuentaDisponible(false);
        setErrorGlobal(
          loadError instanceof Error
            ? loadError.message
            : "No se pudo cargar la cuenta bancaria"
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
  }, [cuentaId, esEdicion, isEditarRoute, isNuevoRoute]);

  if (!isNuevoRoute && !isEditarRoute) {
    return null;
  }

  function updateField<K extends keyof BancoFormValues>(
    field: K,
    value: BancoFormValues[K]
  ) {
    setForm(current => ({
      ...current,
      [field]: value,
    }));

    setErrors(current => {
      const next = { ...current };
      delete next[field];
      return next;
    });

    setErrorGlobal(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationErrors = validateForm(form);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      setErrorGlobal("Revisa los campos obligatorios antes de guardar");
      return;
    }

    setGuardando(true);
    setErrorGlobal(null);

    try {
      const payload = buildPayload(form);

      if (esEdicion && cuentaId) {
        await updateContableBanco(cuentaId, payload);
      } else {
        await createContableBanco(payload);
      }

      toast.success(
        esEdicion ? "Cuenta bancaria actualizada" : "Cuenta bancaria creada"
      );
      setLocation(destinoVolver);
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "No se pudo guardar la cuenta bancaria";

      setErrorGlobal(message);
      toast.error(message);
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <DashboardLayout
        titulo={esEdicion ? "Editar Cuenta Bancaria" : "Nueva Cuenta Bancaria"}
        descripcion="Cargando informacion de la cuenta"
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
          <p className="text-muted-foreground">Cargando formulario...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (esEdicion && !cuentaDisponible) {
    return (
      <DashboardLayout
        titulo="Editar Cuenta Bancaria"
        descripcion="No fue posible cargar la cuenta"
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
            {errorGlobal ?? "La cuenta bancaria solicitada no existe"}
          </p>
          <Button asChild variant="outline">
            <Link href={destinoVolver}>Volver a Bancos</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      titulo={esEdicion ? "Editar Cuenta Bancaria" : "Nueva Cuenta Bancaria"}
      descripcion="Configuracion base de cuentas para egresos, recibos y movimientos bancarios"
      acciones={
        <Button asChild variant="outline" size="sm" className="gap-2">
          <Link href={destinoVolver}>
            <ArrowLeft size={18} />
            Volver
          </Link>
        </Button>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {errorGlobal && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorGlobal}
          </div>
        )}

        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-foreground">
              Informacion principal
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Define la cuenta bancaria que podra usarse en egresos y recibos.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nombreBanco">Banco</Label>
              <Input
                id="nombreBanco"
                value={form.nombreBanco}
                onChange={event => updateField("nombreBanco", event.target.value)}
                placeholder="Ej. Bancolombia"
              />
              {errors.nombreBanco && (
                <p className="text-sm text-destructive">{errors.nombreBanco}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="nombreCuenta">Nombre de cuenta</Label>
              <Input
                id="nombreCuenta"
                value={form.nombreCuenta}
                onChange={event => updateField("nombreCuenta", event.target.value)}
                placeholder="Ej. Cuenta principal recaudo"
              />
              {errors.nombreCuenta && (
                <p className="text-sm text-destructive">{errors.nombreCuenta}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Tipo de cuenta</Label>
              <Select
                value={form.tipoCuenta}
                onValueChange={value =>
                  updateField("tipoCuenta", value as ContableCuentaBancariaTipo)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tipo de cuenta" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(ContableCuentaBancariaTipo).map(tipo => (
                    <SelectItem key={tipo} value={tipo}>
                      {formatCuentaTipoLabel(tipo)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="numeroCuenta">Numero de cuenta</Label>
              <Input
                id="numeroCuenta"
                value={form.numeroCuenta}
                onChange={event => updateField("numeroCuenta", event.target.value)}
                placeholder="Numero de cuenta"
              />
              {errors.numeroCuenta && (
                <p className="text-sm text-destructive">{errors.numeroCuenta}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="titular">Titular</Label>
              <Input
                id="titular"
                value={form.titular}
                onChange={event => updateField("titular", event.target.value)}
                placeholder="Titular de la cuenta"
              />
              {errors.titular && (
                <p className="text-sm text-destructive">{errors.titular}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="saldoInicial">Saldo inicial</Label>
              <Input
                id="saldoInicial"
                type="number"
                min="0"
                step="0.01"
                value={form.saldoInicial}
                onChange={event => updateField("saldoInicial", event.target.value)}
              />
              {errors.saldoInicial && (
                <p className="text-sm text-destructive">{errors.saldoInicial}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Estado</Label>
              <Select
                value={form.activa}
                onValueChange={value =>
                  updateField("activa", value as "activa" | "inactiva")
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="activa">Activa</SelectItem>
                  <SelectItem value="inactiva">Inactiva</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="observaciones">Observaciones</Label>
              <Textarea
                id="observaciones"
                value={form.observaciones}
                onChange={event =>
                  updateField("observaciones", event.target.value)
                }
                placeholder="Observaciones internas de la cuenta bancaria"
                rows={4}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Button asChild variant="outline">
            <Link href={destinoVolver}>Cancelar</Link>
          </Button>
          <Button type="submit" className="gap-2" disabled={guardando}>
            <Save size={18} />
            {guardando ? "Guardando..." : esEdicion ? "Guardar cambios" : "Crear cuenta"}
          </Button>
        </div>
      </form>
    </DashboardLayout>
  );
}
