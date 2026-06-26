import { AlertTriangle, BarChart3, Brain, Calculator, Map, MapPinned, Users } from 'lucide-react';

export function AppLayout({ children, setPage }: { children: React.ReactNode; setPage: (p: string) => void }) {
  const items = [
    ['dashboard', 'Dashboard', BarChart3],
    ['electoral', 'Electoral', BarChart3],
    ['mapa', 'Mapa', Map],
    ['territorio', 'Territorio', MapPinned],
    ['inteligencia', 'Inteligencia Territorial', Brain],
    ['ciudadanos', 'Ciudadanos', Users],
    ['problematicas', 'Campo', AlertTriangle],
    ['simulador', 'Simulador', Calculator],
    ['ia', 'IA Estratégica', Brain],
  ] as const;

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-72 bg-slate-950 p-5 text-white md:block">
        <h1 className="text-xl font-bold leading-tight">
          FUNZA 2027
          <br />
          <span className="text-sm text-slate-300">Centro de Inteligencia Electoral</span>
        </h1>
        <nav className="mt-8 space-y-2">
          {items.map(([id, label, Icon]) => (
            <button key={id} onClick={() => setPage(id)} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 hover:bg-slate-800">
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
        <p className="mt-10 text-xs text-slate-400">Uso exclusivo de datos públicos, agregados y estadísticos.</p>
      </aside>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
