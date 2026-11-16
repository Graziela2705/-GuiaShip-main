import json
import math
import urllib.request
import urllib.error
from urllib.parse import urlencode

CEP_ORIGEM_FIXO = "13974080"
OSRM_URL = "https://router.project-osrm.org/route/v1/driving/"


def resposta(status_code, dados):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json; charset=utf-8"
        },
        "body": json.dumps(dados, ensure_ascii=False)
    }


def calcular_distancia(event):
    # Coordenadas enviadas pelo GuiaShip
    origem_lat = float(event["origem_latitude"])
    origem_lon = float(event["origem_longitude"])
    destino_lat = float(event["destino_latitude"])
    destino_lon = float(event["destino_longitude"])

    coordenadas = [origem_lon, origem_lat, destino_lon, destino_lat]

    for coordenada in coordenadas:
        if not math.isfinite(coordenada):
            raise ValueError("As coordenadas devem ser números finitos.")

    if not (-90 <= origem_lat <= 90 and -90 <= destino_lat <= 90):
        raise ValueError("Latitude inválida.")

    if not (-180 <= origem_lon <= 180 and -180 <= destino_lon <= 180):
        raise ValueError("Longitude inválida.")

    rota = (
        f"{OSRM_URL}{origem_lon},{origem_lat};"
        f"{destino_lon},{destino_lat}"
        "?" + urlencode({"overview": "false", "steps": "false"})
    )

    request = urllib.request.Request(
        rota,
        headers={"User-Agent": "GuiaShip/1.0", "Accept": "application/json"}
    )

    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            dados_rota = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, OSError) as erro:
        raise RuntimeError(
            "Não foi possível consultar o serviço de rotas: " + str(erro)
        ) from erro

    if dados_rota.get("code") != "Ok" or not dados_rota.get("routes"):
        raise RuntimeError(
            "O serviço de rotas não encontrou um caminho entre os pontos."
        )

    # O OSRM devolve a distância em metros; convertemos para quilômetros.
    distancia_km = float(dados_rota["routes"][0]["distance"]) / 1000

    if not math.isfinite(distancia_km) or distancia_km <= 0:
        raise RuntimeError("A distância calculada pela rota é inválida.")

    return round(distancia_km, 2)


def lambda_handler(event, context):
    try:
        # Aceita evento direto, Function URL ou API Gateway.
        if isinstance(event.get("body"), str):
            event = json.loads(event["body"])
        elif isinstance(event.get("body"), dict):
            event = event["body"]

        peso = float(event.get("peso", event.get("peso_kg")))
        comprimento = float(event["comprimento_cm"])
        largura = float(event["largura_cm"])
        altura = float(event["altura_cm"])

        cep_origem = "".join(
            c for c in str(event.get("cep_origem", "")) if c.isdigit()
        )
        cep_destino = "".join(
            c for c in str(event.get("cep_destino", "")) if c.isdigit()
        )

        valores = {
            "peso": peso,
            "comprimento_cm": comprimento,
            "largura_cm": largura,
            "altura_cm": altura
        }

        for nome, valor in valores.items():
            if not math.isfinite(valor) or valor <= 0:
                raise ValueError(
                    f"O campo {nome} deve ser um número maior que zero."
                )

        if len(cep_origem) != 8 or len(cep_destino) != 8:
            raise ValueError("Os CEPs devem conter 8 números.")

        if cep_origem != CEP_ORIGEM_FIXO:
            raise ValueError(
                "O CEP de origem deve ser 13974-080, o da Fatec de Itapira."
            )

        # A distância é calculada pela AWS. Não usamos o valor recebido.
        distancia = calcular_distancia(event)

        peso_volumetrico = (
            comprimento * largura * altura
        ) / 6000

        peso_cobrado = max(peso, peso_volumetrico)

        # Mantém a fórmula de frete já utilizada no projeto.
        valor_base = 8.00
        custo_peso = peso_cobrado * 2.50
        custo_distancia = distancia * 0.08

        economica = round(
            valor_base + custo_peso + custo_distancia, 2
        )
        expressa = round(economica * 1.50, 2)

        resultado = {
            "economico": economica,
            "expresso": expressa,
            "peso_cobrado_kg": round(peso_cobrado, 2),
            "distancia_km": distancia,
            "cep_origem": "13974-080",
            "cep_destino": f"{cep_destino[:5]}-{cep_destino[5:]}",
            "observacao": (
                "Distância rodoviária calculada pelo OSRM a partir "
                "das coordenadas fornecidas. Os pontos associados "
                "a CEPs podem ser aproximados."
            )
        }

        return resposta(200, resultado)

    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as erro:
        return resposta(400, {"erro": str(erro)})

    except RuntimeError as erro:
        return resposta(502, {"erro": str(erro)})
