import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, MapPinned, Target, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api/client';
import { KpiCard } from '../components/KpiCard';
import { labelFor } from '../utils/presentation';

const fmt = new Intl.NumberFormat('es-CO');

const emptyCitizens = { totales: {}, evolucion_temporal: [], variacion_semanal: {}, ranking_problematicas: [], lideres: [] };
const emptyIntelligence = { zonas: [], recomendaciones: [], ranking_problematicas: [] };

export function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [citizens, setCitizens] = useState<any>(null);
  const [intelligence, setIntelligence] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    async function load() {
      const [dashboardResult, citizensResult, intelligenceResult] = await Promise.allSettled([
        api.get('/dashboard'),
        api.get('/ciudadanos/indicadores'),
        api.get('/inteligencia/resumen-territorial'),
      ]);
      if (!mounted) return;
      setData(dashboardResult.status === 'fulfilled' ? dashboardResult.value.data : { kpis: {}, crecimiento: [] });
      setCitizens(citizensResult.status === 'fulfilled' ? citizensResult.value.data : emptyCitizens);
      setIntelligence(intelligenceResult.status === 'fulfilled' ? intelligenceResult.value.data : emptyIntelligence);
      if ([dashboardResult, citizensResult, intelligenceResult].some((result) => result.status === 'rejected')) {
        setError('No fue posible cargar toda la información territorial. Se muestran los datos disponibles.');
      }
    }
    load().catch(() => {
      if (!mounted) return;
      setData({ kpis: {}, crecimiento: [] });
      setCitizens(emptyCitizens);
      setIntelligence(emptyIntelligence);
      setError('No fue posible conectar con el backend. Intenta nuevamente en unos segundos.');
    });
    return () => {
      mounted = false;
    };
  }, []);

  const totals = citizens?.totales || {};
  const criticalZones = useMemo(
    () => (intelligence?.zonas || []).filter((zone: any) => ['Zona crítica', 'Zona prioritaria', 'Zona en crecimiento'].includes(zone.nivel_prioridad_territorial)).slice(0, 6),
    [intelligence],
  );
  const consolidatedZones = useMemo(
    () => (intelligence?.zonas || []).filter((zone: any) => zone.nivel_prioridad_territorial === 'Zona consolidada').slice(0, 6),
    [intelligence],
  );

  if (!data || !citizens || !intelligence) return <p>Cargando inteligencia territorial...</p>;

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Centro de inteligencia territorial</h2>
        <p className="text-slate-500">Indicadores vivos alimentados por ciudadanos, interacciones, problemáticas y territorio.</p>
      </div>

      {error && <p className="rounded-lg bg-amber-50 p-4 font-semibold text-amber-900">{error}</p>}

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard title="Ciudadanos" value={fmt.format(totals.ciudadanos_captados || 0)} />
        <KpiCard title="Cobertura" value={`${totals.cobertura_global || 0}%`} />
        <KpiCard title="Apoyos altos" value={fmt.format(totals.apoyo_alto || 0)} />
        <KpiCard title="Indecisos" value={fmt.format(totals.indecisos || 0)} />
        <KpiCard title="No apoyos" value={fmt.format(totals.no_apoyos || 0)} />
        <KpiCard title="Proyección votos" value={fmt.format(totals.proyeccion_votos || 0)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <div className="card">
          <h3 className="mb-4 font-semibold">Zonas priorizadas por inteligencia</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={(intelligence.zonas || []).slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="zona" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="puntaje_prioridad" radius={[6, 6, 0, 0]}>
                {(intelligence.zonas || []).slice(0, 10).map((entry: any) => (
                  <Cell key={entry.zona} fill={entry.nivel_prioridad_territorial === 'Zona crítica' ? '#dc2626' : '#0f172a'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="mb-4 font-semibold">Evolución de captación</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={citizens.evolucion_temporal || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Line dataKey="captados" stroke="#0f172a" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
          <p className="mt-3 text-sm font-semibold text-slate-500">
            Variación semanal: {fmt.format(citizens.variacion_semanal?.variacion || 0)} registros.
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="card">
          <h3 className="mb-4 flex items-center gap-2 font-semibold"><AlertTriangle size={18} /> Zonas críticas</h3>
          <div className="space-y-3">
            {(criticalZones.length ? criticalZones : (intelligence.zonas || []).slice(0, 4)).map((zone: any) => (
              <div key={`${zone.tipo}-${zone.zona}`} className="rounded-lg bg-rose-50 p-3">
                <p className="font-black">{zone.zona}</p>
                <p className="text-sm font-semibold text-rose-700">{zone.nivel_prioridad_territorial} · {zone.cobertura_territorial}% cobertura</p>
              </div>
            ))}
            {!intelligence.zonas?.length && <p className="text-sm font-semibold text-slate-500">Sin zonas disponibles por el momento.</p>}
          </div>
        </div>

        <div className="card">
          <h3 className="mb-4 flex items-center gap-2 font-semibold"><CheckCircle2 size={18} /> Zonas consolidadas</h3>
          <div className="space-y-3">
            {consolidatedZones.map((zone: any) => (
              <div key={`${zone.tipo}-${zone.zona}`} className="rounded-lg bg-emerald-50 p-3">
                <p className="font-black">{zone.zona}</p>
                <p className="text-sm font-semibold text-emerald-700">{fmt.format(zone.apoyos_altos)} apoyos altos</p>
              </div>
            ))}
            {!consolidatedZones.length && <p className="text-sm font-semibold text-slate-500">Aún no hay zonas consolidadas con los criterios actuales.</p>}
          </div>
        </div>

        <div className="card">
          <h3 className="mb-4 flex items-center gap-2 font-semibold"><Target size={18} /> Problemáticas principales</h3>
          <div className="space-y-3">
            {(citizens.ranking_problematicas?.length ? citizens.ranking_problematicas : intelligence.ranking_problematicas || []).slice(0, 5).map((item: any) => (
              <div key={item.categoria} className="flex items-center justify-between rounded-lg bg-slate-50 p-3 text-sm font-bold">
                <span>{labelFor(item.categoria)}</span>
                <span>{fmt.format(item.frecuencia || item.casos || 0)}</span>
              </div>
            ))}
            {!citizens.ranking_problematicas?.length && !intelligence.ranking_problematicas?.length && <p className="text-sm font-semibold text-slate-500">Sin problemáticas registradas.</p>}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="card">
          <h3 className="mb-4 flex items-center gap-2 font-semibold"><Users size={18} /> Líderes más efectivos</h3>
          <div className="space-y-2">
            {(citizens.lideres || []).map((leader: any) => (
              <div key={leader.lider} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold">
                <span>{leader.lider}</span>
                <span>{fmt.format(leader.apoyos_altos)} altos · {fmt.format(leader.captados)} captados</span>
              </div>
            ))}
            {!citizens.lideres?.length && <p className="text-sm font-semibold text-slate-500">Aún no hay líderes con captación registrada.</p>}
          </div>
        </div>

        <div className="card">
          <h3 className="mb-4 flex items-center gap-2 font-semibold"><MapPinned size={18} /> Lectura automática</h3>
          <div className="space-y-3">
            {(intelligence.recomendaciones || []).slice(0, 4).map((item: any) => (
              <div key={`${item.zona}-${item.recomendacion}`} className="rounded-lg border border-slate-200 p-3">
                <p className="font-black">{item.zona}</p>
                <p className="mt-1 text-sm font-semibold text-slate-600">{item.recomendacion}</p>
              </div>
            ))}
            {!intelligence.recomendaciones?.length && <p className="text-sm font-semibold text-slate-500">Sin recomendaciones disponibles hasta cargar más información territorial.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
