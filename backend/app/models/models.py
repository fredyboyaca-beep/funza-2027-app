from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.session import Base

class Role(Base):
    __tablename__ = "roles"
    id = Column(Integer, primary_key=True)
    nombre = Column(String(80), unique=True, nullable=False)
    descripcion = Column(Text)

class Usuario(Base):
    __tablename__ = "usuarios"
    id = Column(Integer, primary_key=True)
    nombre = Column(String(120), nullable=False)
    email = Column(String(160), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    activo = Column(Boolean, default=True)
    role_id = Column(Integer, ForeignKey("roles.id"))
    role = relationship("Role")
    creado_en = Column(DateTime, server_default=func.now())

class Barrio(Base):
    __tablename__ = "barrios"
    id = Column(Integer, primary_key=True)
    nombre = Column(String(120), unique=True, nullable=False)
    poblacion_estimada = Column(Integer, default=0)
    estrato_promedio = Column(Float, default=0)
    lat = Column(Float)
    lng = Column(Float)
    geojson = Column(JSON)

class Vereda(Base):
    __tablename__ = "veredas"
    id = Column(Integer, primary_key=True)
    nombre = Column(String(120), unique=True, nullable=False)
    poblacion_estimada = Column(Integer, default=0)
    lat = Column(Float)
    lng = Column(Float)
    geojson = Column(JSON)

class PuestoVotacion(Base):
    __tablename__ = "puestos_votacion"
    id = Column(Integer, primary_key=True)
    nombre = Column(String(180), nullable=False)
    direccion = Column(String(220))
    mesas = Column(Integer, default=0)
    potencial = Column(Integer, default=0)
    lat = Column(Float)
    lng = Column(Float)
    barrio_id = Column(Integer, ForeignKey("barrios.id"), nullable=True)
    vereda_id = Column(Integer, ForeignKey("veredas.id"), nullable=True)

class Eleccion(Base):
    __tablename__ = "elecciones"
    id = Column(Integer, primary_key=True)
    nombre = Column(String(160), nullable=False)
    tipo = Column(String(80), nullable=False)
    anio = Column(Integer, nullable=False)
    total_votos = Column(Integer, default=0)
    censo_electoral = Column(Integer, default=0)

class ResultadoElectoral(Base):
    __tablename__ = "resultados_electorales"
    id = Column(Integer, primary_key=True)
    eleccion_id = Column(Integer, ForeignKey("elecciones.id"), nullable=False)
    candidato = Column(String(160), nullable=False)
    partido = Column(String(160))
    votos = Column(Integer, default=0)
    sector = Column(String(160))
    puesto_id = Column(Integer, ForeignKey("puestos_votacion.id"), nullable=True)
    eleccion = relationship("Eleccion")

class IndicadorDemografico(Base):
    __tablename__ = "indicadores_demograficos"
    id = Column(Integer, primary_key=True)
    anio = Column(Integer, nullable=False)
    grupo = Column(String(80), nullable=False)
    sexo = Column(String(30))
    valor = Column(Integer, default=0)
    barrio_id = Column(Integer, ForeignKey("barrios.id"), nullable=True)
    vereda_id = Column(Integer, ForeignKey("veredas.id"), nullable=True)

class Problematica(Base):
    __tablename__ = "problematicas"
    id = Column(Integer, primary_key=True)
    categoria = Column(String(80), nullable=False)
    descripcion = Column(Text)
    severidad = Column(Integer, default=1)
    frecuencia = Column(Integer, default=1)
    fuente = Column(String(120))
    evidencia = Column(Text)
    responsable = Column(String(120))
    estado = Column(String(40), default="abierta")
    lat = Column(Float)
    lng = Column(Float)
    barrio_id = Column(Integer, ForeignKey("barrios.id"), nullable=True)
    vereda_id = Column(Integer, ForeignKey("veredas.id"), nullable=True)
    fecha = Column(DateTime, server_default=func.now())
    fecha_actualizacion = Column(DateTime, server_default=func.now(), onupdate=func.now())

class CiudadanoCaptado(Base):
    __tablename__ = "ciudadanos_captados"
    id = Column(Integer, primary_key=True)
    nombres = Column(String(120), nullable=False)
    apellidos = Column(String(120), nullable=False)
    tipo_documento = Column(String(30))
    numero_documento = Column(String(50), unique=True, index=True)
    telefono = Column(String(50), index=True)
    email = Column(String(160), index=True)
    barrio_id = Column(Integer, ForeignKey("barrios.id"), nullable=True)
    vereda_id = Column(Integer, ForeignKey("veredas.id"), nullable=True)
    direccion_referencia = Column(String(220))
    edad = Column(Integer)
    sexo = Column(String(30))
    ocupacion = Column(String(120))
    segmento = Column(String(120))
    fuente_captura = Column(String(120), nullable=False)
    lider_responsable = Column(String(120))
    consentimiento_datos = Column(Boolean, nullable=False, default=False)
    fecha_consentimiento = Column(DateTime)
    observaciones = Column(Text)
    estado_contacto = Column(String(60), default="pendiente")
    nivel_apoyo = Column(String(30), default="indeciso")
    fecha_creacion = Column(DateTime, server_default=func.now())
    fecha_actualizacion = Column(DateTime, server_default=func.now(), onupdate=func.now())
    barrio = relationship("Barrio")
    vereda = relationship("Vereda")

class InteraccionTerritorial(Base):
    __tablename__ = "interacciones_territoriales"
    id = Column(Integer, primary_key=True)
    ciudadano_id = Column(Integer, ForeignKey("ciudadanos_captados.id"), nullable=True)
    barrio_id = Column(Integer, ForeignKey("barrios.id"), nullable=True)
    vereda_id = Column(Integer, ForeignKey("veredas.id"), nullable=True)
    tipo_interaccion = Column(String(80), nullable=False)
    canal = Column(String(40), nullable=False)
    tema = Column(String(160))
    descripcion = Column(Text)
    responsable = Column(String(120))
    fecha = Column(DateTime, nullable=False)
    resultado = Column(Text)
    requiere_seguimiento = Column(Boolean, default=False)
    fecha_seguimiento = Column(DateTime)
    fecha_creacion = Column(DateTime, server_default=func.now())
    ciudadano = relationship("CiudadanoCaptado")
    barrio = relationship("Barrio")
    vereda = relationship("Vereda")

class Segmento(Base):
    __tablename__ = "segmentos"
    id = Column(Integer, primary_key=True)
    nombre = Column(String(120), nullable=False)
    descripcion = Column(Text)
    tamano_estimado = Column(Integer, default=0)
    participacion_historica = Column(Float, default=0)
    necesidades = Column(Text)

class Proyeccion(Base):
    __tablename__ = "proyecciones"
    id = Column(Integer, primary_key=True)
    nombre = Column(String(120), nullable=False)
    parametros = Column(JSON, nullable=False)
    resultados = Column(JSON, nullable=False)
    creado_en = Column(DateTime, server_default=func.now())

class Reporte(Base):
    __tablename__ = "reportes"
    id = Column(Integer, primary_key=True)
    tipo = Column(String(80), nullable=False)
    titulo = Column(String(160), nullable=False)
    ruta = Column(String(250))
    creado_en = Column(DateTime, server_default=func.now())

class Auditoria(Base):
    __tablename__ = "auditoria"
    id = Column(Integer, primary_key=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    accion = Column(String(160), nullable=False)
    entidad = Column(String(100))
    detalle = Column(JSON)
    creado_en = Column(DateTime, server_default=func.now())
