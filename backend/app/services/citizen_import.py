from datetime import datetime, timezone
from typing import Any

import pandas as pd
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.models import Barrio, CiudadanoCaptado, Vereda

REQUIRED_COLUMNS = {"nombres", "apellidos", "fuente_captura", "consentimiento_datos"}


def _clean_text(value: Any) -> str | None:
    if pd.isna(value):
        return None
    text = str(value).strip()
    return text or None


def _bool_value(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if pd.isna(value):
        return False
    return str(value).strip().lower() in {"true", "1", "si", "sí", "s", "yes", "y"}


def _int_value(value: Any) -> int | None:
    if pd.isna(value) or value == "":
        return None
    return int(value)


def _find_territory_id(db: Session, model, value: Any) -> int | None:
    if isinstance(value, (int, float)) and not pd.isna(value):
        record = db.get(model, int(value))
        return record.id if record else None
    text = _clean_text(value)
    if not text:
        return None
    if text.isdigit():
        record = db.get(model, int(text))
        return record.id if record else None
    record = db.query(model).filter(model.nombre.ilike(text)).first()
    return record.id if record else None


def _duplicate_filter(row: dict[str, Any]):
    filters = []
    for field in ("numero_documento", "telefono", "email"):
        value = row.get(field)
        if value:
            filters.append(getattr(CiudadanoCaptado, field) == value)
    return or_(*filters) if filters else None


def import_ciudadanos(file, filename: str, db: Session, usuario_cargue: str = "sistema") -> dict[str, Any]:
    df = pd.read_excel(file) if filename.lower().endswith((".xlsx", ".xls")) else pd.read_csv(file)
    df.columns = [str(column).strip().lower() for column in df.columns]

    missing = sorted(REQUIRED_COLUMNS - set(df.columns))
    if missing:
        return {"ok": False, "error": f"Columnas obligatorias faltantes: {', '.join(missing)}"}

    resumen: dict[str, Any] = {
        "ok": True,
        "usuario_cargue": usuario_cargue,
        "fecha_cargue": datetime.now(timezone.utc).isoformat(),
        "filas_recibidas": int(len(df)),
        "importados": 0,
        "duplicados": 0,
        "rechazados_sin_consentimiento": 0,
        "rechazados_sin_territorio": 0,
        "rechazados_sin_fuente": 0,
        "errores": [],
    }

    for index, raw in df.iterrows():
        row = {column: _clean_text(raw.get(column)) for column in df.columns}
        consentimiento = _bool_value(raw.get("consentimiento_datos"))

        if not consentimiento:
            resumen["rechazados_sin_consentimiento"] += 1
            resumen["errores"].append({"fila": int(index) + 2, "error": "Registro sin consentimiento_datos=true"})
            continue

        if not row.get("telefono") and not row.get("numero_documento") and not row.get("email"):
            resumen["errores"].append({"fila": int(index) + 2, "error": "Debe incluir teléfono, número de documento o correo electrónico"})
            continue

        if not row.get("fuente_captura"):
            resumen["rechazados_sin_fuente"] += 1
            resumen["errores"].append({"fila": int(index) + 2, "error": "fuente_captura es obligatoria"})
            continue

        barrio_id = _find_territory_id(db, Barrio, raw.get("barrio_id") or raw.get("barrio"))
        vereda_id = _find_territory_id(db, Vereda, raw.get("vereda_id") or raw.get("vereda"))
        if not barrio_id and not vereda_id:
            resumen["rechazados_sin_territorio"] += 1
            resumen["errores"].append({"fila": int(index) + 2, "error": "Debe asociar barrio_id/barrio o vereda_id/vereda"})
            continue
        if barrio_id and vereda_id:
            resumen["errores"].append({"fila": int(index) + 2, "error": "Use barrio o vereda, no ambos"})
            continue

        duplicate_filter = _duplicate_filter(row)
        if duplicate_filter is not None and db.query(CiudadanoCaptado).filter(duplicate_filter).first():
            resumen["duplicados"] += 1
            resumen["errores"].append({"fila": int(index) + 2, "error": "Duplicado por documento, teléfono o correo electrónico"})
            continue

        ciudadano = CiudadanoCaptado(
            nombres=row.get("nombres") or "",
            apellidos=row.get("apellidos") or "",
            tipo_documento=row.get("tipo_documento"),
            numero_documento=row.get("numero_documento"),
            telefono=row.get("telefono"),
            email=row.get("email"),
            barrio_id=barrio_id,
            vereda_id=vereda_id,
            direccion_referencia=row.get("direccion_referencia"),
            edad=_int_value(raw.get("edad")),
            sexo=row.get("sexo"),
            ocupacion=row.get("ocupacion"),
            segmento=row.get("segmento"),
            fuente_captura=row.get("fuente_captura") or "cargue_masivo",
            lider_responsable=row.get("lider_responsable"),
            consentimiento_datos=True,
            fecha_consentimiento=datetime.now(timezone.utc),
            observaciones=row.get("observaciones"),
            estado_contacto=row.get("estado_contacto") or "pendiente",
            nivel_apoyo=(row.get("nivel_apoyo") or "indeciso").lower(),
        )
        db.add(ciudadano)
        resumen["importados"] += 1

    db.commit()
    return resumen
