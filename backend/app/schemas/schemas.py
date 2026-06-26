from datetime import datetime
from pydantic import BaseModel, field_validator, model_validator
from typing import Optional, Any

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class Login(BaseModel):
    email: str
    password: str

class UsuarioCreate(BaseModel):
    nombre: str
    email: str
    password: str
    role_id: int

class UsuarioOut(BaseModel):
    id: int
    nombre: str
    email: str
    activo: bool
    role_id: Optional[int]
    class Config: from_attributes = True

class BarrioIn(BaseModel):
    nombre: str
    poblacion_estimada: int = 0
    estrato_promedio: float = 0
    lat: Optional[float] = None
    lng: Optional[float] = None
    geojson: Optional[Any] = None

class VeredaIn(BaseModel):
    nombre: str
    poblacion_estimada: int = 0
    lat: Optional[float] = None
    lng: Optional[float] = None
    geojson: Optional[Any] = None

class EleccionIn(BaseModel):
    nombre: str
    tipo: str
    anio: int
    total_votos: int = 0
    censo_electoral: int = 0

class ProblematicaIn(BaseModel):
    categoria: str
    descripcion: Optional[str] = None
    severidad: int = 1
    frecuencia: int = 1
    fuente: Optional[str] = None
    evidencia: Optional[str] = None
    responsable: Optional[str] = None
    estado: str = "abierta"
    lat: Optional[float] = None
    lng: Optional[float] = None
    barrio_id: Optional[int] = None
    vereda_id: Optional[int] = None

    @field_validator("categoria", "descripcion", "fuente")
    @classmethod
    def validar_texto_obligatorio(cls, value: Optional[str], info) -> str:
        normalized = (value or "").strip()
        if not normalized:
            raise ValueError(f"{info.field_name} es obligatorio")
        return normalized

    @field_validator("severidad")
    @classmethod
    def validar_severidad(cls, value: int) -> int:
        if value < 1 or value > 5:
            raise ValueError("nivel de afectacion debe estar entre 1 y 5")
        return value

    @field_validator("frecuencia")
    @classmethod
    def validar_frecuencia(cls, value: int) -> int:
        if value < 1:
            raise ValueError("numero de reportes debe ser mayor o igual a 1")
        return value

    @model_validator(mode="after")
    def validar_territorio(self):
        if not self.barrio_id and not self.vereda_id:
            raise ValueError("Debe asociar la problemática a un barrio o vereda")
        if self.barrio_id and self.vereda_id:
            raise ValueError("Use barrio_id o vereda_id, no ambos")
        return self

class ProblematicaOut(BaseModel):
    id: int
    categoria: str
    descripcion: Optional[str] = None
    severidad: int = 1
    frecuencia: int = 1
    fuente: Optional[str] = None
    evidencia: Optional[str] = None
    responsable: Optional[str] = None
    estado: str = "abierta"
    lat: Optional[float] = None
    lng: Optional[float] = None
    barrio_id: Optional[int] = None
    vereda_id: Optional[int] = None
    fecha: Optional[datetime] = None
    fecha_actualizacion: Optional[datetime] = None
    class Config: from_attributes = True

class CiudadanoBase(BaseModel):
    nombres: str
    apellidos: str
    tipo_documento: Optional[str] = None
    numero_documento: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    barrio_id: Optional[int] = None
    vereda_id: Optional[int] = None
    direccion_referencia: Optional[str] = None
    edad: Optional[int] = None
    sexo: Optional[str] = None
    ocupacion: Optional[str] = None
    segmento: Optional[str] = None
    fuente_captura: str
    lider_responsable: Optional[str] = None
    consentimiento_datos: bool
    fecha_consentimiento: Optional[datetime] = None
    observaciones: Optional[str] = None
    estado_contacto: str = "pendiente"
    nivel_apoyo: str = "indeciso"

    @field_validator("nivel_apoyo")
    @classmethod
    def validar_nivel_apoyo(cls, value: str) -> str:
        permitido = {"alto", "medio", "bajo", "indeciso", "no_responde"}
        normalized = value.lower().strip()
        if normalized not in permitido:
            raise ValueError("nivel_apoyo debe ser alto, medio, bajo, indeciso o no_responde")
        return normalized

    @field_validator("consentimiento_datos")
    @classmethod
    def validar_consentimiento(cls, value: bool) -> bool:
        if value is not True:
            raise ValueError("No se permite registrar ciudadanos sin consentimiento de datos")
        return value

    @field_validator("fuente_captura")
    @classmethod
    def validar_fuente_captura(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("fuente_captura es obligatoria")
        return normalized

    @model_validator(mode="after")
    def validar_territorio_y_contacto(self):
        if not self.barrio_id and not self.vereda_id:
            raise ValueError("Debe asociar el ciudadano a un barrio o vereda")
        if self.barrio_id and self.vereda_id:
            raise ValueError("Use barrio_id o vereda_id, no ambos")
        if not self.telefono and not self.email and not self.numero_documento:
            raise ValueError("Debe incluir teléfono, correo electrónico o número de documento")
        return self

class CiudadanoCreate(CiudadanoBase):
    pass

class CiudadanoUpdate(BaseModel):
    nombres: Optional[str] = None
    apellidos: Optional[str] = None
    tipo_documento: Optional[str] = None
    numero_documento: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    barrio_id: Optional[int] = None
    vereda_id: Optional[int] = None
    direccion_referencia: Optional[str] = None
    edad: Optional[int] = None
    sexo: Optional[str] = None
    ocupacion: Optional[str] = None
    segmento: Optional[str] = None
    fuente_captura: Optional[str] = None
    lider_responsable: Optional[str] = None
    consentimiento_datos: Optional[bool] = None
    fecha_consentimiento: Optional[datetime] = None
    observaciones: Optional[str] = None
    estado_contacto: Optional[str] = None
    nivel_apoyo: Optional[str] = None

    @field_validator("nivel_apoyo")
    @classmethod
    def validar_nivel_apoyo_update(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        permitido = {"alto", "medio", "bajo", "indeciso", "no_responde"}
        normalized = value.lower().strip()
        if normalized not in permitido:
            raise ValueError("nivel_apoyo debe ser alto, medio, bajo, indeciso o no_responde")
        return normalized

class CiudadanoOut(CiudadanoBase):
    id: int
    fecha_creacion: Optional[datetime] = None
    fecha_actualizacion: Optional[datetime] = None
    class Config: from_attributes = True

class InteraccionBase(BaseModel):
    ciudadano_id: Optional[int] = None
    barrio_id: Optional[int] = None
    vereda_id: Optional[int] = None
    tipo_interaccion: str
    canal: str
    tema: Optional[str] = None
    descripcion: Optional[str] = None
    responsable: Optional[str] = None
    fecha: datetime
    resultado: Optional[str] = None
    requiere_seguimiento: bool = False
    fecha_seguimiento: Optional[datetime] = None

    @field_validator("canal")
    @classmethod
    def validar_canal(cls, value: str) -> str:
        permitido = {"visita", "llamada", "whatsapp", "reunion", "evento", "redes"}
        normalized = value.lower().strip()
        if normalized not in permitido:
            raise ValueError("canal debe ser visita, llamada, whatsapp, reunion, evento o redes")
        return normalized

class InteraccionCreate(InteraccionBase):
    pass

class InteraccionUpdate(BaseModel):
    ciudadano_id: Optional[int] = None
    barrio_id: Optional[int] = None
    vereda_id: Optional[int] = None
    tipo_interaccion: Optional[str] = None
    canal: Optional[str] = None
    tema: Optional[str] = None
    descripcion: Optional[str] = None
    responsable: Optional[str] = None
    fecha: Optional[datetime] = None
    resultado: Optional[str] = None
    requiere_seguimiento: Optional[bool] = None
    fecha_seguimiento: Optional[datetime] = None

class InteraccionOut(InteraccionBase):
    id: int
    fecha_creacion: Optional[datetime] = None
    class Config: from_attributes = True

class SegmentoIn(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    tamano_estimado: int = 0
    participacion_historica: float = 0
    necesidades: Optional[str] = None

class SimuladorIn(BaseModel):
    censo_electoral: int
    participacion_esperada: float
    abstencion_proyectada: float = 0
    incremento_juvenil: float = 0
    crecimiento_sector: float = 0
    meta_votacion: int
