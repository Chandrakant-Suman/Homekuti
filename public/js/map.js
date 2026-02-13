if (typeof listing !== "undefined" && listing.geometry) {

  const coords = listing.geometry.coordinates;

  // ✅ Map init with scroll zoom disabled initially
  const map = L.map("map", {
    scrollWheelZoom: false,
  }).setView([coords[1], coords[0]], 13);

  // Enable scroll zoom only after user clicks map
  map.on("click", () => map.scrollWheelZoom.enable());

  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      attribution: "&copy; OpenStreetMap contributors",
    }
  ).addTo(map);

  // ✅ Custom logo marker
  const redIcon = L.icon({
    iconUrl: "/images/logo.jpg",
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40],
  });

  const marker = L.marker([coords[1], coords[0]], { icon: redIcon }).addTo(map);

  marker.bindPopup(`
    <b>${listing.title}</b><br>
    ${listing.location}
  `).openPopup();
}
