import { useEffect, useMemo, useState } from 'react';
import { Upload, UserPlus, Users } from 'lucide-react';
import { api } from '../api/client';
import { labelFor, userMessage } from '../utils/presentation';

type Ciudadano = {
  id: number;
  nombres: string;
  apellidos: string;
  telefono?: string;
  email?: string;
  barrio_id?: number;
  vereda_id?: number;
  fuente_captura: string;
  lider_responsable?: string;
  consentimiento_datos: boolean;
  estado_contacto: string;
  nivel_apoyo: string;
};

type Territorio = { id: number; nombre: string; poblacion_estimada: number };
type Indicadores = {
  restriccion: string;
  totales: Record<string, number>;
  por_zona: {
    zona: string;
    tipo: string;
    ciudadanos_captados: number;
    apoyo_alto: number;
    apoyo_medio: number;
    indecisos: number;
    no_responde: number;
    porcentaje_cobertura: number;
    necesidad_visita: boolean;
  }[];
  fuentes_captura: { fuente: string; total: number }[];
  evolucion_temporal: { fecha: string; captados: number }[];
};

const initialForm = {
  nombres: '',
  apellidos: '',
  tipo_documento: 'CC',
  numero_documento: '',
  telefono: '',
  email: '',
  barrio_id: '',
  vereda_id: '',
  fuente_captura: 'formulario_campana',
  lider_responsable: '',
  consentimiento_datos: true,
  estado_contacto: 'pendiente',
  nivel_apoyo: 'indeciso',
  observaciones: '',
};

export function Ciudadanos() {
  const [ciudadanos, setCiudadanos] = useState<Ciudadano[]>([]);
  const [indicadores, setIndicadores] = useState<Indicadores | null>(null);
  const [barrios, setBarrios] = useState<Territorio[]>([]);
  const [veredas, setVeredas] = useState<Territorio[]>([]);
  const [form, setForm] = useState(initialForm);
  const [file, setFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [error, setError] = useState('');

  const load = async () => {
    const [ciudadanosResponse, indicadoresResponse, barriosResponse, veredasResponse] = await Promise.all([
      api.get('/ciudadanos'),
      api.get('/ciudadanos/indicadores'),
      api.get('/barrios'),
      api.get('/veredas'),
    ]);
    setCiudadanos(ciudadanosResponse.data);
    setIndicadores(indicadoresResponse.data);
    setBarrios(barriosResponse.data);
    setVeredas(veredasResponse.data);
  };

  useEffect(() => {
    load();
  }, []);

  function setField(key: string, value: string | boolean) {
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
      const payload = {
        ...form,
        barrio_id: form.barrio_id ? Number(form.barrio_id) : undefined,
        vereda_id: form.vereda_id ? Number(form.vereda_id) : undefined,
      };
      await api.post('/ciudadanos', payload);
      setForm(initialForm);
      await load();
    } catch (err: any) {
      setError(userMessage(err, 'No se pudo registrar el ciudadano'));
    }
  }

  async function upload() {
    if (!file) return;
    setError('');
    const data = new FormData();
    data.append('file', file);
    try {
      const response = await api.post('/ciudadanos/importar', data);
      setImportResult(response.data);
      await load();
    } catch (err: any) {
      setError(userMessage(err, 'No se pudo importar el archivo'));
    }
  }

  const zoneById = useMemo(() => {
    const zones: Record<string, string> = {};
    barrios.forEach((item) => { zones[`b-${item.id}`] = item.nombre; });
    veredas.forEach((item) => { zones[`v-${item.id}`] = item.nombre; });
    return zones;
  }, [barrios, veredas]);
  const totals = indicadores?.totales || {};

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold">Ciudadanos captados</h2>
          <p className="mt-1 max-w-3xl text-sm font-semibold text-slate-500">
            Gestión de contactos captados voluntariamente por la campaña. Requiere autorización de tratamiento y origen verificable.
          </p>
        </div>
        <span className="rounded-full bg-amber-50 px-4 py-2 text-sm font-black text-amber-700">Proteccion de datos activa</span>
      </div>

      {error && <div className="rounded-lg bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>}

      <div className="grid gap-4 md:grid-cols-4">
        <div className="card"><p className="text-sm text-slate-500">Total captados</p><h3 className="text-3xl font-black">{totals.ciudadanos_captados || 0}</h3></div>
        <div className="card"><p className="text-sm text-slate-500">Apoyo alto</p><h3 className="text-3xl font-black">{totals.apoyo_alto || 0}</h3></div>
        <div className="card"><p className="text-sm text-slate-500">Apoyo medio</p><h3 className="text-3xl font-black">{totals.apoyo_medio || 0}</h3></div>
        <div className="card"><p className="text-sm text-slate-500">Cobertura global</p><h3 className="text-3xl font-black">{totals.cobertura_global || 0}%</h3></div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <div className="card space-y-4">
          <div className="flex items-center gap-2">
            <UserPlus size={20} />
            <h3 className="font-bold">Registro individual</h3>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <input className="input" placeholder="Nombres" value={form.nombres} onChange={(e) => setField('nombres', e.target.value)} />
            <input className="input" placeholder="Apellidos" value={form.apellidos} onChange={(e) => setField('apellidos', e.target.value)} />
            <input className="input" placeholder="Número de documento" value={form.numero_documento} onChange={(e) => setField('numero_documento', e.target.value)} />
            <input className="input" placeholder="Teléfono" value={form.telefono} onChange={(e) => setField('telefono', e.target.value)} />
            <input className="input" placeholder="Email" value={form.email} onChange={(e) => setField('email', e.target.value)} />
            <select className="input" value={form.barrio_id} onChange={(e) => setField('barrio_id', e.target.value)}>
              <option value="">Barrio urbano</option>
              {barrios.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
            </select>
            <select className="input" value={form.vereda_id} onChange={(e) => setField('vereda_id', e.target.value)}>
              <option value="">Vereda rural</option>
              {veredas.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
            </select>
            <input className="input" placeholder="Líder responsable" value={form.lider_responsable} onChange={(e) => setField('lider_responsable', e.target.value)} />
            <input className="input" placeholder="Fuente de captura" value={form.fuente_captura} onChange={(e) => setField('fuente_captura', e.target.value)} />
            <select className="input" value={form.nivel_apoyo} onChange={(e) => setField('nivel_apoyo', e.target.value)}>
              <option value="alto">Apoyo alto</option>
              <option value="medio">Apoyo medio</option>
              <option value="bajo">Apoyo bajo</option>
              <option value="indeciso">Indeciso</option>
              <option value="no_responde">Sin respuesta</option>
            </select>
            <select className="input" value={form.estado_contacto} onChange={(e) => setField('estado_contacto', e.target.value)}>
              <option value="pendiente">Pendiente</option>
              <option value="contactado">Contactado</option>
              <option value="seguimiento">En seguimiento</option>
              <option value="cerrado">Cerrado</option>
            </select>
            <label className="flex items-center gap-2 text-sm font-bold text-slate-600 md:col-span-2">
              <input type="checkbox" checked={form.consentimiento_datos} onChange={(e) => setField('consentimiento_datos', e.target.checked)} />
              Cuenta con autorización para tratamiento de datos
            </label>
          </div>
          <button className="btn" onClick={save}>Guardar ciudadano</button>
        </div>

        <div className="card space-y-4">
          <div className="flex items-center gap-2">
            <Upload size={20} />
          <h3 className="font-bold">Carga masiva CSV/Excel</h3>
          </div>
          <p className="text-sm font-semibold text-slate-500">
            La matriz debe incluir nombre, apellido, autorización de datos, fuente de captura, territorio y un dato de contacto.
          </p>
          <input className="input" type="file" accept=".csv,.xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <button className="btn" onClick={upload}>Importar archivo</button>
          {importResult && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
              <p className="font-black">Carga procesada</p>
              <p className="mt-1">Registros incorporados: {importResult.importados || 0}</p>
              <p>Duplicados detectados: {importResult.duplicados || 0}</p>
              <p>Registros no incorporados: {(importResult.errores || []).length}</p>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="mb-4 flex items-center gap-2">
          <Users size={20} />
          <h3 className="font-bold">Indicadores agregados por zona</h3>
        </div>
        <div className="mb-6 grid gap-3 md:grid-cols-3">
          {indicadores?.por_zona.slice(0, 6).map((zone) => (
            <div key={`${zone.tipo}-${zone.zona}`} className="rounded-lg border border-slate-200 p-4">
              <p className="font-black">{zone.zona}</p>
              <p className="text-xs font-bold uppercase text-slate-400">{zone.tipo}</p>
              <p className="mt-2 text-sm font-semibold text-slate-600">
                {zone.ciudadanos_captados} captados · {zone.porcentaje_cobertura}% cobertura
              </p>
              <p className="mt-1 text-xs font-bold text-slate-500">
                Altos {zone.apoyo_alto} · Medios {zone.apoyo_medio} · Indecisos {zone.indecisos} · Sin respuesta {zone.no_responde}
              </p>
            </div>
          ))}
        </div>
        <div className="overflow-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b text-slate-500">
              <tr>
                <th className="py-3">Nombre</th>
                <th>Territorio</th>
                <th>Nivel apoyo</th>
                <th>Estado</th>
                <th>Fuente</th>
                <th>Líder</th>
              </tr>
            </thead>
            <tbody>
              {ciudadanos.map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="py-3 font-bold">{item.nombres} {item.apellidos}</td>
                  <td>{item.barrio_id ? zoneById[`b-${item.barrio_id}`] : item.vereda_id ? zoneById[`v-${item.vereda_id}`] : '-'}</td>
                  <td><span className="rounded-full bg-slate-100 px-3 py-1 font-bold">{labelFor(item.nivel_apoyo)}</span></td>
                  <td>{labelFor(item.estado_contacto)}</td>
                  <td>{labelFor(item.fuente_captura)}</td>
                  <td>{item.lider_responsable || '-'}</td>
                </tr>
              ))}
              {!ciudadanos.length && <tr><td className="py-6 text-slate-500" colSpan={6}>Aun no hay ciudadanos captados.</td></tr>}
            </tbody>
          </table>
        </div>
        {indicadores?.restriccion && <p className="mt-4 rounded-lg bg-amber-50 p-4 text-sm font-semibold text-amber-900">Los indicadores se presentan de forma agregada por territorio y no exponen datos sensibles.</p>}
      </div>
    </section>
  );
}
