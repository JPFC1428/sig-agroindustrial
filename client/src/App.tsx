import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";
import Clientes from "./pages/Clientes";
import Contable from "./pages/Contable";
import ContableEgresoDetalle from "./pages/ContableEgresoDetalle";
import ContableEgresoNuevo from "./pages/ContableEgresoNuevo";
import ContableEgresos from "./pages/ContableEgresos";
import ContableBancoMovimientos from "./pages/ContableBancoMovimientos";
import ContableBancoNuevo from "./pages/ContableBancoNuevo";
import ContableBancos from "./pages/ContableBancos";
import ContableArchivo from "./pages/ContableArchivo";
import ContableReportes from "./pages/ContableReportes";
import ContableConciliacionBancaria from "./pages/ContableConciliacionBancaria";
import ContableCarteraClientes from "./pages/ContableCarteraClientes";
import ContableCarteraProveedores from "./pages/ContableCarteraProveedores";
import ContableCuadresCaja from "./pages/ContableCuadresCaja";
import ContableFacturasCompra from "./pages/ContableFacturasCompra";
import ContableFacturaCompraNueva from "./pages/ContableFacturaCompraNueva";
import ContableLegalizacionViaticos from "./pages/ContableLegalizacionViaticos";
import ContableNominaSeguridadSocial from "./pages/ContableNominaSeguridadSocial";
import ContableNotaCreditoDetalle from "./pages/ContableNotaCreditoDetalle";
import ContableNotaCreditoNueva from "./pages/ContableNotaCreditoNueva";
import ContableNotasCredito from "./pages/ContableNotasCredito";
import ContableReciboCajaDetalle from "./pages/ContableReciboCajaDetalle";
import ContableReciboCajaNuevo from "./pages/ContableReciboCajaNuevo";
import ContableRecibosCaja from "./pages/ContableRecibosCaja";
import ContableTerceros from "./pages/ContableTerceros";
import ContableTerceroNuevo from "./pages/ContableTerceroNuevo";
import Configuracion from "./pages/Configuracion";
import ClienteDetalle from "./pages/ClienteDetalle";
import ClienteNuevo from "./pages/ClienteNuevo";
import ChatInterno from "./pages/ChatInterno";
import CotizacionImprimir from "./pages/CotizacionImprimir";
import CotizacionNueva from "./pages/CotizacionNueva";
import InventarioCompras from "./pages/InventarioCompras";
import InventarioComprasGestion from "./pages/InventarioComprasGestion";
import InventarioEntradas from "./pages/InventarioEntradas";
import InventarioProductos from "./pages/InventarioProductos";
import InventarioProveedores from "./pages/InventarioProveedores";
import Login from "./pages/Login";
import MercadoAgricola from "./pages/MercadoAgricola";
import MercadoAgricolaAdmin from "./pages/MercadoAgricolaAdmin";
import ProspectoDetalle from "./pages/ProspectoDetalle";
import ProspectoNuevo from "./pages/ProspectoNuevo";
import Prospectos from "./pages/Prospectos";
import RoleHome from "./pages/RoleHome";
import Sertec from "./pages/Sertec";
import SertecDetalle from "./pages/SertecDetalle";
import SertecImprimir from "./pages/SertecImprimir";
import SertecNueva from "./pages/SertecNueva";
import Usuarios from "./pages/Usuarios";
import VisitaNueva from "./pages/VisitaNueva";
import VisitaDetalle from "./pages/VisitaDetalle";
import Visitas from "./pages/Visitas";
import Cotizaciones from "./pages/Cotizaciones";
import Seguimientos from "./pages/Seguimientos";
import SeguimientoNuevo from "./pages/SeguimientoNuevo";

function Router() {
  return (
    <Switch>
      <Route path={"/login"} component={Login} />
      <ProtectedRoute path={"/"} component={RoleHome} />
      <ProtectedRoute path={"/dashboard"} component={Dashboard} />
      <ProtectedRoute path={"/sertec"} component={Sertec} />
      <ProtectedRoute path={"/sertec/nuevo"} component={SertecNueva} />
      <ProtectedRoute
        path={"/sertec/:id/imprimir-entrada"}
        component={SertecImprimir}
      />
      <ProtectedRoute
        path={"/sertec/:id/imprimir-salida"}
        component={SertecImprimir}
      />
      <ProtectedRoute path={"/sertec/:id"} component={SertecDetalle} />
      <ProtectedRoute
        path={"/contable/terceros/nuevo"}
        component={ContableTerceroNuevo}
      />
      <ProtectedRoute
        path={"/contable/terceros/:id/editar"}
        component={ContableTerceroNuevo}
      />
      <ProtectedRoute
        path={"/contable/terceros"}
        component={ContableTerceros}
      />
      <ProtectedRoute
        path={"/contable/cartera-clientes"}
        component={ContableCarteraClientes}
      />
      <ProtectedRoute
        path={"/contable/cartera-proveedores"}
        component={ContableCarteraProveedores}
      />
      <ProtectedRoute
        path={"/contable/recibos-caja/nuevo"}
        component={ContableReciboCajaNuevo}
      />
      <ProtectedRoute
        path={"/contable/recibos-caja/:id"}
        component={ContableReciboCajaDetalle}
      />
      <ProtectedRoute
        path={"/contable/recibos-caja"}
        component={ContableRecibosCaja}
      />
      <ProtectedRoute
        path={"/contable/bancos/nuevo"}
        component={ContableBancoNuevo}
      />
      <ProtectedRoute
        path={"/contable/bancos/:id/editar"}
        component={ContableBancoNuevo}
      />
      <ProtectedRoute
        path={"/contable/bancos/:id"}
        component={ContableBancoMovimientos}
      />
      <ProtectedRoute path={"/contable/bancos"} component={ContableBancos} />
      <ProtectedRoute
        path={"/contable/conciliaciones-bancarias"}
        component={ContableConciliacionBancaria}
      />
      <ProtectedRoute path={"/contable/dashboard"} component={Contable} />
      <ProtectedRoute
        path={"/contable/reportes"}
        component={ContableReportes}
      />
      <ProtectedRoute
        path={"/contable/archivo"}
        component={ContableArchivo}
      />
      <ProtectedRoute
        path={"/contable/comprobantes-egreso/nuevo"}
        component={ContableEgresoNuevo}
      />
      <ProtectedRoute
        path={"/contable/comprobantes-egreso/:id"}
        component={ContableEgresoDetalle}
      />
      <ProtectedRoute
        path={"/contable/comprobantes-egreso"}
        component={ContableEgresos}
      />
      <ProtectedRoute
        path={"/contable/facturas-compra/nuevo"}
        component={ContableFacturaCompraNueva}
      />
      <ProtectedRoute
        path={"/contable/facturas-compra/:id/editar"}
        component={ContableFacturaCompraNueva}
      />
      <ProtectedRoute
        path={"/contable/facturas-compra"}
        component={ContableFacturasCompra}
      />
      <ProtectedRoute
        path={"/contable/notas-credito/nuevo"}
        component={ContableNotaCreditoNueva}
      />
      <ProtectedRoute
        path={"/contable/notas-credito/:id"}
        component={ContableNotaCreditoDetalle}
      />
      <ProtectedRoute
        path={"/contable/notas-credito"}
        component={ContableNotasCredito}
      />
      <ProtectedRoute
        path={"/contable/cuadres-caja"}
        component={ContableCuadresCaja}
      />
      <ProtectedRoute
        path={"/contable/nomina-seguridad-social"}
        component={ContableNominaSeguridadSocial}
      />
      <ProtectedRoute
        path={"/contable/viaticos"}
        component={ContableLegalizacionViaticos}
      />
      <ProtectedRoute path={"/contable"} component={Contable} />
      <ProtectedRoute path={"/contable/:section"} component={Contable} />
      <ProtectedRoute
        path={"/inventario-compras"}
        component={InventarioCompras}
      />
      <ProtectedRoute
        path={"/inventario-compras/proveedores"}
        component={InventarioProveedores}
      />
      <ProtectedRoute
        path={"/inventario-compras/productos"}
        component={InventarioProductos}
      />
      <ProtectedRoute
        path={"/inventario-compras/compras"}
        component={InventarioComprasGestion}
      />
      <ProtectedRoute
        path={"/inventario-compras/entradas"}
        component={InventarioEntradas}
      />
      <ProtectedRoute
        path={"/inventario-compras/:section"}
        component={InventarioCompras}
      />
      <ProtectedRoute path={"/chat"} component={ChatInterno} />
      <ProtectedRoute
        path={"/mercado-agricola/admin"}
        component={MercadoAgricolaAdmin}
      />
      <ProtectedRoute path={"/mercado-agricola"} component={MercadoAgricola} />
      <ProtectedRoute path={"/configuracion"} component={Configuracion} />
      <ProtectedRoute path={"/usuarios"} component={Usuarios} adminOnly />
      <ProtectedRoute path={"/clientes"} component={Clientes} />
      <ProtectedRoute path={"/clientes/nuevo"} component={ClienteNuevo} />
      <ProtectedRoute
        path={"/clientes/:id/editar"}
        component={ClienteNuevo}
      />
      <ProtectedRoute path={"/clientes/:id"} component={ClienteDetalle} />
      <ProtectedRoute path={"/prospectos"} component={Prospectos} />
      <ProtectedRoute path={"/prospectos/nuevo"} component={ProspectoNuevo} />
      <ProtectedRoute
        path={"/prospectos/:id/editar"}
        component={ProspectoNuevo}
      />
      <ProtectedRoute path={"/prospectos/:id"} component={ProspectoDetalle} />
      <ProtectedRoute path={"/visitas/nuevo"} component={VisitaNueva} />
      <ProtectedRoute
        path={"/visitas/:id/editar"}
        component={VisitaNueva}
      />
      <ProtectedRoute path={"/visitas/:id"} component={VisitaDetalle} />
      <ProtectedRoute path={"/visitas"} component={Visitas} />
      <ProtectedRoute path={"/cotizaciones/nuevo"} component={CotizacionNueva} />
      <ProtectedRoute
        path={"/cotizaciones/:id/editar"}
        component={CotizacionNueva}
      />
      <ProtectedRoute
        path={"/cotizaciones/:id/imprimir"}
        component={CotizacionImprimir}
      />
      <ProtectedRoute path={"/cotizaciones"} component={Cotizaciones} />
      <ProtectedRoute
        path={"/seguimientos/nuevo"}
        component={SeguimientoNuevo}
      />
      <ProtectedRoute
        path={"/seguimientos/:id/editar"}
        component={SeguimientoNuevo}
      />
      <ProtectedRoute path={"/seguimientos"} component={Seguimientos} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
