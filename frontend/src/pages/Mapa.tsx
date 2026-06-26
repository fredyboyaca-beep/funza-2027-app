import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Crosshair, Layers, MapPin, Search, Target, Users, X } from 'lucide-react';
import { api } from '../api/client';
import { labelFor } from '../utils/presentation';

type GeoZone = {
  id: number;
  nombre: string;
  tipo: 'Barrio' | 'Vereda';
  poblacion_estimada: number;
  lat?: number;
  lng?: number;
};

type TerritoryZone = {
  nombre: string;
  tipo: 'Barrio' | 'Vereda';
  poblacion_estimada: number;
  ciudadanos_captados: number;
  apoyos_altos: number;
  apoyos_medios: number;
  apoyos_bajos: number;
  indecisos: number;
  no_responde: number;
  interacciones: number;
  problematicas: number;
  problematica_principal: string;
  cobertura: number;
  potencial: number;
  lider_responsable: string;
  estado_estrategico: string;
  puntaje_prioridad: number;
  severidad_promedio: number;
  recomendaciones: string[];
  justificacion: string[];
};

type MapInfo = {
  municipio?: {
    nombre: string;
    departamento: string;
    codigo_dane: string;
    area_km2: number;
    poblacion_referencia: number;
    poblacion_fuente: string;
    nota_cartografia: string;
  };
  eleccion_alcaldia_2023?: {
    fuente: string;
    total_votos: number;
    votos_validos: number;
  };
};

type Projection = {
  participacion: number;
  afinidad: number;
  adversarioPrincipal: number;
  otrosAdversarios: number;
};

const fmt = new Intl.NumberFormat('es-CO');

const DEFAULT_MAP_INFO: MapInfo = {
  municipio: {
    nombre: 'Funza',
    departamento: 'Cundinamarca',
    codigo_dane: '25286',
    area_km2: 70,
    poblacion_referencia: 82321,
    poblacion_fuente: 'DANE - proyecciones municipales con base censal CNPV 2018',
    nota_cartografia: 'Coordenadas operativas aproximadas. Preparado para reemplazo por GeoJSON oficial.',
  },
  eleccion_alcaldia_2023: {
    fuente: 'Registraduría Nacional - resultados territoriales 2023',
    total_votos: 46872,
    votos_validos: 44494,
  },
};

function zoneKey(zone: { tipo: string; nombre: string }) {
  return `${zone.tipo}-${zone.nombre}`;
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function geoPoint(zone: GeoZone) {
  const lat = zone.lat ?? 4.716;
  const lng = zone.lng ?? -74.215;
  const x = 360 + (lng + 74.215) * 6200;
  const y = 310 - (lat - 4.716) * 6200;
  return {
    x: Math.max(56, Math.min(664, x)),
    y: Math.max(58, Math.min(542, y)),
  };
}

function territoryFromIntelligence(zone: any): TerritoryZone {
  const leaders = zone.lideres || zone.lideres_asociados || [];
  const leaderText = Array.isArray(leaders) && leaders.length ? leaders[0]?.lider || leaders[0] : 'Sin líder asignado';
  return {
    nombre: zone.zona || zone.nombre,
    tipo: zone.tipo || 'Barrio',
    poblacion_estimada: zone.poblacion_estimada || 0,
    ciudadanos_captados: zone.ciudadanos_captados || 0,
    apoyos_altos: zone.apoyos_altos || zone.apoyo_alto || 0,
    apoyos_medios: zone.apoyos_medios || zone.apoyo_medio || 0,
    apoyos_bajos: zone.rechazos_apoyos_bajos || zone.apoyos_bajos || zone.apoyo_bajo || 0,
    indecisos: zone.indecisos || 0,
    no_responde: zone.no_responde || 0,
    interacciones: zone.interacciones || zone.interacciones_registradas || 0,
    problematicas: zone.problematicas_total || zone.problematicas_reportadas || zone.problematicas || 0,
    problematica_principal: zone.problematica_principal || 'Sin registros',
    cobertura: zone.cobertura_territorial ?? zone.porcentaje_cobertura ?? zone.cobertura ?? 0,
    potencial: zone.potencial_electoral_estimado || zone.potencial || 0,
    lider_responsable: leaderText,
    estado_estrategico: zone.nivel_prioridad_territorial || zone.clasificacion_territorial || 'Zona por conquistar',
    puntaje_prioridad: zone.puntaje_prioridad || 0,
    severidad_promedio: zone.severidad_promedio || 0,
    recomendaciones: zone.recomendaciones || [],
    justificacion: zone.justificacion || [],
  };
}

function territoryFromGeo(zone: GeoZone): TerritoryZone {
  return {
    nombre: zone.nombre,
    tipo: zone.tipo,
    poblacion_estimada: zone.poblacion_estimada || 0,
    ciudadanos_captados: 0,
    apoyos_altos: 0,
    apoyos_medios: 0,
    apoyos_bajos: 0,
    indecisos: 0,
    no_responde: 0,
    interacciones: 0,
    problematicas: 0,
    problematica_principal: 'Sin registros',
    cobertura: 0,
    potencial: Math.round((zone.poblacion_estimada || 0) * 0.58),
    lider_responsable: 'Sin líder asignado',
    estado_estrategico: 'Zona por conquistar',
    puntaje_prioridad: 0,
    severidad_promedio: 0,
    recomendaciones: ['Programar primer recorrido territorial y levantar necesidades comunitarias agregadas.'],
    justificacion: ['Aún no hay registros captados en esta zona.'],
  };
}

function colorFor(zone: TerritoryZone, active: boolean) {
  if (active) return '#0f172a';
  if (zone.estado_estrategico === 'Zona crítica') return '#dc2626';
  if (zone.estado_estrategico === 'Zona prioritaria') return '#e11d48';
  if (zone.estado_estrategico === 'Zona en crecimiento') return '#f59e0b';
  if (zone.estado_estrategico === 'Zona favorable') return '#0f766e';
  if (zone.estado_estrategico === 'Zona consolidada') return '#16a34a';
  if (zone.tipo === 'Vereda') return '#2563eb';
  return '#64748b';
}

function defaultProjection(zone: TerritoryZone): Projection {
  const censoEstimado = Math.round(zone.poblacion_estimada * 0.72);
  const participacion = zone.cobertura > 2 ? 60 : 54;
  const votantesEsperados = Math.round(censoEstimado * (participacion / 100));
  return {
    participacion,
    afinidad: zone.apoyos_altos > 0 ? 38 : 24,
    adversarioPrincipal: Math.round(votantesEsperados * 0.28),
    otrosAdversarios: Math.round(votantesEsperados * 0.14),
  };
}

function calculateProjection(zone: TerritoryZone, projection: Projection) {
  const censoEstimado = Math.round(zone.poblacion_estimada * 0.72);
  const votantesEsperados = Math.round(censoEstimado * (projection.participacion / 100));
  const votosPropios = Math.round(votantesEsperados * (projection.afinidad / 100));
  const votosAdversarios = projection.adversarioPrincipal + projection.otrosAdversarios;
  return {
    censoEstimado,
    votantesEsperados,
    votosPropios,
    votosAdversarios,
    margen: votosPropios - votosAdversarios,
  };
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-slate-50 p-4">
      <p className="text-xs font-black uppercase text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-black text-slate-950">{value}</p>
    </div>
  );
}

export function Mapa() {
  const [mapInfo, setMapInfo] = useState<MapInfo>(DEFAULT_MAP_INFO);
  const [geoZones, setGeoZones] = useState<GeoZone[]>([]);
  const [territoryZones, setTerritoryZones] = useState<TerritoryZone[]>([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('Todos');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [traceOpen, setTraceOpen] = useState(false);
  const [projectionEdits, setProjectionEdits] = useState<Record<string, Projection>>({});

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError('');
      const [mapResult, intelligenceResult, barriosResult, veredasResult] = await Promise.allSettled([
        api.get('/mapa/inteligencia'),
        api.get('/inteligencia/resumen-territorial'),
        api.get('/barrios'),
        api.get('/veredas'),
      ]);
      if (!mounted) return;

      const barrios = barriosResult.status === 'fulfilled' ? barriosResult.value.data || [] : [];
      const veredas = veredasResult.status === 'fulfilled' ? veredasResult.value.data || [] : [];
      const geo: GeoZone[] = [
        ...barrios.map((item: any) => ({ ...item, tipo: 'Barrio' as const })),
        ...veredas.map((item: any) => ({ ...item, tipo: 'Vereda' as const })),
      ];
      const intelligenceZones: TerritoryZone[] =
        intelligenceResult.status === 'fulfilled'
          ? (intelligenceResult.value.data.zonas || []).map(territoryFromIntelligence)
          : [];
      const intelligenceByKey = new Map(intelligenceZones.map((zone: TerritoryZone) => [zoneKey(zone), zone]));
      const merged: TerritoryZone[] = geo.map((zone) => intelligenceByKey.get(zoneKey(zone)) || territoryFromGeo(zone));

      setMapInfo(mapResult.status === 'fulfilled' ? mapResult.value.data : DEFAULT_MAP_INFO);
      setGeoZones(geo);
      setTerritoryZones(merged);
      setSelectedKey((current) => current || (merged[0] ? zoneKey(merged[0]) : ''));
      setError(
        [mapResult, intelligenceResult, barriosResult, veredasResult].some((result) => result.status === 'rejected')
          ? 'Algunos datos no pudieron cargarse. Se muestra la base territorial disponible.'
          : '',
      );
      setLoading(false);
    }
    load().catch(() => {
      if (!mounted) return;
      setError('No fue posible conectar con el backend. Intenta nuevamente en unos segundos.');
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const geoByKey = useMemo(() => {
    const map = new Map<string, GeoZone>();
    geoZones.forEach((zone) => map.set(zoneKey(zone), zone));
    return map;
  }, [geoZones]);

  const filtered = useMemo(() => {
    const needle = normalizeText(search);
    return territoryZones.filter((zone) => {
      const matchesSearch = !needle || normalizeText(zone.nombre).includes(needle);
      const matchesType = typeFilter === 'Todos' || zone.tipo === typeFilter;
      const matchesStatus =
        statusFilter === 'Todos' ||
        (statusFilter === 'Con registros' && zone.ciudadanos_captados > 0) ||
        (statusFilter === 'Sin registros' && zone.ciudadanos_captados === 0) ||
        zone.estado_estrategico === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [territoryZones, search, typeFilter, statusFilter]);

  const selected = useMemo(
    () => territoryZones.find((zone) => zoneKey(zone) === selectedKey) || filtered[0] || territoryZones[0],
    [filtered, selectedKey, territoryZones],
  );

  const projection = selected
    ? projectionEdits[zoneKey(selected)] || defaultProjection(selected)
    : null;
  const projectionResult = selected && projection ? calculateProjection(selected, projection) : null;
  const visibleKeys = new Set(filtered.map(zoneKey));
  const selectedGeo = selected ? geoByKey.get(zoneKey(selected)) : null;

  function updateProjection(key: keyof Projection, value: number) {
    if (!selected) return;
    const currentKey = zoneKey(selected);
    setProjectionEdits((current) => ({
      ...current,
      [currentKey]: {
        ...(current[currentKey] || defaultProjection(selected)),
        [key]: value,
      },
    }));
  }

  if (loading) {
    return <p className="rounded-lg bg-white p-5 font-semibold text-slate-600">Cargando mapa territorial...</p>;
  }

  if (!territoryZones.length) {
    return (
      <section className="rounded-lg bg-white p-6">
        <h2 className="text-2xl font-black">Mapa territorial</h2>
        <p className="mt-2 font-semibold text-rose-700">No fue posible cargar barrios y veredas desde el backend.</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black">Mapa territorial inteligente</h2>
          <p className="mt-1 max-w-4xl text-sm font-semibold text-slate-500">
            Selecciona un barrio o vereda para ver cobertura, apoyos, problemáticas, proyección y recomendación de campaña.
          </p>
        </div>
        <span className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white">45 unidades oficiales</span>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(520px,1fr)_430px]">
        <div className="rounded-lg bg-white p-5 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[1fr_170px_190px]">
            <div className="flex items-center gap-3 rounded-lg bg-slate-50 px-4 py-3">
              <Search size={18} className="text-slate-400" />
              <input
                className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-slate-400"
                placeholder="Buscar barrio o vereda..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              {search && (
                <button onClick={() => setSearch('')} className="rounded-full p-1 text-slate-400 hover:bg-white">
                  <X size={16} />
                </button>
              )}
            </div>
            <select className="input" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option>Todos</option>
              <option>Barrio</option>
              <option>Vereda</option>
            </select>
            <select className="input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option>Todos</option>
              <option>Con registros</option>
              <option>Sin registros</option>
              <option>Zona crítica</option>
              <option>Zona prioritaria</option>
              <option>Zona en crecimiento</option>
              <option>Zona consolidada</option>
            </select>
          </div>

          <div className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
            <svg viewBox="0 0 720 600" className="h-[560px] w-full">
              <rect width="720" height="600" fill="#f8fafc" />
              <path d="M100 122 L328 54 L574 112 L650 294 L554 506 L310 548 L104 446 L58 250 Z" fill="#eef2f7" stroke="#d7dee8" strokeWidth="2" />
              <path d="M88 318 C190 270 296 260 420 302 C506 332 588 330 652 288" fill="none" stroke="#cbd5e1" strokeWidth="10" strokeLinecap="round" opacity="0.55" />
              {geoZones.map((geo) => {
                const key = zoneKey(geo);
                const zone = territoryZones.find((item) => zoneKey(item) === key) || territoryFromGeo(geo);
                const point = geoPoint(geo);
                const active = selected && zoneKey(selected) === key;
                const visible = visibleKeys.has(key);
                const radius = geo.tipo === 'Vereda' ? 13 : 9;
                return (
                  <g
                    key={key}
                    role="button"
                    tabIndex={0}
                    aria-label={`Seleccionar ${geo.tipo} ${geo.nombre}`}
                    onClick={() => setSelectedKey(key)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') setSelectedKey(key);
                    }}
                    className="cursor-pointer"
                    opacity={visible ? 1 : 0.16}
                  >
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={active ? radius + 8 : radius + 3}
                      fill={active ? '#0f172a' : '#ffffff'}
                      stroke={colorFor(zone, active)}
                      strokeWidth={active ? 5 : 3}
                    />
                    <circle cx={point.x} cy={point.y} r={radius} fill={colorFor(zone, active)} />
                    {(active || zone.ciudadanos_captados > 0) && (
                      <text x={point.x + 15} y={point.y - 10} fill="#0f172a" fontSize="12" fontWeight="900">
                        {geo.nombre}
                      </text>
                    )}
                  </g>
                );
              })}
              {selected && selectedGeo && (
                <g>
                  <rect x="26" y="500" width="668" height="72" rx="18" fill="#ffffff" opacity="0.96" />
                  <text x="50" y="530" fill="#0f172a" fontSize="22" fontWeight="900">
                    {selected.nombre}
                  </text>
                  <text x="50" y="554" fill="#64748b" fontSize="13" fontWeight="800">
                    {selected.tipo} · {selected.estado_estrategico} · {selected.cobertura}% cobertura · {selected.ciudadanos_captados ? `${selected.ciudadanos_captados} captados` : 'Aún no hay registros captados en esta zona'}
                  </text>
                </g>
              )}
            </svg>
          </div>

          <div className="mt-4 flex flex-wrap gap-4 text-xs font-black text-slate-600">
            <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-full bg-[#dc2626]" /> Zona crítica</span>
            <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-full bg-[#e11d48]" /> Prioritaria</span>
            <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-full bg-[#f59e0b]" /> En crecimiento</span>
            <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-full bg-[#16a34a]" /> Consolidada</span>
            <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-full bg-[#2563eb]" /> Vereda</span>
          </div>

          <div className="mt-5 rounded-lg border border-slate-200 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-black uppercase text-slate-400">
              <Layers size={16} /> Territorios filtrados
            </div>
            <div className="grid max-h-72 gap-2 overflow-y-auto pr-1 md:grid-cols-2">
              {filtered.map((zone) => {
                const key = zoneKey(zone);
                const active = selected && zoneKey(selected) === key;
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedKey(key)}
                    className={`rounded-lg border px-3 py-2 text-left transition ${active ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white hover:border-slate-400'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-black">{zone.nombre}</span>
                      <span className={active ? 'text-xs font-bold text-slate-300' : 'text-xs font-bold text-slate-400'}>{zone.tipo}</span>
                    </div>
                    <p className={active ? 'mt-1 text-xs font-semibold text-slate-300' : 'mt-1 text-xs font-semibold text-slate-500'}>
                      {zone.cobertura}% cobertura · {zone.estado_estrategico}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {selected && projection && projectionResult && (
          <aside className="space-y-5">
            <div className="rounded-lg bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase text-slate-400">Territorio seleccionado</p>
                  <h3 className="mt-1 text-2xl font-black">{selected.nombre}</h3>
                  <p className="mt-1 text-sm font-bold text-slate-500">{selected.tipo}</p>
                </div>
                <span className="rounded-full px-3 py-1 text-xs font-black text-white" style={{ backgroundColor: colorFor(selected, false) }}>
                  {selected.estado_estrategico}
                </span>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <StatCard label="Población" value={fmt.format(selected.poblacion_estimada)} />
                <StatCard label="Captados" value={fmt.format(selected.ciudadanos_captados)} />
                <StatCard label="Cobertura" value={`${selected.cobertura}%`} />
                <StatCard label="Potencial" value={fmt.format(selected.potencial)} />
              </div>
              {!selected.ciudadanos_captados && (
                <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm font-bold text-amber-900">
                  Aún no hay registros captados en esta zona.
                </p>
              )}
            </div>

            <div className="rounded-lg bg-white p-5 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 font-black"><Users size={18} /> Apoyos agregados</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <StatCard label="Alto" value={fmt.format(selected.apoyos_altos)} />
                <StatCard label="Medio" value={fmt.format(selected.apoyos_medios)} />
                <StatCard label="Bajo / rechazo" value={fmt.format(selected.apoyos_bajos)} />
                <StatCard label="Indecisos" value={fmt.format(selected.indecisos)} />
              </div>
            </div>

            <div className="rounded-lg bg-white p-5 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 font-black"><AlertTriangle size={18} /> Lectura territorial</h3>
              <div className="space-y-3 text-sm font-semibold text-slate-700">
                <p><b>Problemática principal:</b> {labelFor(selected.problematica_principal)}</p>
                <p><b>Reportes:</b> {fmt.format(selected.problematicas)} · <b>Interacciones:</b> {fmt.format(selected.interacciones)}</p>
                <p><b>Líder responsable:</b> {selected.lider_responsable}</p>
                <p><b>Severidad promedio:</b> {selected.severidad_promedio || 0}/5</p>
              </div>
              <div className="mt-4 rounded-lg bg-blue-50 p-4">
                <p className="text-xs font-black uppercase text-blue-700">Recomendación IA</p>
                <p className="mt-1 text-sm font-bold text-slate-800">
                  {selected.recomendaciones[0] || 'Programar recorrido de diagnóstico, registrar hallazgos y actualizar captación territorial.'}
                </p>
              </div>
            </div>

            <div className="rounded-lg bg-white p-5 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 font-black"><Target size={18} /> Proyección editable</h3>
              <label className="block text-sm font-bold text-slate-600">
                Participación esperada ({projection.participacion}%)
                <input className="mt-2 w-full" type="range" min="35" max="85" value={projection.participacion} onChange={(event) => updateProjection('participacion', Number(event.target.value))} />
              </label>
              <label className="mt-4 block text-sm font-bold text-slate-600">
                Afinidad estimada ({projection.afinidad}%)
                <input className="mt-2 w-full" type="range" min="5" max="70" value={projection.afinidad} onChange={(event) => updateProjection('afinidad', Number(event.target.value))} />
              </label>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-bold text-slate-600">
                  Votos adversario principal
                  <input className="input mt-1" type="number" min="0" value={projection.adversarioPrincipal} onChange={(event) => updateProjection('adversarioPrincipal', Number(event.target.value))} />
                </label>
                <label className="text-sm font-bold text-slate-600">
                  Otros adversarios
                  <input className="input mt-1" type="number" min="0" value={projection.otrosAdversarios} onChange={(event) => updateProjection('otrosAdversarios', Number(event.target.value))} />
                </label>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <StatCard label="Votantes esperados" value={fmt.format(projectionResult.votantesEsperados)} />
                <StatCard label="Votos propios" value={fmt.format(projectionResult.votosPropios)} />
                <StatCard label="Votos adversarios" value={fmt.format(projectionResult.votosAdversarios)} />
                <StatCard label="Margen" value={fmt.format(projectionResult.margen)} />
              </div>
            </div>

            <div className="rounded-lg bg-amber-50 p-4 text-sm font-semibold text-amber-900">
              <button className="flex items-center gap-2 font-black" onClick={() => setTraceOpen((current) => !current)}>
                <Crosshair size={16} /> {traceOpen ? 'Ocultar trazabilidad' : 'Ver trazabilidad'}
              </button>
              {traceOpen && (
                <div className="mt-3 space-y-1">
                  <p>Código DANE: {mapInfo.municipio?.codigo_dane}</p>
                  <p>Fuente poblacional: {mapInfo.municipio?.poblacion_fuente}</p>
                  <p>Fuente electoral: {mapInfo.eleccion_alcaldia_2023?.fuente}</p>
                  <p>{mapInfo.municipio?.nota_cartografia}</p>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </section>
  );
}
