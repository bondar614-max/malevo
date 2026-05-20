import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Generate from "@/pages/Generate";
import Service from "@/pages/Service";
import Styles from "@/pages/Styles";
import Admin from "@/pages/Admin";
import AdminLogin from "@/pages/AdminLogin";
import Account from "@/pages/Account";
import { AuthProvider } from "@/lib/auth";
import { AuthModalProvider } from "@/components/auth/AuthModal";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/styles" component={Styles} />
      <Route path="/generate/:id" component={Generate} />
      <Route path="/service/:key" component={Service} />
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin" component={Admin} />
      <Route path="/account" component={Account} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Enforce dark mode on the document
  if (typeof document !== 'undefined') {
    document.documentElement.classList.add('dark');
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthModalProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </AuthModalProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
