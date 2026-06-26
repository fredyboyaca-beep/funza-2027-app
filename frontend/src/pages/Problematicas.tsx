import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ClipboardList, MapPinned, Save } from 'lucide-react';
import { api } from '../api/client';
import { labelFor, userMessage } from '../utils/presentation';

type Territorio = { id: number; nombre: string };
type Problematica = {
  id: number;
  categoria: string;
  descripcion?: string;
  severidad: number;
  frecuencia: number;
  fuente?: string;
  evidencia?: string;
  estado: string;
  barrio_id?: number;
  vereda_id?: number;
  fecha?: string;
};

const categorias = [
  'seguridad',
  'movilidad',
  'salud',
  'educacion',
  'empleo',
  'servicios públicos',
  'espacio publico',
  'medio ambiente',
  'vivienda',
  'cultura',
  'deporte',
];

const initialForm = {
  categoria: 'seguridad',
  descripcion: '',
  fuente: 'recorrido_territorial',
  severidad: 3,
  frecuencia: 1,
  estado: 'abierta',
  evidencia: '',
  barrio_id: '',
  vereda_id: '',
};

export function Problematicas() {
  const [form, setForm] = useState(initialForm);
  const [barrios, setBarrios] = useState<Territorio[]>([]);
  const [veredas, setVeredas] = useState<Territorio[]>([]);
  const [registros, setRegistros] = useState<Problematica[]>([]);
  const [error, setError] = useState('');

  async function load() {
    const [barriosResponse, veredasResponse, registrosResponse] = await Promise.all([
      api.get('/barrios'),
      api.get('/veredas'),
      api.get('/problematicas'),
    ]);
    setBarrios(barriosResponse.data);
    setVeredas(veredasResponse.data);
    setRegistros(registrosResponse.data);
  }

  useEffect(() => {
    load().catch(() => setError('No fue posible cargar los registros de campo. Verifica la conexión con el backend.'));
  }, []);

  const territoryNames = useMemo(() => {
    const names: Record<string, string> = {};
    barrios.forEach((item) => { names[`b-${item.id}`] = item.nombre; });
    veredas.forEach((item) => { names[`v-${item.id}`] = item.nombre; });
    return names;
  }, [barrios, veredas]);

  function setField(key: string, value: string | number) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === 'barrio_id' && value) next.vereda_id = '';
      if (key === 'vereda_id' && value) next.barrio_id = '';
      return next;
    });
  }

  async function save() {
    setError('');
    try {
      await api.post('/problematicas', {
        ...form,
        barrio_id: form.barrio_id ? Number(form.barrio_id) : undefined,
        vereda_id: form.vereda_id ? Number(form.vereda_id) : undefined,
        evidencia: form.evidencia || undefined,
      });
      setForm(initialForm);
      await load();
    } catch (err: any) {
      setError(userMessage(err, 'No se pudo registrar el hallazgo territorial'));
    }
  }

  const abiertas = registros.filter((item) => item.estado !== 'cerrada').length;
  const reportes = registros.reduce((acc, item) => acc + (item.frecuencia || 1), 0);
  const afectacionPromedio = registros.length
    ? (registros.reduce((acc, item) => acc + (item.severidad || 1), 0) / registros.length).toFixed(1)
    : '0';

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black">Campo territorial</h2>
          <p className="mt-1 max-w-4xl text-sm font-semibold text-slate-500">
            Captura operativa de problemáticas por barrio o vereda. Estos registros alimentan Inteligencia Territorial e IA Estratégica.
          </p>
        </div>
        <span className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white">Submodulo operativo</span>
      </div>

      {error && <div className="rounded-lg bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card"><p className="text-sm font-bold text-slate-500">Registros</p><h3 className="text-3xl font-black">{registros.length}</h3></div>
        <div className="card"><p className="text-sm font-bold text-slate-500">Reportes acumulados</p><h3 className="text-3xl font-black">{reportes}</h3></div>
        <div className="card"><p className="text-sm font-bold text-slate-500">Afectación promedio</p><h3 className="text-3xl font-black">{afectacionPromedio}/5</h3></div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="card space-y-4">
          <div className="flex items-center gap-2">
            <MapPinned size={20} className="text-slate-400" />
            <h3 className="font-bold">Registrar hallazgo de campo</h3>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <select className="input" value={form.barrio_id} onChange={(event) => setField('barrio_id', event.target.value)}>
              <option value="">Barrio urbano</option>
              {barrios.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
            </select>
            <select className="input" value={form.vereda_id} onChange={(event) => setField('vereda_id', event.target.value)}>
              <option value="">Vereda rural</option>
              {veredas.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
            </select>
            <select className="input" value={form.categoria} onChange={(event) => setField('categoria', event.target.value)}>
              {categorias.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <input className="input" placeholder="Fuente" value={form.fuente} onChange={(event) => setField('fuente', event.target.value)} />
            <label className="text-sm font-bold text-slate-600">
              Nivel de afectación: {form.severidad}/5
              <input className="mt-2 w-full" type="range" min="1" max="5" value={form.severidad} onChange={(event) => setField('severidad', Number(event.target.value))} />
            </label>
            <label className="text-sm font-bold text-slate-600">
              Número de reportes
              <input className="input mt-2" type="number" min="1" value={form.frecuencia} onChange={(event) => setField('frecuencia', Number(event.target.value))} />
            </label>
            <select className="input" value={form.estado} onChange={(event) => setField('estado', event.target.value)}>
              <option value="abierta">Abierta</option>
              <option value="en_revision">En revisión</option>
              <option value="gestionada">Gestionada</option>
              <option value="cerrada">Cerrada</option>
            </select>
            <input className="input" placeholder="Evidencia opcional" value={form.evidencia} onChange={(event) => setField('evidencia', event.target.value)} />
            <textarea
              className="input min-h-28 md:col-span-2"
              placeholder="Descripción concreta del hallazgo territorial"
              value={form.descripcion}
              onChange={(event) => setField('descripcion', event.target.value)}
            />
          </div>

          <button className="btn flex items-center gap-2" onClick={save}>
            <Save size={16} />
            Registrar hallazgo
          </button>
        </div>

        <div className="card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ClipboardList size={20} className="text-slate-400" />
              <h3 className="font-bold">Últimos registros de campo</h3>
            </div>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">{abiertas} abiertos</span>
          </div>
          <div className="space-y-3">
            {registros.slice(0, 10).map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-black capitalize">{item.categoria}</p>
                    <p className="text-xs font-bold uppercase text-slate-400">
                      {item.barrio_id ? territoryNames[`b-${item.barrio_id}`] : item.vereda_id ? territoryNames[`v-${item.vereda_id}`] : 'Sin zona'}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{labelFor(item.estado)}</span>
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-700">{item.descripcion || 'Sin descripcion'}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
                  <span className="rounded-full bg-rose-50 px-3 py-1 text-rose-700">Afectación {item.severidad}/5</span>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">{item.frecuencia || 1} reportes</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1">Origen: {labelFor(item.fuente)}</span>
                </div>
              </div>
            ))}
            {!registros.length && (
              <div className="rounded-lg bg-slate-50 p-6 text-sm font-semibold text-slate-500">
                <AlertTriangle className="mb-2 text-slate-400" />
                    Aún no hay problemáticas territoriales registradas.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
