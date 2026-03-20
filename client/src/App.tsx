import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";
import Clientes from "./pages/Clientes";
import ClienteDetalle from "./pages/ClienteDetalle";
import ClienteNuevo from "./pages/ClienteNuevo";
import Prospectos from "./pages/Prospectos";
import Visitas from "./pages/Visitas";
import Cotizaciones from "./pages/Cotizaciones";
import Seguimientos from "./pages/Seguimientos";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Dashboard} />
      <Route path={"/dashboard"} component={Dashboard} />
      <Route path={"/clientes"} component={Clientes} />
      <Route path={"/clientes/nuevo"} component={ClienteNuevo} />
      <Route path={"/clientes/:id/editar"} component={ClienteNuevo} />
      <Route path={"/clientes/:id"} component={ClienteDetalle} />
      <Route path={"/prospectos"} component={Prospectos} />
      <Route path={"/visitas"} component={Visitas} />
      <Route path={"/cotizaciones"} component={Cotizaciones} />
      <Route path={"/seguimientos"} component={Seguimientos} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
