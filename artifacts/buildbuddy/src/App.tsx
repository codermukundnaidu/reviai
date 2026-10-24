import { useEffect, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Shell } from '@/components/shell';
import Home from '@/pages/home';
import Projects from '@/pages/projects';
import ProjectPage from '@/pages/project';
import Settings from '@/pages/settings';
import NotFound from '@/pages/not-found';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

function Router() {
  const [path] = useLocation();
  useEffect(() => {
    const name = path === '/' ? 'Start with your idea' : path === '/projects' ? 'Your projects' : path === '/settings' ? 'Settings & connections' : 'Project workspace';
    document.title = `${name} · BuildBuddy Voice`;
  }, [path]);
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <Shell><RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/projects" component={Projects} />
        <Route path="/project/:id" component={ProjectPage} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary></Shell>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
