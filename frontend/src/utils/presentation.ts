const statusLabels: Record<string, string> = {
  pendiente_validacion_oficial: 'En proceso de verificación documental',
  coalicion_validada_fuente_publica: 'Coalición verificada con fuente pública',
  registrado: 'Registrado en fuente electoral',
  coalicion_inscrita_o_reportada: 'Coalición oficialmente registrada o reportada',
  aval_oficial_o_movimiento_registrado: 'Aval o movimiento registrado',
  registraduria_consultada: 'Información obtenida de Registraduría Nacional',
  registraduria_referenciada_sin_descarga: 'Información oficial referenciada',
  referencia_registraduria_configurada: 'Fuente oficial configurada',
  distribucion_proporcional_en_coalicion: 'Estimación distribuida entre partidos de la coalición',
  fuente_principal_oficial: 'Fuente oficial principal',
  validacion_proceso_electoral: 'Validación del proceso electoral',
  indice_no_definitivo: 'Referencia auxiliar',
  referencia_publica: 'Referencia pública disponible',
  consultada: 'Fuente consultada',
  abierta: 'Abierta',
  en_revision: 'En revisión',
  gestionada: 'Gestionada',
  cerrada: 'Cerrada',
  pendiente: 'Pendiente',
  contactado: 'Contactado',
  seguimiento: 'En seguimiento',
  alto: 'Apoyo alto',
  medio: 'Apoyo medio',
  bajo: 'Apoyo bajo',
  indeciso: 'Indeciso',
  no_responde: 'Sin respuesta',
  formulario_campana: 'Formulario de campaña',
  recorrido_territorial: 'Recorrido territorial',
  cargue_masivo: 'Carga masiva',
  'movimiento/partido pendiente de validar': 'Información oficial no encontrada',
  'movimiento/coalicion oficial pendiente de validar': 'En proceso de verificación documental',
};

export function labelFor(value?: string | null) {
  if (!value) return 'Sin información disponible';
  const normalized = value.trim();
  const key = normalized.toLowerCase();
  if (statusLabels[key]) return statusLabels[key];
  return normalized
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function confidenceTone(value?: string | null) {
  const key = (value || '').toLowerCase();
  if (key.includes('pendiente')) return 'bg-amber-50 text-amber-700';
  if (key.includes('validada') || key.includes('registrado')) return 'bg-emerald-50 text-emerald-700';
  return 'bg-blue-50 text-blue-700';
}

export function userMessage(error: any, fallback = 'No fue posible completar la operación') {
  const detail = error?.response?.data?.detail;
  const raw = Array.isArray(detail) ? detail.map((item: any) => item.msg).join('. ') : detail;
  if (!raw) return fallback;
  return String(raw)
    .replaceAll('barrio_id', 'barrio')
    .replaceAll('vereda_id', 'vereda')
    .replaceAll('fuente_captura', 'fuente de captura')
    .replaceAll('consentimiento_datos', 'autorización de tratamiento de datos')
    .replaceAll('numero_documento', 'documento')
    .replaceAll('_', ' ');
}
