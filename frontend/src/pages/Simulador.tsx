import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, SlidersHorizontal, Target, TrendingDown, TrendingUp } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api/client';

const fmt = new Intl.NumberFormat('es-CO');

type FormState = {
  censo_electoral: number;
  participacion_esperada: number;
  abstencion_proyectada: number;
  incremento_juvenil: number;
  crecimiento_sector: number;
  meta_votacion: number;
};

const initial: FormState = {
  censo_electoral: 60000,
  participacion_esperada: 0.58,
  abstencion_proyectada: 0.02,
  incremento_juvenil: 0.03,
  crecimiento_sector: 0.04,
  meta_votacion: 18000,
};

function percentLabel(value: number) {
  return `${Math.round(value * 100)}%`;
}

function ScenarioCard({ name, value, meta }: { name: string; value: number; meta: number }) {
  const ok = value >= meta;
  const diff = value - meta;
  return (
    <div className={`rounded-lg border p-5 shadow-sm ${ok ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-black capitalize text-slate-600">{name}</p>
        {ok ? <CheckCircle2 size={20} className="text-emerald-700" /> : <AlertTriangle size={20} className="text-rose-700" />}
      </div>
      <h3 className="mt-2 text-3xl font-black text-slate-950">{fmt.format(value)}</h3>
      <p className={`mt-1 text-sm font-bold ${ok ? 'text-emerald-700' : 'text-rose-700'}`}>
        {ok ? `Supera meta por ${fmt.format(diff)}` : `Faltan ${fmt.format(Math.abs(diff))}`}
      </p>
    </div>
  );
}

export function Simulador() {
  const [form, setForm] = useState<FormState>(initial);
  const [res, setRes] = useState<any>(null);
  const [insumos, setInsumos] = useState<any>(null);
  const [inteligencia, setInteligencia] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/ciudadanos/indicadores'),
      api.get('/inteligencia/resumen-territorial'),
    ]).then(([citizensResponse, intelligenceResponse]) => {
      setInsumos(citizensResponse.data);
      setInteligencia(intelligenceResponse.data);
    }).catch(() => setError('No fue posible cargar insumos territoriales. El simulador seguirá funcionando con supuestos manuales.'));
  }, []);

  const chartData = useMemo(() => {
    if (!res) return [];
    return ['optimista', 'moderado', 'conservador', 'critico'].map((name) => ({ escenario: name, votos: res[name], meta: form.meta_votacion }));
  }, [res, form.meta_votacion]);

  function change(key: keyof FormState, value: number) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function run() {
    setLoading(true);
    try {
      const response = await api.post('/simulador', form);
      setRes(response.data);
    } catch {
      setError('No fue posible guardar la simulación en el backend. Revisa la conexión e intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  }

  const expectedVoters = Math.round(form.censo_electoral * form.participacion_esperada);
  const adjustedBase = Math.round(expectedVoters * (1 + form.incremento_juvenil + form.crecimiento_sector - form.abstencion_proyectada));
  const best = res ? res.optimista : adjustedBase;
  const worst = res ? res.critico : Math.round(adjustedBase * 0.7);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black">Simulador electoral</h2>
          <p className="mt-1 max-w-3xl text-sm font-semibold text-slate-500">
            Modela escenarios de votación esperada, meta y brechas para decidir intensidad territorial.
          </p>
        </div>
        <span className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white">Escenarios 2027</span>
      </div>

      {error && <p className="rounded-lg bg-amber-50 p-4 text-sm font-bold text-amber-900">{error}</p>}

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="card space-y-5">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={20} className="text-slate-400" />
            <h3 className="font-bold">Supuestos de simulación</h3>
          </div>

          {insumos && (
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
              <p className="text-xs font-black uppercase text-blue-700">Insumos operativos agregados</p>
              <p className="mt-2 text-sm font-semibold text-slate-700">
                {fmt.format(insumos.totales.ciudadanos_captados || 0)} captados · {fmt.format(insumos.totales.apoyo_alto || 0)} apoyos altos · {fmt.format(insumos.totales.indecisos || 0)} indecisos · {insumos.totales.cobertura_global || 0}% cobertura.
              </p>
            </div>
          )}

          <label className="block text-sm font-bold text-slate-600">
            Censo electoral estimado
            <input className="input mt-1" type="number" value={form.censo_electoral} onChange={(e) => change('censo_electoral', Number(e.target.value))} />
          </label>

          <label className="block text-sm font-bold text-slate-600">
            Meta de votación
            <input className="input mt-1" type="number" value={form.meta_votacion} onChange={(e) => change('meta_votacion', Number(e.target.value))} />
          </label>

          {([
            ['participacion_esperada', 'Participación esperada'],
            ['abstencion_proyectada', 'Riesgo adicional de abstención'],
            ['incremento_juvenil', 'Incremento por voto joven'],
            ['crecimiento_sector', 'Crecimiento por trabajo territorial'],
          ] as [keyof FormState, string][]).map(([key, label]) => (
            <label key={key} className="block text-sm font-bold text-slate-600">
              {label} ({percentLabel(form[key])})
              <input className="mt-3 w-full" type="range" min="0" max={key === 'participacion_esperada' ? '0.85' : '0.2'} step="0.01" value={form[key]} onChange={(e) => change(key, Number(e.target.value))} />
            </label>
          ))}

          <button className="btn w-full" onClick={run} disabled={loading}>
            {loading ? 'Calculando...' : 'Calcular escenarios'}
          </button>
        </div>

        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-bold text-slate-500">Votantes esperados</p>
              <h3 className="mt-2 text-3xl font-black">{fmt.format(expectedVoters)}</h3>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-bold text-slate-500">Base ajustada</p>
              <h3 className="mt-2 text-3xl font-black">{fmt.format(adjustedBase)}</h3>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-bold text-slate-500">Rango estimado</p>
              <h3 className="mt-2 text-3xl font-black">{fmt.format(worst)} - {fmt.format(best)}</h3>
            </div>
          </div>

          {res && (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                {['optimista', 'moderado', 'conservador', 'critico'].map((key) => (
                  <ScenarioCard key={key} name={key} value={res[key]} meta={form.meta_votacion} />
                ))}
              </div>

              <div className="card">
                <h3 className="mb-4 font-bold">Comparativo de escenarios</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="escenario" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="votos" fill="#0f172a" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="meta" fill="#e11d48" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="card">
                <div className="flex items-center gap-2">
                  {res.moderado >= form.meta_votacion ? <TrendingUp className="text-emerald-600" /> : <TrendingDown className="text-rose-600" />}
                  <h3 className="font-bold">Lectura estratégica</h3>
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-700">
                  {res.moderado >= form.meta_votacion
                    ? 'El escenario moderado cumple la meta. La prioridad es sostener cobertura, cuidar indecisos y evitar pérdida por abstención.'
                    : 'El escenario moderado no cumple la meta. Se requiere aumentar cobertura, priorizar zonas de alto potencial y reducir abstención proyectada.'}
                </p>
                {inteligencia && (
                  <p className="mt-3 rounded-lg bg-amber-50 p-4 text-sm font-semibold text-amber-900">
                    Potencial territorial agregado actual: {fmt.format(inteligencia.totales.potencial_electoral_estimado || 0)}. Este simulador no predice resultados futuros; traduce supuestos y datos agregados en escenarios de trabajo.
                  </p>
                )}
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg bg-slate-50 p-4">
                    <Target size={18} className="text-slate-400" />
                    <p className="mt-2 text-sm font-bold text-slate-600">Meta</p>
                    <p className="text-xl font-black">{fmt.format(form.meta_votacion)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-4">
                    <TrendingUp size={18} className="text-slate-400" />
                    <p className="mt-2 text-sm font-bold text-slate-600">Moderado</p>
                    <p className="text-xl font-black">{fmt.format(res.moderado)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-4">
                    <AlertTriangle size={18} className="text-slate-400" />
                    <p className="mt-2 text-sm font-bold text-slate-600">Brecha</p>
                    <p className="text-xl font-black">{fmt.format(res.moderado - form.meta_votacion)}</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
