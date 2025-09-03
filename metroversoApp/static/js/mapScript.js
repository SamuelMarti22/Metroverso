mapboxgl.accessToken =
  "pk.eyJ1IjoibGFjYXRyaWxmIiwiYSI6ImNtZG00eGJqZjAxMGYyaXBrcGY3b2tjYzIifQ.gx3C4J17a-6YrUBt6sZTmQ";

const initialLocationView = [-75.5752, 6.2491]; // Coordinates of San Antonio

const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mapbox/standard", // Style of the map
  config: {
    basemap: {
      theme: "monochrome",
    },
  },
  center: initialLocationView,
  zoom: 15,
});

let closestStationsToOrigin = [];
let closestStationsToDestination = [];
let closestStationsToUser = [];

let inRoute = false; // Flag to check if in route mode
let userLocation = null;
let lastUserLocation = null; // Store last location for comparison
let userMarker = null;
let watchId = null;
let lastUpdateTime = 0;
const UPDATE_INTERVAL = 1000; // Update interval in milliseconds
const STATION_UPDATE_THRESHOLD = 10; // Update stations when user moves more than 10 meters

// Function to show/hide the closest stations box
function setClosestStationsBoxVisible(visible) {
  const box = document.getElementById("closestStationsBox");
  box.style.display = visible ? "" : "none";
}

// Function to update user location
function updateUserLocation(position) {
  const userLat = position.coords.latitude;
  const userLng = position.coords.longitude;
  const accuracy = position.coords.accuracy;
  const currentTime = Date.now();

  // Limit very frequent updates
  if (currentTime - lastUpdateTime < UPDATE_INTERVAL) {
    return;
  }

  console.log("Location accuracy:", Math.round(accuracy * 100) / 100, "m");
  //if (accuracy > 100) {
  //    console.warn("Low location precision");
  //    return;
  //}

  const newUserLocation = [userLng, userLat];

  // Check if user has moved significantly before updating closest stations
  let shouldUpdateStations = false;
  if (!lastUserLocation) {
    shouldUpdateStations = true; // First time getting location
  } else {
    const distance = turf.distance(
      turf.point(lastUserLocation),
      turf.point(newUserLocation),
      { units: "meters" }
    );
    if (distance > STATION_UPDATE_THRESHOLD) {
      shouldUpdateStations = true;
    }
  }

  userLocation = newUserLocation;
  lastUpdateTime = currentTime;

  // Show the box if there is userLocation, hide if not
  setClosestStationsBoxVisible(true);

  // Update closest stations only if user has moved significantly
  if (shouldUpdateStations) {
    closestStationsToUser = closestPoints(turf.point(userLocation), 2000);
    closestStations(turf.point(userLocation), 2000);
    lastUserLocation = [...userLocation];

    // Update the button text with the station name/id
    const btn1 = document.getElementById("btnClosestStation1");
    const btn2 = document.getElementById("btnClosestStation2");
    const btn3 = document.getElementById("btnClosestStation3");
    btn1.innerHTML = `<i class="bi bi-geo-alt"></i> ${
      closestStationsToUser[0]?.properties.ID || ""
    }`;
    btn2.innerHTML = `<i class="bi bi-geo-alt"></i> ${
      closestStationsToUser[1]?.properties.ID || ""
    }`;
    btn3.innerHTML = `<i class="bi bi-geo-alt"></i> ${
      closestStationsToUser[2]?.properties.ID || ""
    }`;
    document.getElementById(
      "btnUserLocation"
    ).innerHTML = `<i class="bi bi-person"></i> Mi ubicación`;
  }

  if (!userMarker) {
    // Create custom marker
    const markerElement = document.createElement("div");
    markerElement.innerHTML = "📍";
    markerElement.style.fontSize = "20px";
    markerElement.style.cursor = "pointer";

    userMarker = new mapboxgl.Marker({ element: markerElement })
      .setLngLat([userLng, userLat])
      .setPopup(
        new mapboxgl.Popup({
          closeButton: false,
          offset: [0, -10],
        }).setText("Tu ubicación")
      )
      .addTo(map);
  } else {
    // If marker already exists, just update its position
    userMarker.setLngLat([userLng, userLat]);
  }
}

// Function to start optimized tracking
function startLocationTracking() {
  watchId = navigator.geolocation.watchPosition(
    updateUserLocation,
    handleLocationError,
    {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: UPDATE_INTERVAL,
    }
  );
}

// Function to handle location errors
function handleLocationError(error) {
  console.warn("Could not get location:", error.message);

  switch (error.code) {
    case error.PERMISSION_DENIED:
      console.warn("Permission denied to access location.");
      break;
    case error.POSITION_UNAVAILABLE:
      alert("Location information is not available.");
      break;
    case error.TIMEOUT:
      alert("Location request timed out.");
      break;
    default:
      alert("Error getting location.");
      break;
  }
}

// Function to get walking route
async function walkingRoute(start, end) {
  const query = await fetch(
    `https://api.mapbox.com/directions/v5/mapbox/walking/${start[0]},${start[1]};${end[0]},${end[1]}?steps=true&geometries=geojson&overview=full&approaches=unrestricted;unrestricted&access_token=${mapboxgl.accessToken}`,
    { method: "GET" }
  );
  const json = await query.json();
  const data = json.routes[0];
  return data;
}

// Function to add route to map
function addRouteToMap(route, routeId = "walking-route") {
  // Remove existing route if it exists
  if (map.getSource(routeId)) {
    map.removeLayer(routeId);
    map.removeSource(routeId);
  }

  // Add route source and layer
  map.addSource(routeId, {
    type: "geojson",
    data: {
      type: "Feature",
      properties: {},
      geometry: route.geometry,
    },
  });

  map.addLayer({
    id: routeId,
    type: "line",
    source: routeId,
    layout: {
      "line-join": "round",
      "line-cap": "round",
    },
    paint: {
      "line-color": "#4CAF50",
      "line-width": 4,
      "line-opacity": 0.8,
      "line-dasharray": [2, 2],
    },
  });
}

// Function to get walking route to origin
function walkingRouteToOrigin() {
  const firstPoint = closestStationsToOrigin[0];
  if (markerOrigin) {
    walkingRoute(
      [markerOrigin.getLngLat().lng, markerOrigin.getLngLat().lat],
      firstPoint.geometry.coordinates
    )
      .then((route) => {
        if (route.distance > 2000) {
          const alertBox = document.getElementById("alerta-validacion");
          const alertMessage = document.getElementById("mensaje-alerta");
          showAutoClosingAlert(
            alertBox,
            alertMessage,
            "La distancia del origen a la primera estación es mayor a 2 km"
          );
        }
        addRouteToMap(route, "routeToOrigin");

        if (map.getLayer("routeToOrigin-label"))
          map.removeLayer("routeToOrigin-label");
        if (map.getSource("routeToOrigin-label"))
          map.removeSource("routeToOrigin-label");
        map.addSource("routeToOrigin-label", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                geometry: route.geometry,
                properties: {
                  distance: `${(route.distance / 1000).toFixed(2)} km`,
                },
              },
            ],
          },
        });
        map.addLayer({
          id: "routeToOrigin-label",
          type: "symbol",
          source: "routeToOrigin-label",
          layout: {
            "symbol-placement": "line",
            "text-field": ["get", "distance"],
            "text-size": 16,
            "text-offset": [0, 0.5],
          },
          paint: {
            "text-color": "#000000",
            "text-halo-color": "#FFFFFF",
            "text-halo-width": 2,
          },
        });
      })
      .catch((error) => {
        console.error("Error getting route:", error);
      });
  }
}

// Function to get walking route to destination
function walkingRouteToDestination() {
  const lastPoint = closestStationsToDestination[0];
  if (markerDestiny) {
    walkingRoute(lastPoint.geometry.coordinates, [
      markerDestiny.getLngLat().lng,
      markerDestiny.getLngLat().lat,
    ])
      .then((route) => {
        if (route.distance > 2000) {
          const alertBox = document.getElementById("alerta-validacion");
          const alertMessage = document.getElementById("mensaje-alerta");
          showAutoClosingAlert(
            alertBox,
            alertMessage,
            "La estación más cercana al destino está a más de 2 km"
          );
        }
        addRouteToMap(route, "routeToDestination");

        if (map.getLayer("routeToDestination-label"))
          map.removeLayer("routeToDestination-label");
        if (map.getSource("routeToDestination-label"))
          map.removeSource("routeToDestination-label");
        map.addSource("routeToDestination-label", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                geometry: route.geometry,
                properties: {
                  distance: `${(route.distance / 1000).toFixed(2)} km`,
                },
              },
            ],
          },
        });
        map.addLayer({
          id: "routeToDestination-label",
          type: "symbol",
          source: "routeToDestination-label",
          layout: {
            "symbol-placement": "line",
            "text-field": ["get", "distance"],
            "text-size": 16,
            "text-offset": [0, 0.5],
          },
          paint: {
            "text-color": "#000000",
            "text-halo-color": "#FFFFFF",
            "text-halo-width": 2,
          },
        });
      })
      .catch((error) => {
        console.error("Error getting route:", error);
      });
  }
}

// Function to find the closest stations to the user location
function closestStations(userPoint, maxDistance) {
  // Remove existing layers and sources if they exist
  if (map.getLayer("distance-labels")) map.removeLayer("distance-labels");
  if (map.getLayer("points-layer")) map.removeLayer("points-layer");
  if (map.getLayer("lines-layer")) map.removeLayer("lines-layer");
  if (map.getSource("points")) map.removeSource("points");
  if (map.getSource("lines")) map.removeSource("lines");

  if (inRoute) return; // Skip if in route mode

  const top3 = closestPoints(userPoint, 2000);
  console.log("Closest points:", top3);

  const pointsGeoJSON = {
    type: "FeatureCollection",
    features: top3.map((p) => ({
      type: "Feature",
      geometry: p.geometry,
      properties: {
        ID: p.properties.ID,
      },
    })),
  };

  const linesGeoJSON = {
    type: "FeatureCollection",
    features: top3.map((p) => {
      const distance = turf.distance(userPoint, p, { units: "meters" });

      return {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [userPoint.geometry.coordinates, p.geometry.coordinates],
        },
        properties: {
          distance: `${distance.toFixed(0)} m`, // round to meters
        },
      };
    }),
  };

  map.addSource("points", { type: "geojson", data: pointsGeoJSON });
  map.addSource("lines", { type: "geojson", data: linesGeoJSON });

  map.addLayer({
    id: "lines-layer",
    type: "line",
    source: "lines",
    layout: {
      "line-join": "round",
      "line-cap": "round",
    },
    paint: {
      "line-color": "#FF0000",
      "line-width": 2,
    },
  });

  map.addLayer({
    id: "points-layer",
    type: "circle",
    source: "points",
    paint: {
      "circle-color": "#FF0000",
      "circle-radius": 6,
      "circle-stroke-width": 2,
      "circle-stroke-color": "#FFFFFF",
    },
  });

  map.addLayer({
    id: "distance-labels",
    type: "symbol",
    source: "lines",
    layout: {
      "symbol-placement": "line",
      "text-field": ["get", "distance"],
      "text-size": 14,
      "text-offset": [0, 0.5],
    },
    paint: {
      "text-color": "#000000",
      "text-halo-color": "#FFFFFF",
      "text-halo-width": 1,
    },
  });
}

console.log("Map initialized");
map.on("load", () => {
  startLocationTracking();
  loadServiceHours(); // Load service hours when page loads
  
  // Inicializar funcionalidades de autocompletado
  setupInputSuggestions();
});

// Function to load and display service hours
function loadServiceHours() {
  fetch('/view/getServiceHours')
    .then((res) => res.json())
    .then((data) => {
      displayServiceHours(data.service_hours);
    })
    .catch((error) => {
      console.error('Error loading service hours:', error);
    });
}

// Function to display service hours
function displayServiceHours(serviceHours, usesLineL = false) {
  let infoContainer = document.getElementById("serviceHoursInfo");
  if (!infoContainer) {
    infoContainer = document.createElement("div");
    infoContainer.id = "serviceHoursInfo";
    infoContainer.style.marginTop = "10px";
    infoContainer.style.padding = "10px";
    infoContainer.style.backgroundColor = "#f8f9fa";
    infoContainer.style.borderRadius = "5px";
    document.querySelector(".divRute").appendChild(infoContainer);
  }

  if (serviceHours) {
    const statusClass = serviceHours.is_operating ? 'text-success' : 'text-danger';
    const statusText = serviceHours.is_operating ? 'Operando' : 'Cerrado';
    
    let html = '';
    
    if (usesLineL) {
      html = `
        <h6 class="mb-2">🕒 Horario de Operación - Línea L</h6>
        <p class="mb-1"><strong>${serviceHours.day}:</strong> ${serviceHours.open_time} - ${serviceHours.close_time}</p>
        <p class="mb-1 text-info"><small><strong>Nota:</strong> La Línea L tiene horario especial: Lunes a Sábado 9:00-18:00, Domingos 8:30-18:00</small></p>
        <p class="mb-0 ${statusClass}"><strong>Estado:</strong> ${statusText}</p>
      `;
    } else {
      html = `
        <h6 class="mb-2">🕒 Horario de Operación</h6>
        <p class="mb-1"><strong>${serviceHours.day}:</strong> ${serviceHours.open_time} - ${serviceHours.close_time}</p>
        <p class="mb-0 ${statusClass}"><strong>Estado:</strong> ${statusText}</p>
      `;
    }
    
    infoContainer.innerHTML = html;
  }
}

// Removed popup functionality to keep only custom dropdown suggestions

// Function to go to user location
document.querySelector(".userLocation").addEventListener("click", function () {
  if (userMarker) {
    map.flyTo({
      center: userMarker.getLngLat(),
      zoom: 15,
      essential: true,
    });
  } else {
    alert("Could not find location.");
  }
});

// Rute finding function
document.getElementById("btnSearchRute").addEventListener("click", function () {
  const inputStart = document.getElementById("inputStart").value;
  const inputDestination = document.getElementById("inputDestination").value;

  const alertBox = document.getElementById("alerta-validacion");
  const alertMessage = document.getElementById("mensaje-alerta");

  const validationResult = validateInputsAndStations(
    inputStart,
    inputDestination,
    pointsStations,
    validateLocation
  );
  if (!validationResult.valid) {
    showAutoClosingAlert(alertBox, alertMessage, validationResult.message);
    return;
  }

  const { startPoint, endPoint, startId, endId, startName, endName } = validationResult;

  // Hide alert if all is valid
  alertBox.style.display = "none";

  console.log(`Inicio: ${startName} (${startId}), Destino: ${endName} (${endId})`);

  fetch(
    `/view/callRute?inputStart=${startId}&inputDestination=${endId}`
  )
    .then((res) => res.json())
    .then((data) => {
      console.log("Ruta:", data.rute);
      console.log("Distancia:", data.distance);
      console.log("Información de transferencias:", data.transfer_info);

             // Check if the trip can be made according to the schedule
       if (data.can_make_trip === false || String(data.can_make_trip).toLowerCase() === "false") {
         const alertBox = document.getElementById("alerta-validacion");
         const alertMessage = document.getElementById("mensaje-alerta");
         
         let alertMessageText = "⚠️ El viaje no se puede completar dentro del horario de operación del metro.";
         
         // Special message for Line L
         if (data.uses_line_l) {
           alertMessageText = "⚠️ El viaje no se puede completar dentro del horario de operación de la Línea L (9:00-18:00 L-S, 8:30-18:00 Dom).";
         }
         
         showAutoClosingAlert(
           alertBox,
           alertMessage,
           alertMessageText
         );
         return; // Do not continue showing the route
       }

               displayTransferInfo(data.transfer_info, data.rute);
               
               // Update service hours display with new data
               displayServiceHours(data.service_hours, data.uses_line_l);
    });

  // Adjust map view to include both points
  const bounds = new mapboxgl.LngLatBounds();
  bounds.extend(startPoint.geometry.coordinates);
  bounds.extend(endPoint.geometry.coordinates);
  map.fitBounds(bounds, { padding: 40 });
});



function displayTransferInfo(transferInfo, route) {
  let infoContainer = document.getElementById("routeInfo");
  if (!infoContainer) {
    infoContainer = document.createElement("div");
    infoContainer.id = "routeInfo";
    infoContainer.style.marginTop = "10px";
    infoContainer.style.padding = "10px";
    infoContainer.style.backgroundColor = "#f8f9fa";
    infoContainer.style.borderRadius = "5px";
    document.querySelector(".divRute").appendChild(infoContainer);
  }

  let html = `<h6>Información de Ruta</h6>`;
  html +=
    '<p class="route-chain"><strong>Ruta completa:</strong> ' +
    window.renderRouteChain(route, transferInfo) +
    "</p>";

  if (transferInfo.requires_transfer) {
    html += `<p><strong>Se requieren ${transferInfo.transfer_count} transferencia(s)</strong></p>`;
    html += `<p><strong>Estaciones de transferencia:</strong></p>`;
    html += `<ul>`;
    transferInfo.transfer_stations.forEach((station) => {
      const stationName = window.getStationName(station);
      html += `<li>Transferencia en: <strong>${stationName}</strong></li>`;
    });
    html += `</ul>`;
  } else {
    html += `<p><strong>No se requieren transferencias</strong></p>`;
    html += `<p>Viaje directo en la línea ${transferInfo.line_segments[0]?.line}</p>`;
  }

  // How to make transfers
  if (transferInfo.requires_transfer) {
    const segs = transferInfo.line_segments;
    const transferHints = [];

    for (let i = 1; i < segs.length; i++) {
      const prev = segs[i - 1];
      const curr = segs[i];
      const transferStation = prev.stations[prev.stations.length - 1];
      const newLine = curr.line;
      const nextStation =
        curr.stations.length > 1 ? curr.stations[1] : transferStation;

      const transferStationName = window.getStationName(transferStation);
      const nextStationName = window.getStationName(nextStation);
      transferHints.push(
        `En <strong>${transferStationName}</strong> cambia a la línea <strong>${newLine}</strong> y dirígete a <strong>${nextStationName}</strong>.`
      );
    }

    html += `
          <hr class="my-2">
          <h6 class="mb-2 text-success fw-bold">seguimiento de transbordos</h6>
          <div class="small">
          ${transferHints.map((h) => `<div>• ${h}</div>`).join("")}
          </div>
      `;
  }
  infoContainer.innerHTML = html;
}

// Handle sidebar active states
document.querySelectorAll(".subCategory").forEach((item) => {
  item.addEventListener("click", function () {
    // Remove active class from all items
    document
      .querySelectorAll(".subCategory")
      .forEach((el) => el.classList.remove("active"));
    // Add active class to clicked item
    this.classList.add("active");
  });
});

// Language selection functionality
document.querySelectorAll(".language-item").forEach((item) => {
  item.addEventListener("click", function () {
    // Remove selected class from all items
    document.querySelectorAll(".language-item").forEach((i) => {
      i.classList.remove("selected");
      const icon = i.querySelector(".bi-check-circle-fill");
      if (icon) icon.remove();
    });

    // Add selected class to clicked item
    this.classList.add("selected");

    // Add check icon
    if (!this.querySelector(".bi-check-circle-fill")) {
      const checkIcon = document.createElement("i");
      checkIcon.className = "bi bi-check-circle-fill ms-auto text-success";
      this.appendChild(checkIcon);
    }
  });
});

// Selecting a destination point
let selecting = 0;
let markerOrigin = null;
let markerDestiny = null;
let mapContainer = document.getElementById("map");

document
  .getElementById("btnUserLocationOrigin")
  .addEventListener("click", () => {
    selecting = 1;
    map.getCanvas().classList.add("crosshair");
    console.log("🟢 Modo selección activado (Origen): haz clic en el mapa");
  });

document
  .getElementById("btnUserLocationDestiny")
  .addEventListener("click", () => {
    selecting = 2;
    map.getCanvas().classList.add("crosshair");
    console.log("🟢 Modo selección activado (Destino): haz clic en el mapa");
  });

const pickStartingPoint = (originPoint) => {
  closestStationsToOrigin = closestPoints(turf.point(originPoint), 4000);
  if (markerOrigin) {
    markerOrigin.setLngLat(originPoint);
  } else {
    markerOrigin = new mapboxgl.Marker({ color: "blue" })
      .setLngLat(originPoint)
      .addTo(map);
  }
  drawWalkingRoutes();
};

const pickDestinationPoint = (destinyPoint) => {
  closestStationsToDestination = closestPoints(turf.point(destinyPoint), 4000);
  if (markerDestiny) {
    markerDestiny.setLngLat(destinyPoint);
  } else {
    markerDestiny = new mapboxgl.Marker({ color: "red" })
      .setLngLat(destinyPoint)
      .addTo(map);
  }
  drawWalkingRoutes();
};

const drawWalkingRoutes = () => {
  if (markerOrigin !== null && markerDestiny !== null) {
    walkingRouteToOrigin();
    walkingRouteToDestination();
  }
};

// If a user clicks the map
map.on("click", (e) => {
  if (selecting === 0) return; // not selecting
  selecting === 1
    ? pickStartingPoint([e.lngLat.lng, e.lngLat.lat])
    : pickDestinationPoint([e.lngLat.lng, e.lngLat.lat]);
  selecting = 0;
  map.getCanvas().classList.remove("crosshair");
});

// Variables to store the id and selected location
let selectedStationId = null;
let selectedStationLocation = null;

document.getElementById("btnClosestStation1").onclick = function () {
  if (closestStationsToUser[0]) {
    this.innerText = closestStationsToUser[0].properties.ID;
    selectedStationLocation = closestStationsToUser[0].geometry.coordinates;
    pickStartingPoint(selectedStationLocation);
    map.flyTo({ center: selectedStationLocation });
  }
};
document.getElementById("btnClosestStation2").onclick = function () {
  if (closestStationsToUser[1]) {
    this.innerText = closestStationsToUser[1].properties.ID;
    selectedStationLocation = closestStationsToUser[1].geometry.coordinates;
    pickStartingPoint(selectedStationLocation);
    map.flyTo({ center: selectedStationLocation });
  }
};
document.getElementById("btnClosestStation3").onclick = function () {
  if (closestStationsToUser[2]) {
    this.innerText = closestStationsToUser[2].properties.ID;
    selectedStationLocation = closestStationsToUser[2].geometry.coordinates;
    pickStartingPoint(selectedStationLocation);
    map.flyTo({ center: selectedStationLocation });
  }
};
document.getElementById("btnUserLocation").onclick = function () {
  pickStartingPoint(userLocation);
  map.flyTo({ center: userLocation });
};



// Función para mostrar sugerencias en tiempo real
function setupInputSuggestions() {
    const startInput = document.getElementById('inputStart');
    const destInput = document.getElementById('inputDestination');
    
    if (startInput) {
        startInput.addEventListener('input', function() {
            showInputSuggestions(this, 'startSuggestions');
        });
        
        startInput.addEventListener('focus', function() {
            showInputSuggestions(this, 'startSuggestions');
        });
    }
    
    if (destInput) {
        destInput.addEventListener('input', function() {
            showInputSuggestions(this, 'destSuggestions');
        });
        
        destInput.addEventListener('focus', function() {
            showInputSuggestions(this, 'destSuggestions');
        });
    }
}

// Función para mostrar sugerencias de input
function showInputSuggestions(inputElement, containerId) {
    const value = inputElement.value.trim();
    
    // Remover contenedor de sugerencias existente
    let existingContainer = document.getElementById(containerId);
    if (existingContainer) {
        existingContainer.remove();
    }
    
    if (value.length < 2) return;
    
    const suggestions = getStationSuggestions(value);
    if (suggestions.length === 0) return;
    
    // Crear contenedor de sugerencias
    const container = document.createElement('div');
    container.id = containerId;
    container.className = 'suggestions-container';
    container.style.cssText = `
        position: absolute;
        background: white;
        border: 1px solid #ddd;
        border-radius: 4px;
        max-height: 200px;
        overflow-y: auto;
        z-index: 1000;
        width: ${inputElement.offsetWidth}px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    `;
    
    // Añadir sugerencias
    suggestions.forEach(suggestion => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        item.style.cssText = `
            padding: 8px 12px;
            cursor: pointer;
            border-bottom: 1px solid #eee;
            font-size: 14px;
        `;
        // Extract line from station ID (first character)
        const line = suggestion.id.charAt(0);
        item.innerHTML = `
            <strong>${suggestion.name}</strong> 
            <span class="station-id">Línea ${line}</span>
        `;
        
        item.addEventListener('click', function() {
            inputElement.value = suggestion.name;
            container.remove();
        });
        
        item.addEventListener('mouseenter', function() {
            this.style.backgroundColor = '#f8f9fa';
        });
        
        item.addEventListener('mouseleave', function() {
            this.style.backgroundColor = 'white';
        });
        
        container.appendChild(item);
    });
    
    // Posicionar contenedor
    const rect = inputElement.getBoundingClientRect();
    container.style.top = `${rect.bottom + window.scrollY}px`;
    container.style.left = `${rect.left + window.scrollX}px`;
    
    // Añadir al DOM
    document.body.appendChild(container);
    
    // Cerrar sugerencias al hacer clic fuera
    document.addEventListener('click', function closeSuggestions(e) {
        if (!container.contains(e.target) && e.target !== inputElement) {
            container.remove();
            document.removeEventListener('click', closeSuggestions);
        }
    });
}
