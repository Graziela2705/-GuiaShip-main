import math
from datetime import date, timedelta

import functions_framework
from flask import jsonify


def responder(conteudo, status):
    response = jsonify(conteudo)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response, status


def numero_finito(valor, nome):
    try:
        resultado = float(valor)
    except (TypeError, ValueError):
        raise ValueError(f"Campo inválido: {nome}.")

    if not math.isfinite(resultado):
        raise ValueError(f"Campo inválido: {nome}.")

    return resultado


def analisar_lista_pedidos(pedidos):
    if not isinstance(pedidos, list) or not pedidos:
        raise ValueError("Envie uma lista de pedidos.")

    faturamento = 0
    fretes = 0
    peso_total = 0
    distancia_total = 0
    economicos = 0
    expressos = 0

    for pedido in pedidos:
        if not isinstance(pedido, dict):
            raise ValueError("Cada pedido deve ser um objeto.")

        valor = numero_finito(pedido.get("valor_produtos"), "valor_produtos")
        frete = numero_finito(pedido.get("valor_frete"), "valor_frete")
        peso = numero_finito(pedido.get("peso"), "peso")
        distancia = numero_finito(pedido.get("distancia_km"), "distancia_km")
        modalidade = pedido.get("modalidade")

        if valor < 0 or frete < 0 or peso <= 0 or distancia < 0:
            raise ValueError("Valores inválidos no pedido.")

        faturamento += valor
        fretes += frete
        peso_total += peso
        distancia_total += distancia

        if modalidade == "economico":
            economicos += 1
        elif modalidade == "expresso":
            expressos += 1
        else:
            raise ValueError("Modalidade de frete inválida.")

    total = faturamento + fretes

    return {
        "plataforma": "Google Cloud",
        "funcao": "Analise de pedidos e logistica",
        "indicadores": {
            "total_pedidos": len(pedidos),
            "faturamento_produtos": round(faturamento, 2),
            "total_fretes": round(fretes, 2),
            "faturamento_total": round(total, 2),
            "ticket_medio": round(total / len(pedidos), 2),
            "peso_total_kg": round(peso_total, 2),
            "distancia_total_km": round(distancia_total, 2),
            "fretes": {
                "economico": economicos,
                "expresso": expressos,
            },
        },
        "status": "Analise concluida com sucesso",
    }


def estimar_entrega(dados):
    dias_por_regiao = {
        "sudeste": 2,
        "sul": 3,
        "centro-oeste": 4,
        "nordeste": 5,
        "norte": 7,
    }

    regiao = dados.get("regiao_destino")
    modalidade = dados.get("modalidade_frete")

    if regiao not in dias_por_regiao:
        raise ValueError("Região de destino inválida.")

    if modalidade not in ("economico", "expresso"):
        raise ValueError("Modalidade de frete inválida.")

    distancia = numero_finito(dados.get("distancia_km"), "distancia_km")
    if distancia < 0:
        raise ValueError("A distância não pode ser negativa.")

    dias = dias_por_regiao[regiao]
    if modalidade == "expresso":
        dias -= 1
    if distancia > 500:
        dias += 2
    dias = max(1, dias)

    risco = "Alto" if dias >= 7 else "Médio" if dias >= 5 else "Baixo"
    data_prevista = (date.today() + timedelta(days=dias)).isoformat()

    return {
        "data_prevista": data_prevista,
        "prazo_dias": dias,
        "risco_logistico": risco,
        "status": "Previsao calculada com sucesso",
    }


@functions_framework.http
def analisar_pedidos(request):
    if request.method == "OPTIONS":
        return responder({}, 204)

    if request.method != "POST":
        return responder({"erro": "Utilize POST."}, 405)

    dados = request.get_json(silent=True)
    if not isinstance(dados, dict):
        return responder({"erro": "Envie um objeto JSON válido."}, 400)

    try:
        if "pedidos" in dados:
            resultado = analisar_lista_pedidos(dados["pedidos"])
        else:
            resultado = estimar_entrega(dados)

        return responder(resultado, 200)
    except (ValueError, TypeError, KeyError) as erro:
        return responder({"erro": str(erro)}, 400)
