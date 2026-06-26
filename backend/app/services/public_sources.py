from __future__ import annotations

from datetime import datetime, timezone
from html.parser import HTMLParser
from typing import Any
from urllib.request import Request, urlopen


class TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts: list[str] = []
        self.skip = False

    def handle_starttag(self, tag: str, attrs):
        if tag in {"script", "style", "noscript"}:
            self.skip = True

    def handle_endtag(self, tag: str):
        if tag in {"script", "style", "noscript"}:
            self.skip = False

    def handle_data(self, data: str):
        if not self.skip:
            text = " ".join(data.split())
            if text:
                self.parts.append(text)

    def text(self) -> str:
        return " ".join(self.parts)


KEYWORDS = {
    "seguridad": ["seguridad", "convivencia", "delito", "violencia", "protección", "orden público"],
    "movilidad": ["movilidad", "tránsito", "vial", "vías", "cicloruta", "semáforo", "señalización"],
    "educación": ["educación", "matrícula", "colegio", "estudiantes", "rural", "docente"],
    "salud": ["salud", "salud mental", "hospital", "vacunación", "atención"],
    "servicios públicos": ["servicios públicos", "acueducto", "alcantarillado", "energía", "aseo"],
    "medio ambiente": ["ambiente", "animal", "residuos", "humedal", "sostenible", "agua"],
    "espacio público": ["espacio público", "parque", "andén", "recuperación"],
    "empleo": ["empleo", "desarrollo económico", "competitividad", "empresa", "productivo"],
}


PUBLIC_SOURCES = [
    {
        "nombre": "Alcaldía Municipal de Funza",
        "url": "https://www.funza-cundinamarca.gov.co/",
        "tipo": "oficial municipal",
        "descripcion_base": "Sitio oficial municipal con noticias, planes, dependencias y comunicados públicos.",
        "hallazgos_base": [
            {"categoria": "gestión pública", "problematica": "Necesidad de contrastar solicitudes ciudadanas con comunicados y programas municipales vigentes.", "evidencia": "Sitio oficial municipal de Funza."}
        ],
    },
    {
        "nombre": "Plan de Desarrollo Municipal Funza Evoluciona 2024-2027",
        "url": "https://www.funza-cundinamarca.gov.co/planes/plan-de-desarrollo-municipal-funza-evoluciona-20242027",
        "tipo": "oficial municipal",
        "descripcion_base": "Plan de desarrollo vigente para contrastar problemáticas con ejes programáticos.",
        "hallazgos_base": [
            {"categoria": "planeación", "problematica": "Alinear propuestas de campaña con los ejes del Plan de Desarrollo Municipal 2024-2027.", "evidencia": "Referencia pública del Plan de Desarrollo Municipal."}
        ],
    },
    {
        "nombre": "Plan de Desarrollo de Funza - Región Metropolitana",
        "url": "https://regionmetropolitana.gov.co/observatorio/publicaciones/planes-desarrollo/plan-desarrollo-funza-2024-2027",
        "tipo": "público regional",
        "descripcion_base": "Ficha pública del plan de desarrollo de Funza 2024-2027.",
        "hallazgos_base": [
            {"categoria": "movilidad", "problematica": "Necesidad de revisar transporte, viajes y movilidad regional con enfoque territorial.", "evidencia": "Ficha pública regional del Plan de Desarrollo de Funza 2024-2027."},
            {"categoria": "seguridad", "problematica": "Seguridad ciudadana, convivencia y justicia aparecen como área temática a priorizar.", "evidencia": "Ficha pública regional del Plan de Desarrollo de Funza 2024-2027."},
            {"categoria": "abastecimiento", "problematica": "Abastecimiento alimentario y comercialización requieren lectura territorial por zona.", "evidencia": "Ficha pública regional del Plan de Desarrollo de Funza 2024-2027."},
        ],
    },
    {
        "nombre": "Ministerio de Educación - matrícula rural Funza",
        "url": "https://www.mineducacion.gov.co/portal/salaprensa/Comunicados/426750:Funza-Cundinamarca-uno-de-los-municipios-que-presenta-un-porcentaje-bajo-en-el-avance-de-matricula-oficial-de-la-zona-rural-No-esperes-hasta-ultimo-momento-Matriculalos-ya",
        "tipo": "oficial nacional",
        "descripcion_base": "Comunicado público sobre avance de matrícula oficial rural y urbana en Funza.",
        "hallazgos_base": [
            {"categoria": "educación", "problematica": "Bajo avance de matrícula oficial en zona rural de Funza reportado por el Ministerio de Educación.", "evidencia": "Comunicado público del Ministerio de Educación Nacional."}
        ],
    },
]


def _fetch_text(url: str) -> str:
    request = Request(url, headers={"User-Agent": "FUNZA-2027 territorial intelligence"})
    with urlopen(request, timeout=7) as response:
        raw = response.read(500_000).decode("utf-8", errors="ignore")
    parser = TextExtractor()
    parser.feed(raw)
    return parser.text()


def _classify(text: str) -> list[dict[str, Any]]:
    lowered = text.lower()
    detected = []
    for category, keywords in KEYWORDS.items():
        score = sum(lowered.count(keyword) for keyword in keywords)
        if score:
            detected.append({"categoria": category, "menciones": score})
    detected.sort(key=lambda item: item["menciones"], reverse=True)
    return detected[:5]


def _concrete_findings(text: str, fallback: list[dict[str, str]]) -> list[dict[str, str]]:
    lowered = text.lower()
    findings = list(fallback)
    if "matrícula oficial de la zona rural" in lowered or "porcentaje bajo en el avance de matrícula" in lowered:
        findings.append(
            {
                "categoria": "educación",
                "problematica": "Bajo avance de matrícula oficial en zona rural de Funza.",
                "evidencia": "El texto público menciona bajo avance de matrícula oficial rural.",
            }
        )
    if "seguridad ciudadana" in lowered and "convivencia" in lowered:
        findings.append(
            {
                "categoria": "seguridad",
                "problematica": "Seguridad ciudadana y convivencia requieren priorización territorial.",
                "evidencia": "La fuente pública menciona seguridad ciudadana y convivencia.",
            }
        )
    if "transporte" in lowered and "movilidad" in lowered:
        findings.append(
            {
                "categoria": "movilidad",
                "problematica": "Movilidad y transporte aparecen como frente de intervención territorial.",
                "evidencia": "La fuente pública menciona transporte y movilidad.",
            }
        )
    unique = {}
    for finding in findings:
        key = (finding["categoria"], finding["problematica"])
        unique[key] = finding
    return list(unique.values())


def public_problem_sources() -> dict[str, Any]:
    consulted_at = datetime.now(timezone.utc).isoformat()
    sources = []
    category_totals: dict[str, int] = {}

    for source in PUBLIC_SOURCES:
        status = "consultada"
        fallback_findings = source.get("hallazgos_base", [])
        try:
            text = _fetch_text(source["url"])
            resumen = text[:700] if text else source["descripcion_base"]
        except Exception:
            status = "referencia_publica"
            text = source["descripcion_base"]
            resumen = source["descripcion_base"]

        categorias = _classify(text)
        hallazgos = _concrete_findings(text, fallback_findings)
        for finding in hallazgos:
            category_totals[finding["categoria"]] = category_totals.get(finding["categoria"], 0) + 1
        for item in categorias:
            category_totals[item["categoria"]] = category_totals.get(item["categoria"], 0) + item["menciones"]
        sources.append(
            {
                **source,
                "estado": status,
                "consultado_en": consulted_at,
                "categorias_detectadas": categorias,
                "problematicas_concretas": hallazgos,
                "resumen": resumen,
            }
        )

    ranking = [{"categoria": key, "menciones": value} for key, value in category_totals.items()]
    ranking.sort(key=lambda item: item["menciones"], reverse=True)
    return {
        "consultado_en": consulted_at,
        "restriccion": "Fuentes públicas; no contiene datos personales ni inferencias individuales.",
        "ranking_problematicas_publicas": ranking,
        "problematicas_concretas": [finding for source in sources for finding in source["problematicas_concretas"]],
        "fuentes": sources,
    }
