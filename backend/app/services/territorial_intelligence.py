from collections import Counter, defaultdict
from statistics import mean
from typing import Any

from sqlalchemy.orm import Session

from app.models.models import Barrio, CiudadanoCaptado, InteraccionTerritorial, Problematica, Vereda


APOYO_KEYS = {"alto", "medio", "bajo", "indeciso", "no_responde"}
OFFICIAL_BARRIO_NAMES = {
    "Siete Trojes", "Santa Teresita", "Villa Paúl", "El Lago", "El Palmar", "Miraflores",
    "Bacatá Cacique", "La Chaguya", "El Prado", "Centro", "Serenas", "Villa Adriana",
    "La Aurora", "El Pensamiento", "Bellisca", "México", "Serrezuelita", "Popular",
    "Porvenir", "La Fortuna", "Samarkanda", "Hato Casablanca", "Hato Sector I",
    "Hato Sector II", "Francisco Martínez Rico", "Nuevo México", "El Sol", "Tisquesusa",
    "Nueva Gerona", "Villa Paola", "El Dorado", "Villa Diana", "Renacer", "Ciudad Jardín",
    "Senderos de Funza", "Altos de Gualí", "Prados de San Andrés", "Villas de San Andrés",
    "Portal de San Andrés",
}
OFFICIAL_VEREDA_NAMES = {"El Cacique", "La Florida", "El Coclí", "El Papayo", "San Antonio Los Pinos", "Tienda Nueva"}


def _support_counts(ciudadanos: list[CiudadanoCaptado]) -> dict[str, int]:
    counts = {key: 0 for key in APOYO_KEYS}
    for ciudadano in ciudadanos:
        level = (ciudadano.nivel_apoyo or "indeciso").strip().lower()
        counts[level if level in counts else "indeciso"] += 1
    return counts


def _problem_stats(problematicas: list[Problematica]) -> tuple[list[dict[str, Any]], float]:
    grouped: dict[str, dict[str, Any]] = defaultdict(lambda: {"categoria": "", "casos": 0, "frecuencia": 0, "severidades": []})
    for problema in problematicas:
        categoria = (problema.categoria or "sin_categoria").strip().lower()
        grouped[categoria]["categoria"] = categoria
        grouped[categoria]["casos"] += 1
        grouped[categoria]["frecuencia"] += int(problema.frecuencia or 1)
        grouped[categoria]["severidades"].append(int(problema.severidad or 1))

    ranking = []
    all_severities = []
    for item in grouped.values():
        all_severities.extend(item["severidades"])
        ranking.append(
            {
                "categoria": item["categoria"],
                "casos": item["casos"],
                "frecuencia": item["frecuencia"],
                "severidad_promedio": round(mean(item["severidades"]), 2) if item["severidades"] else 0,
            }
        )
    ranking.sort(key=lambda row: (row["frecuencia"], row["severidad_promedio"], row["casos"]), reverse=True)
    return ranking, round(mean(all_severities), 2) if all_severities else 0


def _priority(row: dict[str, Any]) -> tuple[str, int, list[str]]:
    score = 0
    reasons: list[str] = []

    if row["cobertura_territorial"] < 1:
        score += 30
        reasons.append("cobertura territorial menor al 1%")
    elif row["cobertura_territorial"] < 3:
        score += 20
        reasons.append("cobertura territorial baja")

    if row["ciudadanos_captados"] == 0 and row["interacciones"] == 0:
        score += 25
        reasons.append("zona sin registros de captacion ni interaccion")

    if row["indecisos"] > row["apoyos_altos"]:
        score += 15
        reasons.append("indecisos superan apoyos altos")

    if row["rechazos_apoyos_bajos"] > row["apoyos_altos"]:
        score += 12
        reasons.append("rechazos o apoyos bajos superan apoyos altos")

    if row["no_responde"] > row["apoyos_altos"] and row["ciudadanos_captados"] > 0:
        score += 8
        reasons.append("registros sin respuesta superan apoyos altos")

    if row["severidad_promedio"] >= 4:
        score += 18
        reasons.append("severidad promedio alta en problemáticas")
    elif row["severidad_promedio"] >= 3:
        score += 10
        reasons.append("severidad promedio media-alta")

    if row["potencial_electoral_estimado"] >= 4000:
        score += 10
        reasons.append("potencial electoral agregado alto")

    if row["ciudadanos_captados"] == 0 and row["interacciones"] == 0:
        classification = "Zona por conquistar"
    elif row["severidad_promedio"] >= 4 and row["cobertura_territorial"] < 3:
        classification = "Zona crítica"
    elif row["cobertura_territorial"] >= 5 and row["apoyos_altos"] >= (row["apoyos_medios"] + row["indecisos"] + row["rechazos_apoyos_bajos"]):
        classification = "Zona consolidada"
    elif score >= 55:
        classification = "Zona prioritaria"
    elif score >= 30:
        classification = "Zona en crecimiento"
    elif row["apoyos_altos"] + row["apoyos_medios"] > row["indecisos"] + row["rechazos_apoyos_bajos"]:
        classification = "Zona favorable"
    else:
        classification = "Zona por conquistar"

    return classification, score, reasons


def _recommendations(row: dict[str, Any]) -> list[str]:
    recommendations = []
    if row["ciudadanos_captados"] == 0:
        recommendations.append("Programar primer recorrido de reconocimiento y registro autorizado de contactos.")
    if row["indecisos"] > 0:
        recommendations.append("Preparar mensaje pedagógico para indecisos con base en problemáticas registradas.")
    if row["rechazos_apoyos_bajos"] > row["apoyos_altos"]:
        recommendations.append("Realizar escucha comunitaria antes de acciones persuasivas; hay senales de resistencia.")
    if row["problematica_principal"]:
        recommendations.append(f"Priorizar propuesta programática sobre {row['problematica_principal']}.")
    if row["interacciones"] == 0:
        recommendations.append("Asignar responsable territorial y registrar interacciones de seguimiento.")
    if not recommendations:
        recommendations.append("Mantener seguimiento y medir evolucion semanal de cobertura y apoyos agregados.")
    return recommendations


def _zone_row(nombre: str, tipo: str, poblacion: int, ciudadanos: list[CiudadanoCaptado], interacciones: list[InteraccionTerritorial], problematicas: list[Problematica]) -> dict[str, Any]:
    supports = _support_counts(ciudadanos)
    problem_ranking, severity_avg = _problem_stats(problematicas)
    coverage = round((len(ciudadanos) / poblacion) * 100, 2) if poblacion else 0
    estimated_census = round(poblacion * 0.72)
    expected_turnout = round(estimated_census * 0.58)
    base_opportunity = max(0, expected_turnout - supports["alto"] - supports["medio"])
    potential = max(0, round(base_opportunity * (1 - min(coverage, 25) / 100)))
    row = {
        "zona": nombre,
        "tipo": tipo,
        "poblacion_estimada": poblacion,
        "ciudadanos_captados": len(ciudadanos),
        "apoyos_altos": supports["alto"],
        "apoyos_medios": supports["medio"],
        "indecisos": supports["indeciso"],
        "rechazos_apoyos_bajos": supports["bajo"],
        "no_responde": supports["no_responde"],
        "interacciones": len(interacciones),
        "problematicas_total": len(problematicas),
        "problematicas_frecuentes": problem_ranking[:3],
        "problematica_principal": problem_ranking[0]["categoria"] if problem_ranking else None,
        "severidad_promedio": severity_avg,
        "cobertura_territorial": coverage,
        "potencial_electoral_estimado": potential,
    }
    classification, score, reasons = _priority(row)
    row["nivel_prioridad_territorial"] = classification
    row["puntaje_prioridad"] = score
    row["justificacion"] = reasons
    row["recomendaciones"] = _recommendations(row)
    return row


def calculate_territorial_intelligence(db: Session) -> dict[str, Any]:
    rows: list[dict[str, Any]] = []
    for barrio in db.query(Barrio).filter(Barrio.nombre.in_(OFFICIAL_BARRIO_NAMES)).order_by(Barrio.nombre).all():
        rows.append(
            _zone_row(
                barrio.nombre,
                "Barrio",
                barrio.poblacion_estimada or 0,
                db.query(CiudadanoCaptado).filter(CiudadanoCaptado.barrio_id == barrio.id).all(),
                db.query(InteraccionTerritorial).filter(InteraccionTerritorial.barrio_id == barrio.id).all(),
                db.query(Problematica).filter(Problematica.barrio_id == barrio.id).all(),
            )
        )
    for vereda in db.query(Vereda).filter(Vereda.nombre.in_(OFFICIAL_VEREDA_NAMES)).order_by(Vereda.nombre).all():
        rows.append(
            _zone_row(
                vereda.nombre,
                "Vereda",
                vereda.poblacion_estimada or 0,
                db.query(CiudadanoCaptado).filter(CiudadanoCaptado.vereda_id == vereda.id).all(),
                db.query(InteraccionTerritorial).filter(InteraccionTerritorial.vereda_id == vereda.id).all(),
                db.query(Problematica).filter(Problematica.vereda_id == vereda.id).all(),
            )
        )

    priority_counts = Counter(row["nivel_prioridad_territorial"] for row in rows)
    problem_totals: dict[str, dict[str, Any]] = defaultdict(lambda: {"categoria": "", "casos": 0, "frecuencia": 0, "zonas": 0})
    for row in rows:
        for problema in row["problematicas_frecuentes"]:
            category = problema["categoria"]
            problem_totals[category]["categoria"] = category
            problem_totals[category]["casos"] += problema["casos"]
            problem_totals[category]["frecuencia"] += problema["frecuencia"]
            problem_totals[category]["zonas"] += 1

    ranking_problematicas = sorted(problem_totals.values(), key=lambda item: (item["frecuencia"], item["casos"]), reverse=True)
    ordered_rows = sorted(rows, key=lambda row: (row["puntaje_prioridad"], row["potencial_electoral_estimado"]), reverse=True)
    totals = {
        "zonas": len(rows),
        "poblacion_estimada": sum(row["poblacion_estimada"] for row in rows),
        "ciudadanos_captados": sum(row["ciudadanos_captados"] for row in rows),
        "apoyos_altos": sum(row["apoyos_altos"] for row in rows),
        "apoyos_medios": sum(row["apoyos_medios"] for row in rows),
        "indecisos": sum(row["indecisos"] for row in rows),
        "rechazos_apoyos_bajos": sum(row["rechazos_apoyos_bajos"] for row in rows),
        "no_responde": sum(row["no_responde"] for row in rows),
        "interacciones": sum(row["interacciones"] for row in rows),
        "problematicas": sum(row["problematicas_total"] for row in rows),
        "potencial_electoral_estimado": sum(row["potencial_electoral_estimado"] for row in rows),
        "cobertura_promedio": round(mean([row["cobertura_territorial"] for row in rows]), 2) if rows else 0,
    }
    recommendations = []
    for row in ordered_rows[:5]:
        recommendations.append(
            {
                "zona": row["zona"],
                "tipo": row["tipo"],
                "prioridad": row["nivel_prioridad_territorial"],
                "recomendacion": row["recomendaciones"][0],
                "sustento": row["justificacion"][:3],
            }
        )

    return {
        "fuente": "Cálculo agregado interno con ciudadanos autorizados, interacciones, problemáticas y catálogo territorial.",
        "restricciones": "No incluye datos personales ni perfilamiento individual; todos los resultados se agregan por barrio o vereda.",
        "totales": totals,
        "distribucion_prioridad": dict(priority_counts),
        "ranking_problematicas": ranking_problematicas,
        "zonas": ordered_rows,
        "recomendaciones": recommendations,
    }


def priority_zones(intelligence: dict[str, Any]) -> list[dict[str, Any]]:
    priority_names = {"Zona crítica", "Zona prioritaria", "Zona en crecimiento", "Zona por conquistar"}
    return [row for row in intelligence["zonas"] if row["nivel_prioridad_territorial"] in priority_names]


def opportunities(intelligence: dict[str, Any]) -> list[dict[str, Any]]:
    rows = []
    for row in intelligence["zonas"]:
        if row["potencial_electoral_estimado"] <= 0:
            continue
        rows.append(
            {
                "zona": row["zona"],
                "tipo": row["tipo"],
                "oportunidad": "Cobertura baja con potencial electoral agregado",
                "potencial_electoral_estimado": row["potencial_electoral_estimado"],
                "cobertura_territorial": row["cobertura_territorial"],
                "accion_sugerida": row["recomendaciones"][0],
                "sustento": row["justificacion"],
            }
        )
    return sorted(rows, key=lambda item: item["potencial_electoral_estimado"], reverse=True)[:12]


def alerts(intelligence: dict[str, Any]) -> list[dict[str, Any]]:
    alerts_list = []
    for row in intelligence["zonas"]:
        if row["nivel_prioridad_territorial"] == "Zona crítica":
            alerts_list.append({"nivel": "crítica", "zona": row["zona"], "mensaje": "Alta severidad y baja cobertura territorial.", "sustento": row["justificacion"]})
        elif row["ciudadanos_captados"] == 0:
            alerts_list.append({"nivel": "exploracion", "zona": row["zona"], "mensaje": "Zona sin ciudadanos captados autorizados.", "sustento": row["justificacion"]})
        elif row["rechazos_apoyos_bajos"] > row["apoyos_altos"]:
            alerts_list.append({"nivel": "riesgo", "zona": row["zona"], "mensaje": "Apoyos bajos o rechazos superan apoyos altos.", "sustento": row["justificacion"]})
    return alerts_list[:20]
