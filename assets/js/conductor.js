import { db } from "./firebase.js";
import { ref, onValue, update } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";
import { setPill, fmtCoords } from "./common.js";

const $ = (id) => document.getElementById(id);

const pendingList = $("pendingList");
const pendingCount = $("pendingCount");
const queueHint = $("queueHint");

const cNombre = $("cNombre");
const cEstado = $("cEstado");
const cId = $("cId");
const cCoords = $("cCoords");

const btnAceptar = $("btnAceptar");
const btnFinalizar = $("btnFinalizar");
const btnLimpiarSel = $("btnLimpiarSel");

const driverHint = $("driverHint");

let map, marker;

// Estado local del conductor
let tripsCache = {};          // { id: trip }
let selectedTripId = null;    // viaje seleccionado (pendiente o aceptado)

initMap();
listenTrips();

btnAceptar.addEventListener("click", async () => {
  if (!selectedTripId) return;
  const t = tripsCache[selectedTripId];
  if (!t || t.estado !== "pendiente") return;

  await update(ref(db, `trips/${selectedTripId}`), {
    estado: "aceptado",
    acceptedAt: new Date().toISOString()
  });
});

btnFinalizar.addEventListener("click", async () => {
  if (!selectedTripId) return;
  const t = tripsCache[selectedTripId];
  if (!t || t.estado !== "aceptado") return;

  await update(ref(db, `trips/${selectedTripId}`), {
    estado: "finalizado",
    finishedAt: new Date().toISOString()
  });
});

btnLimpiarSel.addEventListener("click", () => {
  selectedTripId = null;
  renderSelected(null, null);
  renderQueue();
});

function initMap(){
  map = L.map("mapConductor", { zoomControl: true }).setView([-16.4897, -68.1193], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  marker = L.marker([-16.4897, -68.1193]).addTo(map).bindPopup("Selecciona un viaje…");
}

function listenTrips(){
  const tripsRef = ref(db, "trips");

  onValue(tripsRef, (snap) => {
    tripsCache = snap.val() || {};

    // Si el seleccionado ya no existe, limpiamos selección
    if (selectedTripId && !tripsCache[selectedTripId]) {
      selectedTripId = null;
      renderSelected(null, null);
    }

    // Auto-selección inteligente:
    // - si no hay selección, selecciona un "aceptado" primero (si existe),
    //   sino selecciona el primero "pendiente".
    if (!selectedTripId) {
      const accepted = firstByEstado("aceptado");
      const pending = firstByEstado("pendiente");
      if (accepted) selectedTripId = accepted.id;
      else if (pending) selectedTripId = pending.id;
    }

    // Render
    renderQueue();

    if (selectedTripId && tripsCache[selectedTripId]) {
      renderSelected(selectedTripId, tripsCache[selectedTripId]);
    } else {
      renderSelected(null, null);
    }
  });
}

function firstByEstado(estado){
  const list = Object.entries(tripsCache)
    .map(([id, trip]) => ({ id, trip }))
    .filter(x => x.trip && x.trip.estado === estado)
    .sort((a,b) => (a.trip.createdAt || "").localeCompare(b.trip.createdAt || ""));
  return list[0] || null;
}

function renderQueue(){
  const pendientes = Object.entries(tripsCache)
    .map(([id, trip]) => ({ id, trip }))
    .filter(x => x.trip && x.trip.estado === "pendiente")
    .sort((a,b) => (a.trip.createdAt || "").localeCompare(b.trip.createdAt || ""));

  pendingCount.textContent = String(pendientes.length);

  if (pendientes.length === 0) {
    pendingList.innerHTML = `<div class="queue-empty">No hay viajes pendientes por ahora.</div>`;
    queueHint.textContent = "Cuando un cliente pida moto, aparecerá aquí.";
    return;
  }

  queueHint.textContent = "Toca un viaje para seleccionarlo.";

  pendingList.innerHTML = pendientes.map(({id, trip}) => {
    const isSel = selectedTripId === id;
    const name = escapeHtml(trip.nombreCliente || "Cliente");
    const createdAt = trip.createdAt ? new Date(trip.createdAt).toLocaleString() : "—";
    const coords = (typeof trip.lat === "number" && typeof trip.lng === "number")
      ? fmtCoords(trip.lat, trip.lng)
      : "—";

    return `
      <div class="queue-item ${isSel ? "selected" : ""}" data-id="${id}">
        <div class="q-left">
          <div class="q-title">${name}</div>
          <div class="q-sub">Creado: ${escapeHtml(createdAt)}</div>
          <div class="q-sub">Coords: ${escapeHtml(coords)}</div>
        </div>
        <div class="q-right">
          <span class="status-pill pending">Pendiente</span>
        </div>
      </div>
    `;
  }).join("");

  // click handlers (sin frameworks)
  pendingList.querySelectorAll(".queue-item").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.getAttribute("data-id");
      if (!id || !tripsCache[id]) return;
      selectedTripId = id;
      renderQueue();
      renderSelected(id, tripsCache[id]);
    });
  });
}

function renderSelected(id, trip){
  if (!id || !trip) {
    cNombre.textContent = "—";
    cId.textContent = "—";
    cCoords.textContent = "Lat/Lng: —";
    setPill(cEstado, "neutral", "Sin selección");

    btnAceptar.disabled = true;
    btnFinalizar.disabled = true;
    btnLimpiarSel.disabled = true;

    driverHint.textContent = "Selecciona un viaje pendiente para ver detalles y aceptarlo.";
    marker.bindPopup("Selecciona un viaje…").openPopup();
    return;
  }

  cNombre.textContent = trip.nombreCliente || "—";
  cId.textContent = id;

  const lat = trip.lat;
  const lng = trip.lng;

  if (typeof lat === "number" && typeof lng === "number"){
    cCoords.textContent = `Lat/Lng: ${fmtCoords(lat,lng)}`;
    marker.setLatLng([lat,lng]);
    marker.bindPopup(`Cliente: ${trip.nombreCliente || "—"}`).openPopup();
    map.setView([lat,lng], 15);
  } else {
    cCoords.textContent = "Lat/Lng: —";
  }

  btnLimpiarSel.disabled = false;

  if (trip.estado === "pendiente"){
    setPill(cEstado, "pending", "Pendiente");
    btnAceptar.disabled = false;
    btnFinalizar.disabled = true;
    driverHint.textContent = "Viaje pendiente seleccionado. Puedes aceptarlo.";
  } else if (trip.estado === "aceptado"){
    setPill(cEstado, "accepted", "Aceptado");
    btnAceptar.disabled = true;
    btnFinalizar.disabled = false;
    driverHint.textContent = "Viaje aceptado. Finaliza cuando termine.";
  } else if (trip.estado === "finalizado"){
    setPill(cEstado, "done", "Finalizado");
    btnAceptar.disabled = true;
    btnFinalizar.disabled = true;
    driverHint.textContent = "Viaje finalizado. Selecciona otro pendiente si hay.";
  } else {
    setPill(cEstado, "neutral", trip.estado || "—");
    btnAceptar.disabled = true;
    btnFinalizar.disabled = true;
    driverHint.textContent = "Estado desconocido.";
  }
}

function escapeHtml(str){
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
