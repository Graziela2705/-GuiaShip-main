# GuiaShip — Front-end do SaaS Multicloud (Grupo C)

Front-end demonstrativo para a Atividade Prática 04 — Ecossistema SaaS Multicloud Integrado. O tema do Grupo C é **E-commerce (Logística e Checkout Inteligente)**.

## Módulos

- **AWS Lambda:** Calculadora de Frete Dinâmico — peso, dimensões e distância rodoviária calculada entre os CEPs; modalidades econômica e expressa selecionáveis.
- **Azure Functions:** Motor de Regras de Cupom e Cashback — total do carrinho e categoria do cliente; desconto percentual e cashback.
- **Google Cloud Functions:** Estimador de Prazo de Entrega (SLA) — região e modalidade de frete; data prevista e risco logístico.

## Clientes, carrinho e categorias

- O cliente pode criar uma conta e entrar; a senha é derivada com Web Crypto antes de ser guardada no navegador.
- O carrinho aceita itens, preços e quantidades, calculando o total enviado ao módulo de benefícios.
- A categoria começa como **Novo cliente** e pode ser alterada pela área administrativa após autenticação.
- Para testar a área administrativa, defina `adminAccessCode` em `config.js` e use esse código no botão **Acesso admin**. A lista de clientes e as contas existem apenas no navegador atual.
- Esta autenticação é somente uma demonstração de front-end: o código administrativo é visível no JavaScript publicado e os dados locais podem ser alterados pelo usuário. Para produção, implemente identidade, sessão e autorização de administrador em um backend ou provedor de autenticação.

## Catálogo de periféricos

O catálogo demonstrativo inclui teclado, mouse, headset, mousepad, webcam, microfone, monitor, controle e caixas de som. Cada item informa peso e dimensões unitárias; ao adicionar produtos, o checkout soma os pesos e estima o pacote com os itens empilhados. Os preços e as especificações são ilustrativos, não dados oficiais de fabricante.

## Executar localmente para desenvolvimento

Abra `index.html` no navegador ou use uma extensão de servidor estático. Os cálculos locais são demonstrativos. A entrega final deve estar hospedada publicamente, não em `localhost`.

## Configurar endpoints reais

1. Publique as três funções serverless e copie suas URLs HTTPS.
2. Abra `config.js` e preencha:
   - `awsFreightUrl`
   - `azureBenefitsUrl`
   - `googleDeliveryUrl`
3. Cada função deve aceitar `POST` com `Content-Type: application/json` e responder JSON.
4. Configure CORS em cada provedor para permitir o domínio onde o front-end está hospedado.
5. Se preferir, use o botão **Configurar APIs** no front-end para informar as URLs durante a sessão.

### Payloads enviados pelo front-end

AWS:
```json
{
  "peso": 2.5,
  "comprimento_cm": 30,
  "largura_cm": 20,
  "altura_cm": 15,
  "distancia_km": 120,
  "cep_origem": "13974-080",
  "cep_destino": "13900-000"
}
```

Azure:
```json
{
  "total_carrinho": 249.9,
  "categoria_cliente": "regular"
}
```

Google Cloud:
```json
{
  "regiao_destino": "sudeste",
  "modalidade_frete": "economico",
  "distancia_km": 120,
  "cep_origem": "13974-080",
  "cep_destino": "13900-000"
}
```

O CEP de origem é fixo na Fatec Itapira (CEP 13974-080). O navegador tenta obter coordenadas pela BrasilAPI, AwesomeAPI ou Nominatim/OpenStreetMap, e consulta a rota rodoviária no OSRM. Como CEPs podem representar áreas ou pontos aproximados, a distância não substitui a rota até um endereço exato. O checkout bloqueia o cálculo se não conseguir obter a rota, em vez de usar uma distância regional inventada. Esses serviços públicos dependem de internet e disponibilidade; para produção, use provedores com SLA ou os serviços da sua própria infraestrutura e respeite os termos de uso.

Após calcular as opções de frete, selecione **Econômico** ou **Expresso** para atualizar o total com desconto e o prazo de entrega. A modalidade escolhida é enviada à função de prazo do Google Cloud.

### Contrato de resposta sugerido

A atividade não especifica nomes exatos de campos JSON. Para a integração direta com este front-end, recomenda-se:

AWS:
```json
{ "economico": 18.25, "expresso": 35.11 }
```

Azure:
```json
{ "desconto_percentual": 7, "desconto_valor": 17.49, "cashback": 4.65 }
```

Google Cloud:
```json
{ "data_prevista": "2026-10-29", "prazo_dias": 4, "risco_logistico": "Baixo" }
```

O código também reconhece alguns nomes alternativos de campos. Ajuste `app.js` se o contrato real das funções usar outros nomes.

## Resiliência e métricas

- Os três módulos são chamados de forma independente com `Promise.allSettled`.
- Cada chamada HTTP tem timeout configurável em `config.js` (`timeoutMs`, padrão 8 segundos).
- Falha HTTP, timeout, CORS ou URL vazia aciona fallback local apenas para o módulo correspondente.
- A interface mostra latência medida no navegador e identifica claramente quando o resultado veio de fallback local. Essa latência é uma medição de ponta a ponta no browser, não uma métrica interna do provedor.
- Os cálculos de fallback são apenas exemplos didáticos; não representam tarifas reais, regras fiscais, prazos garantidos ou uma política comercial real.

## Publicação sugerida: GitHub Pages

1. Envie os arquivos para a pasta `frontend-app` do repositório GitHub.
2. No repositório, abra **Settings → Pages**.
3. Em *Build and deployment*, selecione **Deploy from a branch**, escolha `main` e a pasta `/frontend-app` (ou `/root`, se publicar a partir da raiz).
4. Salve e aguarde a URL pública.
5. Abra a URL pública e teste o checkout. Para integração real, confirme CORS e endpoints HTTPS.

Outras opções do enunciado: AWS S3/CloudFront, Azure Static Web Apps, Firebase Hosting, Vercel e Netlify.

## Segurança

Não inclua chaves privadas, senhas ou credenciais no JavaScript público ou no GitHub. Como os endpoints são públicos para a demonstração acadêmica, limite permissões, monitore logs e desative recursos após a avaliação para evitar consumo inesperado.

## Limites desta entrega

Este pacote entrega o **front-end**. As três funções serverless, suas URLs públicas, o CORS, a hospedagem e a documentação técnica final precisam ser configurados e testados separadamente. Enquanto as URLs não forem preenchidas, a interface usa fallback local e informa isso visualmente.
