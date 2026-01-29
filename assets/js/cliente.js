import { db } from "./firebase.js";
import { ref, push, set, onValue, get, remove } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";
import { setPill, fmtCoords, safeTrim, nowISO } from "./common.js";

const $ = (id) => document.getElementById(id);

const nombreInput = $("nombreCliente");
const btnUbicacion = $("btnUbicacion");
const btnPedir = $("btnPedir");
const btnCancelarLocal = $("btnCancelarLocal");
const estadoViaje = $("estadoViaje");
const detalleViaje = $("detalleViaje");
const coordsEl = $("coords");

let map, marker;
let lastLat = null;
let lastLng = null;

const LS_TRIP_ID = "motoapp_trip_id";

initUI();
initMap();
resumeIfTripExists();

btnUbicacion.addEventListener("click", async () => {
  await getLocationAndUpdateMap(true);
});

btnPedir.addEventListener("click", async () => {
  const nombreCliente = safeTrim(nombreInput.value) || "Cliente";
  const ok = await getLocationAndUpdateMap(true);
  if (!ok) return;

  const tripsRef = ref(db, "trips");
  const newTripRef = push(tripsRef);
  const tripId = newTripRef.key;

  const payload = {
    nombreCliente,
    lat: lastLat,
    lng: lastLng,
    estado: "pendiente",
    createdAt: nowISO()
  };

  await set(newTripRef, payload);
  localStorage.setItem(LS_TRIP_ID, tripId);

  watchTrip(tripId);
  uiPending(tripId);
});

btnCancelarLocal.addEventListener("click", async () => {
  const tripId = localStorage.getItem(LS_TRIP_ID);
  localStorage.removeItem(LS_TRIP_ID);

  if (tripId) {
    try { await remove(ref(db, `trips/${tripId}`)); } catch {}
  }

  detalleViaje.textContent = "";
  setPill(estadoViaje, "neutral", "Sin solicitud");
});

function initUI(){
  setPill(estadoViaje, "neutral", "Sin solicitud");
  detalleViaje.textContent = "";
}

function initMap(){
  map = L.map("mapCliente", { zoomControl: true }).setView([-16.4897, -68.1193], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  marker = L.marker([-16.4897, -68.1193]).addTo(map).bindPopup("Ubicación (demo)").openPopup();
}

async function resumeIfTripExists(){
  const tripId = localStorage.getItem(LS_TRIP_ID);
  if (!tripId) return;

  const snap = await get(ref(db, `trips/${tripId}`));
  if (!snap.exists()){
    localStorage.removeItem(LS_TRIP_ID);
    return;
  }
  watchTrip(tripId);
}

function watchTrip(tripId){
  const tripRef = ref(db, `trips/${tripId}`);
  onValue(tripRef, (snap) => {
    if (!snap.exists()){
      setPill(estadoViaje, "neutral", "Sin solicitud");
      detalleViaje.textContent = "El viaje fue eliminado o no existe.";
      return;
    }

    const t = snap.val();
    const st = t.estado;

    if (st === "pendiente") uiPending(tripId);
    else if (st === "aceptado") uiAccepted(tripId);
    else if (st === "finalizado") uiDone(tripId);
    else setPill(estadoViaje, "neutral", st || "—");

    if (typeof t.lat === "number" && typeof t.lng === "number"){
      lastLat = t.lat;
      lastLng = t.lng;
      updateMap(lastLat, lastLng, "Tu ubicación");
    }
  });
}

function uiPending(tripId){
  setPill(estadoViaje, "pending", "Pendiente");
  detalleViaje.textContent = `Solicitud enviada. ID: ${tripId}`;
}
function uiAccepted(tripId){
  setPill(estadoViaje, "accepted", "Aceptado");
  detalleViaje.textContent = `El conductor aceptó tu viaje. ID: ${tripId}`;
}
function uiDone(tripId){
  setPill(estadoViaje, "done", "Finalizado");
  detalleViaje.textContent = `Viaje finalizado. ID: ${tripId}`;
}

function updateMap(lat, lng, label){
  coordsEl.textContent = `Lat/Lng: ${fmtCoords(lat,lng)}`;
  marker.setLatLng([lat, lng]);
  marker.bindPopup(label).openPopup();
  map.setView([lat, lng], 16);
}

async function getLocationAndUpdateMap(){
  if (!("geolocation" in navigator)){
    alert("Tu navegador no soporta geolocalización.");
    return false;
  }

  btnUbicacion.disabled = true;
  btnPedir.disabled = true;

  const pos = await new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ ok:true, p }),
      () => resolve({ ok:false }),
      { enableHighAccuracy:true, timeout:12000, maximumAge:0 }
    );
  });

  btnUbicacion.disabled = false;
  btnPedir.disabled = false;

  if (!pos.ok){
    alert("No se pudo obtener ubicación. Verifica permisos y abre en HTTPS.");
    return false;
  }

  const { latitude, longitude } = pos.p.coords;
  lastLat = latitude;
  lastLng = longitude;

  updateMap(lastLat, lastLng, "Tu ubicación");
  return true;
}
