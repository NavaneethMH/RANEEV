/* RANEEV Clinical Wayfinding — route map for the public, citizen, volunteer, coordinator, and admin frontend shells. */
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AdminPortal, AuthPage, CitizenPortal, CoordinatorPortal, LandingPage, RoleSelection, VolunteerPortal } from "./pages/RaneevScreens";

function Router() {
  return <Switch>
    <Route path="/" component={LandingPage} />
    <Route path="/login">{() => <AuthPage kind="login" />}</Route>
    <Route path="/register">{() => <AuthPage kind="register" />}</Route>
    <Route path="/roles" component={RoleSelection} />
    <Route path="/citizen/:page?">{({ page }) => <CitizenPortal page={page} />}</Route>
    <Route path="/volunteer/:page?">{({ page }) => <VolunteerPortal page={page} />}</Route>
    <Route path="/coordinator/:page?">{({ page }) => <CoordinatorPortal page={page} />}</Route>
    <Route path="/admin/:page?">{({ page }) => <AdminPortal page={page} />}</Route>
    <Route path="/404" component={NotFound} />
    <Route component={NotFound} />
  </Switch>;
}

export default function App() { return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster position="top-right" richColors /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>; }
