def _public_findings(public_sources: list[dict]) -> list[dict]:
    findings = []
    for source in public_sources:
        for item in source.get("problematicas", []) or []:
            findings.append({
                "categoria": item.get("categoria", "sin categoría"),
                "problematica": item.get("problematica", "problemática sin descripción"),
                "evidencia": item.get("evidencia", "fuente pública registrada"),
                "fuente": source.get("nombre"),
                "url": source.get("url"),
            })
    return findings


def recommend(context: dict) -> dict:
    """Reglas transparentes sobre datos agregados; no perfila personas."""
    participation = float(context.get("participacion", 0) or 0)
    abstention = float(context.get("abstencion", 0) or 0)
    top_problem = context.get("problematica_principal") or "problemática sin clasificar"
    sector = context.get("sector") or "zona sin clasificar"
    objetivo = context.get("objetivo") or "priorizar"
    priority = context.get("prioridad") or "sin prioridad calculada"
    coverage = float(context.get("cobertura", 0) or 0)
    potential = int(context.get("potencial", 0) or 0)
    public_sources = context.get("fuentes_publicas") or []
    internal_problems = context.get("problematicas_agregadas") or []
    findings = _public_findings(public_sources)
    main_finding = findings[0] if findings else None
    main_internal_problem = internal_problems[0] if internal_problems else None
    strategic_topic = (
        main_internal_problem.get("categoria")
        if isinstance(main_internal_problem, dict) and main_internal_problem.get("categoria")
        else main_finding["problematica"]
        if main_finding
        else top_problem
    )

    opportunities = []
    evidence = []
    topics_to_address = []
    if main_finding:
        topics_to_address.append({
            "tema": main_finding["categoria"],
            "que_abordar": main_finding["problematica"],
            "por_que": main_finding["evidencia"],
            "fuente": main_finding["fuente"],
            "accion_candidatura": "Convertir el hallazgo en propuesta verificable por barrio/vereda antes de prometer soluciones.",
        })
    if abstention >= 0.45:
        opportunities.append("Priorizar pedagogía electoral y recorridos de escucha por zona agregada.")
        evidence.append("La abstención agregada ingresada supera el 45%.")
    if participation < 0.55:
        opportunities.append("Diseñar agenda territorial para aumentar participación en sectores de baja concurrencia.")
        evidence.append("La participación agregada ingresada es menor al 55%.")
    if coverage < 3:
        opportunities.append("Aumentar cobertura territorial antes de tomar decisiones de persuasión.")
        evidence.append("La cobertura territorial calculada es inferior al 3%.")
    if potential >= 2000:
        opportunities.append("Asignar equipo de avanzada por potencial electoral agregado relevante.")
        evidence.append(f"Potencial electoral estimado para la zona: {potential}.")

    opportunities.append(f"Conectar propuesta programática con el tema principal detectado: {strategic_topic}.")
    evidence.append(f"Zona analizada: {sector}. Prioridad calculada: {priority}.")
    if main_internal_problem:
        evidence.append(
            f"Problemática agregada interna: {main_internal_problem.get('categoria')} "
            f"({main_internal_problem.get('frecuencia', main_internal_problem.get('reportes', 0))} reportes/frecuencia)."
        )

    if public_sources:
        evidence.append(f"Se cruzó con {len(public_sources)} fuente(s) pública(s) reportada(s) por el módulo.")
    for finding in findings[:3]:
        evidence.append(f"{finding['fuente']}: {finding['problematica']}")

    agenda = [
        f"Visita de escucha en {sector} enfocada en {strategic_topic}.",
        "Registro de hallazgos por barrio/vereda, siempre en forma agregada.",
        "Reunión de cierre para convertir hallazgos en compromisos medibles.",
    ]
    proposal = [
        f"Línea programática sobre {strategic_topic} con indicador territorial.",
        "Tablero público de seguimiento a compromisos por zona.",
        "Priorización de intervenciones donde coincidan baja cobertura, alta severidad y alto potencial.",
    ]
    if not topics_to_address:
        topics_to_address.append({
            "tema": top_problem,
            "que_abordar": f"Diagnóstico territorial sobre {top_problem} en {sector}.",
            "por_que": "Es el tema principal disponible en los datos agregados del sistema.",
            "fuente": "Datos internos agregados",
            "accion_candidatura": "Validar en recorrido, registrar evidencia y priorizar compromisos medibles.",
        })

    return {
        "objetivo": objetivo,
        "sector_analizado": sector,
        "sectores_prioritarios": [sector],
        "temas_que_debe_abordar": topics_to_address,
        "oportunidades": opportunities,
        "agenda_sugerida": agenda,
        "propuesta_programatica": proposal,
        "mensaje_redes": f"En {sector}, la prioridad es escuchar y actuar sobre {strategic_topic} con datos verificables y seguimiento público.",
        "sustento": evidence,
        "advertencia_etica": "Recomendación basada únicamente en información pública, agregada y datos autorizados. No perfila personas.",
    }
