import { BrainCircuit, FolderTree, GitGraph, LayoutDashboard, SearchCode, Settings, Sparkles } from "lucide-react";

const navItems = [
  { label: "Repositories", icon: LayoutDashboard },
  { label: "Architecture", icon: FolderTree },
  { label: "Graph Explorer", icon: GitGraph },
  { label: "AI Chat", icon: BrainCircuit },
  { label: "Impact Analyzer", icon: SearchCode },
  { label: "Settings", icon: Settings }
];

const metrics = [
  ["Files", "320"],
  ["Functions", "1,200"],
  ["Services", "7"],
  ["Dependencies", "560"]
];

export function Workspace() {
  return (
    <main className="grid min-h-screen grid-cols-[260px_1fr]">
      <aside className="border-r border-slate-800 bg-slate-950 p-4">
        <p className="mb-4 text-xs uppercase tracking-[0.25em] text-slate-400">Prometheus</p>
        <button className="mb-6 w-full rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-left text-sm text-cyan-300">
          + Import Repository
        </button>
        <nav className="space-y-2">
          {navItems.map(({ label, icon: Icon }, idx) => (
            <button
              key={label}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                idx === 0 ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-900"
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>
        <div className="mt-8 rounded-lg border border-slate-800 bg-slate-900 p-3 text-xs text-slate-300">
          <p className="mb-2 font-medium text-slate-100">Command Palette</p>
          <p>Press ⌘K to search functions, open graphs, and ask AI.</p>
        </div>
      </aside>

      <section className="p-6">
        <header className="panel mb-6 p-5">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Repository Dashboard</p>
          <h1 className="mt-2 text-2xl font-semibold">Repo: Stripe Clone</h1>
          <div className="mt-5 grid gap-3 md:grid-cols-4">
            {metrics.map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                <p className="text-xs text-slate-400">{label}</p>
                <p className="mt-1 text-xl font-semibold">{value}</p>
              </div>
            ))}
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="panel p-4 lg:col-span-2">
            <h2 className="mb-4 font-semibold">Repository Import</h2>
            <div className="space-y-3 text-sm">
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-slate-400">Paste GitHub URL</div>
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-slate-400">Upload ZIP</div>
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-slate-400">Connect GitHub</div>
              <button className="rounded-lg bg-cyan-400 px-3 py-2 text-sm font-medium text-slate-900">Analyze Repository</button>
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <p>Step 1: Parsing files ✓</p>
              <p>Step 2: Building graph ⏳</p>
              <p>Step 3: Indexing code</p>
            </div>
          </div>

          <div className="panel p-4">
            <h2 className="mb-3 font-semibold">Architecture Overview</h2>
            <pre className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs text-cyan-300">
{`Frontend
  ↓
API Gateway
  ↓
Auth Service
  ↓
Database`}
            </pre>
          </div>

          <div className="panel p-4 lg:col-span-2">
            <h2 className="mb-3 font-semibold">Graph Explorer</h2>
            <pre className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs text-slate-300">
{`           authService
           /       \
       login()    logout()
          |
     validateUser()
          |
       database`}
            </pre>
            <p className="mt-3 text-sm text-slate-400">Zoom, search nodes, highlight dependencies, click node → show code.</p>
          </div>

          <div className="panel p-4">
            <h2 className="mb-3 font-semibold">AI Codebase Chat</h2>
            <p className="mb-2 rounded-lg border border-slate-800 bg-slate-950 p-2 text-sm text-slate-300">
              Explain authentication flow
            </p>
            <p className="text-sm text-slate-400">auth/service.ts line 45</p>
          </div>

          <div className="panel p-4">
            <h2 className="mb-3 font-semibold">Impact Analyzer</h2>
            <p className="text-sm text-slate-300">Changing processPayment() affects:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-400">
              <li>checkoutService</li>
              <li>refundService</li>
              <li>billingAPI</li>
            </ul>
          </div>

          <div className="panel p-4">
            <h2 className="mb-3 font-semibold">File Explorer</h2>
            <pre className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs text-slate-300">{`src/
  auth/
    login.ts
    token.ts
  payments/
    billing.ts`}</pre>
          </div>
        </div>

        <footer className="mt-4 flex items-center gap-2 text-xs text-slate-500">
          <Sparkles size={14} />
          Workspace-first interface inspired by GitHub, Linear, and IDE workflows.
        </footer>
      </section>
    </main>
  );
}
