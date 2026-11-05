(() => {
  const $ = (id) => document.getElementById(id);
  const config = { ...window.API_CONFIG };
  const endpoints = { aws: config.awsFreightUrl || "", azure: config.azureBenefitsUrl || "", gcp: config.googleDeliveryUrl || "" };
  const currency = (n) => Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const numeric = (id) => Number($(id).value);
  const validPositive = ["weight","length","width","height","cartTotal"];
  const usersKey = "guiaship.users";
  const cartKey = "guiaship.cart";
  const categoryNames = { novo: "Novo cliente", regular: "Cliente recorrente", vip: "VIP" };
  const storeOrigin = {
  cep: config.originCep || "13974-080",
  address: "Fatec Itapira, Rua Tereza Lera Paoletti, 570 - Jardim Bela Vista, Itapira - SP"
};
  const regionNames = { sudeste: "Sudeste", sul: "Sul", "centro-oeste": "Centro-Oeste", nordeste: "Nordeste", norte: "Norte" };
  const products = [
    { id: "keyboard", name: "Teclado mecânico compacto", category: "Teclado", description: "Layout compacto com switches mecânicos.", price: 279.90, weightKg: 1.1, lengthCm: 36, widthCm: 14, heightCm: 5 },
    { id: "mouse", name: "Mouse gamer 6 botões", category: "Mouse", description: "Sensor ajustável e formato ambidestro.", price: 119.90, weightKg: 0.18, lengthCm: 13, widthCm: 8, heightCm: 5 },
    { id: "headset", name: "Headset over-ear", category: "Áudio", description: "Fones acolchoados com microfone integrado.", price: 229.90, weightKg: 0.48, lengthCm: 22, widthCm: 20, heightCm: 11 },
    { id: "mousepad", name: "Mousepad estendido", category: "Acessório", description: "Superfície ampla, enviado enrolado.", price: 79.90, weightKg: 0.55, lengthCm: 42, widthCm: 10, heightCm: 10 },
    { id: "webcam", name: "Webcam Full HD", category: "Vídeo", description: "Câmera USB com suporte para monitor.", price: 159.90, weightKg: 0.24, lengthCm: 13, widthCm: 10, heightCm: 8 },
    { id: "microphone", name: "Microfone USB de mesa", category: "Áudio", description: "Microfone condensador com base compacta.", price: 249.90, weightKg: 0.72, lengthCm: 24, widthCm: 16, heightCm: 10 },
    { id: "monitor", name: "Monitor gamer 24 polegadas", category: "Vídeo", description: "Monitor com base desmontada na embalagem.", price: 899.90, weightKg: 4.2, lengthCm: 62, widthCm: 42, heightCm: 14 },
    { id: "controller", name: "Controle sem fio", category: "Acessório", description: "Controle USB com conexão sem fio.", price: 189.90, weightKg: 0.34, lengthCm: 17, widthCm: 13, heightCm: 8 },
    { id: "speakers", name: "Par de caixas de som USB", category: "Áudio", description: "Duas caixas compactas para desktop.", price: 149.90, weightKg: 0.86, lengthCm: 22, widthCm: 16, heightCm: 12 }
  ];
  const readStoredArray = (key) => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(value) ? value : [];
    } catch { return []; }
  };
  let users = readStoredArray(usersKey);
  let cart = readStoredArray(cartKey).filter(item => item && typeof item.name === "string" && Number(item.price) > 0 && Number(item.quantity) > 0);
  let currentUser = null;
  let accountMode = "login";
  let selectedFreightMode = "economico";
  let lastCheckoutData = null;
  let lastFreightPrices = null;
  const geocodeCache = new Map();
  const routeCache = new Map();
  let lastRoutePoints = null;
  let geocoderQueue = Promise.resolve();
  let lastGeocoderRequest = 0;
  let routeRequestId = 0;
  const setStatus = (key, state, text) => {
    const suffix = key === "aws" ? "Aws" : key === "azure" ? "Azure" : "Gcp";
    $("status" + suffix).textContent = text;
    $("dot" + suffix).className = "status-dot " + (state === "ok" ? "good" : state === "fallback" ? "warn" : "");
  };
  const setMeta = (key, text, error = false) => {
    const id = key === "aws" ? "metaAws" : key === "azure" ? "metaAzure" : "metaGcp";
    $(id).textContent = text;
    $(id).className = "result-meta" + (error ? " error" : "");
  };
  const showNotice = (text) => { $("notice").textContent = text; $("notice").classList.remove("hidden"); };
  const hideNotice = () => $("notice").classList.add("hidden");

  function saveUsers() { localStorage.setItem(usersKey, JSON.stringify(users)); }
  function saveCart() { localStorage.setItem(cartKey, JSON.stringify(cart)); }
  function updateAccountUI() {
    const signedIn = Boolean(currentUser);
    $("openAccount").hidden = signedIn;
    $("logoutButton").hidden = !signedIn;
    $("profileName").textContent = signedIn ? currentUser.name : "Grupo C";
    $("profileSubtitle").textContent = signedIn ? currentUser.email : "Equipe do projeto";
    $("profileAvatar").textContent = signedIn ? currentUser.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase() : "GC";
    $("customerName").textContent = signedIn ? currentUser.name + " · " + currentUser.email : "Entre ou cadastre-se para continuar";
    $("customerCategoryBadge").textContent = signedIn ? categoryNames[currentUser.category] || categoryNames.novo : "Sem categoria";
    $("customer").value = signedIn ? currentUser.category : "novo";
  }
  function renderCart() {
    const list = $("cartItems");
    list.replaceChildren();
    if (!cart.length) {
      const empty = document.createElement("p");
      empty.className = "cart-empty";
      empty.textContent = "Seu carrinho está vazio.";
      list.append(empty);
    }
    let total = 0;
    cart.forEach((item, index) => {
      const subtotal = Math.round(item.price * 100 * item.quantity) / 100;
      total += subtotal;
      const row = document.createElement("div");
      row.className = "cart-item";
      const description = document.createElement("div");
      description.className = "cart-item-name";
      const name = document.createElement("b");
      name.textContent = item.name;
      const detail = document.createElement("small");
      const specs = Number.isFinite(Number(item.weightKg)) && Number.isFinite(Number(item.lengthCm))
        ? " · " + item.weightKg + " kg · " + item.lengthCm + " × " + item.widthCm + " × " + item.heightCm + " cm/un."
        : " · medidas não cadastradas";
      detail.textContent = item.quantity + " × " + currency(item.price) + specs;
      description.append(name, detail);
      const amount = document.createElement("span");
      amount.className = "cart-item-total";
      amount.textContent = currency(subtotal);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "cart-remove";
      remove.textContent = "Remover";
      remove.setAttribute("aria-label", "Remover " + item.name + " do carrinho");
      remove.addEventListener("click", () => {
        cart.splice(index, 1);
        saveCart();
        renderCart();
      });
      row.append(description, amount, remove);
      list.append(row);
    });
    total = Math.round(total * 100) / 100;
    $("cartTotal").value = String(total);
    $("cartTotalDisplay").textContent = currency(total);
    updatePackageFromCart();
  }
  function updatePackageFromCart() {
    const packageFields = ["weight", "length", "width", "height"];
    const hasMissingSpecs = cart.some(item => ![item.weightKg, item.lengthCm, item.widthCm, item.heightCm].every(value => Number.isFinite(Number(value)) && Number(value) > 0));
    if (!cart.length || hasMissingSpecs) {
      packageFields.forEach(id => { $(id).value = ""; });
      return;
    }
    const totalWeight = cart.reduce((sum, item) => sum + Number(item.weightKg) * item.quantity, 0);
    const packageLength = Math.max(...cart.map(item => Number(item.lengthCm)));
    const packageWidth = Math.max(...cart.map(item => Number(item.widthCm)));
    const packageHeight = cart.reduce((sum, item) => sum + Number(item.heightCm) * item.quantity, 0);
    $("weight").value = totalWeight.toFixed(2);
    $("length").value = String(packageLength);
    $("width").value = String(packageWidth);
    $("height").value = String(packageHeight);
  }
  function renderProducts() {
    const catalog = $("productCatalog");
    const query = $("productSearch").value.trim().toLocaleLowerCase("pt-BR");
    const activeFilter = document.querySelector("[data-product-filter].active")?.dataset.productFilter || "todos";
    const matches = products.filter(product =>
      (activeFilter === "todos" || product.category === activeFilter) &&
      (product.name + " " + product.description + " " + product.category).toLocaleLowerCase("pt-BR").includes(query)
    );
    catalog.replaceChildren();
    if (!matches.length) {
      const empty = document.createElement("p");
      empty.className = "catalog-empty";
      empty.textContent = "Nenhum produto encontrado. Tente outra busca ou categoria.";
      catalog.append(empty);
      return;
    }
    matches.forEach(product => {
      const card = document.createElement("article");
      card.className = "product-card";
      const top = document.createElement("div");
      top.className = "product-card-top";
      const category = document.createElement("span");
      category.className = "product-category";
      category.textContent = product.category;
      const code = document.createElement("span");
      code.className = "product-code";
      code.textContent = "GS / " + product.id.slice(0, 3).toUpperCase();
      top.append(category, code);
      const title = document.createElement("h3");
      title.textContent = product.name;
      const description = document.createElement("p");
      description.className = "product-description";
      description.textContent = product.description;
      const specs = document.createElement("dl");
      specs.className = "product-specs";
      [["Peso", product.weightKg.toLocaleString("pt-BR") + " kg"], ["Comprimento", product.lengthCm + " cm"], ["Largura", product.widthCm + " cm"], ["Altura", product.heightCm + " cm"]].forEach(([label, value]) => {
        const row = document.createElement("div");
        const term = document.createElement("dt");
        term.textContent = label;
        const data = document.createElement("dd");
        data.textContent = value;
        row.append(term, data);
        specs.append(row);
      });
      const footer = document.createElement("div");
      footer.className = "product-card-footer";
      const price = document.createElement("strong");
      price.className = "product-price";
      price.textContent = currency(product.price);
      const add = document.createElement("button");
      add.type = "button";
      add.className = "btn btn-primary product-add";
      add.dataset.productId = product.id;
      add.textContent = "Adicionar";
      footer.append(price, add);
      card.append(top, title, description, specs, footer);
      catalog.append(card);
    });
  }
  function setAccountMode(mode) {
    accountMode = mode;
    const registering = mode === "register";
    $("accountTitle").textContent = registering ? "Crie sua conta" : "Acesse sua conta";
    $("accountNameField").hidden = !registering;
    $("accountNameInput").required = registering;
    $("accountPassword").autocomplete = registering ? "new-password" : "current-password";
    $("accountSubmitLabel").textContent = registering ? "Criar conta" : "Entrar";
    $("accountMessage").textContent = "";
    $("accountMessage").className = "account-message";
    document.querySelectorAll("[data-account-mode]").forEach(button => button.classList.toggle("active", button.dataset.accountMode === mode));
  }
  async function passwordDigest(password, salt) {
    if (!window.crypto?.subtle) throw new Error("A proteção de senha requer uma origem HTTPS ou localhost.");
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 120000, hash: "SHA-256" }, key, 256);
    return Array.from(new Uint8Array(bits), byte => byte.toString(16).padStart(2, "0")).join("");
  }
  function bytesToHex(bytes) { return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join(""); }
  function hexToBytes(hex) { return new Uint8Array(hex.match(/.{2}/g).map(byte => parseInt(byte, 16))); }
  function setAccountMessage(text, success = false) {
    $("accountMessage").textContent = text;
    $("accountMessage").className = "account-message" + (success ? " success" : "");
  }
  function renderAdminCustomers() {
    const select = $("adminCustomerSelect");
    select.replaceChildren();
    users.forEach(user => {
      const option = document.createElement("option");
      option.value = user.email;
      option.textContent = user.name + " · " + user.email;
      select.append(option);
    });
    $("assignCategory").disabled = users.length === 0;
    if (users.length) $("adminCategorySelect").value = users.find(user => user.email === select.value)?.category || "novo";
  }

  function getDestinationByCep(cep) {
    const prefix = Number(cep.slice(0, 2));
    const region = prefix >= 1 && prefix <= 39 ? "sudeste"
      : prefix >= 40 && prefix <= 65 ? "nordeste"
      : prefix >= 66 && prefix <= 69 ? "norte"
      : prefix >= 70 && prefix <= 79 ? "centro-oeste"
      : prefix >= 80 && prefix <= 99 ? "sul"
      : "sudeste";
    return { region };
  }
  function geocodeCep(cep) {
    if (geocodeCache.has(cep)) return Promise.resolve(geocodeCache.get(cep));
    const request = geocoderQueue.then(async () => {
      if (geocodeCache.has(cep)) return geocodeCache.get(cep);
      const waitMs = Math.max(0, 1000 - (Date.now() - lastGeocoderRequest));
      if (waitMs) await new Promise(resolve => setTimeout(resolve, waitMs));
      lastGeocoderRequest = Date.now();
      const providers = [
        async () => {
          const response = await fetch("https://brasilapi.com.br/api/cep/v2/" + cep);
          if (!response.ok) throw new Error("BrasilAPI HTTP " + response.status);
          const data = await response.json();
          return { latitude: Number(data.location?.coordinates?.latitude), longitude: Number(data.location?.coordinates?.longitude) };
        },
        async () => {
          const response = await fetch("https://cep.awesomeapi.com.br/json/" + cep);
          if (!response.ok) throw new Error("AwesomeAPI HTTP " + response.status);
          const data = await response.json();
          return { latitude: Number(data.lat), longitude: Number(data.lng) };
        },
        async () => {
          const url = "https://nominatim.openstreetmap.org/search?" + new URLSearchParams({ postalcode: cep, country: "Brazil", format: "jsonv2", limit: "1" });
          const response = await fetch(url, { headers: { Accept: "application/json" } });
          if (!response.ok) throw new Error("OpenStreetMap HTTP " + response.status);
          const matches = await response.json();
          if (!matches.length) throw new Error("CEP sem coordenadas no OpenStreetMap");
          return { latitude: Number(matches[0].lat), longitude: Number(matches[0].lon) };
        }
      ];
      const failures = [];
      for (const provider of providers) {
        try {
          const point = await withTimeout(provider(), config.timeoutMs || 8000);
          if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude) || point.latitude === 0 || point.longitude === 0) throw new Error("Coordenadas indisponíveis");
          geocodeCache.set(cep, point);
          return point;
        } catch (error) {
          failures.push(error.message || "falha de consulta");
        }
      }
      throw new Error("Não foi possível obter coordenadas para o CEP. " + failures.join("; "));
    });
    geocoderQueue = request.catch(() => {});
    return request;
  }
  async function updateDestinationSummary() {
  const requestId = ++routeRequestId;
  const cep = $("cep").value.replace(/\D/g, "");

  $("distance").value = "";
  lastRoutePoints = null;

  if (cep.length !== 8) {
    $("destinationRegion").textContent = "Informe o CEP do cliente";
    $("distanceEstimate").textContent = "A AWS calculará a distância da rota.";
    return null;
  }

  const destination = getDestinationByCep(cep);
  $("destinationRegion").textContent = regionNames[destination.region];
  $("distanceEstimate").textContent =
    "Localizando os pontos para enviar à AWS…";

  try {
    const [origin, target] = await Promise.all([
      geocodeCep(storeOrigin.cep),
      geocodeCep(cep)
    ]);

    if (requestId !== routeRequestId) return null;

    lastRoutePoints = {
      origem_latitude: origin.latitude,
      origem_longitude: origin.longitude,
      destino_latitude: target.latitude,
      destino_longitude: target.longitude
    };

    $("distanceEstimate").textContent =
      "Pontos localizados. A distância rodoviária será calculada pela AWS.";

    return { cep, points: lastRoutePoints };
  } catch (error) {
    if (requestId !== routeRequestId) return null;

    $("distanceEstimate").textContent =
      error.message || "Não foi possível localizar os pontos.";

    return null;
  }
}

  async function readInputs() {
    const cep = $("cep").value.replace(/\D/g, "");
    if (cep.length !== 8) throw new Error("Informe um CEP válido com 8 números.");
   const routePoints = await updateDestinationSummary();

if (!routePoints || !lastRoutePoints) {
  throw new Error(
    "Não foi possível localizar os pontos da rota. Confira o CEP."
  );
}
    const destination = getDestinationByCep(cep);
    const data = {
     peso: numeric("weight"),
distancia_km: 0, // A AWS calculará a distância real
...lastRoutePoints,
comprimento_cm: numeric("length"), largura_cm: numeric("width"), altura_cm: numeric("height"),
      cep_origem: storeOrigin.cep, cep_destino: cep.slice(0, 5) + "-" + cep.slice(5),
      total_carrinho: numeric("cartTotal"), categoria_cliente: currentUser?.category || "novo",
      regiao_destino: destination.region
    };
    if (!currentUser) throw new Error("Entre ou cadastre-se para calcular o checkout.");
    if (!cart.length) throw new Error("Adicione pelo menos um item ao carrinho.");
    for (const id of validPositive) {
      if (!Number.isFinite(numeric(id)) || numeric(id) <= 0) throw new Error("Preencha peso, distância, dimensões e total do carrinho com valores maiores que zero.");
    }
    return data;
  }

  function localFreight(d) {
    const volumetricWeight = (d.comprimento_cm * d.largura_cm * d.altura_cm) / 6000;
    const billableWeight = Math.max(d.peso, volumetricWeight);
    const base = 7 + billableWeight * 2.2 + d.distancia_km * 0.045;
    return { economico: Number(base.toFixed(2)), expresso: Number((base * 1.65 + 5).toFixed(2)), _fallback: true };
  }
  function localBenefits(d) {
    const rates = { novo: 0.03, regular: 0.07, vip: 0.12 };
    const rate = rates[d.categoria_cliente] ?? 0;
    const discount = d.total_carrinho >= 200 ? rate : 0;
    const afterDiscount = d.total_carrinho * (1 - discount);
    return { desconto_percentual: discount * 100, desconto_valor: d.total_carrinho * discount, cashback: afterDiscount * (d.categoria_cliente === "vip" ? 0.05 : 0.02), total_com_desconto: afterDiscount, _fallback: true };
  }
  function localDelivery(d, freightMode) {
    const regionDays = { sudeste: 2, sul: 3, "centro-oeste": 4, nordeste: 5, norte: 7 };
    const modeDays = freightMode === "expresso" ? -1 : 0;
    const days = Math.max(1, (regionDays[d.regiao_destino] || 4) + modeDays + (d.distancia_km > 500 ? 2 : 0));
    const date = new Date();
    date.setDate(date.getDate() + days);
    const risk = days >= 7 ? "Alto" : days >= 5 ? "Médio" : "Baixo";
    return { data_prevista: date.toISOString().slice(0,10), prazo_dias: days, risco_logistico: risk, _fallback: true };
  }
  function withTimeout(promise, ms) {
    let timer;
    return Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Tempo limite excedido")), ms); })
    ]).finally(() => clearTimeout(timer));
  }
  async function callEndpoint(key, url, payload, fallbackFn) {
    const start = performance.now();
    if (!url) {
      return { data: fallbackFn(), latency: Math.round(performance.now() - start), source: "fallback", reason: "URL HTTPS não configurada" };
    }
    try {
      const response = await withTimeout(fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload)
      }), config.timeoutMs || 8000);
      if (!response.ok) throw new Error("HTTP " + response.status);
      const data = await response.json();
      if (key === "gcp" && (
        !value(data, ["data_prevista", "data_provavel_entrega", "estimated_delivery_date", "deliveryDate"], "") ||
        !value(data, ["risco_logistico", "nivel_risco", "risk_level", "riskLevel"], "")
      )) {
        throw new Error("Resposta do Google Cloud fora do contrato de prazo de entrega");
      }
      return { data, latency: Math.round(performance.now() - start), source: "cloud" };
    } catch (err) {
      return { data: fallbackFn(), latency: Math.round(performance.now() - start), source: "fallback", reason: err.message || "Falha de comunicação" };
    }
  }
  function value(obj, keys, defaultValue = undefined) {
    for (const key of keys) if (obj && obj[key] !== undefined && obj[key] !== null) return obj[key];
    return defaultValue;
  }
  function renderModule(key, result) {
    const label = key === "aws" ? "AWS Lambda" : key === "azure" ? "Azure Functions" : "Google Cloud Functions";
    const fallback = result.source === "fallback";
    setStatus(key, fallback ? "fallback" : "ok", fallback ? "Fallback local ativo" : "Conectado · " + label);
    const latencyId = key === "aws" ? "latAws" : key === "azure" ? "latAzure" : "latGcp";
    $(latencyId).textContent = result.latency + " ms";
    setMeta(key, fallback ? "Fallback local utilizado — " + result.reason + ". Valores simulados, não retornados pela nuvem." : "Resposta real recebida via HTTPS / JSON.");
  }
  function formatDate(raw) {
    if (!raw) return "Não informado";
    const d = new Date(raw + (String(raw).length === 10 ? "T12:00:00" : ""));
    return Number.isNaN(d.getTime()) ? String(raw) : d.toLocaleDateString("pt-BR");
  }
  function renderDelivery(result) {
    const deliveryDate = value(result.data, ["data_prevista", "data_provavel_entrega", "estimated_delivery_date", "deliveryDate"], "");
    const risk = String(value(result.data, ["risco_logistico", "nivel_risco", "risk_level", "riskLevel"], "Não informado"));
    $("deliveryDate").textContent = formatDate(deliveryDate);
    $("riskBadge").textContent = "Risco " + risk;
    $("riskBadge").className = "risk-badge" + (/alto|high/i.test(risk) ? " high" : /médio|medio|medium/i.test(risk) ? " medium" : "");
  }
  function updateFreightSelection(mode) {
    selectedFreightMode = mode;
    document.querySelectorAll("[data-freight-mode]").forEach(button => {
      const selected = button.dataset.freightMode === mode;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    if (lastFreightPrices && lastCheckoutData) {
      const price = lastFreightPrices[mode];
      $("finalTotal").textContent = currency(Math.max(0, lastCheckoutData.total_carrinho - lastFreightPrices.discountAmount) + price);
    }
  }
  async function updateDeliveryForMode(mode) {
    if (!lastCheckoutData) return;
    const d = lastCheckoutData;
    setStatus("gcp", "", "Atualizando prazo…");
    const result = await callEndpoint("gcp", endpoints.gcp, {
      regiao_destino: d.regiao_destino, modalidade_frete: mode,
      distancia_km: d.distancia_km, cep_origem: d.cep_origem, cep_destino: d.cep_destino
    }, () => localDelivery(d, mode));
    if (mode !== selectedFreightMode) return;
    renderModule("gcp", result);
    renderDelivery(result);
  }
  async function runCheckout(d) {
    $("emptyState").classList.add("hidden");
    $("results").classList.remove("hidden");
    hideNotice();
    $("calculateBtn").disabled = true;
    $("calculateBtn").querySelector("span").textContent = "Calculando…";
    ["aws","azure","gcp"].forEach(k => setStatus(k, "", "Processando…"));
    // Independent calls: one provider failure must not block the other modules.
    const tasks = await Promise.allSettled([
      callEndpoint("aws", endpoints.aws, {
  peso: d.peso,
  comprimento_cm: d.comprimento_cm,
  largura_cm: d.largura_cm,
  altura_cm: d.altura_cm,
  distancia_km: 0,
  cep_origem: d.cep_origem,
  cep_destino: d.cep_destino,

  origem_latitude: d.origem_latitude,
  origem_longitude: d.origem_longitude,
  destino_latitude: d.destino_latitude,
  destino_longitude: d.destino_longitude
}, () => localFreight(d)),
      callEndpoint("azure", endpoints.azure, {
        total_carrinho: d.total_carrinho, categoria_cliente: d.categoria_cliente
      }, () => localBenefits(d)),
      callEndpoint("gcp", endpoints.gcp, {
        regiao_destino: d.regiao_destino, modalidade_frete: selectedFreightMode,
        distancia_km: d.distancia_km, cep_origem: d.cep_origem, cep_destino: d.cep_destino
      }, () => localDelivery(d, selectedFreightMode))
    ]);
    const results = tasks.map((t, i) => t.status === "fulfilled" ? t.value : ({
      data: [() => localFreight(d), () => localBenefits(d), () => localDelivery(d, selectedFreightMode)][i](),
      latency: 0, source: "fallback", reason: t.reason?.message || "Erro inesperado"
    }));
    const [aws, azure, gcp] = results;
    lastCheckoutData = d;
    renderModule("aws", aws); renderModule("azure", azure); renderModule("gcp", gcp);

    const freightEconomy = Number(value(aws.data, ["economico", "frete_economico", "economic_price", "economicPrice", "economico_valor"], 0));
    const freightExpress = Number(value(aws.data, ["expresso", "frete_expresso", "express_price", "expressPrice", "expresso_valor"], 0));
    const discountPercent = Number(value(azure.data, ["desconto_percentual", "discount_percent", "discountPercent"], 0));
    const discountAmount = Number(value(azure.data, ["desconto_valor", "discount_amount", "discountAmount"], d.total_carrinho * discountPercent / 100));
    const cashback = Number(value(azure.data, ["cashback", "cashback_valor", "cashback_amount", "cashbackAmount"], 0));
    $("economicPrice").textContent = currency(freightEconomy);
    $("expressPrice").textContent = currency(freightExpress);
    $("discountValue").textContent = discountPercent.toLocaleString("pt-BR") + "% · " + currency(discountAmount);
    $("cashbackValue").textContent = currency(cashback);
    lastFreightPrices = { economico: freightEconomy, expresso: freightExpress, discountAmount };
    updateFreightSelection(selectedFreightMode);
    renderDelivery(gcp);
    const failed = results.filter(r => r.source === "fallback").length;
    if (failed) showNotice(failed + " de 3 módulo(s) usaram fallback local. Os resultados foram mantidos para que uma falha isolada não interrompa o checkout. Configure as URLs HTTPS para testar as funções reais.");
    else showNotice("Os três provedores responderam. Confira os resultados e os tempos medidos no navegador.");
    $("calculateBtn").disabled = false;
    $("calculateBtn").querySelector("span").textContent = "Calcular checkout completo";
  }

  $("checkoutForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentUser) {
      showNotice("Entre ou cadastre-se antes de continuar.");
      $("accountModal").classList.remove("hidden");
      return;
    }
   try {
  const dados = await readInputs();
  await runCheckout(dados);
} catch (err) {
  console.error("Erro no checkout:", err);
  showNotice(err.message || "Confira os dados informados.");
}
  });

  $("productCatalog").addEventListener("click", event => {
    const button = event.target.closest("[data-product-id]");
    if (!button) return;
    const product = products.find(item => item.id === button.dataset.productId);
    if (!product) return;
    const existing = cart.find(item => item.productId === product.id);
    if (existing) existing.quantity += 1;
    else cart.push({ ...product, quantity: 1 });
    saveCart();
    renderCart();
    hideNotice();
    button.textContent = "Adicionado";
    window.setTimeout(() => { if (button.isConnected) button.textContent = "Adicionar"; }, 900);
  });
  $("productSearch").addEventListener("input", renderProducts);
  $("cep").addEventListener("input", updateDestinationSummary);
  document.querySelectorAll("[data-freight-mode]").forEach(button => button.addEventListener("click", () => {
    const mode = button.dataset.freightMode;
    updateFreightSelection(mode);
    updateDeliveryForMode(mode);
  }));
  document.querySelectorAll("[data-product-filter]").forEach(button => button.addEventListener("click", () => {
    document.querySelectorAll("[data-product-filter]").forEach(filter => filter.classList.toggle("active", filter === button));
    renderProducts();
  }));

  $("openAccount").addEventListener("click", () => {
    setAccountMode("login");
    $("accountModal").classList.remove("hidden");
  });
  $("closeAccount").addEventListener("click", () => $("accountModal").classList.add("hidden"));
  $("accountModal").addEventListener("click", event => {
    if (event.target === $("accountModal")) $("accountModal").classList.add("hidden");
  });
  document.querySelectorAll("[data-account-mode]").forEach(button => button.addEventListener("click", () => setAccountMode(button.dataset.accountMode)));
  $("accountForm").addEventListener("submit", async event => {
    event.preventDefault();
    const email = $("accountEmail").value.trim().toLowerCase();
    const password = $("accountPassword").value;
    try {
      if (accountMode === "register") {
        const name = $("accountNameInput").value.trim();
        if (users.some(user => user.email === email)) throw new Error("Já existe uma conta com este e-mail.");
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const user = { name, email, salt: bytesToHex(salt), passwordHash: await passwordDigest(password, salt), category: "novo" };
        users.push(user);
        saveUsers();
        currentUser = user;
        setAccountMessage("Conta criada. Sua categoria inicial é Novo cliente.", true);
      } else {
        const user = users.find(candidate => candidate.email === email);
        if (!user || await passwordDigest(password, hexToBytes(user.salt)) !== user.passwordHash) throw new Error("E-mail ou senha incorretos.");
        currentUser = user;
        setAccountMessage("Login realizado.", true);
      }
      sessionStorage.setItem("guiaship.session", currentUser.email);
      updateAccountUI();
      window.setTimeout(() => $("accountModal").classList.add("hidden"), 500);
    } catch (error) {
      setAccountMessage(error.message || "Não foi possível autenticar. Verifique os dados e tente novamente.");
    }
  });
  $("logoutButton").addEventListener("click", () => {
    sessionStorage.removeItem("guiaship.session");
    currentUser = null;
    updateAccountUI();
    showNotice("Você saiu da sua conta.");
  });

  $("openAdmin").addEventListener("click", () => {
    $("adminLoginForm").classList.remove("hidden");
    $("adminPanel").classList.add("hidden");
    $("adminLoginForm").reset();
    $("adminMessage").textContent = config.adminAccessCode ? "" : "Defina adminAccessCode em config.js para habilitar o acesso administrativo.";
    $("adminMessage").className = "account-message";
    $("adminModal").classList.remove("hidden");
  });
  $("closeAdmin").addEventListener("click", () => $("adminModal").classList.add("hidden"));
  $("adminModal").addEventListener("click", event => {
    if (event.target === $("adminModal")) $("adminModal").classList.add("hidden");
  });
  $("adminLoginForm").addEventListener("submit", event => {
    event.preventDefault();
    if (!config.adminAccessCode || $("adminCodeInput").value !== config.adminAccessCode) {
      $("adminMessage").textContent = "Código administrativo inválido ou não configurado.";
      $("adminMessage").className = "account-message";
      return;
    }
    $("adminLoginForm").classList.add("hidden");
    $("adminPanel").classList.remove("hidden");
    $("adminMessage").textContent = "Acesso administrativo autenticado.";
    $("adminMessage").className = "account-message success";
    renderAdminCustomers();
  });
  $("adminCustomerSelect").addEventListener("change", () => {
    const selected = users.find(user => user.email === $("adminCustomerSelect").value);
    if (selected) $("adminCategorySelect").value = selected.category || "novo";
  });
  $("assignCategory").addEventListener("click", () => {
    const selectedEmail = $("adminCustomerSelect").value;
    const selectedCategory = $("adminCategorySelect").value;
    const user = users.find(candidate => candidate.email === selectedEmail);
    if (!user) {
      $("adminMessage").textContent = "Cadastre um cliente antes de atribuir uma categoria.";
      $("adminMessage").className = "account-message";
      return;
    }
    user.category = selectedCategory;
    saveUsers();
    if (currentUser?.email === user.email) {
      currentUser = user;
      updateAccountUI();
    }
    $("adminMessage").textContent = "Categoria de " + user.name + " atualizada para " + categoryNames[selectedCategory] + ".";
    $("adminMessage").className = "account-message success";
  });

  try {
    const sessionEmail = sessionStorage.getItem("guiaship.session");
    currentUser = users.find(user => user.email === sessionEmail) || null;
  } catch { currentUser = null; }
  renderCart();
  renderProducts();
  updateDestinationSummary();
  updateAccountUI();

  const modal = $("configModal");
  const openModal = () => { $("urlAws").value = endpoints.aws; $("urlAzure").value = endpoints.azure; $("urlGcp").value = endpoints.gcp; modal.classList.remove("hidden"); };
  $("openConfig").addEventListener("click", openModal);
  $("closeConfig").addEventListener("click", () => modal.classList.add("hidden"));
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.add("hidden"); });
  $("saveConfig").addEventListener("click", () => {
    endpoints.aws = $("urlAws").value.trim();
    endpoints.azure = $("urlAzure").value.trim();
    endpoints.gcp = $("urlGcp").value.trim();
    for (const [key, url] of Object.entries(endpoints)) {
      if (url && !/^https:\/\/.+/i.test(url)) { showNotice("As URLs de API devem começar com https://."); return; }
    }
    modal.classList.add("hidden");
    showNotice("URLs atualizadas nesta sessão. Execute novamente a simulação para testar os endpoints.");
  });
  $("clearConfig").addEventListener("click", () => { $("urlAws").value = ""; $("urlAzure").value = ""; $("urlGcp").value = ""; });
})();