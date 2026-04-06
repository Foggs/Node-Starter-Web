import { Switch, Route, Router as WouterRouter, Link, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import About from "@/pages/about";

const queryClient = new QueryClient();

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
];

function NavBar() {
  const [location] = useLocation();
  return (
    <nav className="border-b bg-background">
      <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
        <span className="font-semibold text-foreground">My App</span>
        <div className="flex items-center gap-6">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`text-sm transition-colors ${
                location === href
                  ? "text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}

function Router() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <NavBar />
      <main className="flex-1">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/about" component={About} />
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
