# FUNZA 2027 - CENTRO DE INTELIGENCIA ELECTORAL

Plataforma web profesional para análisis territorial, demográfico, electoral y estratégico de Funza, Cundinamarca, construida con FastAPI, PostgreSQL, React, TypeScript, Tailwind, Recharts y Leaflet.

## Principio ético

El sistema trabaja solo con datos públicos, agregados y estadísticos. No debe almacenar datos personales de ciudadanos ni hacer perfilamiento individual.

## Módulos incluidos

- Dashboard ejecutivo con KPIs, pirámide poblacional y crecimiento poblacional.
- Carga de resultados electorales en Excel o CSV.
- Resumen electoral por candidato.
- Mapa Leaflet con barrios, veredas y puestos.
- Registro y ranking de problemáticas territoriales.
- Segmentación demográfica agregada.
- Simulador electoral con escenarios optimista, moderado, conservador y crítico.
- Asistente IA basado en reglas transparentes y datos agregados.
- Autenticación JWT base y roles.
- Swagger automático en `/docs`.
- Docker Compose con PostgreSQL, backend y frontend.

## Instalación en Visual Studio Code

1. Abre la carpeta `funza-2027` en Visual Studio Code.
2. Instala Docker Desktop.
3. Copia `backend/.env.example` como `backend/.env` si deseas cambiar credenciales.
4. Ejecuta:

```bash
docker compose up --build
```

5. Abre:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8521`
- Swagger: `http://localhost:8521/docs`

## Usuario inicial

- Email: `admin@funza2027.local`
- Contraseña: `Admin2027*`

## Formato de carga electoral

CSV o Excel con columnas mínimas:

```csv
eleccion_id,candidato,votos,partido,sector
1,Candidato A,12000,Partido X,Centro
1,Candidato B,9500,Partido Y,La Aurora
```

Primero crea una elección desde Swagger en `/elecciones` o en base de datos.

## Endpoints principales

- `/auth/login`
- `/usuarios`
- `/barrios`
- `/veredas`
- `/elecciones`
- `/resultados/cargar`
- `/resultados/resumen`
- `/indicadores`
- `/problematicas`
- `/problematicas/ranking`
- `/segmentacion`
- `/simulador`
- `/ia/recomendar`
- `/mapa/capas`
- `/reportes`

## Producción

Antes de producción:

- Cambiar `SECRET_KEY`.
- Usar HTTPS.
- Configurar dominios CORS reales.
- Implementar migraciones Alembic formales.
- Agregar pruebas unitarias y de integración.
- Validar fuentes oficiales cargadas: DANE, Registraduría, Alcaldía de Funza, Gobernación de Cundinamarca.
- Incorporar PostGIS para geometrías reales de barrios y veredas.
