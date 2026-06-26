import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CheckCircle2, Database, FileUp, Landmark, RefreshCw, TrendingUp, Users } from 'lucide-react';
import { api } from '../api/client';
import { confidenceTone, labelFor } from '../utils/presentation';

type Resultado = {
  candidato: string;
  partido: string;
  votos: number;
  sector: string;
  partidos_alianza: string[];
  confianza_partido: string;
  relacion_politica: string;
};

type Eleccion = {
  id: number;
  anio: number;
  nombre: string;
  total_votos: number;
  censo_electoral: number;
  ganador: string;
  votos_ganador: number;
  segundo: string;
  votos_segundo: number;
  brecha: number;
  votos_blanco: number;
  votos_nulos: number;
  no_marcados: number;
  resultados: Resultado[];
};

type Partido = {
  partido: string;
  votos_total: number;
  participaciones: number;
  metodo: string;
  anios: { anio: number; candidato: string; votos: number; coalicion?: string }[];
};

type Historico = {
  fuente: string;
  fuente_2023: string;
  fuentes_consulta: { nombre: string; tipo: string; uso: string; url: string }[];
  restriccion: string;
  elecciones: Eleccion[];
  tendencia: { anio: number; total_votos: number; votos_ganador: number; brecha: number; crecimiento_total: number; crecimiento_ganador: number }[];
  partidos: Partido[];
  nota_partidos: string;
};

const fmt = new Intl.NumberFormat('es-CO');

function Kpi({ title, value, icon: Icon }: { title: string; value: string | number; icon: any }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-slate-500">{title}</p>
        <Icon size={20} className="text-slate-400" />
      </div>
      <h3 className="mt-2 text-3xl font-black text-slate-950">{value}</h3>
    </div>
  );
}

export function Electoral() {
  const [data, setData] = useState<Historico | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showTrace, setShowTrace] = useState(false);

  async function load() {
    const response = await api.get('/electoral/historico');
    setData(response.data);
    if (!selectedYear && response.data.elecciones?.length) {
      setSelectedYear(response.data.elecciones[response.data.elecciones.length - 1].anio);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function syncOfficial() {
    setLoading(true);
    try {
      const response = await api.post('/electoral/sincronizar-oficial');
      setSyncResult(response.data);
      await load();
    } finally {
      setLoading(false);
    }
  }

  async function upload() {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    await api.post('/resultados/cargar', fd);
    await load();
  }

  const selected = useMemo(() => data?.elecciones.find((item) => item.anio === selectedYear) || data?.elecciones[data.elecciones.length - 1], [data, selectedYear]);
  const candidateChart = selected?.resultados.filter((row) => !['Votos no marcados', 'Votos nulos', 'Votos en blanco'].includes(row.candidato)).slice(0, 8) || [];

  if (!data) return <p>Cargando análisis electoral...</p>;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black">Análisis Electoral Histórico</h2>
          <p className="mt-1 max-w-4xl text-sm font-semibold text-slate-500">
            Resultados oficiales agregados, partidos/movimientos y tendencias para comparar con la gestión territorial de campaña.
          </p>
        </div>
        <button className="btn flex items-center gap-2" onClick={syncOfficial} disabled={loading}>
          <RefreshCw size={16} />
          {loading ? 'Sincronizando...' : 'Sincronizar fuente oficial'}
        </button>
      </div>

      {syncResult && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
          <p className="flex items-center gap-2"><CheckCircle2 size={16} /> Fuente electoral actualizada: {syncResult.elecciones.length} elecciones disponibles.</p>
          <p className="mt-1">Última sincronización: {labelFor(syncResult.estado_fuente_2023)}.</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Kpi title="Elecciones históricas" value={fmt.format(data.elecciones.length)} icon={Database} />
        <Kpi title="Último total votos" value={fmt.format(data.elecciones[data.elecciones.length - 1]?.total_votos || 0)} icon={Users} />
        <Kpi title="Partidos/movimientos" value={fmt.format(data.partidos.length)} icon={Landmark} />
        <Kpi title="Última brecha" value={fmt.format(data.elecciones[data.elecciones.length - 1]?.brecha || 0)} icon={TrendingUp} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
        <div className="card">
          <h3 className="mb-4 font-bold">Elección a revisar</h3>
          <div className="grid gap-2">
            {data.elecciones.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedYear(item.anio)}
                className={`rounded-lg border px-4 py-3 text-left transition ${
                  selected?.anio === item.anio ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white hover:border-slate-400'
                }`}
              >
                <p className="font-black">{item.anio}</p>
                <p className={selected?.anio === item.anio ? 'text-sm font-semibold text-slate-300' : 'text-sm font-semibold text-slate-500'}>{item.ganador || 'Sin ganador cargado'}</p>
              </button>
            ))}
          </div>

          <div className="mt-6 rounded-lg bg-slate-50 p-4">
            <p className="mb-2 flex items-center gap-2 text-sm font-black text-slate-600"><FileUp size={16} /> Carga manual de respaldo</p>
            <p className="mb-3 text-xs font-bold text-slate-400">Use esta opción solo cuando cuente con una matriz electoral verificada.</p>
            <input className="input" type="file" accept=".csv,.xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <button className="btn mt-3 w-full" onClick={upload}>Cargar archivo</button>
          </div>
        </div>

        <div className="space-y-6">
          {selected && (
            <div className="card">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">Resultado municipal</p>
                  <h3 className="mt-1 text-2xl font-black">{selected.nombre}</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{selected.ganador} vs {selected.segundo}</p>
                </div>
                <span className="rounded-full bg-blue-50 px-4 py-2 text-sm font-black text-blue-700">Brecha {fmt.format(selected.brecha)}</span>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-4">
                <Kpi title="Total votos" value={fmt.format(selected.total_votos)} icon={Users} />
                <Kpi title="Ganador" value={fmt.format(selected.votos_ganador)} icon={TrendingUp} />
                <Kpi title="Blanco" value={fmt.format(selected.votos_blanco)} icon={Database} />
                <Kpi title="Nulos" value={fmt.format(selected.votos_nulos)} icon={Database} />
              </div>
              <div className="mt-6">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={candidateChart}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="candidato" tick={{ fontSize: 11 }} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="votos" fill="#0f172a" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-5 overflow-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b text-slate-500">
                    <tr>
                      <th className="py-3">Candidato</th>
                      <th>Movimiento / coalicion</th>
                      <th>Partidos de alianza</th>
                      <th>Nivel de confianza</th>
                      <th>Tipo de registro</th>
                      <th>Votos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.resultados.slice(0, 8).map((row) => (
                      <tr key={`${selected.anio}-${row.candidato}`} className="border-b">
                        <td className="py-3 font-bold">{row.candidato}</td>
                        <td>{labelFor(row.partido)}</td>
                        <td className="max-w-sm">
                          {row.partidos_alianza?.length ? row.partidos_alianza.join(', ') : 'Informacion oficial no encontrada'}
                        </td>
                        <td>
                          <span className={`rounded-full px-3 py-1 text-xs font-black ${confidenceTone(row.confianza_partido)}`}>
                            {labelFor(row.confianza_partido)}
                          </span>
                        </td>
                        <td className="text-xs font-bold text-slate-500">{labelFor(row.relacion_politica)}</td>
                        <td className="font-black">{fmt.format(row.votos)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="card">
          <h3 className="mb-4 font-bold">Tendencia histórica</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.tendencia}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="anio" />
                <YAxis />
                <Tooltip />
                <Line dataKey="total_votos" stroke="#0f172a" strokeWidth={3} />
                <Line dataKey="votos_ganador" stroke="#e11d48" strokeWidth={3} />
                <Line dataKey="brecha" stroke="#2563eb" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="card">
          <h3 className="mb-4 font-bold">Partidos y movimientos</h3>
          <div className="space-y-3">
            {data.partidos.map((item) => (
              <div key={item.partido} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-black">{labelFor(item.partido)}</p>
                  <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white">{fmt.format(item.votos_total)}</span>
                </div>
                <p className="mt-1 text-xs font-bold text-slate-400">{fmt.format(item.participaciones)} participaciones históricas registradas</p>
                <p className="mt-1 text-xs font-bold text-slate-400">Criterio: {labelFor(item.metodo)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.anios.map((row) => (
                    <span key={`${item.partido}-${row.anio}-${row.candidato}`} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                      {row.anio}: {fmt.format(row.votos)} {row.coalicion ? `(${row.coalicion})` : ''}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 rounded-lg bg-amber-50 p-4 text-sm font-semibold text-amber-900">{data.nota_partidos}</p>
        </div>

        <div className="card">
          <h3 className="mb-4 font-bold">Cómo se usa en campaña</h3>
          <div className="space-y-3 text-sm font-semibold text-slate-700">
            <p className="rounded-lg bg-slate-50 p-4">Comparar el ganador histórico y la brecha contra la cobertura actual por barrio/vereda.</p>
            <p className="rounded-lg bg-slate-50 p-4">Cruzar partidos/movimientos con candidatos para entender continuidad, competencia y dispersión del voto.</p>
            <p className="rounded-lg bg-slate-50 p-4">Usar puestos o mesas oficiales cuando se cargue el detalle estructurado de Registraduría.</p>
            <p className="rounded-lg bg-amber-50 p-4 text-amber-900">La información electoral se presenta de forma agregada y no contiene datos personales.</p>
          </div>
          <a className="mt-4 inline-flex rounded-full bg-blue-50 px-4 py-2 text-sm font-black text-blue-700" href={data.fuente_2023} target="_blank" rel="noreferrer">
            Abrir fuente oficial 2023
          </a>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-bold">Fuentes y criterio de validación</h3>
          <button className="rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-700" onClick={() => setShowTrace((current) => !current)}>
            {showTrace ? 'Ocultar trazabilidad' : 'Ver trazabilidad'}
          </button>
        </div>
        {showTrace && (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {data.fuentes_consulta?.map((source) => (
              <a key={source.nombre} href={source.url} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 p-4 transition hover:border-slate-400">
                <p className="font-black">{source.nombre}</p>
                <p className="mt-1 text-xs font-bold uppercase text-slate-400">{labelFor(source.tipo)}</p>
                <p className="mt-3 text-sm font-semibold text-slate-600">{source.uso}</p>
              </a>
            ))}
          </div>
        )}
        <p className="mt-4 rounded-lg bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          Para 2011 y 2015 se conserva el resultado oficial, pero los respaldos políticos informales quedan separados como pendientes de validación documental. Para proyecciones por partido solo se usan avales o coaliciones con mayor trazabilidad.
        </p>
      </div>
    </section>
  );
}
