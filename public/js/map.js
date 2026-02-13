if (typeof listing !== "undefined" && listing?.geometry?.coordinates) {

  const coords = listing.geometry.coordinates;
  const lat = coords[1];
  const lng = coords[0];

  const zoomLevel = isDefaultLocation ? 5 : 13;

  // Map init
  const map = L.map("map", {
    scrollWheelZoom: false,
  }).setView([lat, lng], zoomLevel);

  // Enable scroll zoom after click
  map.on("click", () => map.scrollWheelZoom.enable());

  // Tile layer
  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      attribution: "&copy; OpenStreetMap contributors",
    }
  ).addTo(map);

  // Custom marker icon
  const redIcon = L.icon({
    iconUrl: "/images/logo.jpg",
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40],
  });

  const marker = L.marker([lat, lng], { icon: redIcon }).addTo(map);

  const locationNote = isDefaultLocation
    ? "<br><span style='color:#c0392b;font-size:12px;'>Approximate location</span>"
    : "";

  marker.bindPopup(`
    <b>${listing.title}</b><br>
    ${listing.location}
    ${locationNote}
  `).openPopup();

  // ⭐ Optional badge for default location
  if (isDefaultLocation) {
    const badge = L.control({ position: "topright" });

    badge.onAdd = function () {
      const div = L.DomUtil.create("div");
      div.innerHTML = "Approximate Location";
      div.style.background = "white";
      div.style.padding = "6px 10px";
      div.style.borderRadius = "8px";
      div.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";
      div.style.fontSize = "12px";
      return div;
    };

    badge.addTo(map);
  }
}
