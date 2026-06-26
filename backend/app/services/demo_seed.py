from __future__ import annotations

import random
import unicodedata
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.models import Barrio, CiudadanoCaptado, InteraccionTerritorial, Problematica, Vereda


DEMO_SOURCE = "demo_funza_2027"
DEMO_MARKER = "[DEMO FUNZA 2027]"

FIRST_NAMES = [
    "Andres", "Camila", "Daniel", "Laura", "Sebastian", "Paula", "Julian", "Marcela",
    "Felipe", "Carolina", "Santiago", "Natalia", "Jorge", "Diana", "Mateo", "Valentina",
    "Oscar", "Adriana", "Cristian", "Luisa", "Diego", "Alejandra", "Hernan", "Patricia",
]
LAST_NAMES = [
    "Garcia", "Rodriguez", "Martinez", "Lopez", "Gomez", "Perez", "Sanchez", "Ramirez",
    "Torres", "Diaz", "Moreno", "Rojas", "Castro", "Vargas", "Herrera", "Jimenez",
]
LEADERS = [
    "Equipo Centro", "Liderazgo Aurora", "Coordinacion Occidental", "Red Joven Bacata",
    "Equipo Rural", "Comando Programatico", "Voluntariado Funza",
]
OCCUPATIONS = ["comerciante", "empleado", "independiente", "estudiante", "docente", "conductor", "ama de casa", "tecnico"]
CHANNELS = ["visita", "llamada", "whatsapp", "reunion", "evento"]


def _normalize(value: str) -> str:
    value = value.replace("Ã¡", "a").replace("Ã©", "e").replace("Ã­", "i").replace("Ã³", "o").replace("Ãº", "u")
    value = value.replace("Ã±", "n").replace("Ã", "i")
    value = unicodedata.normalize("NFD", value)
    return "".join(char for char in value if unicodedata.category(char) != "Mn").lower().strip()


def _catalog(db: Session, model) -> dict[str, Any]:
    return {_normalize(row.nombre): row for row in db.query(model).all()}


def _find(catalog: dict[str, Any], *names: str):
    for name in names:
        found = catalog.get(_normalize(name))
        if found:
            return found
    normalized_names = [_normalize(name) for name in names]
    for key, row in catalog.items():
        if any(name in key or key in name for name in normalized_names):
            return row
    raise ValueError(f"No se encontro territorio demo: {names[0]}")


def delete_demo_dataset(db: Session) -> dict[str, int]:
    demo_citizens = db.query(CiudadanoCaptado).filter(CiudadanoCaptado.fuente_captura == DEMO_SOURCE).all()
    citizen_ids = [row.id for row in demo_citizens]

    interaction_query = db.query(InteraccionTerritorial).filter(
        or_(
            InteraccionTerritorial.responsable == DEMO_SOURCE,
            InteraccionTerritorial.descripcion.ilike(f"%{DEMO_MARKER}%"),
            InteraccionTerritorial.ciudadano_id.in_(citizen_ids) if citizen_ids else False,
        )
    )
    problem_query = db.query(Problematica).filter(
        or_(
            Problematica.fuente == DEMO_SOURCE,
            Problematica.evidencia.ilike(f"%{DEMO_MARKER}%"),
            Problematica.descripcion.ilike(f"%{DEMO_MARKER}%"),
        )
    )

    deleted_interactions = interaction_query.count()
    deleted_problems = problem_query.count()
    deleted_citizens = len(demo_citizens)

    interaction_query.delete(synchronize_session=False)
    problem_query.delete(synchronize_session=False)
    db.query(CiudadanoCaptado).filter(CiudadanoCaptado.fuente_captura == DEMO_SOURCE).delete(synchronize_session=False)
    db.commit()
    return {"ciudadanos": deleted_citizens, "interacciones": deleted_interactions, "problematicas": deleted_problems}


def _support_pool(profile: str) -> list[str]:
    profiles = {
        "consolidado": ["alto"] * 62 + ["medio"] * 24 + ["indeciso"] * 10 + ["bajo"] * 4,
        "prioritario": ["indeciso"] * 58 + ["medio"] * 18 + ["alto"] * 14 + ["bajo"] * 10,
        "critico": ["bajo"] * 45 + ["indeciso"] * 35 + ["medio"] * 12 + ["alto"] * 8,
        "crecimiento": ["medio"] * 42 + ["alto"] * 30 + ["indeciso"] * 24 + ["bajo"] * 4,
        "rural": ["medio"] * 34 + ["indeciso"] * 32 + ["alto"] * 24 + ["bajo"] * 10,
        "base": ["indeciso"] * 36 + ["medio"] * 28 + ["alto"] * 24 + ["bajo"] * 12,
    }
    return profiles[profile]


def _created_at(profile: str, index: int) -> datetime:
    now = datetime.utcnow()
    if profile == "crecimiento":
        return now - timedelta(days=index % 8)
    if profile == "consolidado":
        return now - timedelta(days=15 + index % 38)
    if profile == "critico":
        return now - timedelta(days=20 + index % 30)
    return now - timedelta(days=5 + index % 45)


def _add_citizens(db: Session, rng: random.Random, zone: Any, kind: str, count: int, profile: str, serial_start: int) -> list[CiudadanoCaptado]:
    citizens: list[CiudadanoCaptado] = []
    support_pool = _support_pool(profile)
    for index in range(count):
        first = FIRST_NAMES[(serial_start + index) % len(FIRST_NAMES)]
        last = LAST_NAMES[(serial_start * 3 + index) % len(LAST_NAMES)]
        support = rng.choice(support_pool)
        created_at = _created_at(profile, index)
        phone = f"3009{serial_start:03d}{index:03d}"[-10:]
        citizen = CiudadanoCaptado(
            nombres=first,
            apellidos=f"{last} Demo",
            tipo_documento="CC",
            numero_documento=f"DEMO-{serial_start:03d}-{index:04d}",
            telefono=phone,
            email=f"demo.{serial_start}.{index}@funza2027.local",
            barrio_id=zone.id if kind == "Barrio" else None,
            vereda_id=zone.id if kind == "Vereda" else None,
            direccion_referencia=f"Referencia territorial {zone.nombre}",
            edad=rng.randint(18, 72),
            sexo=rng.choice(["F", "M"]),
            ocupacion=rng.choice(OCCUPATIONS),
            segmento=rng.choice(["joven", "familia", "comercio", "liderazgo", "adulto mayor"]),
            fuente_captura=DEMO_SOURCE,
            lider_responsable=rng.choice(LEADERS),
            consentimiento_datos=True,
            fecha_consentimiento=created_at,
            observaciones=f"{DEMO_MARKER} Registro ficticio para probar inteligencia territorial.",
            estado_contacto=rng.choice(["pendiente", "contactado", "seguimiento", "cerrado"]),
            nivel_apoyo=support,
            fecha_creacion=created_at,
            fecha_actualizacion=created_at,
        )
        db.add(citizen)
        citizens.append(citizen)
    db.flush()
    return citizens


def _add_interactions(db: Session, rng: random.Random, citizens: list[CiudadanoCaptado], zone: Any, kind: str, count: int, tema: str):
    for index, citizen in enumerate(citizens[:count]):
        db.add(
            InteraccionTerritorial(
                ciudadano_id=citizen.id,
                barrio_id=zone.id if kind == "Barrio" else None,
                vereda_id=zone.id if kind == "Vereda" else None,
                tipo_interaccion=rng.choice(["seguimiento", "escucha", "validacion territorial"]),
                canal=rng.choice(CHANNELS),
                tema=tema,
                descripcion=f"{DEMO_MARKER} Interaccion ficticia para lectura agregada de {zone.nombre}.",
                responsable=DEMO_SOURCE,
                fecha=citizen.fecha_creacion + timedelta(days=rng.randint(0, 4)),
                resultado=rng.choice(["Interes en propuesta", "Requiere seguimiento", "Solicita visita", "Compromiso programatico"]),
                requiere_seguimiento=rng.choice([True, False]),
                fecha_seguimiento=datetime.utcnow() + timedelta(days=7 + index % 12),
            )
        )


def _add_problem(db: Session, zone: Any, kind: str, categoria: str, descripcion: str, severity: int, frequency: int):
    db.add(
        Problematica(
            categoria=categoria,
            descripcion=f"{DEMO_MARKER} {descripcion}",
            severidad=severity,
            frecuencia=frequency,
            fuente=DEMO_SOURCE,
            evidencia=f"{DEMO_MARKER} Evidencia ficticia agregada para demostracion.",
            responsable="Equipo DEMO",
            estado="abierta" if severity >= 4 else "en_revision",
            barrio_id=zone.id if kind == "Barrio" else None,
            vereda_id=zone.id if kind == "Vereda" else None,
            fecha=datetime.utcnow() - timedelta(days=max(1, 12 - severity)),
        )
    )


def load_demo_dataset(db: Session) -> dict[str, int]:
    delete_demo_dataset(db)
    rng = random.Random(2027)
    barrios = _catalog(db, Barrio)
    veredas = _catalog(db, Vereda)

    scenarios = [
        (_find(barrios, "Centro"), "Barrio", 66, "consolidado", "confianza comunitaria"),
        (_find(barrios, "La Aurora"), "Barrio", 58, "prioritario", "indecisos y agenda social"),
        (_find(barrios, "Serrezuelita"), "Barrio", 14, "critico", "seguridad y servicios publicos"),
        (_find(barrios, "Bacata Cacique", "Bacatá Cacique", "BacatÃ¡ Cacique"), "Barrio", 42, "crecimiento", "crecimiento juvenil"),
        (_find(veredas, "Tienda Nueva"), "Vereda", 28, "rural", "agenda rural"),
        (_find(veredas, "El Cocli", "El Coclí", "El CoclÃ­"), "Vereda", 20, "rural", "movilidad rural"),
        (_find(barrios, "El Prado"), "Barrio", 12, "base", "seguimiento territorial"),
        (_find(barrios, "Porvenir"), "Barrio", 11, "base", "escucha comunitaria"),
        (_find(barrios, "Nuevo Mexico", "Nuevo México", "Nuevo MÃ©xico"), "Barrio", 10, "base", "servicios publicos"),
        (_find(barrios, "Popular"), "Barrio", 9, "base", "seguridad"),
        (_find(barrios, "Villa Diana"), "Barrio", 8, "base", "movilidad"),
        (_find(veredas, "San Antonio Los Pinos"), "Vereda", 7, "rural", "produccion rural"),
    ]

    all_citizens: list[CiudadanoCaptado] = []
    serial = 1
    for zone, kind, count, profile, tema in scenarios:
        citizens = _add_citizens(db, rng, zone, kind, count, profile, serial)
        all_citizens.extend(citizens)
        interaction_count = max(3, min(len(citizens), round(count * (0.72 if profile in {"consolidado", "crecimiento"} else 0.42))))
        _add_interactions(db, rng, citizens, zone, kind, interaction_count, tema)
        serial += 1

    problem_plan = [
        ("Serrezuelita", "Barrio", "seguridad", "Percepcion de inseguridad en recorridos barriales y necesidad de presencia institucional.", 5, 18),
        ("Serrezuelita", "Barrio", "servicios publicos", "Reportes recurrentes sobre alumbrado y estado de vias internas.", 4, 11),
        ("La Aurora", "Barrio", "movilidad", "Preocupacion por tiempos de desplazamiento y conexion con zonas de trabajo.", 3, 14),
        ("La Aurora", "Barrio", "empleo", "Solicitud de oportunidades de empleo y formacion tecnica para hogares jovenes.", 3, 9),
        ("Centro", "Barrio", "espacio publico", "Necesidad de ordenar comercio, parqueo y uso del espacio publico.", 2, 7),
        ("Bacata Cacique", "Barrio", "educacion", "Interes en actividades juveniles, cultura y refuerzo educativo.", 2, 6),
        ("Tienda Nueva", "Vereda", "movilidad", "Dificultades de transporte rural y acceso a servicios municipales.", 4, 10),
        ("El Cocli", "Vereda", "medio ambiente", "Inquietudes sobre manejo ambiental, vias rurales y relacion con actividades productivas.", 3, 8),
        ("San Antonio Los Pinos", "Vereda", "servicios publicos", "Necesidad de seguimiento a servicios rurales y conectividad.", 3, 5),
    ]
    for name, kind, category, description, severity, frequency in problem_plan:
        catalog = barrios if kind == "Barrio" else veredas
        zone = _find(catalog, name, "Bacatá Cacique", "BacatÃ¡ Cacique", "El Coclí", "El CoclÃ­")
        _add_problem(db, zone, kind, category, description, severity, frequency)

    db.commit()
    return {
        "ciudadanos": len(all_citizens),
        "interacciones": db.query(InteraccionTerritorial).filter(InteraccionTerritorial.responsable == DEMO_SOURCE).count(),
        "problematicas": db.query(Problematica).filter(Problematica.fuente == DEMO_SOURCE).count(),
    }


def demo_status(db: Session) -> dict[str, int | bool]:
    citizens = db.query(CiudadanoCaptado).filter(CiudadanoCaptado.fuente_captura == DEMO_SOURCE).count()
    interactions = db.query(InteraccionTerritorial).filter(InteraccionTerritorial.responsable == DEMO_SOURCE).count()
    problems = db.query(Problematica).filter(Problematica.fuente == DEMO_SOURCE).count()
    return {"activo": citizens > 0, "ciudadanos": citizens, "interacciones": interactions, "problematicas": problems}
