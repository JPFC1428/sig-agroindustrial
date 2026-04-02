import { ArrowLeft, ArrowRight } from "lucide-react";
import { Link, useLocation } from "wouter";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  getModuleByKey,
  getModuleItemByPath,
  getVisibleModuleItems,
  type AppModuleKey,
} from "@/lib/module-navigation";

type ModuleWorkspaceProps = {
  moduleKey: AppModuleKey;
};

function getSectionSupportText(moduleKey: AppModuleKey, itemId: string) {
  if (moduleKey === "contable" && itemId === "contable-viaticos") {
    return "Esta opcion se deja preparada para conectar viaticos, gastos y soportes del modulo Comercial cuando se construya la fase contable.";
  }

  if (moduleKey === "contable") {
    return "La ruta, navegacion y espacio funcional ya quedaron creados para construir esta seccion por fases sin volver a reorganizar el sistema.";
  }

  if (moduleKey === "sertec") {
    return "SERTEC queda como modulo principal independiente, listo para sumar vistas y procesos propios en fases posteriores.";
  }

  return "El modulo queda creado como punto de entrada funcional para fases posteriores de inventario, compras y abastecimiento.";
}

export default function ModuleWorkspace({ moduleKey }: ModuleWorkspaceProps) {
  const [location] = useLocation();
  const module = getModuleByKey(moduleKey);
  const visibleItems = getVisibleModuleItems(module);
  const currentItem = getModuleItemByPath(module.key, location);
  const isDashboard = currentItem.id === module.items[0]?.id;

  return (
    <DashboardLayout
      titulo={isDashboard ? module.label : currentItem.label}
      descripcion={isDashboard ? module.description : currentItem.description}
    >
      <div className="max-w-6xl space-y-6">
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">
              Estructura funcional
            </h2>
            <p className="text-sm text-muted-foreground">
              {getSectionSupportText(module.key, currentItem.id)}
            </p>
          </div>
        </div>

        {isDashboard ? (
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <div className="mb-6">
              <h3 className="text-base font-semibold text-foreground">
                Opciones del modulo
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Esta base ya permite desarrollar cada seccion por separado sin
                cambiar la navegacion principal.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleItems.map(item => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="rounded-lg border border-border bg-background p-4 transition-smooth hover:bg-accent"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{item.label}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                    <ArrowRight size={16} className="mt-1 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.4fr,0.9fr]">
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <div className="mb-4">
                <p className="text-sm font-medium text-foreground">
                  {currentItem.label}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {currentItem.description}
                </p>
              </div>

              <div className="rounded-lg border border-border bg-accent/40 p-4 text-sm text-muted-foreground">
                La ruta ya existe y queda separada como parte del modulo{" "}
                <span className="font-medium text-foreground">{module.label}</span>.
                En la siguiente fase se puede conectar a Neon, endpoints y
                procesos contables o operativos sin volver a tocar el menu
                principal.
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <h3 className="text-base font-semibold text-foreground">
                Navegacion
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Usa el dashboard del modulo para seguir incorporando funciones
                por etapas.
              </p>

              <div className="mt-5 flex flex-col gap-3">
                <Button asChild variant="outline">
                  <Link href={module.href}>
                    <ArrowLeft size={16} />
                    Volver al dashboard del modulo
                  </Link>
                </Button>

                {moduleKey === "contable" && currentItem.id === "contable-viaticos" && (
                  <Button asChild>
                    <Link href="/visitas">Abrir visitas comerciales</Link>
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
