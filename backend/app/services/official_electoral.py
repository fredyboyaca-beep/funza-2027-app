from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from urllib.request import Request, urlopen

from sqlalchemy.orm import Session

from app.models.models import Eleccion, ResultadoElectoral


REGISTRADURIA_FUNZA_2023_URL = "https://resultados.registraduria.gov.co/alcalde/126/colombia/cundinamarca/funza"
ELECTORAL_PUBLIC_SOURCES = [
    {
        "nombre": "Registraduría Nacional del Estado Civil - histórico de resultados electorales",
        "tipo": "fuente_principal_oficial",
        "uso": "Resultados oficiales agregados, formularios E-26 y documentos electorales históricos.",
        "url": "https://www.registraduria.gov.co/-Historico-de-Resultados-.html",
    },
    {
        "nombre": "Registraduría Nacional - resultados oficiales elecciones territoriales 2023 Funza",
        "tipo": "fuente_principal_oficial",
        "uso": "Candidatos, votos obtenidos y movimiento/aval reportado para Alcaldía de Funza 2023.",
        "url": REGISTRADURIA_FUNZA_2023_URL,
    },
    {
        "nombre": "Consejo Nacional Electoral - Resolución 6506 de 2023 Funza",
        "tipo": "validacion_proceso_electoral",
        "uso": "Contexto oficial sobre proceso electoral e inscripción de cédulas en Funza.",
        "url": "https://www.cne.gov.co/",
    },
    {
        "nombre": "Wikipedia",
        "tipo": "indice_no_definitivo",
        "uso": "Solo índice inicial para ubicar información; no se usa como fuente definitiva de resultados.",
        "url": "https://es.wikipedia.org/",
    },
]


HISTORICAL_MAYOR_RESULTS = [
    {
        "anio": 2011,
        "nombre": "Alcaldía Funza 2011",
        "fuente": "Registraduría Nacional - Elecciones regionales 2011 Funza Alcalde",
        "url": "https://wapp.registraduria.gov.co/e26/2011/",
        "total_votos": 32588,
        "censo_electoral": 0,
        "resultados": [
            {"candidato": "Jorge Enrique Machuca López", "partido": "Movimiento/coalición oficial pendiente de validar", "votos": 16224},
            {"candidato": "Diego Fernando Mora Herrera", "partido": "Movimiento/partido pendiente de validar", "votos": 12389},
            {"candidato": "Carlos Julio Buitrago Gonzalez", "partido": "Movimiento/partido pendiente de validar", "votos": 593},
            {"candidato": "Votos no marcados", "partido": "No marcado", "votos": 671},
            {"candidato": "Votos nulos", "partido": "Nulo", "votos": 835},
            {"candidato": "Votos en blanco", "partido": "Blanco", "votos": 1876},
        ],
    },
    {
        "anio": 2015,
        "nombre": "Alcaldía Funza 2015",
        "fuente": "Registraduría Nacional - Elecciones de autoridades locales 2015 Funza Alcalde",
        "url": "https://wapp.registraduria.gov.co/e26/2015/",
        "total_votos": 39254,
        "censo_electoral": 0,
        "resultados": [
            {"candidato": "Manuel Antonio Montagu Briceno", "partido": "Movimiento/coalicion oficial pendiente de validar", "votos": 22407},
            {"candidato": "Oscar Javier Uribe Quintero", "partido": "Movimiento/partido pendiente de validar", "votos": 6664},
            {"candidato": "Diego Fernando Mora Herrera", "partido": "Movimiento/partido pendiente de validar", "votos": 6079},
            {"candidato": "Comité Promotor Voto En Blanco", "partido": "Comité promotor voto en blanco", "votos": 229},
            {"candidato": "Votos no marcados", "partido": "No marcado", "votos": 729},
            {"candidato": "Votos nulos", "partido": "Nulo", "votos": 1032},
            {"candidato": "Votos en blanco", "partido": "Blanco", "votos": 2114},
        ],
    },
    {
        "anio": 2019,
        "nombre": "Alcaldía Funza 2019",
        "fuente": "Registraduría Nacional - Elecciones regionales 2019 Funza Alcalde",
        "url": "https://wapp.registraduria.gov.co/e26/2019/",
        "total_votos": 45709,
        "censo_electoral": 0,
        "resultados": [
            {"candidato": "Daniel Felipe Bernal Montealegre", "partido": "Coalición Contigo, Funza Evoluciona", "votos": 18704, "partidos_alianza": ["Cambio Radical", "Alianza Social Independiente", "Alianza Verde", "Partido Conservador", "Partido Liberal", "AICO", "Partido de la U"]},
            {"candidato": "Oscar Javier Uribe Quintero", "partido": "Movimiento/partido pendiente de validar", "votos": 17681},
            {"candidato": "Guillermo Andres Castro Rozo", "partido": "Movimiento/partido pendiente de validar", "votos": 3093},
            {"candidato": "Carlos Julio Rodriguez Sandoval", "partido": "Movimiento/partido pendiente de validar", "votos": 492},
            {"candidato": "Votos no marcados", "partido": "No marcado", "votos": 617},
            {"candidato": "Votos nulos", "partido": "Nulo", "votos": 1229},
            {"candidato": "Votos en blanco", "partido": "Blanco", "votos": 3893},
        ],
    },
    {
        "anio": 2023,
        "nombre": "Alcaldía Funza 2023",
        "fuente": "Registraduría Nacional - Elecciones territoriales 2023 Funza Alcalde",
        "url": REGISTRADURIA_FUNZA_2023_URL,
        "total_votos": 46872,
        "censo_electoral": 0,
        "resultados": [
            {"candidato": "Jeimmy Sulgey Villamil Buitrago", "partido": "Coalición Funza Evoluciona", "votos": 25534, "partidos_alianza": ["Cambio Radical", "Partido Liberal", "Alianza Verde", "Partido Conservador", "AICO", "Partido de la U", "Partido Demócrata Colombiano", "ASI", "Todos Somos Colombia", "Colombia Justa Libres"]},
            {"candidato": "Bryan Alexis Amaya Sanchez", "partido": "Movimiento/partido pendiente de validar", "votos": 8417},
            {"candidato": "Jhonny Alexander Salamanca Segura", "partido": "Movimiento/partido pendiente de validar", "votos": 3167},
            {"candidato": "Doris Riano Duarte", "partido": "Movimiento/partido pendiente de validar", "votos": 1970},
            {"candidato": "Ana Rosa Carvajal Jimenez", "partido": "Movimiento/partido pendiente de validar", "votos": 766},
            {"candidato": "Votos no marcados", "partido": "No marcado", "votos": 675},
            {"candidato": "Votos nulos", "partido": "Nulo", "votos": 1703},
            {"candidato": "Votos en blanco", "partido": "Blanco", "votos": 4640},
        ],
    },
]


def _probe_url(url: str) -> str:
    request = Request(url, headers={"User-Agent": "FUNZA-2027 electoral intelligence"})
    with urlopen(request, timeout=8) as response:
        return response.read(2000).decode("utf-8", errors="ignore")


def sync_official_results(db: Session) -> dict[str, Any]:
    synced = []
    for election_data in HISTORICAL_MAYOR_RESULTS:
        election = db.query(Eleccion).filter(Eleccion.nombre == election_data["nombre"], Eleccion.anio == election_data["anio"]).first()
        if not election:
            election = Eleccion(
                nombre=election_data["nombre"],
                tipo="alcaldia",
                anio=election_data["anio"],
                total_votos=election_data["total_votos"],
                censo_electoral=election_data["censo_electoral"],
            )
            db.add(election)
            db.flush()
        else:
            election.total_votos = election_data["total_votos"]
            election.censo_electoral = election_data["censo_electoral"]

        for row in election_data["resultados"]:
            exists = db.query(ResultadoElectoral).filter(
                ResultadoElectoral.eleccion_id == election.id,
                ResultadoElectoral.candidato == row["candidato"],
            ).first()
            if not exists:
                db.add(
                    ResultadoElectoral(
                        eleccion_id=election.id,
                        candidato=row["candidato"],
                        partido=row["partido"],
                        votos=row["votos"],
                        sector="Funza",
                    )
                )
            else:
                exists.partido = row["partido"]
                exists.votos = row["votos"]
                exists.sector = "Funza"

        synced.append({"anio": election_data["anio"], "nombre": election_data["nombre"], "url": election_data["url"]})

    db.commit()
    external_status = "referencia_registraduria_configurada"
    try:
        _probe_url(REGISTRADURIA_FUNZA_2023_URL)
        external_status = "registraduria_consultada"
    except Exception:
        external_status = "registraduria_referenciada_sin_descarga"

    return {
        "ok": True,
        "sincronizado_en": datetime.now(timezone.utc).isoformat(),
        "estado_fuente_2023": external_status,
        "fuente_principal": REGISTRADURIA_FUNZA_2023_URL,
        "elecciones": synced,
        "nota": "Resultados municipales oficiales agregados. La discriminación por puesto o mesa se anexará cuando la fuente publique o permita descargar el detalle estructurado.",
    }


def electoral_history(db: Session) -> dict[str, Any]:
    elections = db.query(Eleccion).filter(Eleccion.tipo == "alcaldia").order_by(Eleccion.anio).all()
    rows = []
    for election in elections:
        results = db.query(ResultadoElectoral).filter(ResultadoElectoral.eleccion_id == election.id).all()
        valid_candidates = [
            row for row in results
            if row.candidato.lower() not in {"votos no marcados", "votos nulos", "votos en blanco", "comite promotor voto en blanco"}
        ]
        ordered = sorted(valid_candidates, key=lambda item: item.votos or 0, reverse=True)
        winner = ordered[0] if ordered else None
        second = ordered[1] if len(ordered) > 1 else None
        white = next((row.votos for row in results if row.candidato.lower() == "votos en blanco"), 0)
        null = next((row.votos for row in results if row.candidato.lower() == "votos nulos"), 0)
        unmarked = next((row.votos for row in results if row.candidato.lower() == "votos no marcados"), 0)
        rows.append(
            {
                "id": election.id,
                "anio": election.anio,
                "nombre": election.nombre,
                "total_votos": election.total_votos,
                "censo_electoral": election.censo_electoral,
                "ganador": winner.candidato if winner else None,
                "votos_ganador": winner.votos if winner else 0,
                "segundo": second.candidato if second else None,
                "votos_segundo": second.votos if second else 0,
                "brecha": (winner.votos - second.votos) if winner and second else 0,
                "votos_blanco": white,
                "votos_nulos": null,
                "no_marcados": unmarked,
                "resultados": sorted(
                    [
                        {
                            "candidato": row.candidato,
                            "partido": row.partido,
                            "votos": row.votos,
                            "sector": row.sector,
                            "partidos_alianza": _candidate_meta(election.anio, row.candidato).get("partidos_alianza", []),
                            "confianza_partido": _candidate_meta(election.anio, row.candidato).get("confianza_partido", "pendiente_validacion_oficial"),
                            "relacion_politica": _candidate_meta(election.anio, row.candidato).get("relacion_politica", "pendiente_validacion_oficial"),
                        }
                        for row in results
                    ],
                    key=lambda item: item["votos"],
                    reverse=True,
                ),
            }
        )

    trend = []
    for index, row in enumerate(rows):
        previous = rows[index - 1] if index else None
        trend.append(
            {
                "anio": row["anio"],
                "total_votos": row["total_votos"],
                "votos_ganador": row["votos_ganador"],
                "brecha": row["brecha"],
                "crecimiento_total": row["total_votos"] - previous["total_votos"] if previous else 0,
                "crecimiento_ganador": row["votos_ganador"] - previous["votos_ganador"] if previous else 0,
            }
        )

    return {
        "fuente": "Registraduría Nacional del Estado Civil - resultados electorales territoriales, consolidados municipales.",
        "fuente_2023": REGISTRADURIA_FUNZA_2023_URL,
        "fuentes_consulta": ELECTORAL_PUBLIC_SOURCES,
        "restriccion": "Datos oficiales agregados. No contiene datos personales.",
        "elecciones": rows,
        "tendencia": trend,
        "partidos": party_summary(rows),
        "nota_partidos": "Los partidos de coaliciones 2019 y 2023 se usan como base de comparación. Las candidaturas sin fuente partidista verificada quedan como información en proceso de verificación documental y no se usan para proyección por partido.",
    }


def _candidate_meta(year: int, candidate: str) -> dict[str, Any]:
    for election in HISTORICAL_MAYOR_RESULTS:
        if election["anio"] != year:
            continue
        for row in election["resultados"]:
            if row["candidato"] == candidate:
                meta = dict(row)
                if row.get("partidos_alianza"):
                    meta["confianza_partido"] = "coalicion_validada_fuente_publica"
                    meta["relacion_politica"] = "coalicion_inscrita_o_reportada"
                elif "pendiente" in (row.get("partido") or "").lower():
                    meta["confianza_partido"] = "pendiente_validacion_oficial"
                    meta["relacion_politica"] = "pendiente_validacion_oficial"
                else:
                    meta["confianza_partido"] = "registrado"
                    meta["relacion_politica"] = "aval_oficial_o_movimiento_registrado"
                return meta
    return {}


def party_summary(elections: list[dict[str, Any]]) -> list[dict[str, Any]]:
    totals: dict[str, dict[str, Any]] = {}
    excluded = {"No marcado", "Nulo", "Blanco", "Comite promotor voto en blanco"}
    for election in elections:
        for result in election["resultados"]:
            if result.get("confianza_partido") == "pendiente_validacion_oficial":
                continue
            parties = result.get("partidos_alianza") or [result.get("partido") or "Movimiento/partido pendiente de validar"]
            if result.get("partido") in excluded:
                continue
            distributed_votes = round(result["votos"] / len(parties)) if parties else result["votos"]
            for party in parties:
                if party not in totals:
                    totals[party] = {"partido": party, "votos_total": 0, "participaciones": 0, "anios": [], "metodo": "distribucion_proporcional_en_coalicion"}
                totals[party]["votos_total"] += distributed_votes
                totals[party]["participaciones"] += 1
                totals[party]["anios"].append({"anio": election["anio"], "candidato": result["candidato"], "votos": distributed_votes, "coalicion": result.get("partido")})
    return sorted(totals.values(), key=lambda item: item["votos_total"], reverse=True)
