import pandas as pd
from sklearn.cluster import KMeans

def electoral_summary(rows):
    df = pd.DataFrame(rows)
    if df.empty:
        return {"total_votos": 0, "por_candidato": []}
    grouped = df.groupby("candidato", as_index=False)["votos"].sum().sort_values("votos", ascending=False)
    return {"total_votos": int(df["votos"].sum()), "por_candidato": grouped.to_dict(orient="records")}

def simulate(params):
    base_votantes = params.censo_electoral * params.participacion_esperada
    ajuste = 1 + params.incremento_juvenil + params.crecimiento_sector - params.abstencion_proyectada
    moderado = max(0, base_votantes * ajuste)
    escenarios = {
        "optimista": round(moderado * 1.15),
        "moderado": round(moderado),
        "conservador": round(moderado * 0.88),
        "critico": round(moderado * 0.70),
    }
    escenarios["cumple_meta"] = {k: v >= params.meta_votacion for k, v in escenarios.items() if k != "cumple_meta"}
    return escenarios

def cluster_sectors(features):
    df = pd.DataFrame(features)
    if len(df) < 3:
        return []
    numeric = df.select_dtypes(include="number").fillna(0)
    km = KMeans(n_clusters=min(3, len(df)), random_state=42, n_init="auto")
    df["cluster"] = km.fit_predict(numeric)
    return df.to_dict(orient="records")
