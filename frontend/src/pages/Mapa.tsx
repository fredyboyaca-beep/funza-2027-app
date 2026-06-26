import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Filter, Layers, MapPin, Search, Target, TrendingUp, Users, X } from 'lucide-react';
import { api } from '../api/client';
import { labelFor } from '../utils/presentation';

type Candidato = {
  nombre: string;
  movimiento: string;
  votos: number;
  color: string;
};

type Sector = {
  id: string;
  nombre: string;
  tipo: string;
  poblacion: number;
  riesgo_abstencion: string;
  ganador_2023: string;
  color: string;
  points: number[][];
};

type ProjectionCell = {
  id: string;
  nombre: string;
  x: number;
  y: number;
  size: number;
  potencial: number;
  abstencion: number;
  prioridad: 'Alta' | 'Media' | 'Baja';
  foco: string;
};

type ZoneProjection = {
  poblacion: number;
  censoFactor: number;
  participacion: number;
  afinidad: number;
  cobertura: number;
  adversarioPrincipal: number;
  otrosAdversarios: number;
};

type MapaData = {
  municipio: {
    nombre: string;
    departamento: string;
    codigo_dane: string;
    area_km2: number;
    poblacion_referencia: number;
    poblacion_fuente: string;
    nota_cartografia: string;
  };
  eleccion_alcaldia_2023: {
    fuente: string;
    total_votos: number;
    votos_validos: number;
    votos_blanco: number;
    votos_nulos: number;
    no_marcados: number;
    candidatos: Candidato[];
  };
  sectores: Sector[];
};

type TerritoryZone = {
  nombre: string;
  tipo: string;
  poblacion_estimada: number;
  ciudadanos_captados: number;
  apoyos_altos: number;
  apoyos_medios: number;
  apoyos_bajos: number;
  no_responde?: number;
  indecisos: number;
  interacciones: number;
  problematicas: number;
  problematica_principal: string;
  cobertura: number;
  potencial: number;
  requiere_visita: boolean;
  nivel_prioridad_territorial?: string;
  puntaje_prioridad?: number;
  severidad_promedio?: number;
  recomendaciones?: string[];
  justificacion?: string[];
};

type GeoZone = {
  id: number;
  nombre: string;
  tipo: string;
  poblacion_estimada: number;
  lat?: number;
  lng?: number;
};

const fmt = new Intl.NumberFormat('es-CO');

function pct(value: number, total: number) {
  if (!total) return '0,0%';
  return `${((value / total) * 100).toFixed(1).replace('.', ',')}%`;
}

function pathFrom(points: number[][]) {
  return points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ') + ' Z';
}

function boundsFrom(points: number[][]) {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

function zoneKey(zona: { tipo: string; nombre: string }) {
  return `${zona.tipo}-${zona.nombre}`;
}

function geoPoint(zone: GeoZone) {
  const lat = zone.lat ?? 4.716;
  const lng = zone.lng ?? -74.215;
  const x = 235 + (lng + 74.215) * 5200;
  const y = 214 - (lat - 4.716) * 5200;
  return {
    x: Math.max(32, Math.min(438, x)),
    y: Math.max(34, Math.min(398, y)),
  };
}

function territoryTile(index: number, total: number) {
  const cols = 5;
  const rows = Math.max(1, Math.ceil(total / cols));
  const col = index % cols;
  const row = Math.floor(index / cols);
  const gap = 7;
  const width = (410 - gap * (cols - 1)) / cols;
  const height = Math.min(62, (330 - gap * (rows - 1)) / rows);
  const x = 30 + col * (width + gap);
  const y = 48 + row * (height + gap);
  const skew = (index % 2) * 8;
  const points = [
    [x + skew, y],
    [x + width, y + 5],
    [x + width - skew, y + height],
    [x, y + height - 6],
  ];
  return {
    path: pathFrom(points),
    cx: x + width / 2,
    cy: y + height / 2,
    width,
    height,
  };
}

function focusedBlocks() {
  return [
    { id: 'norte', label: 'Norte', path: 'M 92 72 L 236 52 L 248 184 L 104 204 Z' },
    { id: 'oriente', label: 'Oriente', path: 'M 248 64 L 382 96 L 352 228 L 248 184 Z' },
    { id: 'sur', label: 'Sur', path: 'M 104 204 L 248 184 L 292 338 L 126 354 Z' },
    { id: 'occidente', label: 'Occidente', path: 'M 248 184 L 352 228 L 292 338 Z' },
  ];
}

function projectionCellsFor(sector: Sector): ProjectionCell[] {
  const bounds = boundsFrom(sector.points);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const size = Math.max(26, Math.min(width, height) / 3.4);
  const labels = ['Norte', 'Centro', 'Sur', 'Oriente'];
  const focos = ['Abstención', 'Movilización', 'Pedagogía electoral', 'Presencia territorial'];
  return labels.map((label, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const potencial = Math.round((sector.poblacion * (0.18 + index * 0.035)) / 10) * 10;
    const abstencion = Math.min(48, Math.round((sector.riesgo_abstencion === 'Alto' ? 34 : sector.riesgo_abstencion === 'Medio alto' ? 29 : 22) + index * 2.3));
    return {
      id: `${sector.id}-${label.toLowerCase()}`,
      nombre: `${sector.nombre} ${label}`,
      x: bounds.minX + width * (0.26 + col * 0.34) - size / 2,
      y: bounds.minY + height * (0.32 + row * 0.34) - size / 2,
      size,
      potencial,
      abstencion,
      prioridad: abstencion >= 34 ? 'Alta' : abstencion >= 28 ? 'Media' : 'Baja',
      foco: focos[index],
    };
  });
}

function defaultProjection(sector: Sector): ZoneProjection {
  const censoEstimado = Math.round(sector.poblacion * 0.72);
  const participacion = sector.riesgo_abstencion === 'Alto' ? 54 : sector.riesgo_abstencion === 'Medio alto' ? 58 : 62;
  const votantesEsperados = Math.round(censoEstimado * (participacion / 100));
  return {
    poblacion: sector.poblacion,
    censoFactor: 72,
    participacion,
    afinidad: sector.ganador_2023 === 'Competitivo' ? 34 : 42,
    cobertura: 28,
    adversarioPrincipal: Math.round(votantesEsperados * (sector.ganador_2023 === 'Competitivo' ? 0.31 : 0.23)),
    otrosAdversarios: Math.round(votantesEsperados * 0.12),
  };
}

function defaultTerritoryProjection(zona: TerritoryZone): ZoneProjection {
  const poblacion = zona.poblacion_estimada || 0;
  const censoFactor = 72;
  const participacion = zona.requiere_visita ? 54 : 60;
  const votantesEsperados = Math.round(poblacion * (censoFactor / 100) * (participacion / 100));
  return {
    poblacion,
    censoFactor,
    participacion,
    afinidad: zona.apoyos_altos > 0 ? 38 : 25,
    cobertura: Math.min(100, Math.max(0, zona.cobertura || 0)),
    adversarioPrincipal: Math.round(votantesEsperados * 0.28),
    otrosAdversarios: Math.round(votantesEsperados * 0.14),
  };
}

function calculateProjection(projection: ZoneProjection) {
  const censoEstimado = Math.round(projection.poblacion * (projection.censoFactor / 100));
  const votantesEsperados = Math.round(censoEstimado * (projection.participacion / 100));
  const votosProyectados = Math.round(votantesEsperados * (projection.afinidad / 100));
  const personasContacto = Math.round(projection.poblacion * (projection.cobertura / 100));
  const votosAdversarios = Math.round((projection.adversarioPrincipal || 0) + (projection.otrosAdversarios || 0));
  const margenProyectado = votosProyectados - votosAdversarios;
  return { censoEstimado, votantesEsperados, votosProyectados, personasContacto, votosAdversarios, margenProyectado };
}

function territoryFromIntelligence(zona: any): TerritoryZone {
  return {
    nombre: zona.zona,
    tipo: zona.tipo,
    poblacion_estimada: zona.poblacion_estimada || 0,
    ciudadanos_captados: zona.ciudadanos_captados || 0,
    apoyos_altos: zona.apoyos_altos || 0,
    apoyos_medios: zona.apoyos_medios || 0,
    apoyos_bajos: zona.rechazos_apoyos_bajos || 0,
    no_responde: zona.no_responde || 0,
    indecisos: zona.indecisos || 0,
    interacciones: zona.interacciones || 0,
    problematicas: zona.problematicas_total || 0,
    problematica_principal: zona.problematica_principal || 'Sin registros',
    cobertura: zona.cobertura_territorial || 0,
    potencial: zona.potencial_electoral_estimado || 0,
    requiere_visita: ['Zona crítica', 'Zona prioritaria', 'Zona en crecimiento', 'Zona por conquistar'].includes(zona.nivel_prioridad_territorial),
    nivel_prioridad_territorial: zona.nivel_prioridad_territorial,
    puntaje_prioridad: zona.puntaje_prioridad,
    severidad_promedio: zona.severidad_promedio,
    recomendaciones: zona.recomendaciones || [],
    justificacion: zona.justificacion || [],
  };
}

function territoryFill(zona: TerritoryZone, active: boolean) {
  if (active) return '#0f172a';
  if (zona.nivel_prioridad_territorial === 'Zona crítica') return '#dc2626';
  if (zona.nivel_prioridad_territorial === 'Zona prioritaria') return '#e11d48';
  if (zona.nivel_prioridad_territorial === 'Zona en crecimiento') return '#f59e0b';
  if (zona.nivel_prioridad_territorial === 'Zona favorable') return '#0f766e';
  if (zona.nivel_prioridad_territorial === 'Zona consolidada') return '#16a34a';
  if (zona.tipo === 'Vereda') return '#e83e98';
  return zona.requiere_visita ? '#5b2d5d' : '#7b6680';
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-slate-50 p-4">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function CandidateCard({ candidato, total, featured = false }: { candidato: Candidato; total: number; featured?: boolean }) {
  const porcentaje = pct(candidato.votos, total);
  return (
    <div className="rounded-lg bg-slate-50 p-5">
      <div className="flex items-center gap-5">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg bg-white text-3xl font-black text-slate-300">
          {candidato.nombre.split(' ').slice(0, 2).map((x) => x[0]).join('')}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black uppercase tracking-wide text-slate-500">{candidato.movimiento}</p>
          <div className="mt-1 flex items-start justify-between gap-4">
            <h3 className={`${featured ? 'text-3xl' : 'text-2xl'} max-w-sm font-black leading-tight text-slate-950`}>
              {candidato.nombre}
            </h3>
            <div className="text-right">
              <p className={`${featured ? 'text-4xl' : 'text-3xl'} font-black text-slate-950`}>{porcentaje}</p>
              <p className="text-sm font-bold text-slate-400">{fmt.format(candidato.votos)} votos</p>
            </div>
          </div>
          <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full" style={{ width: porcentaje, backgroundColor: candidato.color }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function Mapa() {
  const [data, setData] = useState<MapaData | null>(null);
  const [territoryZones, setTerritoryZones] = useState<TerritoryZone[]>([]);
  const [geoZones, setGeoZones] = useState<GeoZone[]>([]);
  const [selectedId, setSelectedId] = useState('centro');
  const [selectedCellId, setSelectedCellId] = useState('');
  const [selectedTerritoryKey, setSelectedTerritoryKey] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('Todos');
  const [coverageFilter, setCoverageFilter] = useState('Todas');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [zoneProjections, setZoneProjections] = useState<Record<string, ZoneProjection>>({});
  const [territoryProjections, setTerritoryProjections] = useState<Record<string, ZoneProjection>>({});
  const [showTrace, setShowTrace] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/mapa/inteligencia'),
      api.get('/inteligencia/resumen-territorial'),
      api.get('/barrios'),
      api.get('/veredas'),
    ]).then(([mapa, inteligencia, barrios, veredas]) => {
      setData(mapa.data);
      const zonas = (inteligencia.data.zonas || []).map(territoryFromIntelligence);
      setTerritoryZones(zonas);
      const barrioPoints = (barrios.data || []).map((item: any) => ({ ...item, tipo: 'Barrio' }));
      const veredaPoints = (veredas.data || []).map((item: any) => ({ ...item, tipo: 'Vereda' }));
      setGeoZones([...barrioPoints, ...veredaPoints]);
      if (zonas[0]) setSelectedTerritoryKey(zoneKey(zonas[0]));
      setTerritoryProjections((current) => {
        const next = { ...current };
        zonas.forEach((zona: TerritoryZone) => {
          const key = zoneKey(zona);
          if (!next[key]) next[key] = defaultTerritoryProjection(zona);
        });
        return next;
      });
    });
  }, []);

  useEffect(() => {
    if (!data) return;
    setZoneProjections((current) => {
      const next = { ...current };
      data.sectores.forEach((sector) => {
        if (!next[sector.id]) next[sector.id] = defaultProjection(sector);
      });
      return next;
    });
  }, [data]);

  const selected = useMemo(() => data?.sectores.find((x) => x.id === selectedId) || data?.sectores[0], [data, selectedId]);
  const projectionCells = useMemo(() => (selected ? projectionCellsFor(selected) : []), [selected]);
  const selectedCell = projectionCells.find((cell) => cell.id === selectedCellId) || projectionCells[0];
  const candidates = data?.eleccion_alcaldia_2023.candidatos || [];
  const winner = candidates[0];
  const second = candidates[1];
  const margin = winner && second ? winner.votos - second.votos : 0;
  const selectedProjection = selected ? zoneProjections[selected.id] || defaultProjection(selected) : null;
  const selectedProjectionResult = selectedProjection ? calculateProjection(selectedProjection) : null;
  const totalProjection = useMemo(() => {
    if (!territoryZones.length) return { censoEstimado: 0, votantesEsperados: 0, votosProyectados: 0, personasContacto: 0, votosAdversarios: 0, margenProyectado: 0 };
    return territoryZones.reduce(
      (acc, zona) => {
        const key = zoneKey(zona);
        const result = calculateProjection(territoryProjections[key] || defaultTerritoryProjection(zona));
        return {
          censoEstimado: acc.censoEstimado + result.censoEstimado,
          votantesEsperados: acc.votantesEsperados + result.votantesEsperados,
          votosProyectados: acc.votosProyectados + result.votosProyectados,
          personasContacto: acc.personasContacto + result.personasContacto,
          votosAdversarios: acc.votosAdversarios + result.votosAdversarios,
          margenProyectado: acc.margenProyectado + result.margenProyectado,
        };
      },
      { censoEstimado: 0, votantesEsperados: 0, votosProyectados: 0, personasContacto: 0, votosAdversarios: 0, margenProyectado: 0 },
    );
  }, [territoryZones, territoryProjections]);

  const filteredTerritory = useMemo(() => {
    return territoryZones.filter((zona) => {
      const matchesSearch = !searchTerm || zona.nombre.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === 'Todos' || zona.tipo === typeFilter;
      const matchesCoverage =
        coverageFilter === 'Todas' ||
        (coverageFilter === 'Baja cobertura' && zona.requiere_visita) ||
        (coverageFilter === 'Con registros' && zona.ciudadanos_captados > 0) ||
        (coverageFilter === 'Sin registros' && zona.ciudadanos_captados === 0);
      return matchesSearch && matchesType && matchesCoverage;
    });
  }, [territoryZones, searchTerm, typeFilter, coverageFilter]);

  const selectedTerritory = useMemo(() => {
    return territoryZones.find((zona) => zoneKey(zona) === selectedTerritoryKey) || filteredTerritory[0] || territoryZones[0];
  }, [territoryZones, filteredTerritory, selectedTerritoryKey]);
  const selectedTerritoryProjection = selectedTerritory ? territoryProjections[zoneKey(selectedTerritory)] || defaultTerritoryProjection(selectedTerritory) : null;
  const selectedTerritoryResult = selectedTerritoryProjection ? calculateProjection(selectedTerritoryProjection) : null;

  const focusedTerritory = useMemo(() => {
    return selectedTerritory;
  }, [selectedTerritory]);

  const geoByKey = useMemo(() => {
    const map = new Map<string, GeoZone>();
    geoZones.forEach((zone) => map.set(zoneKey(zone), zone));
    return map;
  }, [geoZones]);

  function updateSelectedProjection(key: keyof ZoneProjection, value: number) {
    if (!selected) return;
    setZoneProjections((current) => ({
      ...current,
      [selected.id]: {
        ...(current[selected.id] || defaultProjection(selected)),
        [key]: value,
      },
    }));
  }

  function updateTerritoryProjection(key: keyof ZoneProjection, value: number) {
    if (!selectedTerritory) return;
    const currentKey = zoneKey(selectedTerritory);
    setTerritoryProjections((current) => ({
      ...current,
      [currentKey]: {
        ...(current[currentKey] || defaultTerritoryProjection(selectedTerritory)),
        [key]: value,
      },
    }));
  }

  useEffect(() => {
    if (projectionCells[0]) setSelectedCellId(projectionCells[0].id);
  }, [selectedId, projectionCells.length]);

  useEffect(() => {
    if (!filteredTerritory.length) return;
    const selectedStillVisible = filteredTerritory.some((zona) => zoneKey(zona) === selectedTerritoryKey);
    if (!selectedStillVisible) setSelectedTerritoryKey(zoneKey(filteredTerritory[0]));
  }, [filteredTerritory, selectedTerritoryKey]);

  if (!data || !selected || !selectedCell || !selectedProjection || !selectedProjectionResult || !winner || !second || !selectedTerritory || !selectedTerritoryProjection || !selectedTerritoryResult) return <p>Cargando proyección territorial...</p>;

  return (
    <section className="min-h-screen bg-slate-100 p-0 text-slate-950">
      <div className="grid gap-8 xl:grid-cols-[minmax(420px,0.95fr)_minmax(520px,1fr)]">
        <div className="rounded-lg bg-white p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-3xl font-black">Proyección territorial</h2>
              <p className="mt-2 max-w-md text-sm font-semibold text-slate-500">Selecciona un barrio o vereda para proyectar cobertura, participación y escenarios de competencia.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-500">Análisis agregado</span>
          </div>

          <div className="mt-8 rounded-lg bg-slate-50 px-4 py-3">
            <div className="flex items-center gap-3 text-slate-400">
              <Search size={20} />
              <input
                className="w-full bg-transparent font-semibold text-slate-700 outline-none placeholder:text-slate-400"
                placeholder="Buscar barrio o vereda..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="rounded-full p-1 text-slate-400 hover:bg-white hover:text-slate-700">
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="text-xs font-black uppercase text-slate-400">
              Tipo
              <select className="input mt-1" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                <option>Todos</option>
                <option>Barrio</option>
                <option>Vereda</option>
              </select>
            </label>
            <label className="text-xs font-black uppercase text-slate-400">
              Cobertura
              <select className="input mt-1" value={coverageFilter} onChange={(event) => setCoverageFilter(event.target.value)}>
                <option>Todas</option>
                <option>Baja cobertura</option>
                <option>Con registros</option>
                <option>Sin registros</option>
              </select>
            </label>
          </div>

          <div className="mt-3 flex items-center justify-between text-sm font-black text-slate-500">
            <span className="flex items-center gap-2 text-blue-700"><MapPin size={16} /> {data.municipio.departamento} / {data.municipio.nombre}</span>
            <span>Proyección territorial</span>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <StatCard label="Votos proyectados total" value={fmt.format(totalProjection.votosProyectados)} />
            <StatCard label="Margen proyectado" value={fmt.format(totalProjection.margenProyectado)} />
          </div>

          <div className="mt-6 rounded-lg bg-slate-50 p-4">
            <button className="mb-2 flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-black text-slate-700">
              <ChevronLeft size={18} /> Colombia
            </button>
            <svg viewBox="0 0 470 430" className="h-[430px] w-full">
              <rect width="470" height="430" rx="18" fill="#f8fafc" />
              {filteredTerritory.map((zona, index) => {
                  const key = zoneKey(zona);
                  const tile = territoryTile(index, filteredTerritory.length);
                  const isSelectedTerritory = selectedTerritory && zoneKey(selectedTerritory) === key;
                  const fill = territoryFill(zona, Boolean(isSelectedTerritory));
                  return (
                    <g
                      key={`${key}-tile`}
                      role="button"
                      tabIndex={0}
                      aria-label={`Seleccionar ${zona.tipo} ${zona.nombre}`}
                      onClick={() => setSelectedTerritoryKey(key)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') setSelectedTerritoryKey(key);
                      }}
                      className="cursor-pointer"
                    >
                      <path
                        d={tile.path}
                        fill={fill}
                        stroke={isSelectedTerritory ? '#0f172a' : '#ffffff'}
                        strokeWidth={isSelectedTerritory ? 4 : 2}
                        opacity={isSelectedTerritory ? 1 : 0.88}
                      />
                      {tile.width > 62 && (
                        <text x={tile.cx} y={tile.cy} textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="800">
                          {zona.nombre.length > 12 ? `${zona.nombre.slice(0, 11)}.` : zona.nombre}
                        </text>
                      )}
                    </g>
                  );
                })}
              {selectedTerritory && (
                <g>
                  <rect x="24" y="360" width="422" height="52" rx="14" fill="#ffffff" opacity="0.94" />
                  <text x="42" y="384" fill="#0f172a" fontSize="17" fontWeight="900">
                    {selectedTerritory.nombre}
                  </text>
                  <text x="42" y="403" fill="#64748b" fontSize="12" fontWeight="700">
                    {selectedTerritory.tipo} - {selectedTerritory.nivel_prioridad_territorial || 'Seguimiento'} - cobertura {selectedTerritory.cobertura}%
                  </text>
                </g>
              )}
            </svg>
          </div>

          <div className="mt-6 flex flex-wrap gap-5 text-sm font-black">
            <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-full bg-[#5b2d5d]" /> Barrio/zona activa</span>
            <span className="flex items-center gap-2"><i className="h-3 w-3 rounded bg-slate-950" /> Zona seleccionada</span>
            <span className="flex items-center gap-2"><i className="h-3 w-3 rounded bg-white ring-1 ring-slate-400" /> Enfoque por filtro</span>
            <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-full bg-slate-950" /> Barrio</span>
            <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-full bg-rose-600" /> Vereda</span>
          </div>

          {selectedTerritory && (
            <div className="mt-6 rounded-lg border-2 border-blue-100 bg-blue-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-blue-600">Barrio/vereda filtrado</p>
                  <h3 className="mt-1 text-xl font-black text-slate-950">{selectedTerritory.nombre}</h3>
                  <p className="text-sm font-bold text-slate-500">{selectedTerritory.tipo} · {labelFor(selectedTerritory.problematica_principal)}</p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-blue-700">
                  {selectedTerritory.requiere_visita ? 'Priorizar' : 'Seguimiento'}
                </span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <StatCard label="Población" value={fmt.format(selectedTerritory.poblacion_estimada)} />
                <StatCard label="Captados" value={fmt.format(selectedTerritory.ciudadanos_captados)} />
                <StatCard label="Cobertura" value={`${selectedTerritory.cobertura}%`} />
              </div>
            </div>
          )}

          <div className="mt-6 rounded-lg border border-slate-200 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-slate-400">
              <Layers size={16} /> Barrios y zonas operativas
            </div>
            <div className="grid max-h-80 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {filteredTerritory.map((zona) => {
                const key = zoneKey(zona);
                const active = selectedTerritory && zoneKey(selectedTerritory) === key;
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedTerritoryKey(key)}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm font-bold transition ${
                      active ? 'border-slate-950 bg-slate-950 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <i className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: zona.tipo === 'Barrio' ? '#0f172a' : '#e11d48' }} />
                      <span className="truncate">{zona.nombre}</span>
                    </span>
                    <span className={active ? 'text-right text-slate-200' : 'text-right text-slate-400'}>
                      {zona.tipo}
                      <small className="block text-[11px]">{zona.cobertura}% cobertura</small>
                      <small className="block text-[11px]">{zona.nivel_prioridad_territorial || 'Seguimiento'}</small>
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-xs font-bold text-slate-400">
              Mostrando {fmt.format(filteredTerritory.length)} zonas según filtros. Al seleccionar una zona, el mapa se transforma en ese barrio o vereda para trabajar escenarios de proyección.
            </p>
          </div>

          <div className="mt-6 rounded-lg border border-slate-200 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-slate-400">
              <Target size={16} /> Zonas de enfoque dentro de {selected.nombre}
            </div>
            <div className="grid gap-2">
              {projectionCells.map((cell) => (
                <button
                  key={cell.id}
                  onClick={() => setSelectedCellId(cell.id)}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm font-bold transition ${
                    selectedCell.id === cell.id ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
                  }`}
                >
                  <span>{cell.nombre}</span>
                  <span className={selectedCell.id === cell.id ? 'text-slate-200' : 'text-slate-400'}>{cell.prioridad}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-black">{data.municipio.nombre}</h2>
              <p className="mt-1 text-sm font-bold text-slate-500">{data.municipio.departamento}</p>
            </div>
            <span className="rounded-full bg-blue-50 px-5 py-2 text-lg font-black text-blue-700">Proyección 2027</span>
          </div>

          <div className="mt-6 rounded-lg border-2 border-slate-950 bg-white p-5 shadow-sm transition" key={zoneKey(selectedTerritory)}>
            <p className="text-sm font-black uppercase tracking-wide text-slate-400">Barrio/vereda seleccionado para proyectar</p>
            <div className="mt-1 flex items-center gap-3">
              <i className="h-4 w-4 rounded-full" style={{ backgroundColor: selectedTerritory.tipo === 'Barrio' ? '#0f172a' : '#e11d48' }} />
              <h3 className="text-2xl font-black">{selectedTerritory.nombre}</h3>
            </div>
            <div className="mt-4 grid gap-3 text-sm font-bold text-slate-600 md:grid-cols-2">
              <p>Tipo: <b className="text-slate-950">{selectedTerritory.tipo}</b></p>
              <p>Población ref.: <b className="text-slate-950">{fmt.format(selectedTerritory.poblacion_estimada)}</b></p>
              <p>Captados: <b className="text-slate-950">{fmt.format(selectedTerritory.ciudadanos_captados)}</b></p>
              <p>Problemática: <b className="text-slate-950">{labelFor(selectedTerritory.problematica_principal)}</b></p>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, selectedTerritory.cobertura)}%`,
                  backgroundColor: selectedTerritory.tipo === 'Barrio' ? '#0f172a' : '#e11d48',
                }}
              />
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-400">
              Cobertura registrada: {selectedTerritory.cobertura}% · Potencial operativo: {fmt.format(selectedTerritory.potencial)}
            </p>
          </div>

          <div className="mt-6 rounded-lg border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-wide text-slate-400">Escenario editable de campaña</p>
                <h3 className="mt-1 text-2xl font-black">{selectedTerritory.nombre}</h3>
              </div>
              <Users className="text-slate-400" size={28} />
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="text-sm font-bold text-slate-600">
                Población estimada
                <input
                  className="input mt-1"
                  type="number"
                  min="0"
                  value={selectedTerritoryProjection.poblacion}
                  onChange={(event) => updateTerritoryProjection('poblacion', Number(event.target.value))}
                />
              </label>
              <label className="text-sm font-bold text-slate-600">
                Votos adversario principal
                <input
                  className="input mt-1"
                  type="number"
                  min="0"
                  value={selectedTerritoryProjection.adversarioPrincipal}
                  onChange={(event) => updateTerritoryProjection('adversarioPrincipal', Number(event.target.value))}
                />
              </label>
              <label className="text-sm font-bold text-slate-600">
                Otros adversarios
                <input
                  className="input mt-1"
                  type="number"
                  min="0"
                  value={selectedTerritoryProjection.otrosAdversarios}
                  onChange={(event) => updateTerritoryProjection('otrosAdversarios', Number(event.target.value))}
                />
              </label>
              <label className="text-sm font-bold text-slate-600">
                Factor censo electoral ({selectedTerritoryProjection.censoFactor}%)
                <input
                  className="mt-3 w-full"
                  type="range"
                  min="45"
                  max="90"
                  value={selectedTerritoryProjection.censoFactor}
                  onChange={(event) => updateTerritoryProjection('censoFactor', Number(event.target.value))}
                />
              </label>
              <label className="text-sm font-bold text-slate-600">
                Participación esperada ({selectedTerritoryProjection.participacion}%)
                <input
                  className="mt-3 w-full"
                  type="range"
                  min="35"
                  max="85"
                  value={selectedTerritoryProjection.participacion}
                  onChange={(event) => updateTerritoryProjection('participacion', Number(event.target.value))}
                />
              </label>
              <label className="text-sm font-bold text-slate-600">
                Afinidad / intención ({selectedTerritoryProjection.afinidad}%)
                <input
                  className="mt-3 w-full"
                  type="range"
                  min="5"
                  max="70"
                  value={selectedTerritoryProjection.afinidad}
                  onChange={(event) => updateTerritoryProjection('afinidad', Number(event.target.value))}
                />
              </label>
              <label className="text-sm font-bold text-slate-600 md:col-span-2">
                Cobertura territorial planeada ({selectedTerritoryProjection.cobertura}%)
                <input
                  className="mt-3 w-full"
                  type="range"
                  min="0"
                  max="100"
                  value={selectedTerritoryProjection.cobertura}
                  onChange={(event) => updateTerritoryProjection('cobertura', Number(event.target.value))}
                />
              </label>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-4">
              <StatCard label="Censo estimado" value={fmt.format(selectedTerritoryResult.censoEstimado)} />
              <StatCard label="Votantes esperados" value={fmt.format(selectedTerritoryResult.votantesEsperados)} />
              <StatCard label="Votos proyectados" value={fmt.format(selectedTerritoryResult.votosProyectados)} />
              <StatCard label="Margen vs adversarios" value={fmt.format(selectedTerritoryResult.margenProyectado)} />
              <StatCard label="Adversario principal" value={fmt.format(selectedTerritoryProjection.adversarioPrincipal)} />
              <StatCard label="Otros adversarios" value={fmt.format(selectedTerritoryProjection.otrosAdversarios)} />
              <StatCard label="Total adversarios" value={fmt.format(selectedTerritoryResult.votosAdversarios)} />
              <StatCard label="Contactos meta" value={fmt.format(selectedTerritoryResult.personasContacto)} />
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-slate-200 p-5 shadow-sm">
            <p className="text-sm font-black uppercase tracking-wide text-slate-400">Referencia histórica 2023</p>
            <div className="mt-4">
              <CandidateCard candidato={winner} total={data.eleccion_alcaldia_2023.total_votos} featured />
            </div>

            <div className="my-5 flex items-center gap-4">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="rounded-full bg-slate-50 px-5 py-2 text-sm font-black uppercase tracking-wide text-slate-400">
                Diferencia <b className="ml-2 text-slate-950">{fmt.format(margin)} votos</b>
              </span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <CandidateCard candidato={second} total={data.eleccion_alcaldia_2023.total_votos} />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <StatCard label="Población referencia" value={fmt.format(data.municipio.poblacion_referencia)} />
            <StatCard label="Area municipal" value={`${fmt.format(data.municipio.area_km2)} km2`} />
            <StatCard label="Votos válidos 2023" value={fmt.format(data.eleccion_alcaldia_2023.votos_validos)} />
            <StatCard label="Votos en blanco" value={fmt.format(data.eleccion_alcaldia_2023.votos_blanco)} />
            <StatCard label="Votos nulos" value={fmt.format(data.eleccion_alcaldia_2023.votos_nulos)} />
            <StatCard label="Total votos" value={fmt.format(data.eleccion_alcaldia_2023.total_votos)} />
          </div>

          <div className="mt-6 rounded-lg border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-wide text-slate-400">Zona de enfoque</p>
                <h3 className="mt-1 text-2xl font-black">{selectedCell.nombre}</h3>
              </div>
              <span className={`rounded-full px-4 py-2 text-sm font-black ${
                selectedCell.prioridad === 'Alta' ? 'bg-rose-50 text-rose-700' : selectedCell.prioridad === 'Media' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
              }`}>
                Prioridad {selectedCell.prioridad}
              </span>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <StatCard label="Potencial agregado" value={fmt.format(selectedCell.potencial)} />
              <StatCard label="Abstención proyectada" value={`${selectedCell.abstencion}%`} />
              <StatCard label="Foco táctico" value={selectedCell.foco} />
            </div>
            <div className="mt-5 rounded-lg bg-slate-50 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-slate-400">
                <TrendingUp size={16} /> Acciones sugeridas
              </div>
              <ul className="space-y-2 text-sm font-semibold text-slate-700">
                <li>Priorizar recorridos territoriales y escucha comunitaria con datos agregados.</li>
                <li>Contrastar esta zona con puestos de votación y resultados históricos al cargar fuentes oficiales.</li>
                <li>Registrar problemáticas recurrentes para alimentar ranking y mensajes programáticos.</li>
              </ul>
            </div>
          </div>

          <div className="mt-6 rounded-lg bg-amber-50 p-4 text-sm font-semibold text-amber-900">
            <p>La proyección combina datos agregados, resultados históricos y supuestos editables para orientar decisiones de campo.</p>
            <button className="mt-3 rounded-full bg-white px-4 py-2 text-sm font-black text-amber-900" onClick={() => setShowTrace((current) => !current)}>
              {showTrace ? 'Ocultar trazabilidad' : 'Ver trazabilidad'}
            </button>
            {showTrace && (
              <div className="mt-3 rounded-lg bg-white p-3 text-sm text-slate-700">
                <p>Código DANE: {data.municipio.codigo_dane}</p>
                <p>Fuente poblacional: {data.municipio.poblacion_fuente}</p>
                <p>Fuente electoral: {data.eleccion_alcaldia_2023.fuente}</p>
                <p>Observación cartográfica: {data.municipio.nota_cartografia}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
