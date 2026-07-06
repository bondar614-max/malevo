import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Generate from "@/pages/Generate";
import Service from "@/pages/Service";
import BusinessServices from "@/pages/BusinessServices";
import Styles from "@/pages/Styles";
import Admin from "@/pages/Admin";
import AdminLogin from "@/pages/AdminLogin";
import Account from "@/pages/Account";
import { AuthProvider } from "@/lib/auth";
import { AuthModalProvider } from "@/components/auth/AuthModal";
import { SupportWidget } from "@/components/support/SupportWidget";
import { AnalyticsScripts } from "@/components/AnalyticsScripts";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/business-services" component={BusinessServices} />
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
              <ScrollToTop />
              <AnalyticsScripts />
              <Router />
              <SupportWidget />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </AuthModalProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
