export function setPill(el, state, text){
  el.classList.remove("neutral", "pending", "accepted", "done");
  el.classList.add(state);
  el.textContent = text;
}

export function fmtCoords(lat, lng){
  if (typeof lat !== "number" || typeof lng !== "number") return "—";
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

export function safeTrim(v){
  return (v ?? "").toString().trim();
}

export function nowISO(){
  return new Date().toISOString();
}
