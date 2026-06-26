import { useEffect, useState } from 'react';
import { AlertTriangle, MapPinned, MousePointer2, Target, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api/client';
import { labelFor } from '../utils/presentation';

type ZonaResumen = {
  nombre: string;
  tipo: string;
  poblacion_estimada: number;
  ciudadanos_captados: number;
  apoyos_altos: number;
  apoyos_medios: number;
  apoyos_bajos: number;
  indecisos: number;
  interacciones: number;
  problematicas: number;
  problematica_principal: string;
  cobertura: number;
  potencial: number;
  requiere_visita: boolean;
};

type TerritorioData = {
  totales: Record<string, number>;
  zonas: ZonaResumen[];
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

export function Territorio() {
  const [data, setData] = useState<TerritorioData | null>(null);
  const [selectedKey, setSelectedKey] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/territorio/resumen')
      .then((r) => setData(r.data))
      .catch(() => {
        setData({ totales: {}, zonas: [] });
        setError('No fue posible cargar el resumen territorial. Verifica la conexión con el backend.');
      });
  }, []);

  if (!data) return <p>Cargando inteligencia territorial...</p>;

  const selectedZona = data.zonas.find((zona) => `${zona.tipo}-${zona.nombre}` === selectedKey) || data.zonas[0];
  const zonasBajaCobertura = data.zonas.filter((zona) => zona.requiere_visita);

  const chartData = data.zonas.slice(0, 8).map((zona) => ({
    zona: zona.nombre,
    captados: zona.ciudadanos_captados,
    indecisos: zona.indecisos,
    cobertura: zona.cobertura,
  }));

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Inteligencia territorial</h2>
        <p className="mt-1 max-w-3xl text-sm font-semibold text-slate-500">
          Selecciona un barrio o vereda para leer cobertura, potencial, apoyos, interacciones y prioridades sin exponer datos personales.
        </p>
      </div>

      {error && <p className="rounded-lg bg-amber-50 p-4 text-sm font-bold text-amber-900">{error}</p>}

      <div className="grid gap-4 md:grid-cols-4">
        <Kpi title="Ciudadanos captados" value={fmt.format(data.totales.ciudadanos_captados || 0)} icon={Users} />
        <Kpi title="Apoyos altos" value={fmt.format(data.totales.apoyos_altos || 0)} icon={Target} />
        <Kpi title="Indecisos" value={fmt.format(data.totales.indecisos || 0)} icon={AlertTriangle} />
        <Kpi title="Zonas baja cobertura" value={fmt.format(data.totales.zonas_baja_cobertura || 0)} icon={MapPinned} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <div className="card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="font-bold">Cobertura y captacion por zona</h3>
            <span className="flex items-center gap-2 text-xs font-black uppercase text-slate-400">
              <MousePointer2 size={14} /> Clic en una zona
            </span>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="zona" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="captados" fill="#5b2d5d" radius={[6, 6, 0, 0]} />
              <Bar dataKey="indecisos" fill="#e83e98" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 flex flex-wrap gap-2">
            {data.zonas.map((zona) => {
              const key = `${zona.tipo}-${zona.nombre}`;
              const active = selectedZona && key === `${selectedZona.tipo}-${selectedZona.nombre}`;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedKey(key)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-black transition ${
                    active ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
                  }`}
                >
                  {zona.nombre}
                </button>
              );
            })}
          </div>
        </div>

        <div className="card">
          <h3 className="mb-4 font-bold">Prioridad territorial</h3>
          <div className="space-y-3">
            {zonasBajaCobertura.slice(0, 6).map((zona) => {
              const key = `${zona.tipo}-${zona.nombre}`;
              const active = selectedZona && key === `${selectedZona.tipo}-${selectedZona.nombre}`;
              return (
              <button
                key={key}
                onClick={() => setSelectedKey(key)}
                className={`w-full rounded-lg border p-4 text-left transition ${
                  active ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white hover:border-slate-400'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-black">{zona.nombre}</p>
                    <p className={`text-sm font-semibold ${active ? 'text-slate-300' : 'text-slate-500'}`}>{zona.tipo} · {labelFor(zona.problematica_principal)}</p>
                  </div>
                  <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-black text-rose-700">Visitar</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${active ? 'bg-white' : 'bg-slate-950'}`} style={{ width: `${Math.min(100, zona.cobertura)}%` }} />
                </div>
                <p className={`mt-2 text-xs font-bold ${active ? 'text-slate-300' : 'text-slate-400'}`}>Cobertura {zona.cobertura}% · Potencial {fmt.format(zona.potencial)}</p>
              </button>
            )})}
          </div>
        </div>
      </div>

      {selectedZona && (
        <div className="card">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">Zona seleccionada</p>
              <h3 className="mt-1 text-2xl font-black">{selectedZona.nombre}</h3>
              <p className="mt-1 text-sm font-semibold text-slate-500">{selectedZona.tipo} · {labelFor(selectedZona.problematica_principal)}</p>
            </div>
            <span className={`rounded-full px-4 py-2 text-sm font-black ${
              selectedZona.requiere_visita ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
            }`}>
              {selectedZona.requiere_visita ? 'Requiere visita' : 'En seguimiento'}
            </span>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <Kpi title="Población estimada" value={fmt.format(selectedZona.poblacion_estimada)} icon={Users} />
            <Kpi title="Captados" value={fmt.format(selectedZona.ciudadanos_captados)} icon={Target} />
            <Kpi title="Indecisos" value={fmt.format(selectedZona.indecisos)} icon={AlertTriangle} />
            <Kpi title="Interacciones" value={fmt.format(selectedZona.interacciones)} icon={MousePointer2} />
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-500">Cobertura territorial</p>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-slate-950" style={{ width: `${Math.min(100, selectedZona.cobertura)}%` }} />
              </div>
              <p className="mt-2 text-2xl font-black">{selectedZona.cobertura}%</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-500">Apoyos agregados</p>
              <p className="mt-2 text-sm font-semibold text-slate-600">Altos: <b className="text-slate-950">{fmt.format(selectedZona.apoyos_altos)}</b></p>
              <p className="text-sm font-semibold text-slate-600">Medios: <b className="text-slate-950">{fmt.format(selectedZona.apoyos_medios)}</b></p>
              <p className="text-sm font-semibold text-slate-600">Bajos: <b className="text-slate-950">{fmt.format(selectedZona.apoyos_bajos)}</b></p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-500">Lectura operativa</p>
              <p className="mt-2 text-sm font-semibold text-slate-700">
                {selectedZona.ciudadanos_captados === 0
                  ? 'Sin ciudadanos captados: esta zona aparece como prioridad porque todavia no tiene cobertura registrada.'
                  : 'Zona con actividad registrada. Revisar apoyos, indecisos e interacciones para definir siguiente recorrido.'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <h3 className="mb-4 font-bold">Resumen por barrio y vereda</h3>
        <div className="overflow-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="border-b text-slate-500">
              <tr>
                <th className="py-3">Zona</th>
                <th>Tipo</th>
                <th>Población</th>
                <th>Captados</th>
                <th>Altos</th>
                <th>Medios</th>
                <th>Indecisos</th>
                <th>Interacciones</th>
                <th>Problemática</th>
                <th>Cobertura</th>
                <th>Prioridad</th>
              </tr>
            </thead>
            <tbody>
              {data.zonas.map((zona) => {
                const key = `${zona.tipo}-${zona.nombre}`;
                const active = selectedZona && key === `${selectedZona.tipo}-${selectedZona.nombre}`;
                return (
                <tr
                  key={key}
                  onClick={() => setSelectedKey(key)}
                  className={`cursor-pointer border-b transition ${active ? 'bg-slate-950 text-white' : 'hover:bg-slate-50'}`}
                >
                  <td className="py-3 font-bold">{zona.nombre}</td>
                  <td>{zona.tipo}</td>
                  <td>{fmt.format(zona.poblacion_estimada)}</td>
                  <td>{fmt.format(zona.ciudadanos_captados)}</td>
                  <td>{fmt.format(zona.apoyos_altos)}</td>
                  <td>{fmt.format(zona.apoyos_medios)}</td>
                  <td>{fmt.format(zona.indecisos)}</td>
                  <td>{fmt.format(zona.interacciones)}</td>
                  <td>{labelFor(zona.problematica_principal)}</td>
                  <td>{zona.cobertura}%</td>
                  <td>{zona.requiere_visita ? 'Requiere visita' : 'En seguimiento'}</td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
