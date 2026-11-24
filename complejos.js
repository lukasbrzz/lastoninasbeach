const DATA_URL = "./imagenes/data.json";
const state = { site: {}, complexes: [], units: [] };
const elements = {
  search: document.querySelector("#complex-search"),
  amenity: document.querySelector("#complex-amenity"),
  grid: document.querySelector("#complex-directory-grid"),
  results: document.querySelector("#complex-results"),
  empty: document.querySelector("#complex-empty"),
};

const escapeHTML = (value = "") =>
  String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);

function resolveImagePath(path) {
  const value = String(path ?? "").trim().replaceAll("\\", "/");
  if (/^(https?:)?\/\//i.test(value) || value.startsWith("data:")) return value;
  return `./imagenes/${value.replace(/^\.\/imagenes\//i, "").replace(/^imagenes\//i, "").replace(/^\.\/+/, "").replace(/^\/+/, "")}`;
}

function whatsappPhone() {
  return String(state.site.contacto?.whatsapp ?? "").replace(/\D/g, "");
}

function whatsappHref(phone, message) {
  const number = String(phone ?? "").replace(/\D/g, "");
  const text = encodeURIComponent(message);
  return `${number ? `https://wa.me/${number}` : "https://wa.me/"}?text=${text}`;
}

function mapSearchHref(query) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function renderContactMethods() {
  const container = document.querySelector("#contact-methods");
  if (!container) return;
  const contact = state.site.contacto ?? {};
  const phones = Array.isArray(contact.telefonos) ? contact.telefonos : [];
  const links = phones
    .filter((phone) => phone?.texto && phone?.tel)
    .map((phone) => `<a href="tel:${escapeHTML(phone.tel)}">${escapeHTML(phone.texto)}</a>`);
  if (contact.email) links.push(`<a href="mailto:${escapeHTML(contact.email)}">${escapeHTML(contact.email)}</a>`);
  container.innerHTML = links.join("");
}

function yes(value) {
  return value === true || ["si", "sí", "true", "1", "yes"].includes(String(value ?? "").trim().toLowerCase());
}

function features(unit) {
  const text = String(unit.descripcion ?? "").toLowerCase();
  const result = [];
  if (yes(unit.wifi) || /\bwi[\s-]?fi\b/.test(text)) result.push("wifi");
  if (/\b(parrilla|quincho|asado)\b/.test(text)) result.push("parrilla");
  if (/\b(cochera|estacionamiento|entrada de auto)\b/.test(text)) result.push("cochera");
  if (yes(unit.mascotas)) result.push("mascotas");
  return result;
}

function getComplexUnits(complex) {
  return state.units.filter((unit) => String(unit.complejo_id) === String(complex.id));
}

function matchesComplex(complex) {
  const query = elements.search.value.trim().toLocaleLowerCase("es");
  const name = String(complex.nombre ?? "").toLocaleLowerCase("es");
  if (query && !name.includes(query)) return false;
  const selectedAmenity = elements.amenity.value;
  if (selectedAmenity && !getComplexUnits(complex).some((unit) => features(unit).includes(selectedAmenity))) return false;
  return true;
}

function renderComplex(complex) {
  const units = getComplexUnits(complex);
  const firstUnit = units[0];
  const photo = firstUnit?.imagenes?.[0] ? resolveImagePath(firstUnit.imagenes[0]) : "";
  const mainPhoto = complex.imagen_principal ? resolveImagePath(complex.imagen_principal) : photo;
  const maxCapacity = units.reduce((max, unit) => Math.max(max, Number(unit.capacidad) || 0), 0);
  const allFeatures = [...new Set(units.flatMap(features))];
  const address = complex.ubicacion?.direccion;
  const mapHref = complex.ubicacion?.consultaMapa ? mapSearchHref(complex.ubicacion.consultaMapa) : "";
  const amenityNames = { wifi: "Wi-Fi", parrilla: "Parrilla", cochera: "Cochera", mascotas: "Acepta mascotas" };
  const featureMarkup = allFeatures.map((feature) =>
    `<span class="complex-amenity"><span aria-hidden="true">${feature === "wifi" ? "⌁" : feature === "parrilla" ? "♨" : feature === "cochera" ? "⌂" : "♡"}</span>${amenityNames[feature]}</span>`
  ).join("");
  const link = `./index.html?complejo=${encodeURIComponent(complex.id)}#alojamientos`;
  return `
    <article class="complex-directory-card">
      <a class="complex-directory-photo" href="${link}" aria-label="Ver alojamientos de ${escapeHTML(complex.nombre)}">
        ${mainPhoto ? `<img src="${escapeHTML(mainPhoto)}" data-fallback-src="${mainPhoto !== photo ? escapeHTML(photo) : ""}" alt="${escapeHTML(complex.nombre)}" loading="lazy" />` : ""}
        <span class="complex-card-photo-tag">LAS TONINAS</span>
      </a>
      <div class="complex-directory-content">
        <p class="complex-card-kicker">LA COMARCA <span aria-hidden="true">·</span> LAS TONINAS</p>
        <h3>${escapeHTML(complex.nombre)}</h3>
        <p class="complex-summary">${units.length ? `${units.length} ${units.length === 1 ? "unidad disponible para consultar" : "unidades para elegir"}${maxCapacity ? ` · hasta ${maxCapacity} huéspedes` : ""}.` : "Consultanos por disponibilidad y detalles de este alojamiento."}</p>
        ${address ? `<p class="complex-address"><span aria-hidden="true">⌖</span>${escapeHTML(address)}</p>` : ""}
        <div class="complex-amenities">${featureMarkup}</div>
        <div class="complex-card-footer">
          <span>${units.length} ${units.length === 1 ? "unidad" : "unidades"}</span>
          ${mapHref ? `<a href="${escapeHTML(mapHref)}" target="_blank" rel="noopener noreferrer" aria-label="Ver ubicación de ${escapeHTML(complex.nombre)} en Google Maps">Google Maps <span aria-hidden="true">↗</span></a>` : ""}
          <a href="${link}">Ver unidades <span aria-hidden="true">↗</span></a>
        </div>
      </div>
    </article>`;
}

function render() {
  const complexes = state.complexes.filter(matchesComplex);
  elements.grid.innerHTML = complexes.map(renderComplex).join("");
  elements.results.innerHTML = `${complexes.length} ${complexes.length === 1 ? "complejo" : "complejos"} <span>para explorar</span>`;
  elements.empty.hidden = complexes.length > 0;
  elements.grid.hidden = complexes.length === 0;
}

function clearFilters() {
  elements.search.value = "";
  elements.amenity.value = "";
  render();
}

async function initialize() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-cache" });
    if (!response.ok) throw new Error(`No se pudo cargar ${DATA_URL} (${response.status}).`);
    const data = await response.json();
    state.site = data.sitio && typeof data.sitio === "object" ? data.sitio : {};
    state.complexes = Array.isArray(data.complejos) ? data.complejos : [];
    state.units = Array.isArray(data.duplex) ? data.duplex : [];
    if (!state.complexes.length) throw new Error("El archivo JSON no contiene complejos.");
    const name = state.site.nombre || "La Comarca";
    document.title = `Complejos · ${name}, ${state.site.localidad || "Las Toninas"}`;
    document.querySelectorAll("[data-site-name]").forEach((element) => { element.textContent = name; });
    const phone = whatsappPhone();
    const text = encodeURIComponent(`Hola, quería consultar por un alojamiento en ${state.site.localidad || "Las Toninas"}.`);
    document.querySelector("#complex-whatsapp").href = `https://wa.me/${phone}?text=${text}`;
    const floatingPhone = String(state.site.contacto?.whatsappFlotante ?? "").replace(/\D/g, "");
    document.querySelector("#floating-whatsapp").href = whatsappHref(floatingPhone, "Hola, quería consultar por un alojamiento en Las Toninas.");
    renderContactMethods();
    elements.search.addEventListener("input", render);
    elements.amenity.addEventListener("change", render);
    elements.grid.addEventListener("error", (event) => {
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
    document.querySelector("#complex-clear").addEventListener("click", clearFilters);
    document.querySelector("#complex-empty-clear").addEventListener("click", clearFilters);
    const menu = document.querySelector(".menu-toggle");
    const nav = document.querySelector("#primary-nav");
    menu.addEventListener("click", () => {
      const expanded = menu.getAttribute("aria-expanded") === "true";
      menu.setAttribute("aria-expanded", String(!expanded));
      menu.setAttribute("aria-label", expanded ? "Abrir menú" : "Cerrar menú");
      nav.classList.toggle("is-open", !expanded);
    });
    nav.addEventListener("click", (event) => {
      if (!event.target.closest("a")) return;
      menu.setAttribute("aria-expanded", "false");
      menu.setAttribute("aria-label", "Abrir menú");
      nav.classList.remove("is-open");
    });
    render();
  } catch (error) {
    elements.results.textContent = "No se pudieron cargar los complejos.";
    elements.grid.innerHTML = `<p class="load-error">Ocurrió un problema al leer el catálogo. Verificá que <code>imagenes/data.json</code> exista y abrí el sitio desde un servidor local.</p>`;
    console.error("Error al iniciar el directorio de complejos.", error);
  }
}

initialize();
