import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Brain, CheckCircle2, Compass, MapPinned, Target, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api/client';
import { labelFor } from '../utils/presentation';

type ProblematicaRanking = {
  categoria: string;
  casos: number;
  frecuencia: number;
  severidad_promedio?: number;
  zonas?: number;
};

type ZonaInteligencia = {
  zona: string;
  tipo: string;
  poblacion_estimada: number;
  ciudadanos_captados: number;
  apoyos_altos: number;
  apoyos_medios: number;
  indecisos: number;
  rechazos_apoyos_bajos: number;
  interacciones: number;
  problematicas_total: number;
  problematicas_frecuentes: ProblematicaRanking[];
  problematica_principal: string | null;
  severidad_promedio: number;
  cobertura_territorial: number;
  potencial_electoral_estimado: number;
  nivel_prioridad_territorial: string;
  puntaje_prioridad: number;
  justificacion: string[];
  recomendaciones: string[];
};

type Recomendacion = {
  zona: string;
  tipo: string;
  prioridad: string;
  recomendacion: string;
  sustento: string[];
};

type InteligenciaData = {
  fuente: string;
  restricciones: string;
  totales: Record<string, number>;
  distribucion_prioridad: Record<string, number>;
  ranking_problematicas: ProblematicaRanking[];
  zonas: ZonaInteligencia[];
  recomendaciones: Recomendacion[];
};

const fmt = new Intl.NumberFormat('es-CO');
const priorityColors: Record<string, string> = {
  'Zona crítica': '#dc2626',
  'Zona prioritaria': '#e11d48',
  'Zona en crecimiento': '#f59e0b',
  'Zona favorable': '#0f766e',
  'Baja prioridad': '#0f766e',
  'Zona consolidada': '#16a34a',
  'Zona por conquistar': '#64748b',
};

function Kpi({ title, value, icon: Icon, tone = 'slate' }: { title: string; value: string | number; icon: any; tone?: 'slate' | 'rose' | 'emerald' | 'amber' }) {
  const color = tone === 'rose' ? 'text-rose-600' : tone === 'emerald' ? 'text-emerald-600' : tone === 'amber' ? 'text-amber-600' : 'text-slate-500';
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-slate-500">{title}</p>
        <Icon size={20} className={color} />
      </div>
      <h3 className="mt-2 text-3xl font-black text-slate-950">{value}</h3>
    </div>
  );
}

function priorityBadge(priority: string) {
  const color = priorityColors[priority] || '#475569';
  return (
    <span className="rounded-full px-3 py-1 text-xs font-black text-white" style={{ backgroundColor: color }}>
      {priority}
    </span>
  );
}

export function InteligenciaTerritorial() {
  const [data, setData] = useState<InteligenciaData | null>(null);
  const [selectedZone, setSelectedZone] = useState('');

  useEffect(() => {
    api.get('/inteligencia/resumen-territorial').then((r) => setData(r.data));
  }, []);

  const selected = useMemo(() => {
    if (!data) return null;
    return data.zonas.find((zona) => zona.zona === selectedZone) || data.zonas[0];
  }, [data, selectedZone]);

  if (!data || !selected) return <p>Cargando inteligencia territorial...</p>;

  const priorityData = Object.entries(data.distribucion_prioridad).map(([name, value]) => ({ name, value }));
  const topZones = data.zonas.slice(0, 10).map((zona) => ({
    zona: zona.zona,
    prioridad: zona.puntaje_prioridad,
    potencial: zona.potencial_electoral_estimado,
  }));

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black">Inteligencia Territorial</h2>
          <p className="mt-1 max-w-4xl text-sm font-semibold text-slate-500">
            Motor agregado para priorizar barrios y veredas usando ciudadanos autorizados, interacciones, problemáticas y potencial territorial.
          </p>
        </div>
        <span className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white">IA explicable</span>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <Kpi title="Zonas analizadas" value={fmt.format(data.totales.zonas || 0)} icon={MapPinned} />
        <Kpi title="Captados" value={fmt.format(data.totales.ciudadanos_captados || 0)} icon={Users} tone="emerald" />
        <Kpi title="Indecisos" value={fmt.format(data.totales.indecisos || 0)} icon={AlertTriangle} tone="amber" />
        <Kpi title="Problemáticas" value={fmt.format(data.totales.problematicas || 0)} icon={Compass} tone="rose" />
        <Kpi title="Potencial estimado" value={fmt.format(data.totales.potencial_electoral_estimado || 0)} icon={Target} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.75fr]">
        <div className="card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="font-bold">Zonas priorizadas</h3>
            <span className="text-xs font-black uppercase text-slate-400">Puntaje y potencial</span>
          </div>
          <ResponsiveContainer width="100%" height={330}>
            <BarChart data={topZones}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="zona" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="prioridad" fill="#e11d48" radius={[6, 6, 0, 0]} />
              <Bar dataKey="potencial" fill="#0f172a" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="mb-4 font-bold">Distribución por prioridad</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={priorityData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={96} paddingAngle={2}>
                {priorityData.map((entry) => (
                  <Cell key={entry.name} fill={priorityColors[entry.name] || '#64748b'} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 grid gap-2">
            {priorityData.map((item) => (
              <div key={item.name} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm font-bold">
                <span className="flex items-center gap-2">
                  <i className="h-3 w-3 rounded-full" style={{ backgroundColor: priorityColors[item.name] || '#64748b' }} />
                  {item.name}
                </span>
                <b>{fmt.format(item.value)}</b>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <div className="card">
          <h3 className="mb-4 font-bold">Tabla de zonas priorizadas</h3>
          <div className="overflow-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="border-b text-slate-500">
                <tr>
                  <th className="py-3">Zona</th>
                  <th>Tipo</th>
                  <th>Prioridad</th>
                  <th>Captados</th>
                  <th>Altos</th>
                  <th>Medios</th>
                  <th>Indecisos</th>
                  <th>Bajos</th>
                  <th>Cobertura</th>
                  <th>Potencial</th>
                  <th>Problemática</th>
                </tr>
              </thead>
              <tbody>
                {data.zonas.map((zona) => {
                  const active = selected.zona === zona.zona;
                  return (
                    <tr
                      key={`${zona.tipo}-${zona.zona}`}
                      onClick={() => setSelectedZone(zona.zona)}
                      className={`cursor-pointer border-b transition ${active ? 'bg-slate-950 text-white' : 'hover:bg-slate-50'}`}
                    >
                      <td className="py-3 font-black">{zona.zona}</td>
                      <td>{zona.tipo}</td>
                      <td>{priorityBadge(zona.nivel_prioridad_territorial)}</td>
                      <td>{fmt.format(zona.ciudadanos_captados)}</td>
                      <td>{fmt.format(zona.apoyos_altos)}</td>
                      <td>{fmt.format(zona.apoyos_medios)}</td>
                      <td>{fmt.format(zona.indecisos)}</td>
                      <td>{fmt.format(zona.rechazos_apoyos_bajos)}</td>
                      <td>{zona.cobertura_territorial}%</td>
                      <td>{fmt.format(zona.potencial_electoral_estimado)}</td>
                      <td>{labelFor(zona.problematica_principal || 'Sin registros')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">Diagnóstico seleccionado</p>
                <h3 className="mt-1 text-2xl font-black">{selected.zona}</h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">{selected.tipo} · Puntaje {selected.puntaje_prioridad}</p>
              </div>
              {priorityBadge(selected.nivel_prioridad_territorial)}
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-400">Cobertura</p>
                <p className="mt-1 text-2xl font-black">{selected.cobertura_territorial}%</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-400">Severidad</p>
                <p className="mt-1 text-2xl font-black">{selected.severidad_promedio}</p>
              </div>
            </div>
            <div className="mt-5">
              <p className="mb-2 text-sm font-black text-slate-500">Por qué recomienda esto</p>
              <div className="space-y-2">
                {(selected.justificacion.length ? selected.justificacion : ['Sin alertas fuertes; mantener seguimiento.']).map((item) => (
                  <p key={item} className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">{item}</p>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="mb-4 font-bold">Ranking de problemáticas</h3>
            <div className="space-y-3">
              {(data.ranking_problematicas.length ? data.ranking_problematicas : [{ categoria: 'Sin registros', casos: 0, frecuencia: 0, zonas: 0 }]).map((item) => (
                <div key={item.categoria} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-black">{labelFor(item.categoria)}</p>
                    <span className="text-sm font-black text-slate-400">{fmt.format(item.frecuencia)} reportes</span>
                  </div>
                  <p className="mt-1 text-xs font-bold text-slate-500">{fmt.format(item.casos)} casos · {fmt.format(item.zonas || 0)} zonas</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="mb-4 flex items-center gap-2">
          <Brain className="text-slate-500" size={20} />
          <h3 className="font-bold">Recomendaciones automáticas justificadas</h3>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {data.recomendaciones.map((item) => (
            <div key={`${item.zona}-${item.recomendacion}`} className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-black">{item.zona}</p>
                  <p className="text-sm font-semibold text-slate-500">{item.tipo}</p>
                </div>
                {priorityBadge(item.prioridad)}
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-800">{item.recomendacion}</p>
              <div className="mt-3 space-y-2">
                {(item.sustento.length ? item.sustento : ['Recomendación basada en métricas agregadas disponibles.']).map((reason) => (
                  <p key={reason} className="flex gap-2 text-xs font-bold text-slate-500">
                    <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" />
                    {reason}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 rounded-lg bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          <p>Análisis construido con datos agregados por barrio y vereda. No expone información personal.</p>
          <p className="mt-1">La metodología prioriza cobertura, problemáticas registradas, interacciones y potencial territorial.</p>
        </div>
      </div>
    </section>
  );
}
