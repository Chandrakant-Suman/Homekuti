// public/js/map.js - Using LocationIQ Map Tiles

if (typeof listing !== "undefined" && listing?.geometry?.coordinates) {
  const coords = listing.geometry.coordinates;
  const lat = coords[1];
  const lng = coords[0];

  const zoomLevel = isDefaultLocation ? 5 : 16;

  // Map init
  const map = L.map("map", {
    scrollWheelZoom: false,
  }).setView([lat, lng], zoomLevel);

  // Enable scroll zoom after click
  map.on("click", () => map.scrollWheelZoom.enable());

  // ⭐ LOCATIONIQ TILE LAYER
  // Get API key from a global variable (set in your EJS template)
  const LOCATIONIQ_API_KEY = window.LOCATIONIQ_API_KEY || 'pk.YOUR_API_KEY_HERE';
  
  L.tileLayer(
    `https://{s}-tiles.locationiq.com/v3/streets/r/{z}/{x}/{y}.png?key=${LOCATIONIQ_API_KEY}`,
    {
      attribution:
        '&copy; <a href="https://locationiq.com/">LocationIQ</a> | &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      subdomains: ['a', 'b', 'c'], // LocationIQ subdomains for load balancing
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

  marker
    .bindPopup(
      `
    <b>${listing.title}</b><br>
    ${listing.location}
    ${locationNote}
  `
    )
    .openPopup();

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