from __future__ import annotations

from collections import Counter, defaultdict
from datetime import date
from typing import Any

from sqlalchemy.orm import Session

from app.models.models import Barrio, CiudadanoCaptado, InteraccionTerritorial, Problematica, Vereda
from app.services.territorial_intelligence import OFFICIAL_BARRIO_NAMES, OFFICIAL_VEREDA_NAMES


SUPPORT_LEVELS = ("alto", "medio", "bajo", "indeciso", "no_responde")


def _support_counts(rows: list[CiudadanoCaptado]) -> dict[str, int]:
    counts = {level: 0 for level in SUPPORT_LEVELS}
    for row in rows:
        level = (row.nivel_apoyo or "indeciso").strip().lower()
        counts[level if level in counts else "indeciso"] += 1
    return counts


def _last_interaction(rows: list[InteraccionTerritorial]) -> str | None:
    dates = [row.fecha for row in rows if row.fecha]
    return max(dates).date().isoformat() if dates else None


def _problem_ranking(rows: list[Problematica]) -> list[dict[str, Any]]:
    counter = Counter()
    for row in rows:
        counter[(row.categoria or "sin clasificar").strip().lower()] += int(row.frecuencia or 1)
    return [{"categoria": key, "frecuencia": value} for key, value in counter.most_common(5)]


def _leader_ranking(rows: list[CiudadanoCaptado]) -> list[dict[str, Any]]:
    leaders: dict[str, dict[str, int]] = defaultdict(lambda: {"captados": 0, "apoyos_altos": 0, "indecisos": 0})
    for row in rows:
        leader = (row.lider_responsable or "Sin líder asignado").strip()
        leaders[leader]["captados"] += 1
        if (row.nivel_apoyo or "").lower() == "alto":
            leaders[leader]["apoyos_altos"] += 1
        if (row.nivel_apoyo or "").lower() == "indeciso":
            leaders[leader]["indecisos"] += 1
    ranking = [{"lider": key, **value} for key, value in leaders.items()]
    return sorted(ranking, key=lambda item: (item["apoyos_altos"], item["captados"]), reverse=True)[:8]


def _weekly_variation(rows: list[CiudadanoCaptado]) -> dict[str, int]:
    today = date.today()
    current = 0
    previous = 0
    for row in rows:
        if not row.fecha_creacion:
            continue
        age = (today - row.fecha_creacion.date()).days
        if 0 <= age <= 6:
            current += 1
        elif 7 <= age <= 13:
            previous += 1
    return {"semana_actual": current, "semana_anterior": previous, "variacion": current - previous}


def _territory_classification(supports: dict[str, int], cobertura: float, interacciones: int, problematicas: int) -> str:
    if cobertura >= 5 and supports["alto"] >= supports["medio"] + supports["indeciso"] + supports["bajo"]:
        return "Zona consolidada"
    if supports["alto"] + supports["medio"] > supports["indeciso"] + supports["bajo"] and cobertura >= 2:
        return "Zona favorable"
    if interacciones > 0 and cobertura < 3 and supports["indeciso"] >= supports["alto"]:
        return "Zona en crecimiento"
    if problematicas >= 3 and supports["bajo"] >= supports["alto"]:
        return "Zona crítica"
    if cobertura < 1 or supports["indeciso"] > supports["alto"]:
        return "Zona prioritaria"
    return "Zona por conquistar"


def _zone_indicator(
    zone: Barrio | Vereda,
    tipo: str,
    ciudadanos: list[CiudadanoCaptado],
    interacciones: list[InteraccionTerritorial],
    problematicas: list[Problematica],
) -> dict[str, Any]:
    supports = _support_counts(ciudadanos)
    leaders = {row.lider_responsable for row in ciudadanos if row.lider_responsable}
    poblacion = int(zone.poblacion_estimada or 0)
    cobertura = round((len(ciudadanos) / poblacion) * 100, 2) if poblacion else 0
    necesidad_visita = len(interacciones) == 0 or cobertura < 2 or supports["indeciso"] + supports["no_responde"] > supports["alto"]
    estimated_census = round(poblacion * 0.72)
    expected_turnout = round(estimated_census * 0.58)
    projected_votes = round((supports["alto"] + supports["medio"] * 0.55 + supports["indeciso"] * 0.18) * 1.0)
    return {
        "zona": zone.nombre,
        "tipo": tipo,
        "poblacion_estimada": poblacion,
        "ciudadanos_captados": len(ciudadanos),
        "apoyo_alto": supports["alto"],
        "apoyo_medio": supports["medio"],
        "apoyo_bajo": supports["bajo"],
        "indecisos": supports["indeciso"],
        "no_responde": supports["no_responde"],
        "porcentaje_cobertura": cobertura,
        "lideres_asociados": len(leaders),
        "interacciones_registradas": len(interacciones),
        "problematicas_reportadas": len(problematicas),
        "problematicas_frecuentes": _problem_ranking(problematicas),
        "ultima_visita": _last_interaction([row for row in interacciones if (row.canal or "").lower() == "visita"]),
        "necesidad_visita": necesidad_visita,
        "clasificacion_territorial": _territory_classification(supports, cobertura, len(interacciones), len(problematicas)),
        "prioridad_territorial": "alta" if necesidad_visita and cobertura < 2 else "media" if necesidad_visita else "seguimiento",
        "censo_estimado": estimated_census,
        "votantes_esperados": expected_turnout,
        "proyeccion_votos": projected_votes,
    }


def build_citizen_operational_indicators(db: Session) -> dict[str, Any]:
    barrios = db.query(Barrio).filter(Barrio.nombre.in_(OFFICIAL_BARRIO_NAMES)).order_by(Barrio.nombre).all()
    veredas = db.query(Vereda).filter(Vereda.nombre.in_(OFFICIAL_VEREDA_NAMES)).order_by(Vereda.nombre).all()
    all_citizens = db.query(CiudadanoCaptado).all()
    support_totals = _support_counts(all_citizens)
    source_counts = Counter(row.fuente_captura or "sin_fuente" for row in all_citizens)
    all_interactions = db.query(InteraccionTerritorial).all()
    all_problems = db.query(Problematica).all()
    temporal: dict[date, int] = defaultdict(int)
    for row in all_citizens:
        if row.fecha_creacion:
            temporal[row.fecha_creacion.date()] += 1

    zones = []
    for barrio in barrios:
        zones.append(
            _zone_indicator(
                barrio,
                "Barrio",
                db.query(CiudadanoCaptado).filter(CiudadanoCaptado.barrio_id == barrio.id).all(),
                db.query(InteraccionTerritorial).filter(InteraccionTerritorial.barrio_id == barrio.id).all(),
                db.query(Problematica).filter(Problematica.barrio_id == barrio.id).all(),
            )
        )
    for vereda in veredas:
        zones.append(
            _zone_indicator(
                vereda,
                "Vereda",
                db.query(CiudadanoCaptado).filter(CiudadanoCaptado.vereda_id == vereda.id).all(),
                db.query(InteraccionTerritorial).filter(InteraccionTerritorial.vereda_id == vereda.id).all(),
                db.query(Problematica).filter(Problematica.vereda_id == vereda.id).all(),
            )
        )

    total_population = sum(row["poblacion_estimada"] for row in zones)
    return {
        "restriccion": "Indicadores agregados por territorio. No expone documentos, teléfonos ni correos.",
        "totales": {
            "ciudadanos_captados": len(all_citizens),
            "apoyo_alto": support_totals["alto"],
            "apoyo_medio": support_totals["medio"],
            "apoyo_bajo": support_totals["bajo"],
            "indecisos": support_totals["indeciso"],
            "no_responde": support_totals["no_responde"],
            "no_apoyos": support_totals["bajo"],
            "interacciones": len(all_interactions),
            "problematicas": len(all_problems),
            "zonas_con_captacion": sum(1 for row in zones if row["ciudadanos_captados"] > 0),
            "zonas_sin_captacion": sum(1 for row in zones if row["ciudadanos_captados"] == 0),
            "zonas_criticas": sum(1 for row in zones if row["clasificacion_territorial"] == "Zona crítica"),
            "zonas_consolidadas": sum(1 for row in zones if row["clasificacion_territorial"] == "Zona consolidada"),
            "cobertura_global": round((len(all_citizens) / total_population) * 100, 2) if total_population else 0,
            "proyeccion_votos": sum(row["proyeccion_votos"] for row in zones),
        },
        "por_zona": sorted(zones, key=lambda row: (row["necesidad_visita"], row["poblacion_estimada"]), reverse=True),
        "lideres": _leader_ranking(all_citizens),
        "variacion_semanal": _weekly_variation(all_citizens),
        "ranking_problematicas": _problem_ranking(all_problems),
        "fuentes_captura": [{"fuente": key, "total": value} for key, value in source_counts.most_common()],
        "evolucion_temporal": [
            {"fecha": key.isoformat(), "captados": value}
            for key, value in sorted(temporal.items(), key=lambda item: item[0])
        ],
    }
