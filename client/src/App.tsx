/* RANEEV route registry — existing pages remain intact; guards decide access before protected workspaces render. */
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "./_core/hooks/useAuth";
import { EmergencyDraftProvider } from "./contexts/EmergencyDraftContext";
import { AccessDenied, AdminPortal, AuthPage, CitizenPortal, CoordinatorPortal, LandingPage, RoleSelection, VolunteerPortal } from "./pages/RaneevScreens";

type RaneevRole = "citizen" | "volunteer" | "coordinator" | "admin";
function ProtectedWorkspace({ roles, children }: { roles: RaneevRole[]; children: React.ReactNode }) { const { user, loading } = useAuth({ redirectOnUnauthenticated: true, redirectPath: "/login" }); if (loading || !user) return null; if (!roles.includes(user.role)) return <AccessDenied />; return <>{children}</>; }

function Router() { return <Switch>
  <Route path="/" component={LandingPage} />
  <Route path="/login">{() => <AuthPage kind="login" />}</Route>
  <Route path="/register">{() => <AuthPage kind="register" />}</Route>
  <Route path="/roles" component={RoleSelection} />
  <Route path="/access-denied" component={AccessDenied} />
  <Route path="/citizen/live/:publicId">{({ publicId }) => <ProtectedWorkspace roles={["citizen"]}><CitizenPortal page="live" publicId={publicId} /></ProtectedWorkspace>}</Route>
  <Route path="/citizen/:page?">{({ page }) => <ProtectedWorkspace roles={["citizen"]}><CitizenPortal page={page} /></ProtectedWorkspace>}</Route>
  <Route path="/volunteer/:page?">{({ page }) => <ProtectedWorkspace roles={["volunteer"]}><VolunteerPortal page={page} /></ProtectedWorkspace>}</Route>
  <Route path="/coordinator/:page?">{({ page }) => <ProtectedWorkspace roles={["coordinator"]}><CoordinatorPortal page={page} /></ProtectedWorkspace>}</Route>
  <Route path="/admin/:page?">{({ page }) => <ProtectedWorkspace roles={["admin"]}><AdminPortal page={page} /></ProtectedWorkspace>}</Route>
  <Route path="/404" component={NotFound} />
  <Route component={NotFound} />
</Switch>; }

export default function App() { return <ErrorBoundary><ThemeProvider defaultTheme="light"><EmergencyDraftProvider><TooltipProvider><Toaster position="top-right" richColors /><Router /></TooltipProvider></EmergencyDraftProvider></ThemeProvider></ErrorBoundary>; }
