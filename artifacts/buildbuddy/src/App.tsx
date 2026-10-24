import { useEffect, useRef, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useAuth } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Shell } from '@/components/shell';
import { VoiceAgentProvider } from '@/components/voice-agent';
import Home from '@/pages/home';
import Landing from '@/pages/landing';
import Projects from '@/pages/projects';
import ProjectPage from '@/pages/project';
import Settings from '@/pages/settings';
import NotFound from '@/pages/not-found';
import { Redirect, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: 'hsl(152, 36%, 33%)',
    colorForeground: 'hsl(160, 8%, 13%)',
    colorMutedForeground: 'hsl(160, 6%, 38%)',
    colorDanger: 'hsl(8, 58%, 45%)',
    colorBackground: 'hsl(42, 30%, 98%)',
    colorInput: 'hsl(42, 30%, 99%)',
    colorInputForeground: 'hsl(160, 8%, 13%)',
    colorNeutral: 'hsl(160, 8%, 30%)',
    fontFamily: "'DM Sans', sans-serif",
    borderRadius: '0.9rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[hsl(42,30%,98%)] border border-[hsl(40,14%,85%)] rounded-3xl w-[440px] max-w-full overflow-hidden shadow-sm',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[hsl(160,8%,13%)] font-bold',
    headerSubtitle: 'text-[hsl(160,6%,38%)]',
    socialButtonsBlockButtonText: 'text-[hsl(160,8%,13%)]',
    formFieldLabel: 'text-[hsl(160,8%,13%)]',
    footerActionLink: 'text-[hsl(152,36%,28%)] font-medium',
    footerActionText: 'text-[hsl(160,6%,38%)]',
    dividerText: 'text-[hsl(160,6%,38%)]',
    identityPreviewEditButton: 'text-[hsl(152,36%,28%)]',
    formFieldSuccessText: 'text-[hsl(152,36%,28%)]',
    alertText: 'text-[hsl(8,58%,35%)]',
    logoBox: 'h-12',
    logoImage: 'h-12 w-12',
    formButtonPrimary: 'bg-[hsl(152,36%,33%)] text-white hover:bg-[hsl(152,36%,28%)]',
  },
};

const localization = {
  signIn: { start: { title: 'Welcome back to BuildBuddy', subtitle: 'Sign in to see your projects' } },
  signUp: { start: { title: 'Create your BuildBuddy account', subtitle: 'Keep your projects private and on any browser' } },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prev = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    return addListener(({ user }) => {
      const id = user?.id ?? null;
      if (prev.current !== undefined && prev.current !== id) qc.clear();
      prev.current = id;
    });
  }, [addListener, qc]);
  return null;
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in"><Redirect to="/projects" /></Show>
      <Show when="signed-out"><Landing /></Show>
    </>
  );
}

function LoadingShell() {
  return (
    <div className="min-h-[100dvh] grid place-items-center bg-background" data-testid="status-auth-loading">
      <div className="h-3 w-40 rounded-full bg-muted animate-pulse" />
    </div>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function Protected() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const [path] = useLocation();
  useEffect(() => {
    const name = path === '/new' ? 'Start with your idea' : path === '/projects' ? 'Your projects' : path === '/settings' ? 'Settings & connections' : 'Project workspace';
    document.title = `${name} · BuildBuddy Voice`;
  }, [path]);
  if (!isLoaded) return <LoadingShell />;
  if (!isSignedIn) return <Redirect to="/" />;
  return (
    <VoiceAgentProvider key={userId}>
      <Shell key={userId}>
        <RoutedErrorBoundary>
          <Switch>
            <Route path="/new" component={Home} />
            <Route path="/projects" component={Projects} />
            <Route path="/project/:id" component={ProjectPage} />
            <Route path="/settings" component={Settings} />
            <Route component={NotFound} />
          </Switch>
        </RoutedErrorBoundary>
      </Shell>
    </VoiceAgentProvider>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={localization}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Switch>
            <Route path="/" component={HomeRedirect} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            <Route component={Protected} />
          </Switch>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
