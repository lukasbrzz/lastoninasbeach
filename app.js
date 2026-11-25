const DATA_URL = "./imagenes/data.json";
const INITIAL_UNIT_LIMIT = 3;
const state = { site: {}, units: [], complexes: [], heroSlides: [], heroSlideIndex: 0, cardImages: new Map(), activeUnit: null, activePhoto: 0, showAllUnits: false };

const elements = {
  grid: document.querySelector("#unit-grid"),
  complexShowcase: document.querySelector("#complex-showcase-grid"),
  results: document.querySelector("#results-count"),
  empty: document.querySelector("#empty-state"),
  showMore: document.querySelector("#show-more-units"),
  complex: document.querySelector("#filter-complex"),
  capacity: document.querySelector("#filter-capacity"),
  amenity: document.querySelector("#filter-amenity"),
  clear: document.querySelector("#clear-filters"),
  dialog: document.querySelector("#unit-dialog"),
  dialogContent: document.querySelector("#dialog-content"),
  toast: document.querySelector("#toast"),
  menu: document.querySelector(".menu-toggle"),
  nav: document.querySelector("#primary-nav"),
};

const escapeHTML = (value = "") =>
  String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);

function resolveImagePath(path) {
  const value = String(path ?? "").trim().replaceAll("\\", "/");
  if (/^(https?:)?\/\//i.test(value) || value.startsWith("data:")) return value;
  const relative = value
    .replace(/^\.\/imagenes\//i, "")
    .replace(/^imagenes\//i, "")
    .replace(/^\.\/+/, "")
    .replace(/^\/+/, "");
  return `./imagenes/${relative}`;
}

function showHeroSlide(index) {
  if (!state.heroSlides.length) return;
  state.heroSlideIndex = (index + state.heroSlides.length) % state.heroSlides.length;
  const slide = state.heroSlides[state.heroSlideIndex];
  const image = document.querySelector(".hero-image");
  image.src = resolveImagePath(slide.imagen_principal);
  image.alt = `Entrada de ${slide.nombre}`;
  document.querySelector("#hero-slide-name").textContent = slide.nombre;
  document.querySelector("#hero-slide-index").textContent = String(state.heroSlideIndex + 1).padStart(2, "0");
  document.querySelectorAll("[data-hero-slide]").forEach((button, buttonIndex) => {
    button.setAttribute("aria-current", String(buttonIndex === state.heroSlideIndex));
  });
}

function renderHeroCarousel() {
  state.heroSlides = state.complexes.filter((complex) => complex.imagen_principal);
  const controls = document.querySelector(".hero-carousel-controls");
  if (!state.heroSlides.length) {
    controls.hidden = true;
    return;
  }
  const dots = document.querySelector("#hero-carousel-dots");
  dots.innerHTML = state.heroSlides
    .map((slide, index) => `<button type="button" data-hero-slide="${index}" aria-label="Mostrar foto de ${escapeHTML(slide.nombre)}" aria-current="false"></button>`)
    .join("");
  showHeroSlide(0);
}

function isYes(value) {
  return value === true || ["si", "sí", "true", "1", "yes"].includes(String(value ?? "").trim().toLowerCase());
}

function getComplexName(unit) {
  return state.complexes.find((complex) => String(complex.id) === String(unit.complejo_id))?.nombre ?? "Complejo";
}

function getComplex(unit) {
  return state.complexes.find((complex) => String(complex.id) === String(unit.complejo_id));
}

function mapSearchHref(query) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function getFeatures(unit) {
  const description = String(unit.descripcion ?? "").toLowerCase();
  const facts = [];
  if (isYes(unit.wifi) || /\bwi[\s-]?fi\b/.test(description)) facts.push(["wifi", "Wi-Fi"]);
  if (/\b(parrilla|quincho|asado)\b/.test(description)) facts.push(["parrilla", "Parrilla"]);
  if (/\b(cochera|estacionamiento|entrada de auto)\b/.test(description)) facts.push(["cochera", "Cochera"]);
  if (isYes(unit.mascotas)) facts.push(["mascotas", "Mascotas"]);
  if (/\b(aire acondicionado|aire acond\.)\b/.test(description)) facts.push(["aire", "Aire"]);
  return facts;
}

function getBeachLocation(unit) {
  const text = String(unit.descripcion ?? "").toLowerCase();
  const match = text.match(/(?:a\s*)?(\d{1,2})\s*cuad(?:ras|ra|as)?\s*(?:de\s*)?(?:la\s*)?(?:playa|costa|mar)\b/);
  if (match) return `A ${match[1]} ${Number(match[1]) === 1 ? "cuadra" : "cuadras"} de la playa`;
  if (/\b(a pasos del mar|cerca del mar|cerca de la playa|a pasos de la playa)\b/.test(text)) return "Cerca de la playa";
  return "Las Toninas · consultá distancia";
}

function getShortDescription(unit) {
  const plain = String(unit.descripcion ?? "").replace(/\s+/g, " ").trim();
  return plain.length > 150 ? `${plain.slice(0, 147).trimEnd()}…` : plain;
}

function whatsappPhone() {
  return String(state.site.contacto?.whatsapp ?? "").replace(/\D/g, "");
}

function whatsappHref(unit, message, phoneNumber = whatsappPhone()) {
  const destination = unit
    ? `disponibilidad y tarifas para ${getComplexName(unit)} — ${unit.nombre}`
    : "un alojamiento";
  const text = message || `Hola, quería consultar ${destination} en ${state.site.localidad || "Las Toninas"}.`;
  const phone = String(phoneNumber ?? "").replace(/\D/g, "");
  const base = phone ? `https://wa.me/${phone}?text=` : "https://wa.me/?text=";
  return `${base}${encodeURIComponent(text)}`;
}

function renderContactMethods() {
  const container = document.querySelector("#contact-methods");
  if (!container) return;
  const contact = state.site.contacto ?? {};
  const phones = Array.isArray(contact.telefonos) ? contact.telefonos : [];
  const phoneLinks = phones
    .filter((phone) => phone?.texto && phone?.tel)
    .map((phone) => `<a href="tel:${escapeHTML(phone.tel)}">${escapeHTML(phone.texto)}</a>`);
  if (contact.email) phoneLinks.push(`<a href="mailto:${escapeHTML(contact.email)}">${escapeHTML(contact.email)}</a>`);
  container.innerHTML = phoneLinks.join("");
}

function iconFor(feature) {
  return ({ wifi: "⌁", parrilla: "♨", cochera: "⌂", mascotas: "♡", aire: "❄" })[feature] ?? "•";
}

function renderComplexOptions() {
  const names = new Map();
  for (const complex of state.complexes) {
    if (state.units.some((unit) => String(unit.complejo_id) === String(complex.id))) names.set(String(complex.id), complex.nombre);
  }
  elements.complex.insertAdjacentHTML("beforeend", [...names].map(([id, name]) =>
    `<option value="${escapeHTML(id)}">${escapeHTML(name)}</option>`).join(""));
  renderComplexShowcase();
}

function renderComplexShowcase() {
  elements.complexShowcase.innerHTML = state.complexes
    .filter((complex) => state.units.some((unit) => String(unit.complejo_id) === String(complex.id)))
    .map((complex) => {
      const units = state.units.filter((unit) => String(unit.complejo_id) === String(complex.id));
      const photoPath = complex.imagen_principal || units[0]?.imagenes?.[0];
      const fallbackPhoto = units[0]?.imagenes?.[0];
      const image = photoPath ? resolveImagePath(photoPath) : "";
      const fallbackImage = fallbackPhoto ? resolveImagePath(fallbackPhoto) : "";
      const link = `./index.html?complejo=${encodeURIComponent(complex.id)}#alojamientos`;
      return `
        <a class="complex-showcase-card" href="${link}">
          ${image ? `<img src="${escapeHTML(image)}" data-fallback-src="${image !== fallbackImage ? escapeHTML(fallbackImage) : ""}" alt="" loading="lazy" />` : ""}
          <span class="showcase-shade"></span>
          <span class="showcase-copy">
            <small>${units.length} ${units.length === 1 ? "UNIDAD" : "UNIDADES"}</small>
            <strong>${escapeHTML(complex.nombre)}</strong>
            <span>Explorar <span aria-hidden="true">↗</span></span>
          </span>
        </a>`;
    }).join("");
}

function matchesFilters(unit) {
  const selectedComplex = elements.complex.value;
  const minimumCapacity = Number(elements.capacity.value || 0);
  const selectedAmenity = elements.amenity.value;
  if (selectedComplex && String(unit.complejo_id) !== selectedComplex) return false;
  if (Number(unit.capacidad || 0) < minimumCapacity) return false;
  if (selectedAmenity === "wifi" && !getFeatures(unit).some(([feature]) => feature === "wifi")) return false;
  if (selectedAmenity === "parrilla" && !getFeatures(unit).some(([feature]) => feature === "parrilla")) return false;
  if (selectedAmenity === "cochera" && !getFeatures(unit).some(([feature]) => feature === "cochera")) return false;
  if (selectedAmenity === "mascotas" && !getFeatures(unit).some(([feature]) => feature === "mascotas")) return false;
  return true;
}

function renderCard(unit) {
  const id = String(unit.id);
  const images = Array.isArray(unit.imagenes) ? unit.imagenes : [];
  const imageIndex = state.cardImages.get(id) ?? 0;
  const image = images.length ? resolveImagePath(images[imageIndex % images.length]) : "";
  const features = getFeatures(unit).slice(0, 3);
  const facts = [
    `<span class="fact"><span class="fact-icon" aria-hidden="true">⌖</span>${escapeHTML(getBeachLocation(unit))}</span>`,
    ...features.map(([feature, label]) => `<span class="fact"><span class="fact-icon" aria-hidden="true">${iconFor(feature)}</span>${escapeHTML(label)}</span>`),
  ].join("");
  return `
    <article class="unit-card" data-unit-id="${escapeHTML(id)}">
      <div class="card-photo">
        ${image ? `<img src="${escapeHTML(image)}" alt="${escapeHTML(`${unit.nombre} · ${getComplexName(unit)}`)}" loading="lazy" />` : ""}
        <span class="complex-tag">${escapeHTML(getComplexName(unit))}</span>
        ${images.length > 1 ? `<button class="card-gallery-arrow prev" type="button" aria-label="Foto anterior" data-gallery-step="-1" data-id="${escapeHTML(id)}">‹</button><button class="card-gallery-arrow next" type="button" aria-label="Foto siguiente" data-gallery-step="1" data-id="${escapeHTML(id)}">›</button>` : ""}
        <span class="photo-count">▧ &nbsp;${images.length} fotos</span>
        <span class="card-photo-shade"></span>
      </div>
      <div class="card-content">
        <p class="card-kicker">${escapeHTML(unit.habitaciones ?? "—")} ${Number(unit.habitaciones) === 1 ? "DORMITORIO" : "DORMITORIOS"} <span aria-hidden="true">·</span> ${escapeHTML(unit.banios ?? "—")} ${Number(unit.banios) === 1 ? "BAÑO" : "BAÑOS"}</p>
        <div class="card-title-row"><h3>${escapeHTML(unit.nombre || "Alojamiento")}</h3><span class="card-capacity"><span aria-hidden="true">♙</span> Hasta ${escapeHTML(unit.capacidad ?? "—")}</span></div>
        <p class="card-description">${escapeHTML(getShortDescription(unit))}</p>
        <div class="card-facts">${facts}</div>
        <div class="card-actions">
          <button class="detail-link" type="button" data-open-unit="${escapeHTML(id)}">Ver alojamiento <span aria-hidden="true">↗</span></button>
          <a class="whatsapp-link" href="${escapeHTML(whatsappHref(unit))}" target="_blank" rel="noopener noreferrer" aria-label="Consultar ${escapeHTML(unit.nombre)} por WhatsApp">WhatsApp</a>
        </div>
      </div>
    </article>`;
}

function renderUnits() {
  const filtered = state.units.filter(matchesFilters);
  const visibleUnits = state.showAllUnits ? filtered : filtered.slice(0, INITIAL_UNIT_LIMIT);
  elements.grid.innerHTML = visibleUnits.map(renderCard).join("");
  const suffix = filtered.length > INITIAL_UNIT_LIMIT && !state.showAllUnits
    ? ` <span>· mostrando ${visibleUnits.length} de ${filtered.length}</span>`
    : ` <span>para descubrir</span>`;
  elements.results.innerHTML = `${filtered.length} ${filtered.length === 1 ? "alojamiento" : "alojamientos"}${suffix}`;
  elements.showMore.hidden = filtered.length <= INITIAL_UNIT_LIMIT;
  elements.showMore.setAttribute("aria-expanded", String(state.showAllUnits));
  elements.showMore.textContent = state.showAllUnits ? "Ver menos alojamientos" : `Ver más alojamientos (${filtered.length - INITIAL_UNIT_LIMIT})`;
  elements.empty.hidden = filtered.length !== 0;
  elements.grid.hidden = visibleUnits.length === 0;
}

function getUnitById(id) {
  return state.units.find((unit) => String(unit.id) === String(id));
}

function renderDialog(unit) {
  state.activeUnit = unit;
  state.activePhoto = 0;
  const images = Array.isArray(unit.imagenes) ? unit.imagenes : [];
  const complex = getComplexName(unit);
  const complexData = getComplex(unit);
  const address = complexData?.ubicacion?.direccion;
  const mapQuery = complexData?.ubicacion?.consultaMapa;
  const features = getFeatures(unit);
  const featureMarkup = features.map(([feature, label]) =>
    `<span class="fact"><span class="fact-icon" aria-hidden="true">${iconFor(feature)}</span>${escapeHTML(label)}</span>`).join("");
  const description = String(unit.descripcion || "Descripción pendiente de completar.");
  elements.dialogContent.innerHTML = `
    <div class="dialog-layout">
      <div class="dialog-gallery">
        ${images.length ? `<img id="dialog-image" src="${escapeHTML(resolveImagePath(images[0]))}" alt="${escapeHTML(unit.nombre)} · foto 1" />` : ""}
        <div class="gallery-controls">
          <button type="button" data-dialog-step="-1" aria-label="Foto anterior">‹</button>
          <span class="gallery-indicator" id="gallery-indicator">1 / ${images.length}</span>
          <button type="button" data-dialog-step="1" aria-label="Foto siguiente">›</button>
        </div>
      </div>
      <div class="dialog-body">
        <p class="eyebrow">${escapeHTML(complex)}</p>
        <h2 id="dialog-title">${escapeHTML(unit.nombre)}</h2>
        <p class="dialog-subtitle">Las Toninas, Buenos Aires · ${escapeHTML(getBeachLocation(unit))}</p>
        ${address ? `<p class="dialog-address">${escapeHTML(address)}</p>` : ""}
        ${mapQuery ? `<a class="dialog-map-link" href="${escapeHTML(mapSearchHref(mapQuery))}" target="_blank" rel="noopener noreferrer">Ver ubicación en Google Maps <span aria-hidden="true">↗</span></a>` : ""}
        <div class="dialog-highlights">
          <span class="fact"><span class="fact-icon" aria-hidden="true">♙</span>Hasta ${escapeHTML(unit.capacidad ?? "—")} personas</span>
          <span class="fact"><span class="fact-icon" aria-hidden="true">⌂</span>${escapeHTML(unit.habitaciones ?? "—")} dormitorios</span>
          <span class="fact"><span class="fact-icon" aria-hidden="true">◌</span>${escapeHTML(unit.banios ?? "—")} baños</span>
          ${featureMarkup}
        </div>
        <p class="dialog-description">${escapeHTML(description)}</p>
        <div class="dialog-rules">
          <h3>Para tener en cuenta</h3>
          <p>Los horarios de ingreso y egreso, las reglas de convivencia y la disponibilidad no están detallados en los datos recibidos. Consultalos al reservar.</p>
        </div>
        <div class="dialog-actions">
          <a class="button button-dark" href="${escapeHTML(whatsappHref(unit))}" target="_blank" rel="noopener noreferrer">Consultar por WhatsApp <span aria-hidden="true">↗</span></a>
          <button class="button button-share" type="button" data-share-unit="${escapeHTML(unit.id)}">Compartir <span aria-hidden="true">↗</span></button>
        </div>
      </div>
    </div>`;
  if (!elements.dialog.open) elements.dialog.showModal();
  document.body.classList.add("dialog-open");
}

function changeDialogPhoto(step) {
  const unit = state.activeUnit;
  const images = unit?.imagenes ?? [];
  if (!images.length) return;
  state.activePhoto = (state.activePhoto + step + images.length) % images.length;
  const image = document.querySelector("#dialog-image");
  image.src = resolveImagePath(images[state.activePhoto]);
  image.alt = `${unit.nombre} · foto ${state.activePhoto + 1}`;
  document.querySelector("#gallery-indicator").textContent = `${state.activePhoto + 1} / ${images.length}`;
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => elements.toast.classList.remove("visible"), 2600);
}

async function shareUnit(id) {
  const unit = getUnitById(id);
  if (!unit) return;
  const url = new URL(window.location.href);
  url.hash = `unidad=${encodeURIComponent(unit.id)}`;
  const shareData = { title: `${unit.nombre} · ${getComplexName(unit)}`, text: `Mirá este alojamiento en Las Toninas: ${unit.nombre}.`, url: url.href };
  try {
    if (navigator.share) await navigator.share(shareData);
    else {
      await navigator.clipboard.writeText(url.href);
      showToast("Enlace copiado. ¡Compartilo con quien quieras!");
    }
  } catch (error) {
    if (error?.name === "AbortError") return;
    try {
      await navigator.clipboard.writeText(url.href);
      showToast("Enlace copiado. ¡Compartilo con quien quieras!");
    } catch (clipboardError) {
      showToast("No pudimos copiar el enlace desde este navegador.");
      console.error("No se pudo compartir ni copiar el enlace.", clipboardError);
    }
  }
}

function closeDialog(updateHash = true) {
  if (elements.dialog.open) elements.dialog.close();
  document.body.classList.remove("dialog-open");
  state.activeUnit = null;
  if (updateHash && location.hash.startsWith("#unidad=")) history.replaceState(null, "", `${location.pathname}${location.search}`);
}

function openUnit(id, updateHash = true) {
  const unit = getUnitById(id);
  if (!unit) return;
  renderDialog(unit);
  if (updateHash) history.replaceState(null, "", `#unidad=${encodeURIComponent(unit.id)}`);
}

function openUnitFromHash() {
  const match = location.hash.match(/^#unidad=(.+)$/);
  if (match) openUnit(decodeURIComponent(match[1]), false);
}

function setFiltersToDefault() {
  state.showAllUnits = false;
  elements.complex.value = "";
  elements.capacity.value = "0";
  elements.amenity.value = "";
  renderUnits();
}

function applySiteData() {
  const name = state.site.nombre || "La Comarca";
  const localidad = state.site.localidad || "Las Toninas";
  const provincia = state.site.provincia || "Buenos Aires";
  const mapQuery = state.site.ubicacion?.consultaMapa || `${localidad}, ${provincia}`;
  document.title = `${name} · Tu descanso en ${localidad}`;
  document.querySelectorAll("[data-site-name]").forEach((element) => { element.textContent = name; });
  document.querySelector("#site-presentation").textContent =
    state.site.presentacion || "Unidades cómodas y equipadas para compartir la costa en familia o con amigos.";
  document.querySelector("#map-locality").textContent = localidad;
  document.querySelector(".map-card iframe").src =
    `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&t=&z=13&ie=UTF8&iwloc=&output=embed`;
  document.querySelector("#map-link").href =
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`;
  const complexMapLinks = document.querySelector("#complex-map-links");
  if (complexMapLinks) {
    complexMapLinks.innerHTML = state.complexes
      .filter((complex) => complex.ubicacion?.direccion && complex.ubicacion?.consultaMapa)
      .map((complex) => `<li><a href="${escapeHTML(mapSearchHref(complex.ubicacion.consultaMapa))}" target="_blank" rel="noopener noreferrer"><strong>${escapeHTML(complex.nombre)}</strong><span>${escapeHTML(complex.ubicacion.direccion)}</span></a></li>`)
      .join("");
  }
  renderContactMethods();
  document.querySelector("#general-whatsapp").href = whatsappHref(null);
  const skatingText = "Hola, viajo a un torneo de patín artístico y quería consultar por alojamiento y tarifas para el grupo.";
  document.querySelector("#skating-whatsapp").href = whatsappHref(null, skatingText);
  const floatingPhone = String(state.site.contacto?.whatsappFlotante ?? "").replace(/\D/g, "");
  const floatingMessage = encodeURIComponent("Hola, quería consultar por un alojamiento en Las Toninas.");
  document.querySelector("#floating-whatsapp").href = `https://wa.me/${floatingPhone}?text=${floatingMessage}`;
  renderHeroCarousel();
}

function wireEvents() {
  document.addEventListener("error", (event) => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement) || !image.classList.contains("local-feature-photo")) return;
    image.hidden = true;
    const photo = image.closest(".skating-photo");
    if (photo) photo.hidden = true;
    const gallery = image.closest(".skating-gallery");
    if (gallery && !gallery.querySelector(".skating-photo:not([hidden])")) gallery.hidden = true;
  }, true);
  [elements.complex, elements.capacity, elements.amenity].forEach((input) => input.addEventListener("change", () => {
    state.showAllUnits = false;
    renderUnits();
  }));
  elements.showMore.addEventListener("click", () => {
    state.showAllUnits = !state.showAllUnits;
    renderUnits();
  });
  elements.complexShowcase.addEventListener("error", (event) => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement)) return;
    const fallback = image.dataset.fallbackSrc;
    if (fallback && !image.dataset.fallbackApplied) {
      image.dataset.fallbackApplied = "true";
      image.src = fallback;
    } else {
      image.hidden = true;
    }
  }, true);
  elements.clear.addEventListener("click", setFiltersToDefault);
  document.querySelector("#empty-clear").addEventListener("click", setFiltersToDefault);
  document.querySelector(".hero-carousel-controls").addEventListener("click", (event) => {
    const step = event.target.closest("[data-hero-step]");
    if (step) {
      showHeroSlide(state.heroSlideIndex + Number(step.dataset.heroStep));
      return;
    }
    const dot = event.target.closest("[data-hero-slide]");
    if (dot) showHeroSlide(Number(dot.dataset.heroSlide));
  });
  elements.grid.addEventListener("click", (event) => {
    const openButton = event.target.closest("[data-open-unit]");
    if (openButton) {
      openUnit(openButton.dataset.openUnit);
      return;
    }
    const galleryButton = event.target.closest("[data-gallery-step]");
    if (galleryButton) {
      const { id } = galleryButton.dataset;
      const unit = getUnitById(id);
      if (!unit) return;
      const images = unit.imagenes ?? [];
      state.cardImages.set(id, ((state.cardImages.get(id) ?? 0) + Number(galleryButton.dataset.galleryStep) + images.length) % images.length);
      const card = galleryButton.closest(".unit-card");
      const image = card.querySelector(".card-photo > img");
      image.src = resolveImagePath(images[state.cardImages.get(id)]);
      image.alt = `${unit.nombre} · ${getComplexName(unit)}`;
    }
  });
  elements.dialogContent.addEventListener("click", (event) => {
    const step = event.target.closest("[data-dialog-step]");
    if (step) changeDialogPhoto(Number(step.dataset.dialogStep));
    const share = event.target.closest("[data-share-unit]");
    if (share) shareUnit(share.dataset.shareUnit);
  });
  document.querySelector("#dialog-close").addEventListener("click", () => closeDialog());
  elements.dialog.addEventListener("click", (event) => {
    if (event.target === elements.dialog) closeDialog();
  });
  elements.dialog.addEventListener("close", () => {
    document.body.classList.remove("dialog-open");
    if (location.hash.startsWith("#unidad=")) history.replaceState(null, "", `${location.pathname}${location.search}`);
  });
  elements.menu.addEventListener("click", () => {
    const expanded = elements.menu.getAttribute("aria-expanded") === "true";
    elements.menu.setAttribute("aria-expanded", String(!expanded));
    elements.menu.setAttribute("aria-label", expanded ? "Abrir menú" : "Cerrar menú");
    elements.nav.classList.toggle("is-open", !expanded);
  });
  elements.nav.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      elements.menu.setAttribute("aria-expanded", "false");
      elements.menu.setAttribute("aria-label", "Abrir menú");
      elements.nav.classList.remove("is-open");
    }
  });
  window.addEventListener("hashchange", openUnitFromHash);
}

async function initialize() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-cache" });
    if (!response.ok) throw new Error(`No se pudo cargar ${DATA_URL} (${response.status}).`);
    const data = await response.json();
    state.site = data.sitio && typeof data.sitio === "object" ? data.sitio : {};
    state.complexes = Array.isArray(data.complejos) ? data.complejos : [];
    state.units = Array.isArray(data.duplex) ? data.duplex : [];
    if (!state.units.length) throw new Error("El archivo JSON no contiene unidades en la propiedad «duplex».");
    applySiteData();
    renderComplexOptions();
    const requestedComplex = new URLSearchParams(location.search).get("complejo");
    if (requestedComplex && state.complexes.some((complex) =>
      String(complex.id) === requestedComplex && state.units.some((unit) => String(unit.complejo_id) === requestedComplex))) {
      elements.complex.value = requestedComplex;
    }
    renderUnits();
    wireEvents();
    openUnitFromHash();
  } catch (error) {
    elements.results.textContent = "No se pudieron cargar los alojamientos.";
    elements.grid.innerHTML = `<p class="load-error">Ocurrió un problema al leer el catálogo. Verificá que <code>imagenes/data.json</code> exista y abrí el sitio desde un servidor local.</p>`;
    console.error("Error al iniciar el catálogo de alojamientos.", error);
  }
}

initialize();
