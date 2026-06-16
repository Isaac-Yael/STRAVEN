// ============================================================
// STRAVEN — Catálogo Mayorista — Lógica de la tienda
// ============================================================

// ---- CONFIGURACIÓN ----
const WHATSAPP_NUMBER = "525538900271";

const TIERS = [
  { min: 0,  key: "priceRetail", label: "Precio público" },
  { min: 12, key: "priceDozen1", label: "Mayoreo · 1 docena" },
  { min: 24, key: "priceDozen2", label: "Mayoreo · 2 docenas" },
  { min: 36, key: "priceDozen3", label: "Mayoreo · 3 docenas" },
];

const CART_KEY = "straven_cart_v1";

// ---- ESTADO ----
let cart = {};            // { lineKey: { type:'regular'|'mixed', productId, qty|bundles } }
let modalState = { productId: null, imgIndex: 0 };

const productsById = Object.fromEntries(PRODUCTS.map(p => [p.id, p]));

// ============================================================
// UTILIDADES
// ============================================================
function formatMoney(n){
  return "$" + n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getTier(qty){
  let t = TIERS[0];
  for (const tier of TIERS){ if (qty >= tier.min) t = tier; }
  return t;
}

function getNextTier(qty){
  for (const tier of TIERS){ if (qty < tier.min) return tier; }
  return null;
}

function cartQtyFor(productId){
  const line = cart[productId];
  return line ? line.qty : 0;
}

function saveCart(){
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}
function loadCart(){
  try{
    const raw = localStorage.getItem(CART_KEY);
    if (raw) cart = JSON.parse(raw);
  }catch(e){ cart = {}; }
}

function imgPath(product, filename){
  return `${product.folder}/${filename}`;
}

// ============================================================
// RENDER: CATEGORÍAS + CATÁLOGO
// ============================================================
function displayCategory(cat){
  return cat.toLowerCase() === "leggins" ? "Leggins" : cat;
}

function getCategories(){
  const set = new Map();
  PRODUCTS.forEach(p => {
    const disp = displayCategory(p.category);
    if (!set.has(disp)) set.set(disp, []);
    set.get(disp).push(p);
  });
  // categorías con más productos primero; empate se resuelve alfabéticamente
  return Array.from(set.entries()).sort((a,b) => b[1].length - a[1].length || a[0].localeCompare(b[0], "es"));
}

function slugify(s){
  return "cat-" + s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g,"-");
}

function renderCategoryNav(categories){
  const nav = document.getElementById("catNavInner");
  nav.innerHTML = categories.map(([name]) =>
    `<a href="#${slugify(name)}" class="cat-pill" data-cat="${slugify(name)}">${name}</a>`
  ).join("");
}

function productCardHTML(p){
  const cover = p.images[0] ? imgPath(p, p.images[0]) : "";
  const ownedQty = cartQtyFor(p.id);
  const previewQty = ownedQty + 1; // qty if user adds the default stepper amount (1)
  const tier = getTier(previewQty);
  const next = getNextTier(previewQty);
  const unitPrice = p[tier.key];
  const upsell = next ? `Agrega ${next.min - previewQty} más y paga ${formatMoney(p[next.key])} c/u` : "Ya tienes el mejor precio";

  return `
  <article class="product-card" data-product-id="${p.id}">
    <div class="card-media" data-action="open-modal">
      ${p.promo ? `<span class="badge-promo">${p.promo}</span>` : ""}
      <span class="badge-brand"><img src="logo/${p.brandLogo}" alt=""></span>
      <img src="${cover}" alt="${p.name}" loading="lazy" class="card-cover-img">
    </div>
    <div class="card-body">
      <h3 class="card-title" data-action="open-modal">${p.name}</h3>
      <div class="card-price-row">
        <span class="card-price" data-role="card-price">${formatMoney(unitPrice)}</span>
        <span class="card-price-unit">c/u</span>
      </div>
      <p class="card-price-tier" data-role="card-tier">${tier.label}</p>
      <p class="card-upsell" data-role="card-upsell">${upsell}</p>
      <div class="card-actions">
        <div class="stepper card-stepper">
          <button class="step-btn" data-action="qty-minus">−</button>
          <input type="number" min="1" value="1" data-role="qty-input">
          <button class="step-btn" data-action="qty-plus">+</button>
        </div>
        <div class="card-buttons">
          <button class="btn btn-primary" data-action="add-cart">Agregar</button>
        </div>
        <button class="btn btn-mixed" data-action="add-mixed">Paquete mixto · ${p.mixedQty} pz a ${formatMoney(p.mixedPrice)} c/u</button>
      </div>
    </div>
  </article>`;
}

function renderCatalog(){
  const categories = getCategories();
  renderCategoryNav(categories);
  const main = document.getElementById("catalog");
  main.innerHTML = categories.map(([name, items]) => `
    <section class="cat-section" id="${slugify(name)}">
      <div class="cat-section-head">
        <h2 class="cat-section-title">${name}</h2>
        <span class="cat-section-count">${items.length} modelo${items.length>1?"s":""}</span>
        <div class="cat-section-rule"></div>
      </div>
      <div class="product-grid">
        ${items.map(productCardHTML).join("")}
      </div>
    </section>
  `).join("");
}

// recompute price / tier / upsell text on every visible card without re-rendering whole grid
function refreshCardPricing(){
  document.querySelectorAll(".product-card").forEach(card => {
    const id = card.dataset.productId;
    const p = productsById[id];
    const qtyInput = card.querySelector('[data-role="qty-input"]');
    const stepperQty = Math.max(1, parseInt(qtyInput.value, 10) || 1);
    const ownedQty = cartQtyFor(id);
    const previewQty = ownedQty + stepperQty;
    const tier = getTier(previewQty);
    const next = getNextTier(previewQty);
    card.querySelector('[data-role="card-price"]').textContent = formatMoney(p[tier.key]);
    card.querySelector('[data-role="card-tier"]').textContent = tier.label;
    card.querySelector('[data-role="card-upsell"]').textContent = next
      ? `Agrega ${next.min - previewQty} más y paga ${formatMoney(p[next.key])} c/u`
      : "Ya tienes el mejor precio";
  });
}

// ============================================================
// CICLO DE IMÁGENES EN TARJETAS
// ============================================================
function startCardImageCycling(){
  document.querySelectorAll(".product-card").forEach(card => {
    const id = card.dataset.productId;
    const p = productsById[id];
    if (!p || !p.images || p.images.length < 2) return;
    const img = card.querySelector(".card-cover-img");
    if (!img) return;

    // precarga para que el desvanecido no muestre un parpadeo de carga
    const srcs = p.images.map(file => imgPath(p, file));
    srcs.forEach(src => { const pre = new Image(); pre.src = src; });

    let idx = 0;
    const FADE_MS = 380;
    setInterval(() => {
      idx = (idx + 1) % srcs.length;
      img.style.opacity = "0";
      setTimeout(() => {
        img.src = srcs[idx];
        img.style.opacity = "1";
      }, FADE_MS);
    }, 2500);
  });
}

// ============================================================
// SCROLLSPY NAV
// ============================================================
function setupScrollspy(){
  const sections = Array.from(document.querySelectorAll(".cat-section"));
  const pills = Array.from(document.querySelectorAll(".cat-pill"));
  const setActive = (id) => {
    pills.forEach(p => p.classList.toggle("active", p.dataset.cat === id));
  };
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) setActive(entry.target.id);
    });
  }, { rootMargin: "-140px 0px -70% 0px", threshold: 0 });
  sections.forEach(s => observer.observe(s));
}

// ============================================================
// MODAL DE PRODUCTO
// ============================================================
function openModal(productId){
  const p = productsById[productId];
  if (!p) return;
  modalState = { productId, imgIndex: 0 };
  document.getElementById("modalBrandLogo").src = `logo/${p.brandLogo}`;
  document.getElementById("modalCategory").textContent = displayCategory(p.category);
  document.getElementById("modalTitle").textContent = p.name;
  const promoEl = document.getElementById("modalPromo");
  promoEl.textContent = p.promo || "";

  // tabla de precios
  const tbody = document.querySelector("#priceTiers tbody");
  tbody.innerHTML = TIERS.map(t => `
    <tr data-tier="${t.key}">
      <td>${t.label}${t.min ? ` (${t.min}+ pz)` : ""}</td>
      <td>${formatMoney(p[t.key])} c/u</td>
    </tr>
  `).join("");

  document.getElementById("modalQtyInput").value = 1;
  document.getElementById("modalMixedBtn").textContent =
    `Agregar paquete mixto · ${p.mixedQty} piezas a ${formatMoney(p.mixedPrice)} c/u (${formatMoney(p.mixedQty * p.mixedPrice)})`;

  renderGallery(p);
  updateModalPricing();

  document.getElementById("modalOverlay").classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeModal(){
  document.getElementById("modalOverlay").classList.remove("open");
  document.body.style.overflow = "";
}

function renderGallery(p){
  const main = document.getElementById("galleryMainImg");
  main.src = imgPath(p, p.images[modalState.imgIndex]);
  main.alt = p.name;
  const thumbs = document.getElementById("galleryThumbs");
  thumbs.innerHTML = p.images.map((img, i) =>
    `<img src="${imgPath(p, img)}" data-idx="${i}" class="${i === modalState.imgIndex ? "active" : ""}">`
  ).join("");
}

function setGalleryIndex(delta){
  const p = productsById[modalState.productId];
  const n = p.images.length;
  modalState.imgIndex = (modalState.imgIndex + delta + n) % n;
  renderGallery(p);
}

function updateModalPricing(){
  const p = productsById[modalState.productId];
  const ownedQty = cartQtyFor(p.id);
  const stepperQty = Math.max(1, parseInt(document.getElementById("modalQtyInput").value, 10) || 1);
  const previewQty = ownedQty + stepperQty;
  const tier = getTier(previewQty);
  const next = getNextTier(previewQty);

  document.getElementById("modalCurrentPrice").innerHTML = `${formatMoney(p[tier.key])} <small>c/u</small>`;
  document.getElementById("modalUpsell").textContent = next
    ? `Agrega ${next.min - previewQty} más y paga ${formatMoney(p[next.key])} c/u`
    : "Ya tienes el mejor precio por volumen";

  document.querySelectorAll("#priceTiers tr").forEach(tr => {
    tr.classList.toggle("tier-active", tr.dataset.tier === tier.key);
  });
}

// ============================================================
// CARRITO — lógica
// ============================================================
function addToCart(productId, qty){
  const existing = cart[productId];
  if (existing && existing.type === "regular"){
    existing.qty += qty;
  } else {
    cart[productId] = { type: "regular", productId, qty };
  }
  saveCart();
  renderAll();
  showToast(`Agregado: ${productsById[productId].name} ×${qty}`);
}

function addMixedToCart(productId, bundles){
  const key = productId + "__mixed";
  const existing = cart[key];
  if (existing){
    existing.bundles += bundles;
  } else {
    cart[key] = { type: "mixed", productId, bundles };
  }
  saveCart();
  renderAll();
  const p = productsById[productId];
  showToast(`Agregado: Paquete mixto ${p.name} ×${bundles}`);
}

function updateLineQty(lineKey, newQty){
  const line = cart[lineKey];
  if (!line) return;
  if (line.type === "regular"){
    if (newQty <= 0){ delete cart[lineKey]; }
    else { line.qty = newQty; }
  } else {
    if (newQty <= 0){ delete cart[lineKey]; }
    else { line.bundles = newQty; }
  }
  saveCart();
  renderAll();
}

function removeLine(lineKey){
  delete cart[lineKey];
  saveCart();
  renderAll();
}

function clearCart(){
  cart = {};
  saveCart();
  renderAll();
}

function cartLineAmount(line){
  const p = productsById[line.productId];
  if (line.type === "regular"){
    const tier = getTier(line.qty);
    return { unit: p[tier.key], total: p[tier.key] * line.qty, tierLabel: tier.label };
  } else {
    const totalPieces = p.mixedQty * line.bundles;
    return { unit: p.mixedPrice, total: p.mixedPrice * totalPieces, tierLabel: `Paquete mixto · ${totalPieces} pz` };
  }
}

function cartTotal(){
  return Object.values(cart).reduce((sum, line) => sum + cartLineAmount(line).total, 0);
}

function cartItemCount(){
  return Object.values(cart).reduce((sum, line) => {
    return sum + (line.type === "regular" ? line.qty : line.bundles * productsById[line.productId].mixedQty);
  }, 0);
}

// ============================================================
// RENDER: CARRITO
// ============================================================
function renderCart(){
  const items = Object.entries(cart);
  const container = document.getElementById("cartItems");

  if (items.length === 0){
    container.innerHTML = `
      <div class="cart-empty" id="cartEmpty">
        <p>Tu carrito está vacío.</p>
        <p class="cart-empty-sub">Agrega productos para armar tu pedido de mayoreo.</p>
      </div>`;
  } else {
    container.innerHTML = items.map(([key, line]) => {
      const p = productsById[line.productId];
      const amount = cartLineAmount(line);
      const qty = line.type === "regular" ? line.qty : line.bundles;
      const cover = p.images[0] ? imgPath(p, p.images[0]) : "";
      const lineName = line.type === "mixed" ? `${p.name} <span class="cart-line-badge">Paquete mixto</span>` : p.name;
      return `
      <div class="cart-line" data-line-key="${key}">
        <img src="${cover}" alt="${p.name}">
        <div>
          <p class="cart-line-name">${lineName}</p>
          <p class="cart-line-tier">${amount.tierLabel}</p>
          <div class="cart-line-controls">
            <div class="stepper">
              <button class="step-btn" data-action="line-minus">−</button>
              <input type="number" min="0" value="${qty}" data-role="line-qty">
              <button class="step-btn" data-action="line-plus">+</button>
            </div>
            <button class="cart-line-remove" data-action="line-remove">Eliminar</button>
          </div>
        </div>
        <div class="cart-line-amount">
          ${formatMoney(amount.total)}
          <span class="cart-line-unit">${formatMoney(amount.unit)} c/u</span>
        </div>
      </div>`;
    }).join("");
  }

  document.getElementById("cartTotal").textContent = formatMoney(cartTotal());
  document.getElementById("cartCount").textContent = cartItemCount();
}

function renderAll(){
  renderCart();
  refreshCardPricing();
  if (modalState.productId) updateModalPricing();
}

// ============================================================
// WHATSAPP
// ============================================================
function buildWhatsappMessage(){
  const lines = ["Hola Straven, quiero hacer el siguiente pedido:", ""];
  let i = 1;
  Object.values(cart).forEach(line => {
    const p = productsById[line.productId];
    const amount = cartLineAmount(line);
    const qty = line.type === "regular" ? line.qty : line.bundles * p.mixedQty;
    lines.push(`${i}. ${p.name} ×${qty} (${amount.tierLabel}) — ${formatMoney(amount.unit)} c/u = ${formatMoney(amount.total)}`);
    i++;
  });
  lines.push("", `Total: ${formatMoney(cartTotal())}`, "", "Gracias!");
  return lines.join("\n");
}

function sendWhatsappOrder(){
  if (Object.keys(cart).length === 0){
    showToast("Tu carrito está vacío");
    return;
  }
  const msg = encodeURIComponent(buildWhatsappMessage());
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, "_blank");
}

// ============================================================
// TOAST
// ============================================================
let toastTimer = null;
function showToast(text){
  const toast = document.getElementById("toast");
  toast.textContent = text;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}

// ============================================================
// EVENTOS
// ============================================================
function setupCatalogEvents(){
  document.getElementById("catalog").addEventListener("click", (e) => {
    const card = e.target.closest(".product-card");
    if (!card) return;
    const id = card.dataset.productId;
    const qtyInput = card.querySelector('[data-role="qty-input"]');
    const actionEl = e.target.closest("[data-action]");
    const action = actionEl ? actionEl.dataset.action : null;

    if (action === "open-modal"){ openModal(id); return; }
    if (action === "qty-minus"){
      qtyInput.value = Math.max(1, (parseInt(qtyInput.value,10)||1) - 1);
      refreshCardPricing();
      return;
    }
    if (action === "qty-plus"){
      qtyInput.value = (parseInt(qtyInput.value,10)||1) + 1;
      refreshCardPricing();
      return;
    }
    if (action === "add-cart"){
      const qty = Math.max(1, parseInt(qtyInput.value,10) || 1);
      addToCart(id, qty);
      qtyInput.value = 1;
      return;
    }
    if (action === "add-mixed"){
      addMixedToCart(id, 1);
      return;
    }
  });

  document.getElementById("catalog").addEventListener("input", (e) => {
    if (e.target.dataset.role === "qty-input") refreshCardPricing();
  });

  document.getElementById("catNavInner").addEventListener("click", (e) => {
    const pill = e.target.closest(".cat-pill");
    if (!pill) return;
    document.querySelectorAll(".cat-pill").forEach(p => p.classList.remove("active"));
    pill.classList.add("active");
  });
}

function setupModalEvents(){
  document.getElementById("modalClose").addEventListener("click", closeModal);
  document.getElementById("modalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "modalOverlay") closeModal();
  });
  document.getElementById("galleryPrev").addEventListener("click", () => setGalleryIndex(-1));
  document.getElementById("galleryNext").addEventListener("click", () => setGalleryIndex(1));
  document.getElementById("galleryThumbs").addEventListener("click", (e) => {
    const img = e.target.closest("img[data-idx]");
    if (!img) return;
    modalState.imgIndex = parseInt(img.dataset.idx, 10);
    renderGallery(productsById[modalState.productId]);
  });

  const qtyInput = document.getElementById("modalQtyInput");
  document.getElementById("modalQtyMinus").addEventListener("click", () => {
    qtyInput.value = Math.max(1, (parseInt(qtyInput.value,10)||1) - 1);
    updateModalPricing();
  });
  document.getElementById("modalQtyPlus").addEventListener("click", () => {
    qtyInput.value = (parseInt(qtyInput.value,10)||1) + 1;
    updateModalPricing();
  });
  qtyInput.addEventListener("input", updateModalPricing);

  document.getElementById("modalAddBtn").addEventListener("click", () => {
    const qty = Math.max(1, parseInt(qtyInput.value,10) || 1);
    addToCart(modalState.productId, qty);
    qtyInput.value = 1;
    updateModalPricing();
  });
  document.getElementById("modalMixedBtn").addEventListener("click", () => {
    addMixedToCart(modalState.productId, 1);
  });

  document.addEventListener("keydown", (e) => {
    if (!document.getElementById("modalOverlay").classList.contains("open")) return;
    if (e.key === "Escape") closeModal();
    if (e.key === "ArrowLeft") setGalleryIndex(-1);
    if (e.key === "ArrowRight") setGalleryIndex(1);
  });
}

function setupCartEvents(){
  const drawer = document.getElementById("cartDrawer");
  const overlay = document.getElementById("cartOverlay");
  const open = () => { drawer.classList.add("open"); overlay.classList.add("open"); };
  const close = () => { drawer.classList.remove("open"); overlay.classList.remove("open"); };

  document.getElementById("cartToggle").addEventListener("click", open);
  document.getElementById("cartClose").addEventListener("click", close);
  overlay.addEventListener("click", close);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

  document.getElementById("cartItems").addEventListener("click", (e) => {
    const line = e.target.closest(".cart-line");
    if (!line) return;
    const key = line.dataset.lineKey;
    const input = line.querySelector('[data-role="line-qty"]');
    const action = e.target.dataset.action;
    if (action === "line-minus"){
      updateLineQty(key, Math.max(0, (parseInt(input.value,10)||0) - 1));
    } else if (action === "line-plus"){
      updateLineQty(key, (parseInt(input.value,10)||0) + 1);
    } else if (action === "line-remove"){
      removeLine(key);
    }
  });
  document.getElementById("cartItems").addEventListener("change", (e) => {
    if (e.target.dataset.role !== "line-qty") return;
    const line = e.target.closest(".cart-line");
    const key = line.dataset.lineKey;
    updateLineQty(key, Math.max(0, parseInt(e.target.value,10) || 0));
  });

  document.getElementById("cartWhatsappBtn").addEventListener("click", sendWhatsappOrder);
  document.getElementById("cartClearBtn").addEventListener("click", () => {
    if (Object.keys(cart).length === 0) return;
    clearCart();
    showToast("Carrito vaciado");
  });
}

// ============================================================
// INIT
// ============================================================
function init(){
  loadCart();
  renderCatalog();
  startCardImageCycling();
  setupScrollspy();
  setupCatalogEvents();
  setupModalEvents();
  setupCartEvents();
  renderAll();
}

document.addEventListener("DOMContentLoaded", init);
