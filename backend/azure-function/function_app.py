import json
import logging
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

import azure.functions as func

app = func.FunctionApp(
    http_auth_level=func.AuthLevel.ANONYMOUS
)

RATES = {
    "novo": Decimal("0.03"),
    "regular": Decimal("0.07"),
    "vip": Decimal("0.12"),
}

CENT = Decimal("0.01")


def money(value: Decimal) -> Decimal:
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


@app.route(
    route="calcular-desconto-cashback",
    methods=["POST"],
)
def calcular_desconto_cashback(req: func.HttpRequest) -> func.HttpResponse:
    """Calcula desconto e cashback conforme as regras locais do GuiaShip."""
    try:
        data = req.get_json()
        total = Decimal(str(data.get("total_carrinho", "")))
        categoria = str(data.get("categoria_cliente", "novo")).strip().lower()

        if not total.is_finite() or total <= 0:
            raise ValueError("total_carrinho deve ser um número maior que zero.")

        if categoria not in RATES:
            raise ValueError("categoria_cliente deve ser novo, regular ou vip.")

        # Mesmas regras de localBenefits() em app.js:
        # novo=3%, regular=7%, vip=12%; desconto somente a partir de R$ 200.
        percentual = RATES[categoria] if total >= Decimal("200") else Decimal("0")
        desconto = money(total * percentual)
        total_com_desconto = money(total - desconto)

        # Cashback: 5% para VIP e 2% para novo/regular.
        taxa_cashback = Decimal("0.05") if categoria == "vip" else Decimal("0.02")
        cashback = money(total_com_desconto * taxa_cashback)

        response_body = {
            "desconto_percentual": float(percentual * Decimal("100")),
            "desconto_valor": float(desconto),
            "cashback": float(cashback),
            "total_com_desconto": float(total_com_desconto),
        }

        return func.HttpResponse(
            body=json.dumps(response_body, ensure_ascii=False),
            status_code=200,
            mimetype="application/json",
        )

    except (ValueError, TypeError, InvalidOperation, AttributeError) as exc:
        logging.warning("Requisição inválida para benefícios: %s", exc)
        return func.HttpResponse(
            body=json.dumps(
                {"erro": "Dados inválidos. Informe total_carrinho positivo e categoria_cliente válida."},
                ensure_ascii=False,
            ),
            status_code=400,
            mimetype="application/json",
        )
