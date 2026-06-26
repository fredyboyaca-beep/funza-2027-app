from fastapi import FastAPI, Depends, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text, or_
from sqlalchemy.orm import Session
import pandas as pd
from app.core.config import settings
from app.core.security import hash_password, verify_password, create_access_token
from app.db.session import Base, engine, get_db
from app.models.models import *
from app.schemas.schemas import *
from app.services.analytics import simulate, electoral_summary
from app.services.ai_assistant import recommend
from app.services.citizen_indicators import build_citizen_operational_indicators
from app.services.citizen_import import import_ciudadanos
from app.services.demo_seed import delete_demo_dataset, demo_status, load_demo_dataset
from app.services.official_electoral import electoral_history, sync_official_results
from app.services.public_sources import public_problem_sources
from app.services.territorial_intelligence import alerts as intelligence_alerts
from app.services.territorial_intelligence import calculate_territorial_intelligence, opportunities, priority_zones

Base.metadata.create_all(bind=engine)
app = FastAPI(title=settings.PROJECT_NAME, version="1.0.0")
cors_origins = {
    o.strip()
    for o in settings.CORS_ORIGINS.split(",")
    if o.strip()
}
cors_origins.update({
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://funza-2027-app.vercel.app",
})
app.add_middleware(CORSMiddleware, allow_origins=sorted(cors_origins), allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

OFFICIAL_BARRIOS = [
    {"nombre": "Siete Trojes", "poblacion_estimada": 2300, "estrato_promedio": 3.1, "lat": 4.711, "lng": -74.201},
    {"nombre": "Santa Teresita", "poblacion_estimada": 1900, "estrato_promedio": 2.9, "lat": 4.709, "lng": -74.216},
    {"nombre": "Villa Paúl", "poblacion_estimada": 1700, "estrato_promedio": 2.8, "lat": 4.706, "lng": -74.220},
    {"nombre": "El Lago", "poblacion_estimada": 2400, "estrato_promedio": 3.2, "lat": 4.722, "lng": -74.208},
    {"nombre": "El Palmar", "poblacion_estimada": 2300, "estrato_promedio": 2.8, "lat": 4.719, "lng": -74.226},
    {"nombre": "Miraflores", "poblacion_estimada": 1800, "estrato_promedio": 3.0, "lat": 4.714, "lng": -74.205},
    {"nombre": "Bacatá Cacique", "poblacion_estimada": 3100, "estrato_promedio": 3.0, "lat": 4.713, "lng": -74.206},
    {"nombre": "La Chaguya", "poblacion_estimada": 1600, "estrato_promedio": 2.8, "lat": 4.716, "lng": -74.219},
    {"nombre": "El Prado", "poblacion_estimada": 2100, "estrato_promedio": 3.1, "lat": 4.718, "lng": -74.209},
    {"nombre": "Centro", "poblacion_estimada": 4200, "estrato_promedio": 3.0, "lat": 4.716, "lng": -74.211},
    {"nombre": "Serenas", "poblacion_estimada": 1500, "estrato_promedio": 3.0, "lat": 4.720, "lng": -74.213},
    {"nombre": "Villa Adriana", "poblacion_estimada": 1750, "estrato_promedio": 2.8, "lat": 4.707, "lng": -74.218},
    {"nombre": "La Aurora", "poblacion_estimada": 3800, "estrato_promedio": 2.8, "lat": 4.721, "lng": -74.218},
    {"nombre": "El Pensamiento", "poblacion_estimada": 1550, "estrato_promedio": 2.9, "lat": 4.715, "lng": -74.223},
    {"nombre": "Bellisca", "poblacion_estimada": 1350, "estrato_promedio": 2.8, "lat": 4.710, "lng": -74.207},
    {"nombre": "México", "poblacion_estimada": 2900, "estrato_promedio": 2.7, "lat": 4.719, "lng": -74.205},
    {"nombre": "Serrezuelita", "poblacion_estimada": 3100, "estrato_promedio": 3.0, "lat": 4.717, "lng": -74.224},
    {"nombre": "Popular", "poblacion_estimada": 2100, "estrato_promedio": 2.5, "lat": 4.712, "lng": -74.224},
    {"nombre": "Porvenir", "poblacion_estimada": 2800, "estrato_promedio": 2.6, "lat": 4.710, "lng": -74.218},
    {"nombre": "La Fortuna", "poblacion_estimada": 3000, "estrato_promedio": 2.7, "lat": 4.726, "lng": -74.220},
    {"nombre": "Samarkanda", "poblacion_estimada": 1600, "estrato_promedio": 2.9, "lat": 4.722, "lng": -74.222},
    {"nombre": "Hato Casablanca", "poblacion_estimada": 2200, "estrato_promedio": 3.1, "lat": 4.724, "lng": -74.214},
    {"nombre": "Hato Sector I", "poblacion_estimada": 1850, "estrato_promedio": 3.0, "lat": 4.725, "lng": -74.216},
    {"nombre": "Hato Sector II", "poblacion_estimada": 1850, "estrato_promedio": 3.0, "lat": 4.726, "lng": -74.218},
    {"nombre": "Francisco Martínez Rico", "poblacion_estimada": 1450, "estrato_promedio": 2.8, "lat": 4.713, "lng": -74.221},
    {"nombre": "Nuevo México", "poblacion_estimada": 2300, "estrato_promedio": 2.7, "lat": 4.723, "lng": -74.204},
    {"nombre": "El Sol", "poblacion_estimada": 1800, "estrato_promedio": 2.6, "lat": 4.727, "lng": -74.216},
    {"nombre": "Tisquesusa", "poblacion_estimada": 1500, "estrato_promedio": 2.8, "lat": 4.718, "lng": -74.214},
    {"nombre": "Nueva Gerona", "poblacion_estimada": 1500, "estrato_promedio": 2.8, "lat": 4.709, "lng": -74.209},
    {"nombre": "Villa Paola", "poblacion_estimada": 1650, "estrato_promedio": 2.8, "lat": 4.707, "lng": -74.212},
    {"nombre": "El Dorado", "poblacion_estimada": 2700, "estrato_promedio": 3.0, "lat": 4.725, "lng": -74.210},
    {"nombre": "Villa Diana", "poblacion_estimada": 3200, "estrato_promedio": 2.8, "lat": 4.707, "lng": -74.212},
    {"nombre": "Renacer", "poblacion_estimada": 1400, "estrato_promedio": 2.7, "lat": 4.711, "lng": -74.214},
    {"nombre": "Ciudad Jardín", "poblacion_estimada": 2000, "estrato_promedio": 3.1, "lat": 4.719, "lng": -74.217},
    {"nombre": "Senderos de Funza", "poblacion_estimada": 2300, "estrato_promedio": 3.2, "lat": 4.721, "lng": -74.220},
    {"nombre": "Altos de Gualí", "poblacion_estimada": 1600, "estrato_promedio": 3.0, "lat": 4.723, "lng": -74.226},
    {"nombre": "Prados de San Andrés", "poblacion_estimada": 1900, "estrato_promedio": 3.0, "lat": 4.708, "lng": -74.205},
    {"nombre": "Villas de San Andrés", "poblacion_estimada": 1900, "estrato_promedio": 3.0, "lat": 4.709, "lng": -74.204},
    {"nombre": "Portal de San Andrés", "poblacion_estimada": 1700, "estrato_promedio": 3.0, "lat": 4.710, "lng": -74.203},
]

OFFICIAL_VEREDAS = [
    {"nombre": "El Cacique", "poblacion_estimada": 2100, "lat": 4.700, "lng": -74.240},
    {"nombre": "La Florida", "poblacion_estimada": 1800, "lat": 4.730, "lng": -74.230},
    {"nombre": "El Coclí", "poblacion_estimada": 1800, "lat": 4.742, "lng": -74.237},
    {"nombre": "El Papayo", "poblacion_estimada": 1600, "lat": 4.693, "lng": -74.226},
    {"nombre": "San Antonio Los Pinos", "poblacion_estimada": 2800, "lat": 4.704, "lng": -74.232},
    {"nombre": "Tienda Nueva", "poblacion_estimada": 3200, "lat": 4.735, "lng": -74.224},
]

OFFICIAL_BARRIO_NAMES = [item["nombre"] for item in OFFICIAL_BARRIOS]
OFFICIAL_VEREDA_NAMES = [item["nombre"] for item in OFFICIAL_VEREDAS]
TERRITORY_NAME_ALIASES = {
    Barrio: {
        "Bacata": "Bacatá Cacique",
        "Mexico": "México",
        "Nuevo Mexico": "Nuevo México",
        "Villa Paul": "Villa Paúl",
        "El Porvenir": "Porvenir",
        "El Hato": "Hato Casablanca",
        "Prados de Alameda": "Prados de San Andrés",
    },
    Vereda: {
    "El Coclí": "El Coclí",
        "San Antonio": "San Antonio Los Pinos",
    },
}

def _official_query(db: Session, model):
    names = OFFICIAL_BARRIO_NAMES if model is Barrio else OFFICIAL_VEREDA_NAMES
    return db.query(model).filter(model.nombre.in_(names)).order_by(model.nombre)

def _seed_catalog_items(db: Session, model, items: list[dict]):
    aliases = TERRITORY_NAME_ALIASES.get(model, {})
    for old_name, new_name in aliases.items():
        old = db.query(model).filter_by(nombre=old_name).first()
        target = db.query(model).filter_by(nombre=new_name).first()
        if old and not target:
            old.nombre = new_name
    db.flush()
    for item in items:
        existing = db.query(model).filter_by(nombre=item["nombre"]).first()
        if not existing:
            db.add(model(**item))
        else:
            for key, value in item.items():
                if getattr(existing, key, None) in (None, 0, ""):
                    setattr(existing, key, value)

def ensure_schema_compatibility():
    inspector = inspect(engine)
    if "problematicas" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("problematicas")}
    additions = {
        "frecuencia": "INTEGER DEFAULT 1",
        "fuente": "VARCHAR(120)",
        "evidencia": "TEXT",
        "responsable": "VARCHAR(120)",
        "estado": "VARCHAR(40) DEFAULT 'abierta'",
        "lat": "FLOAT",
        "lng": "FLOAT",
        "fecha_actualizacion": "TIMESTAMP DEFAULT NOW()",
    }
    with engine.begin() as conn:
        for name, ddl in additions.items():
            if name not in columns:
                conn.execute(text(f"ALTER TABLE problematicas ADD COLUMN {name} {ddl}"))

def seed_territory_catalog(db: Session):
    _seed_catalog_items(db, Barrio, OFFICIAL_BARRIOS)
    _seed_catalog_items(db, Vereda, OFFICIAL_VEREDAS)

@app.on_event("startup")
def seed():
    ensure_schema_compatibility()
    db = next(get_db())
    for r in ["Administrador", "Analista", "Coordinador Territorial"]:
        if not db.query(Role).filter_by(nombre=r).first(): db.add(Role(nombre=r))
    db.commit()
    admin_role = db.query(Role).filter_by(nombre="Administrador").first()
    admin_email = "admin@funza2027.local"
    admin_password = "Admin123*"
    admin_user = db.query(Usuario).filter_by(email=admin_email).first()
    if not admin_user:
        db.add(Usuario(nombre="Administrador", email=admin_email, password_hash=hash_password(admin_password), role_id=admin_role.id))
    elif not verify_password(admin_password, admin_user.password_hash):
        admin_user.password_hash = hash_password(admin_password)
        admin_user.role_id = admin_role.id
    seed_territory_catalog(db)
    db.commit(); db.close()

@app.get("/health")
def health(): return {"status":"ok", "app": settings.PROJECT_NAME}

@app.get("/")
def root():
    return {
        "status": "ok",
        "app": settings.PROJECT_NAME,
        "message": "Backend FUNZA 2027 operativo",
        "health": "/health",
        "docs": "/docs",
    }

@app.post("/auth/login", response_model=Token)
def login(payload: Login, db: Session = Depends(get_db)):
    user = db.query(Usuario).filter_by(email=payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash): raise HTTPException(401, "Credenciales inválidas")
    role = db.query(Role).get(user.role_id).nombre if user.role_id else "Analista"
    return Token(access_token=create_access_token(user.email, role))

@app.post("/usuarios", response_model=UsuarioOut)
def create_user(payload: UsuarioCreate, db: Session = Depends(get_db)):
    try:
        password_hash = hash_password(payload.password)
    except ValueError:
        raise HTTPException(400, "La contraseña no puede superar 72 bytes")
    user = Usuario(nombre=payload.nombre, email=payload.email, password_hash=password_hash, role_id=payload.role_id)
    db.add(user); db.commit(); db.refresh(user); return user

@app.get("/usuarios")
def users(db: Session = Depends(get_db)): return db.query(Usuario).all()

@app.get("/dashboard")
def dashboard(db: Session = Depends(get_db)):
    barrios = _official_query(db, Barrio).all()
    veredas = _official_query(db, Vereda).all()
    poblacion = sum(x.poblacion_estimada for x in barrios) + sum(x.poblacion_estimada for x in veredas)
    elecciones = db.query(Eleccion).all()
    censo = max([e.censo_electoral for e in elecciones], default=0)
    total_votos = sum(e.total_votos for e in elecciones)
    participacion = round(total_votos / sum(e.censo_electoral for e in elecciones), 3) if elecciones and sum(e.censo_electoral for e in elecciones) else 0
    return {"kpis":{"poblacion_total":poblacion,"censo_electoral":censo,"barrios":len(barrios),"veredas":len(veredas),"participacion_historica":participacion,"abstencion_historica":round(1-participacion,3) if participacion else 0},"piramide":[{"grupo":"18-28","hombres":4800,"mujeres":5100},{"grupo":"29-59","hombres":10400,"mujeres":11200},{"grupo":"60+","hombres":3100,"mujeres":3700}],"crecimiento":[{"anio":2015,"poblacion":76000},{"anio":2019,"poblacion":83500},{"anio":2023,"poblacion":91000},{"anio":2027,"poblacion":98000}]}

@app.get("/demo/estado")
def demo_estado(db: Session = Depends(get_db)):
    return demo_status(db)

@app.post("/demo/cargar")
def demo_cargar(db: Session = Depends(get_db)):
    seed_territory_catalog(db)
    db.commit()
    return {"ok": True, "mensaje": "Datos DEMO cargados correctamente", **load_demo_dataset(db)}

@app.delete("/demo/eliminar")
def demo_eliminar(db: Session = Depends(get_db)):
    return {"ok": True, "mensaje": "Datos DEMO eliminados correctamente", **delete_demo_dataset(db)}

@app.post("/barrios")
def add_barrio(p: BarrioIn, db: Session = Depends(get_db)):
    obj=Barrio(**p.model_dump()); db.add(obj); db.commit(); db.refresh(obj); return obj
@app.get("/barrios")
def get_barrios(db: Session = Depends(get_db)): return _official_query(db, Barrio).all()

@app.post("/veredas")
def add_vereda(p: VeredaIn, db: Session = Depends(get_db)):
    obj=Vereda(**p.model_dump()); db.add(obj); db.commit(); db.refresh(obj); return obj
@app.get("/veredas")
def get_veredas(db: Session = Depends(get_db)): return _official_query(db, Vereda).all()

@app.post("/elecciones")
def add_eleccion(p: EleccionIn, db: Session = Depends(get_db)):
    obj=Eleccion(**p.model_dump()); db.add(obj); db.commit(); db.refresh(obj); return obj
@app.get("/elecciones")
def get_elecciones(db: Session = Depends(get_db)): return db.query(Eleccion).all()

@app.post("/resultados/cargar")
def upload_results(file: UploadFile = File(...), db: Session = Depends(get_db)):
    df = pd.read_excel(file.file) if file.filename.endswith((".xlsx",".xls")) else pd.read_csv(file.file)
    required = {"eleccion_id","candidato","votos"}
    if not required.issubset(df.columns): raise HTTPException(400, "Columnas requeridas: eleccion_id,candidato,votos")
    for _, r in df.iterrows(): db.add(ResultadoElectoral(eleccion_id=int(r.eleccion_id), candidato=str(r.candidato), partido=str(r.get('partido','')), votos=int(r.votos), sector=str(r.get('sector',''))))
    db.commit(); return {"filas_cargadas": len(df)}
@app.get("/resultados/resumen")
def results_summary(db: Session = Depends(get_db)):
    rows=[{"candidato":r.candidato,"votos":r.votos,"sector":r.sector} for r in db.query(ResultadoElectoral).all()]
    return electoral_summary(rows)

@app.post("/electoral/sincronizar-oficial")
def electoral_sincronizar_oficial(db: Session = Depends(get_db)):
    return sync_official_results(db)

@app.get("/electoral/historico")
def electoral_historico(db: Session = Depends(get_db)):
    return electoral_history(db)

@app.get("/indicadores")
def indicadores(db: Session = Depends(get_db)): return db.query(IndicadorDemografico).all()

def _validar_territorio_problematica(db: Session, barrio_id: int | None, vereda_id: int | None):
    if not barrio_id and not vereda_id:
        raise HTTPException(400, "Debe asociar la problematica a un barrio o vereda")
    if barrio_id and vereda_id:
        raise HTTPException(400, "Use barrio_id o vereda_id, no ambos")
    if barrio_id and not db.get(Barrio, barrio_id):
        raise HTTPException(404, "Barrio asociado no encontrado")
    if vereda_id and not db.get(Vereda, vereda_id):
        raise HTTPException(404, "Vereda asociada no encontrada")

@app.post("/problematicas")
def add_problem(p: ProblematicaIn, db: Session = Depends(get_db)):
    _validar_territorio_problematica(db, p.barrio_id, p.vereda_id)
    obj=Problematica(**p.model_dump()); db.add(obj); db.commit(); db.refresh(obj); return obj

@app.get("/problematicas", response_model=list[ProblematicaOut])
def listar_problematicas(categoria: str | None = None, estado: str | None = None, barrio_id: int | None = None, vereda_id: int | None = None, db: Session = Depends(get_db)):
    query = db.query(Problematica)
    if categoria: query = query.filter(Problematica.categoria == categoria)
    if estado: query = query.filter(Problematica.estado == estado)
    if barrio_id: query = query.filter(Problematica.barrio_id == barrio_id)
    if vereda_id: query = query.filter(Problematica.vereda_id == vereda_id)
    return query.order_by(Problematica.fecha.desc()).all()

@app.get("/problematicas/ranking")
def ranking(db: Session = Depends(get_db)):
    rows=db.query(Problematica).all(); data={}
    for x in rows:
        key=(x.categoria or "sin_categoria").strip().lower()
        if key not in data:
            data[key]={"categoria":key,"casos":0,"reportes":0,"puntaje":0}
        data[key]["casos"] += 1
        data[key]["reportes"] += x.frecuencia or 1
        data[key]["puntaje"] += (x.severidad or 1) * (x.frecuencia or 1)
    return sorted(data.values(), key=lambda x:(x["puntaje"], x["reportes"], x["casos"]), reverse=True)

@app.get("/ciudadanos", response_model=list[CiudadanoOut])
def listar_ciudadanos(nivel_apoyo: str | None = None, estado_contacto: str | None = None, barrio_id: int | None = None, vereda_id: int | None = None, q: str | None = None, db: Session = Depends(get_db)):
    query = db.query(CiudadanoCaptado)
    if nivel_apoyo: query = query.filter(CiudadanoCaptado.nivel_apoyo == nivel_apoyo)
    if estado_contacto: query = query.filter(CiudadanoCaptado.estado_contacto == estado_contacto)
    if barrio_id: query = query.filter(CiudadanoCaptado.barrio_id == barrio_id)
    if vereda_id: query = query.filter(CiudadanoCaptado.vereda_id == vereda_id)
    if q:
        like = f"%{q}%"
        query = query.filter(or_(CiudadanoCaptado.nombres.ilike(like), CiudadanoCaptado.apellidos.ilike(like), CiudadanoCaptado.telefono.ilike(like), CiudadanoCaptado.email.ilike(like)))
    return query.order_by(CiudadanoCaptado.fecha_creacion.desc()).limit(500).all()

@app.get("/ciudadanos/indicadores")
def indicadores_ciudadanos(db: Session = Depends(get_db)):
    return build_citizen_operational_indicators(db)

@app.get("/ciudadanos/{ciudadano_id}", response_model=CiudadanoOut)
def obtener_ciudadano(ciudadano_id: int, db: Session = Depends(get_db)):
    ciudadano = db.get(CiudadanoCaptado, ciudadano_id)
    if not ciudadano: raise HTTPException(404, "Ciudadano no encontrado")
    return ciudadano

def _validar_duplicado_ciudadano(db: Session, payload: CiudadanoCreate, exclude_id: int | None = None):
    filters = []
    if payload.numero_documento: filters.append(CiudadanoCaptado.numero_documento == payload.numero_documento)
    if payload.telefono: filters.append(CiudadanoCaptado.telefono == payload.telefono)
    if payload.email: filters.append(CiudadanoCaptado.email == payload.email)
    if not filters: return
    query = db.query(CiudadanoCaptado).filter(or_(*filters))
    if exclude_id: query = query.filter(CiudadanoCaptado.id != exclude_id)
    if query.first(): raise HTTPException(409, "Ya existe un ciudadano con el mismo documento, teléfono o correo electrónico")

def _validar_territorio_ciudadano(db: Session, barrio_id: int | None, vereda_id: int | None):
    if not barrio_id and not vereda_id:
        raise HTTPException(400, "Debe asociar el ciudadano a un barrio o vereda")
    if barrio_id and vereda_id:
        raise HTTPException(400, "Use barrio_id o vereda_id, no ambos")
    if barrio_id and not db.get(Barrio, barrio_id):
        raise HTTPException(404, "Barrio asociado no encontrado")
    if vereda_id and not db.get(Vereda, vereda_id):
        raise HTTPException(404, "Vereda asociada no encontrada")

@app.post("/ciudadanos", response_model=CiudadanoOut)
def crear_ciudadano(payload: CiudadanoCreate, db: Session = Depends(get_db)):
    _validar_territorio_ciudadano(db, payload.barrio_id, payload.vereda_id)
    _validar_duplicado_ciudadano(db, payload)
    obj = CiudadanoCaptado(**payload.model_dump())
    db.add(obj); db.commit(); db.refresh(obj); return obj

@app.put("/ciudadanos/{ciudadano_id}", response_model=CiudadanoOut)
def actualizar_ciudadano(ciudadano_id: int, payload: CiudadanoUpdate, db: Session = Depends(get_db)):
    obj = db.get(CiudadanoCaptado, ciudadano_id)
    if not obj: raise HTTPException(404, "Ciudadano no encontrado")
    data = payload.model_dump(exclude_unset=True)
    if data.get("consentimiento_datos") is False:
        raise HTTPException(400, "No se permite retirar consentimiento desde esta operacion")
    next_barrio_id = data.get("barrio_id", obj.barrio_id)
    next_vereda_id = data.get("vereda_id", obj.vereda_id)
    _validar_territorio_ciudadano(db, next_barrio_id, next_vereda_id)
    for key, value in data.items(): setattr(obj, key, value)
    db.commit(); db.refresh(obj); return obj

@app.delete("/ciudadanos/{ciudadano_id}")
def eliminar_ciudadano(ciudadano_id: int, db: Session = Depends(get_db)):
    obj = db.get(CiudadanoCaptado, ciudadano_id)
    if not obj: raise HTTPException(404, "Ciudadano no encontrado")
    db.delete(obj); db.commit(); return {"ok": True}

@app.post("/ciudadanos/importar")
def importar_ciudadanos(file: UploadFile = File(...), usuario_cargue: str = "sistema", db: Session = Depends(get_db)):
    if not file.filename.lower().endswith((".csv", ".xlsx", ".xls")):
        raise HTTPException(400, "Formato no soportado. Use CSV o Excel")
    result = import_ciudadanos(file.file, file.filename, db, usuario_cargue)
    if not result.get("ok"):
        raise HTTPException(400, result.get("error", "Error importando ciudadanos"))
    return result

@app.get("/interacciones", response_model=list[InteraccionOut])
def listar_interacciones(ciudadano_id: int | None = None, barrio_id: int | None = None, vereda_id: int | None = None, canal: str | None = None, db: Session = Depends(get_db)):
    query = db.query(InteraccionTerritorial)
    if ciudadano_id: query = query.filter(InteraccionTerritorial.ciudadano_id == ciudadano_id)
    if barrio_id: query = query.filter(InteraccionTerritorial.barrio_id == barrio_id)
    if vereda_id: query = query.filter(InteraccionTerritorial.vereda_id == vereda_id)
    if canal: query = query.filter(InteraccionTerritorial.canal == canal)
    return query.order_by(InteraccionTerritorial.fecha.desc()).limit(500).all()

@app.get("/interacciones/{interaccion_id}", response_model=InteraccionOut)
def obtener_interaccion(interaccion_id: int, db: Session = Depends(get_db)):
    obj = db.get(InteraccionTerritorial, interaccion_id)
    if not obj: raise HTTPException(404, "Interaccion no encontrada")
    return obj

@app.post("/interacciones", response_model=InteraccionOut)
def crear_interaccion(payload: InteraccionCreate, db: Session = Depends(get_db)):
    if payload.ciudadano_id and not db.get(CiudadanoCaptado, payload.ciudadano_id):
        raise HTTPException(404, "Ciudadano asociado no encontrado")
    obj = InteraccionTerritorial(**payload.model_dump())
    db.add(obj); db.commit(); db.refresh(obj); return obj

@app.put("/interacciones/{interaccion_id}", response_model=InteraccionOut)
def actualizar_interaccion(interaccion_id: int, payload: InteraccionUpdate, db: Session = Depends(get_db)):
    obj = db.get(InteraccionTerritorial, interaccion_id)
    if not obj: raise HTTPException(404, "Interaccion no encontrada")
    for key, value in payload.model_dump(exclude_unset=True).items(): setattr(obj, key, value)
    db.commit(); db.refresh(obj); return obj

def _territory_row(nombre: str, tipo: str, poblacion: int, ciudadanos: list[CiudadanoCaptado], interacciones: list[InteraccionTerritorial], problematicas: list[Problematica]):
    apoyos = {"alto": 0, "medio": 0, "bajo": 0, "indeciso": 0, "no_responde": 0}
    for ciudadano in ciudadanos:
        nivel = (ciudadano.nivel_apoyo or "indeciso").lower()
        apoyos[nivel if nivel in apoyos else "indeciso"] += 1
    categorias = {}
    for problema in problematicas:
        categorias[problema.categoria] = categorias.get(problema.categoria, 0) + (problema.frecuencia or problema.severidad or 1)
    problematica_principal = max(categorias.items(), key=lambda item: item[1])[0] if categorias else "Sin registros"
    cobertura = round((len(ciudadanos) / poblacion) * 100, 2) if poblacion else 0
    potencial = max(0, poblacion - len(ciudadanos))
    requiere_visita = cobertura < 2 or apoyos["indeciso"] > apoyos["alto"]
    return {
        "nombre": nombre,
        "tipo": tipo,
        "poblacion_estimada": poblacion,
        "ciudadanos_captados": len(ciudadanos),
        "apoyos_altos": apoyos["alto"],
        "apoyos_medios": apoyos["medio"],
        "apoyos_bajos": apoyos["bajo"],
        "indecisos": apoyos["indeciso"],
        "no_responde": apoyos["no_responde"],
        "interacciones": len(interacciones),
        "problematicas": len(problematicas),
        "problematica_principal": problematica_principal,
        "cobertura": cobertura,
        "potencial": potencial,
        "requiere_visita": requiere_visita,
    }

@app.get("/territorio/resumen")
def territorio_resumen(db: Session = Depends(get_db)):
    rows = []
    for barrio in _official_query(db, Barrio).all():
        rows.append(_territory_row(
            barrio.nombre,
            "Barrio",
            barrio.poblacion_estimada or 0,
            db.query(CiudadanoCaptado).filter(CiudadanoCaptado.barrio_id == barrio.id).all(),
            db.query(InteraccionTerritorial).filter(InteraccionTerritorial.barrio_id == barrio.id).all(),
            db.query(Problematica).filter(Problematica.barrio_id == barrio.id).all(),
        ))
    for vereda in _official_query(db, Vereda).all():
        rows.append(_territory_row(
            vereda.nombre,
            "Vereda",
            vereda.poblacion_estimada or 0,
            db.query(CiudadanoCaptado).filter(CiudadanoCaptado.vereda_id == vereda.id).all(),
            db.query(InteraccionTerritorial).filter(InteraccionTerritorial.vereda_id == vereda.id).all(),
            db.query(Problematica).filter(Problematica.vereda_id == vereda.id).all(),
        ))
    totals = {
        "zonas": len(rows),
        "ciudadanos_captados": sum(row["ciudadanos_captados"] for row in rows),
        "apoyos_altos": sum(row["apoyos_altos"] for row in rows),
        "apoyos_medios": sum(row["apoyos_medios"] for row in rows),
        "indecisos": sum(row["indecisos"] for row in rows),
        "no_responde": sum(row["no_responde"] for row in rows),
        "interacciones": sum(row["interacciones"] for row in rows),
        "zonas_baja_cobertura": sum(1 for row in rows if row["requiere_visita"]),
    }
    return {"totales": totals, "zonas": sorted(rows, key=lambda row: (row["requiere_visita"], row["potencial"]), reverse=True)}

@app.post("/segmentacion")
def add_segmento(p: SegmentoIn, db: Session = Depends(get_db)):
    obj=Segmento(**p.model_dump()); db.add(obj); db.commit(); db.refresh(obj); return obj
@app.get("/segmentacion")
def segmentos(db: Session = Depends(get_db)): return db.query(Segmento).all()

@app.post("/simulador")
def simulador(p: SimuladorIn, db: Session = Depends(get_db)):
    res=simulate(p); db.add(Proyeccion(nombre="Simulación electoral", parametros=p.model_dump(), resultados=res)); db.commit(); return res

@app.post("/ia/recomendar")
def ia(context: dict): return recommend(context)

@app.get("/ia/fuentes-publicas")
def ia_fuentes_publicas():
    return public_problem_sources()

@app.get("/inteligencia/resumen-territorial")
def inteligencia_resumen_territorial(db: Session = Depends(get_db)):
    return calculate_territorial_intelligence(db)

@app.get("/inteligencia/zonas-prioritarias")
def inteligencia_zonas_prioritarias(db: Session = Depends(get_db)):
    intelligence = calculate_territorial_intelligence(db)
    return {"zonas": priority_zones(intelligence)}

@app.get("/inteligencia/oportunidades")
def inteligencia_oportunidades(db: Session = Depends(get_db)):
    intelligence = calculate_territorial_intelligence(db)
    return {"oportunidades": opportunities(intelligence)}

@app.get("/inteligencia/alertas")
def inteligencia_alertas(db: Session = Depends(get_db)):
    intelligence = calculate_territorial_intelligence(db)
    return {"alertas": intelligence_alerts(intelligence)}

@app.get("/mapa/capas")
def capas(db: Session = Depends(get_db)):
    return {"barrios":_official_query(db, Barrio).all(),"veredas":_official_query(db, Vereda).all(),"puestos":db.query(PuestoVotacion).all()}

@app.get("/mapa/inteligencia")
def mapa_inteligencia():
    return {
        "municipio": {
            "nombre": "Funza",
            "departamento": "Cundinamarca",
            "codigo_dane": "25286",
            "area_km2": 70,
            "poblacion_referencia": 82321,
            "poblacion_fuente": "DANE - proyecciones municipales con base censal CNPV 2018",
            "nota_cartografia": "Zonificación operativa preliminar. Reemplazar por GeoJSON oficial de barrios, veredas o manzanas censales cuando se cargue la fuente local.",
        },
        "eleccion_alcaldia_2023": {
            "fuente": "Registraduría Nacional - escrutinio territorial 2023, consolidado municipal",
            "total_votos": 46872,
            "votos_validos": 44494,
            "votos_blanco": 4640,
            "votos_nulos": 1703,
            "no_marcados": 675,
            "candidatos": [
                {"nombre": "Jeimmy Sulgey Villamil Buitrago", "movimiento": "Funza Evoluciona", "votos": 25534, "color": "#5b2d5d"},
                {"nombre": "Bryan Alexis Amaya Sánchez", "movimiento": "Oposición / segundo lugar", "votos": 8417, "color": "#e83e98"},
                {"nombre": "Jhonny Alexander Salamanca Segura", "movimiento": "Tercer lugar", "votos": 3167, "color": "#7b6680"},
                {"nombre": "Doris Riano Duarte", "movimiento": "Cuarto lugar", "votos": 1970, "color": "#9a819e"},
                {"nombre": "Ana Rosa Carvajal Jimenez", "movimiento": "Quinto lugar", "votos": 766, "color": "#c7b5ca"},
            ],
        },
        "sectores": [
            {"id": "centro", "nombre": "Cabecera centro", "tipo": "Urbano", "poblacion": 18600, "riesgo_abstencion": "Medio", "ganador_2023": "Funza Evoluciona", "color": "#5b2d5d", "points": [[154,108],[216,90],[264,132],[252,202],[178,218],[132,166]]},
            {"id": "norte", "nombre": "Expansión norte", "tipo": "Urbano", "poblacion": 14200, "riesgo_abstencion": "Medio alto", "ganador_2023": "Funza Evoluciona", "color": "#6d4a73", "points": [[168,34],[246,46],[292,96],[264,132],[216,90],[154,108]]},
            {"id": "occidente", "nombre": "Corredor occidental", "tipo": "Mixto", "poblacion": 11300, "riesgo_abstencion": "Alto", "ganador_2023": "Competitivo", "color": "#e83e98", "points": [[54,154],[132,166],[178,218],[142,306],[74,292],[38,230]]},
            {"id": "oriente", "nombre": "Borde conurbado", "tipo": "Urbano", "poblacion": 16200, "riesgo_abstencion": "Medio", "ganador_2023": "Funza Evoluciona", "color": "#4b244d", "points": [[264,132],[338,112],[390,174],[352,254],[252,202]]},
            {"id": "sur", "nombre": "Sur urbano-rural", "tipo": "Mixto", "poblacion": 9800, "riesgo_abstencion": "Alto", "ganador_2023": "Competitivo", "color": "#ef6db2", "points": [[142,306],[178,218],[252,202],[292,286],[238,380],[158,374]]},
            {"id": "tienda-nueva", "nombre": "Tienda Nueva / rural", "tipo": "Rural", "poblacion": 4500, "riesgo_abstencion": "Alto", "ganador_2023": "Sin detalle por puesto", "color": "#89738d", "points": [[292,286],[352,254],[444,296],[420,386],[314,382]]},
            {"id": "san-antonio", "nombre": "San Antonio / Los Pinos", "tipo": "Rural", "poblacion": 4100, "riesgo_abstencion": "Medio alto", "ganador_2023": "Sin detalle por puesto", "color": "#a18da5", "points": [[38,230],[74,292],[142,306],[102,390],[28,374],[10,306]]},
            {"id": "cocli-papayo", "nombre": "El Coclí / El Papayo", "tipo": "Rural", "poblacion": 3621, "riesgo_abstencion": "Medio", "ganador_2023": "Sin detalle por puesto", "color": "#d8dee8", "points": [[246,46],[342,34],[414,86],[390,174],[338,112],[292,96]]},
        ],
    }

@app.get("/reportes")
def reportes(db: Session = Depends(get_db)): return db.query(Reporte).all()
