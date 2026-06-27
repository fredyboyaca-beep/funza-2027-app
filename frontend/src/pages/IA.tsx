import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Brain, CalendarDays, FileText, Megaphone, Target } from 'lucide-react';
import { api } from '../api/client';
import { labelFor } from '../utils/presentation';

type Zona = {
  zona: string;
  tipo: string;
  nivel_prioridad_territorial: string;
  problematica_principal: string | null;
  cobertura_territorial: number;
  potencial_electoral_estimado: number;
  indecisos: number;
  interacciones: number;
  justificacion: string[];
  recomendaciones: string[];
};

type Inteligencia = {
  totales: Record<string, number>;
  zonas: Zona[];
  ranking_problematicas: { categoria: string; frecuencia: number; casos: number }[];
  recomendaciones: { zona: string; recomendacion: string; sustento: string[] }[];
};

type FuentePublica = {
  nombre: string;
  url: string;
  tipo: string;
  estado: string;
  consultado_en: string;
  categorias_detectadas: { categoria: string; menciones: number }[];
  problematicas_concretas: { categoria: string; problematica: string; evidencia: string }[];
  resumen: string;
};

type FuentesPublicas = {
  consultado_en: string;
  restriccion: string;
  ranking_problematicas_publicas: { categoria: string; menciones: number }[];
  problematicas_concretas: { categoria: string; problematica: string; evidencia: string }[];
  fuentes: FuentePublica[];
};

const fmt = new Intl.NumberFormat('es-CO');

const objetivos = [
  { id: 'priorizar', label: 'Priorizar recorrido', icon: Target },
  { id: 'agenda', label: 'Agenda territorial', icon: CalendarDays },
  { id: 'propuesta', label: 'Propuesta de gobierno', icon: FileText },
  { id: 'mensaje', label: 'Mensaje público', icon: Megaphone },
] as const;

function buildOutput(objetivo: string, zona: Zona, data: Inteligencia, backend: any, publicData: FuentesPublicas | null) {
  const problemaPublico = publicData?.problematicas_concretas?.[0]?.problematica || publicData?.ranking_problematicas_publicas?.[0]?.categoria;
  const problema = zona.problematica_principal || problemaPublico || data.ranking_problematicas[0]?.categoria || 'problemáticas sin clasificar';
  const sustento = zona.justificacion.length ? zona.justificacion : ['Análisis basado en indicadores agregados disponibles.'];
  const base = {
    zona: zona.zona,
    prioridad: zona.nivel_prioridad_territorial,
    sustento,
    advertencia: backend?.advertencia_etica || 'Solo usa datos agregados, públicos o autorizados. No perfila personas.',
    fuente_publica: publicData?.fuentes?.[0]?.nombre,
  };

  if (objetivo === 'agenda') {
    return {
      ...base,
      titulo: `Agenda sugerida para ${zona.zona}`,
      acciones: [
        `Recorrido de escucha sobre ${problema}.`,
        'Reunión corta con líderes comunitarios y responsables territoriales.',
        'Registro de compromisos, necesidades e interacciones sin publicar datos personales.',
        'Cierre con priorizacion de 3 acciones verificables para seguimiento semanal.',
      ],
      resultado_esperado: 'Aumentar cobertura territorial y convertir hallazgos agregados en compromisos programáticos.',
    };
  }

  if (objetivo === 'propuesta') {
    return {
      ...base,
      titulo: `Propuesta programática basada en ${problema}`,
      acciones: [
        `Crear linea de gobierno local enfocada en ${problema}.`,
        'Definir indicador de avance por barrio/vereda.',
        'Publicar tablero de seguimiento ciudadano con datos agregados.',
        'Priorizar intervenciones donde coincidan baja cobertura y alta severidad.',
      ],
      resultado_esperado: 'Convertir problemáticas registradas en una propuesta medible y defendible.',
    };
  }

  if (objetivo === 'mensaje') {
    return {
      ...base,
      titulo: `Mensaje sugerido para ${zona.zona}`,
      acciones: [
        `En ${zona.zona} escuchamos una preocupacion recurrente: ${problema}.`,
        'Nuestra ruta será medir, priorizar y cumplir con seguimiento público.',
        'Cada compromiso debe nacer de información territorial agregada y verificable.',
      ],
      resultado_esperado: 'Comunicar cercanía y método sin prometer cifras no sustentadas.',
    };
  }

  return {
    ...base,
    titulo: `Prioridad estratégica: ${zona.zona}`,
    acciones: [
      zona.recomendaciones[0] || backend?.oportunidades?.[0] || 'Programar recorrido territorial de diagnóstico.',
      `Revisar potencial estimado de ${fmt.format(zona.potencial_electoral_estimado)} personas votantes agregadas.`,
      `Trabajar el tema principal reportado: ${problema}.`,
      'Actualizar el tablero después de cada jornada territorial.',
    ],
    resultado_esperado: 'Tomar decisiones de recorrido con sustento y no por intuición.',
  };
}

export function IA() {
  const [data, setData] = useState<Inteligencia | null>(null);
  const [objetivo, setObjetivo] = useState<(typeof objetivos)[number]['id']>('priorizar');
  const [zonaNombre, setZonaNombre] = useState('');
  const [backendResult, setBackendResult] = useState<any>(null);
  const [publicData, setPublicData] = useState<FuentesPublicas | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingSources, setLoadingSources] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/inteligencia/resumen-territorial')
      .then((r) => {
        setData(r.data);
        setZonaNombre(r.data.zonas?.[0]?.zona || '');
      })
      .catch(() => {
        setData({ totales: {}, zonas: [], ranking_problematicas: [], recomendaciones: [] });
        setError('No fue posible cargar la inteligencia territorial. Verifica la conexión con el backend.');
      });
  }, []);

  const zona = useMemo(() => data?.zonas.find((item) => item.zona === zonaNombre) || data?.zonas[0], [data, zonaNombre]);
  const output = data && zona ? buildOutput(objetivo, zona, data, backendResult, publicData) : null;

  async function loadSources() {
    setLoadingSources(true);
    try {
      const response = await api.get('/ia/fuentes-publicas');
      setPublicData(response.data);
    } catch {
      setError('No fue posible consultar fuentes públicas en este momento. Puedes continuar con los datos internos agregados.');
    } finally {
      setLoadingSources(false);
    }
  }

  async function run() {
    if (!data || !zona) return;
    setLoading(true);
    try {
      const response = await api.post('/ia/recomendar', {
        participacion: 0.58,
        abstencion: 0.42,
        problematica_principal: zona.problematica_principal || data.ranking_problematicas[0]?.categoria || 'sin registros',
        sector: zona.zona,
        objetivo,
        prioridad: zona.nivel_prioridad_territorial,
        cobertura: zona.cobertura_territorial,
        potencial: zona.potencial_electoral_estimado,
        problematicas_agregadas: data.ranking_problematicas.slice(0, 5),
        fuentes_publicas: publicData?.fuentes?.map((source) => ({
          nombre: source.nombre,
          url: source.url,
          categorias: source.categorias_detectadas,
          problematicas: source.problematicas_concretas,
        })) || [],
      });
      setBackendResult(response.data);
    } catch {
      setError('No fue posible generar el análisis desde el backend. Se mantiene la recomendación local basada en datos agregados.');
    } finally {
      setLoading(false);
    }
  }

  if (!data) return <p>Cargando asistente estratégico...</p>;
  if (!zona || !output) {
    return (
      <section className="space-y-4">
        <h2 className="text-3xl font-black">Asistente IA Estratégico</h2>
        <p className="rounded-lg bg-amber-50 p-4 font-semibold text-amber-900">{error || 'Aún no hay zonas con datos agregados para analizar.'}</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black">Asistente IA Estratégico</h2>
          <p className="mt-1 max-w-4xl text-sm font-semibold text-slate-500">
            Genera análisis, agendas, propuestas y mensajes usando solo datos agregados del sistema.
          </p>
        </div>
        <span className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white">IA explicable</span>
      </div>

      {error && <p className="rounded-lg bg-amber-50 p-4 text-sm font-bold text-amber-900">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="card space-y-5">
          <div>
            <p className="mb-2 text-sm font-black text-slate-500">Objetivo de análisis</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {objetivos.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setObjetivo(id)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-3 text-left text-sm font-black transition ${
                    objetivo === id ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
                  }`}
                >
                  <Icon size={17} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <label className="block text-sm font-black text-slate-500">
            Zona a analizar
            <select className="input mt-2" value={zonaNombre} onChange={(event) => setZonaNombre(event.target.value)}>
              {data.zonas.map((item) => (
                <option key={`${item.tipo}-${item.zona}`} value={item.zona}>
                  {item.zona} - {item.nivel_prioridad_territorial}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase text-slate-400">Potencial</p>
              <p className="mt-1 text-2xl font-black">{fmt.format(zona.potencial_electoral_estimado)}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase text-slate-400">Cobertura</p>
              <p className="mt-1 text-2xl font-black">{zona.cobertura_territorial}%</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase text-slate-400">Indecisos</p>
              <p className="mt-1 text-2xl font-black">{fmt.format(zona.indecisos)}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase text-slate-400">Interacciones</p>
              <p className="mt-1 text-2xl font-black">{fmt.format(zona.interacciones)}</p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-4">
            <p className="mb-3 text-sm font-black text-slate-500">Problemáticas agregadas internas</p>
            <div className="space-y-2">
              {(data.ranking_problematicas.length ? data.ranking_problematicas.slice(0, 4) : [{ categoria: 'Sin registros', frecuencia: 0, casos: 0 }]).map((item) => (
                <div key={item.categoria} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm font-bold">
                  <span>{labelFor(item.categoria)}</span>
                  <span className="text-slate-400">{item.frecuencia} reportes</span>
                </div>
              ))}
            </div>
          </div>

          <button className="btn w-full" onClick={run} disabled={loading}>
            {loading ? 'Analizando...' : 'Generar análisis estratégico'}
          </button>
          <button className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:border-slate-500" onClick={loadSources} disabled={loadingSources}>
            {loadingSources ? 'Consultando fuentes públicas...' : 'Actualizar problemáticas desde fuentes públicas'}
          </button>
        </div>

        <div className="card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">Resultado generado</p>
              <h3 className="mt-1 text-2xl font-black">{output.titulo}</h3>
              <p className="mt-1 text-sm font-semibold text-slate-500">{output.zona} · {output.prioridad}</p>
            </div>
            <Brain className="text-slate-400" size={28} />
          </div>

          <div className="mt-5 space-y-3">
            {backendResult?.temas_que_debe_abordar?.map((item: any) => (
              <div key={`${item.tema}-${item.que_abordar}`} className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-blue-700">Tema que debe abordar el candidato</p>
                <p className="mt-1 font-black text-slate-950">{item.que_abordar}</p>
                <p className="mt-2 text-sm font-semibold text-slate-700">{item.por_que}</p>
                <p className="mt-2 text-xs font-bold text-slate-500">Fuente: {item.fuente || 'Datos agregados del sistema'}</p>
                <p className="mt-3 rounded-lg bg-white p-3 text-sm font-semibold text-slate-700">{item.accion_candidatura}</p>
              </div>
            ))}
            {output.acciones.map((item: string) => (
              <div key={item} className="rounded-lg border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700">
                {item}
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-lg bg-slate-50 p-4">
            <p className="mb-2 flex items-center gap-2 text-sm font-black text-slate-600">
              <AlertTriangle size={16} /> Sustento de la recomendación
            </p>
            <ul className="space-y-2 text-sm font-semibold text-slate-700">
              {output.sustento.map((reason: string) => <li key={reason}>{reason}</li>)}
            </ul>
          </div>

          <div className="mt-5 rounded-lg bg-amber-50 p-4 text-sm font-semibold text-amber-900">
            <p>{output.resultado_esperado}</p>
            <p className="mt-2">{output.advertencia}</p>
            {output.fuente_publica && <p className="mt-2">Fuente pública principal considerada: {output.fuente_publica}.</p>}
          </div>
        </div>
      </div>

      {publicData && (
        <div className="grid gap-6 xl:grid-cols-[0.7fr_1.3fr]">
          <div className="card">
            <h3 className="mb-4 font-bold">Problemáticas públicas concretas</h3>
            <div className="space-y-3">
              {(publicData.problematicas_concretas.length ? publicData.problematicas_concretas : [{ categoria: 'Sin hallazgo', problematica: 'No se detectaron problemáticas concretas en las fuentes consultadas.', evidencia: 'Se requiere cargar o consultar más fuentes públicas.' }]).map((item) => (
                <div key={`${item.categoria}-${item.problematica}`} className="rounded-lg bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">{labelFor(item.categoria)}</p>
                  <p className="mt-1 font-black text-slate-950">{item.problematica}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-600">{item.evidencia}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs font-bold text-slate-400">Consultado: {new Date(publicData.consultado_en).toLocaleString('es-CO')}</p>
          </div>

          <div className="card">
            <h3 className="mb-4 font-bold">Fuentes públicas consultadas</h3>
            <div className="space-y-3">
              {publicData.fuentes.map((source) => (
                <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="block rounded-lg border border-slate-200 p-4 transition hover:border-slate-400">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-black">{source.nombre}</p>
                      <p className="text-xs font-bold uppercase text-slate-400">{labelFor(source.tipo)} · {labelFor(source.estado)}</p>
                    </div>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">Abrir fuente</span>
                  </div>
                  <p className="mt-3 line-clamp-3 text-sm font-semibold text-slate-600">{source.resumen}</p>
                  {source.problematicas_concretas.length > 0 && (
                    <div className="mt-3 rounded-lg bg-white p-3">
                      <p className="mb-2 text-xs font-black uppercase text-slate-400">Hallazgos concretos</p>
                      <div className="space-y-2">
                        {source.problematicas_concretas.map((item) => (
                          <p key={`${source.url}-${item.problematica}`} className="text-xs font-semibold text-slate-700">
                            <b>{labelFor(item.categoria)}:</b> {item.problematica}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {source.categorias_detectadas.map((item) => (
                      <span key={`${source.url}-${item.categoria}`} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                        {labelFor(item.categoria)}: {item.menciones}
                      </span>
                    ))}
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
