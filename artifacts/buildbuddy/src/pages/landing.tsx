import { Link } from 'wouter';

export default function Landing() {
  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="max-w-5xl mx-auto px-5 py-5 flex items-center justify-between">
        <span className="font-display font-bold text-lg">BuildBuddy <span className="text-primary">Voice</span></span>
        <div className="flex gap-2">
          <Link href="/sign-in" data-testid="link-sign-in" className="rounded-full px-4 py-2 text-sm font-medium hover:bg-muted">Sign in</Link>
          <Link href="/sign-up" data-testid="link-sign-up" className="rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-medium">Sign up</Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-5 py-16 md:py-28 bb-in">
        <p className="text-xs font-mono uppercase tracking-widest text-primary mb-4">For people who have never coded</p>
        <h1 className="font-display font-bold text-4xl sm:text-6xl leading-[1.05] mb-5">Tell me what you are trying to get done.</h1>
        <p className="text-muted-foreground text-lg mb-8 max-w-xl">
          BuildBuddy Voice asks the right questions about your goal, then automatically starts a controlled build when AgenticOrg returns a complete, validated plan. AgenticOrg may still pause a run for its own review. Create an account to keep your projects private and available on any browser.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/sign-up" data-testid="link-get-started" className="rounded-full bg-primary text-primary-foreground px-6 py-3 text-sm font-medium">Create an account</Link>
          <Link href="/sign-in" data-testid="link-have-account" className="rounded-full border bg-card px-6 py-3 text-sm font-medium">I already have one</Link>
        </div>
      </main>
    </div>
  );
}
