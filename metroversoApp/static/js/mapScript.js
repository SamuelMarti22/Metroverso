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
let linesStations = null;



// Carga el GeoJSON y lo guarda en la global
async function loadLinesStations() {
  const cfg = window.APP_CONFIG || {};
  if (!cfg.geojsonUrl) {
    console.error("Falta geojsonUrl en APP_CONFIG");
    return null;
  }

  try {
    const res = await fetch(cfg.geojsonUrl, {
      credentials: "same-origin",
      headers: { "Accept": "application/json" }
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    linesStations = await res.json();
    console.log("GeoJSON cargado en linesStations:", linesStations);
    return linesStations;
  } catch (err) {
    console.error("Error cargando GeoJSON:", err);
    return null;
  }
}

async function loadLinesComplete() {
  const cfg = window.APP_CONFIG || {};
  if (!cfg.geojsonComplete) {
    console.error("Falta geojsonUrl en APP_CONFIG");
    return null;
  }

  try {
    const res = await fetch(cfg.geojsonComplete, {
      credentials: "same-origin",
      headers: { "Accept": "application/json" }
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    linesComplete = await res.json();
    console.log("GeoJSON cargado en linesComplete:", linesComplete);
    return linesComplete;
  } catch (err) {
    console.error("Error cargando GeoJSON:", err);
    return null;
  }
}

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
    btn1.innerHTML = `<i class="bi bi-geo-alt"></i> ${closestStationsToUser[0]?.properties.ID || ""
      }`;
    btn2.innerHTML = `<i class="bi bi-geo-alt"></i> ${closestStationsToUser[1]?.properties.ID || ""
      }`;
    btn3.innerHTML = `<i class="bi bi-geo-alt"></i> ${closestStationsToUser[2]?.properties.ID || ""
      }`
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
        }).setText(texts.myLocation)
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

// --- ESTIMATED TIME: mostrar sin mover ---
(function() {
  const estimatedTimeBox = document.getElementById('estimatedTimeBox');
  if (!estimatedTimeBox) {
    console.log('[map] no encontrado #estimatedTimeBox');
    return;
  }

  // asegurar que sea visible y fijo
  const cs = window.getComputedStyle(estimatedTimeBox);
  if (cs.position === 'static' || !cs.position) {
    estimatedTimeBox.style.position = 'fixed';
  }
  estimatedTimeBox.style.zIndex = estimatedTimeBox.style.zIndex || '1060';

  // función para actualizar el valor mostrado (acepta segundos)
  function setEstimatedFromSeconds(sec) {
    const estimatedTimeValue = document.getElementById('estimatedTimeValue');
    if (estimatedTimeValue) {
      if (typeof sec === 'number') {
        const minutes = Math.round(sec / 60);
        estimatedTimeValue.textContent = `${minutes} min`;
      } else {
        estimatedTimeValue.textContent = '-- min';
      }
    }
    estimatedTimeBox.style.display = 'block';
  }

  // si estamos dentro de un .then(route) y existe `route`, actualiza con ello;
  // si no, intenta usar window.lastRouteData si está disponible
  if (typeof route !== 'undefined' && route && route.duration) {
    setEstimatedFromSeconds(route.duration);
  } else if (window.lastRouteData && window.lastRouteData.duration) {
    setEstimatedFromSeconds(window.lastRouteData.duration);
  }
})();

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

  // Cargar el GeoJSON de las líneas del metro
  loadLinesStations();
  loadLinesComplete();

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
function displayServiceHours(serviceHours, usesArviStation = false) {
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
    const statusText = serviceHours.is_operating ? texts.open : texts.closed;

    let html = '';

    if (usesArviStation) {
      // For Arvi station, use the day name directly from serviceHours.day
      html = `
        <h6 class="mb-2">🕒 ${texts.operatingHours} - Estación Arvi</h6>
        <p class="mb-1"><strong>${serviceHours.day}:</strong> ${serviceHours.open_time} - ${serviceHours.close_time}</p>
        <p class="mb-1 text-info"><small><strong>${texts.note}:</strong> Horario especial para la estación Arvi</small></p>
        <p class="mb-0 ${statusClass}"><strong>${texts.state}:</strong> ${statusText}</p>
      `;
    } else {
      // For normal metro, use the days array index
      html = `
        <h6 class="mb-2">🕒 ${texts.operatingHours}</h6>
        <p class="mb-1"><strong>${texts.days[serviceHours.day]}:</strong> ${serviceHours.open_time} - ${serviceHours.close_time}</p>
        <p class="mb-0 ${statusClass}"><strong>${texts.state}:</strong> ${statusText}</p>
      `;
    }

    infoContainer.innerHTML = html;
  }
}

// Function to display Arvi-specific service hours (additional to general metro hours)
function displayArviServiceHours(serviceHours) {
  // Remove any existing Arvi service hours display
  const existingArviContainer = document.getElementById("arviServiceHoursInfo");
  if (existingArviContainer) {
    existingArviContainer.remove();
  }

  if (serviceHours) {
    const statusClass = serviceHours.is_operating ? 'text-success' : 'text-danger';
    const statusText = serviceHours.is_operating ? texts.open : texts.closed;

    const arviContainer = document.createElement("div");
    arviContainer.id = "arviServiceHoursInfo";
    arviContainer.style.marginTop = "10px";
    arviContainer.style.padding = "10px";
    arviContainer.style.backgroundColor = "#e8f5e8";
    arviContainer.style.borderRadius = "5px";
    arviContainer.style.border = "1px solid #28a745";

    const html = `
       <h6 class="mb-2">🕒 ${texts.operatingHours} - Estación Arvi</h6>
       <p class="mb-1"><strong>${serviceHours.day}:</strong> ${serviceHours.open_time} - ${serviceHours.close_time}</p>
       <p class="mb-0 ${statusClass}"><strong>${texts.state}:</strong> ${statusText}</p>
     `;

    arviContainer.innerHTML = html;

    // Insert the Arvi service hours container after the normal service hours container
    const normalServiceHoursContainer = document.getElementById("serviceHoursInfo");
    if (normalServiceHoursContainer) {
      normalServiceHoursContainer.parentNode.insertBefore(arviContainer, normalServiceHoursContainer.nextSibling);
    } else {
      document.querySelector(".divRute").appendChild(arviContainer);
    }
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
  // Clear any existing route visualization
  clearRouteVisualization();

  // Clear any existing Arvi service hours display
  const existingArviContainer = document.getElementById("arviServiceHoursInfo");
  if (existingArviContainer) {
    existingArviContainer.remove();
  }

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

      // Mostrar el botón 'Iniciar Recorrido' solo si la ruta es válida
      const btnStartJourney = document.getElementById("btnStartJourney");
      btnStartJourney.style.display = "block";

      // Guardar los datos de la ruta para usarlos en el botón de iniciar recorrido
      window.lastRouteData = data;

      // Ocultar cualquier alerta previa
      const alertBox = document.getElementById("alerta-validacion");
      alertBox.style.display = "none";

      // Mostrar el tiempo estimado en el contenedor
      const estimatedTimeBox = document.getElementById("estimatedTimeBox");
      const estimatedTimeValue = document.getElementById("estimatedTimeValue");
      if (typeof data.distance === "number" && data.distance > 0) {
        const totalMinutes = Math.round(data.distance);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        if (hours > 0) {
          estimatedTimeValue.textContent = `${hours} h ${minutes} min`;
        } else {
          estimatedTimeValue.textContent = `${minutes} min`;
        }
      } else {
        estimatedTimeValue.textContent = `-- min`;
      }
      estimatedTimeBox.style.display = "block";
// Lógica para el botón 'Iniciar Recorrido'
document.getElementById("btnStartJourney").addEventListener("click", function () {
  const data = window.lastRouteData;
  if (!data) return;

  if (data.can_make_trip === false || String(data.can_make_trip).toLowerCase() === "false") {
    const alertBox = document.getElementById("alerta-validacion");
    const alertMessage = document.getElementById("mensaje-alerta");
    let alertMessageText = "⚠️ El viaje no se puede completar dentro del horario de operación del metro.";
    if (data.uses_arvi_station) {
      alertMessageText = "⚠️ El viaje no se puede completar dentro del horario de operación de la estación Arvi (9:00-18:00 L-S, 8:30-18:00 Dom).";
    }
    showAutoClosingAlert(alertBox, alertMessage, alertMessageText);
    return;
  }
  // Si puede realizar el viaje, no mostrar nada

  // Mostrar el tiempo estimado en el contenedor
  const estimatedTimeBox = document.getElementById("estimatedTimeBox");
  const estimatedTimeValue = document.getElementById("estimatedTimeValue");
  if (data.duration) {
    // Redondear minutos
    const minutes = Math.round(data.duration / 60);
    estimatedTimeValue.textContent = `${minutes} min`;
    estimatedTimeBox.style.display = "block";
  }
});
      displayTransferInfo(data.transfer_info, data.rute);

      // Display the route on the map
      if (data.rute && data.rute_coords) {
        addNodesRouteToMap(data.rute, data.rute_coords);
      }

      // Update service hours display with new data
      console.log("Service hours data:", data.service_hours);
      console.log("Uses Arvi station:", data.uses_arvi_station);
      if (data.service_hours && data.uses_arvi_station) {
        console.log("Displaying Arvi service hours");
        // Only display Arvi-specific service hours if Arvi is part of the route
        displayArviServiceHours(data.service_hours);
      }
    })
    .catch((error) => {
      console.error("Error fetching route:", error);
      const alertBox = document.getElementById("alerta-validacion");
      const alertMessage = document.getElementById("mensaje-alerta");
      showAutoClosingAlert(alertBox, alertMessage, "Error al obtener la ruta. Inténtalo de nuevo.");
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

const lineX =
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "sistema": "MPLUS",
        "itinerario": "Universidad de Medellín - Parque de Aranjuez",
        "SHAPE__Length": 13111.14237182295,
        "objectid": 15,
        "linea": "X",
        "recorte_desde": [
          -75.57098596,
          6.22862439
        ],
        "recorte_hasta": [
          -75.5766653187318,
          6.230890944421365
        ],
        "snap_inicio": [
          -75.57098596,
          6.22862439,
          32
        ],
        "snap_fin": [
          -75.5766653187318,
          6.230890944421365,
          32
        ],
        "distancia_snap_inicio_m": 0,
        "distancia_snap_fin_m": 0
      },
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-75.5766653187318, 6.230890944421365, 32],
          [
            -75.5766653187318,
            6.230890944421365,
            32
          ],
          [
            -75.5766818170204,
            6.230883277586141,
            32
          ],
          [
            -75.57669463889333,
            6.230875177580857,
            32
          ],
          [
            -75.57670864972046,
            6.230863565714495,
            32
          ],
          [
            -75.57671899237911,
            6.230852469929656,
            32
          ],
          [
            -75.57672959254158,
            6.230837676978312,
            32
          ],
          [
            -75.5767376256369,
            6.230822434586094,
            32
          ],
          [
            -75.57674137442147,
            6.230813077043622,
            32
          ],
          [
            -75.57674412187619,
            6.230804395228096,
            32
          ],
          [
            -75.57675274973136,
            6.23077199939855,
            32
          ],
          [
            -75.5767583874568,
            6.230480886566663,
            32
          ],
          [
            -75.57675977053555,
            6.230409417153316,
            32
          ],
          [
            -75.5767921534719,
            6.230340182110688,
            32
          ],
          [
            -75.57680532829475,
            6.230317400723352,
            32
          ],
          [
            -75.5768222390034,
            6.230297242818631,
            32
          ],
          [
            -75.57684237811696,
            6.230280315710592,
            32
          ],
          [
            -75.57686513918819,
            6.230267125939616,
            32
          ],
          [
            -75.57688983484042,
            6.230258072855016,
            32
          ],
          [
            -75.57691572286558,
            6.230253427693706,
            32
          ],
          [
            -75.57694202428371,
            6.230253331684007,
            32
          ],
          [
            -75.57696794589292,
            6.230257788702849,
            32
          ],
          [
            -75.57699270646411,
            6.230266664243225,
            32
          ],
          [
            -75.57701080228962,
            6.230279229390665,
            32
          ],
          [
            -75.57702651535391,
            6.2302946766597,
            32
          ],
          [
            -75.5770534418437,
            6.23033453732108,
            32
          ],
          [
            -75.57706389388159,
            6.230358439105595,
            32
          ],
          [
            -75.57707049475646,
            6.230383678777448,
            32
          ],
          [
            -75.57730837760101,
            6.23133586619602,
            32
          ],
          [
            -75.57731561214652,
            6.231375603400839,
            32
          ],
          [
            -75.57731704243648,
            6.231415970202447,
            32
          ],
          [
            -75.57731263904233,
            6.231456120520009,
            32
          ],
          [
            -75.57730249181765,
            6.231495214018381,
            32
          ],
          [
            -75.57728681450868,
            6.23153243507064,
            32
          ],
          [
            -75.57726593486022,
            6.231567001847248,
            32
          ],
          [
            -75.57724028932846,
            6.231598193464976,
            32
          ],
          [
            -75.57720675832329,
            6.231623419598531,
            32
          ],
          [
            -75.57716970482876,
            6.23164310282091,
            32
          ],
          [
            -75.5771300362561,
            6.231656760432511,
            32
          ],
          [
            -75.57708872488826,
            6.231664058591081,
            32
          ],
          [
            -75.57704678172064,
            6.231664820576196,
            32
          ],
          [
            -75.57700523294945,
            6.231659022384059,
            32
          ],
          [
            -75.57696509566331,
            6.231646810024317,
            32
          ],
          [
            -75.57685744514295,
            6.23160984202139,
            32
          ],
          [
            -75.5767480145,
            6.231578540468679,
            32
          ],
          [
            -75.57664386311797,
            6.23155454613155,
            32
          ],
          [
            -75.57657672836922,
            6.231542362639908,
            32
          ],
          [
            -75.57643236027016,
            6.231518570262276,
            32
          ],
          [
            -75.57634045070408,
            6.231499789559105,
            32
          ],
          [
            -75.57624946364065,
            6.231476954017214,
            32
          ],
          [
            -75.57615957637347,
            6.231450107974096,
            32
          ],
          [
            -75.57540973509916,
            6.231235716973579,
            32
          ],
          [
            -75.57466123556695,
            6.231016677414043,
            32
          ],
          [
            -75.57408952287932,
            6.230841311468704,
            32
          ],
          [
            -75.57399538875858,
            6.230806529720263,
            32
          ],
          [
            -75.57098596,
            6.22862439,
            32
          ]
        ]
      }
    }
  ]
};


// Fallback para la línea T (tu geojson tal cual)
const lineT = {
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "sistema": "T",
        "itinerario": "San Antonio - Oriente",
        "SHAPE__Length": 4171.290908849139,
        "objectid": 16,
        "linea": "T"
      },
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-75.56915715039199, 6.246997810738122, 35],
          [-75.56899648037718, 6.246939945485565, 35],
          [-75.56868243787234, 6.246816641725021, 35],
          [-75.56863898947934, 6.246801958141261, 35],
          [-75.5684612421816, 6.246735418152711, 35],
          [-75.56842800287549, 6.246724214257357, 35],
          [-75.56839065228664, 6.246716433443648, 35],
          [-75.56837017849911, 6.24671548107932, 35],
          [-75.56835366554779, 6.246716566178844, 35],
          [-75.56833734489106, 6.246719288554154, 35],
          [-75.56831358204062, 6.246726402291096, 35],
          [-75.56828405655207, 6.24674124071165, 35],
          [-75.56827055373681, 6.246750796919175, 35],
          [-75.56825213882898, 6.246767599008234, 35],
          [-75.56823555544017, 6.246787030293802, 35],
          [-75.56821518520813, 6.246815646668387, 35],
          [-75.56777413984516, 6.247477583982717, 35],
          [-75.56760308628654, 6.247722127517463, 35],
          [-75.56755248001966, 6.247796650409316, 35],
          [-75.56747938991894, 6.247910291096805, 35],
          [-75.5673819699176, 6.248073005429736, 35],
          [-75.56736150490096, 6.248104248662065, 35],
          [-75.5673436250127, 6.248126656226177, 35],
          [-75.56733018363724, 6.248140484874192, 35],
          [-75.56731516137629, 6.248153243563244, 35],
          [-75.56729902430665, 6.248164352301732, 35],
          [-75.56728188168067, 6.248173796994328, 35],
          [-75.56725459891993, 6.248184643726838, 35],
          [-75.56723564435359, 6.248189546965976, 35],
          [-75.56721629645746, 6.248192532735308, 35],
          [-75.56718695187114, 6.248193357715456, 35],
          [-75.56715790485785, 6.248189803621637, 35],
          [-75.56712976300503, 6.248182147755637, 35],
          [-75.56709475198284, 6.248167632622551, 35],
          [-75.56687073633016, 6.248049446669951, 35],
          [-75.56604518633229, 6.247640077001546, 35],
          [-75.56595580344352, 6.247598197106262, 35],
          [-75.56580587917092, 6.247535515597956, 35],
          [-75.56573944012176, 6.247505681040304, 35],
          [-75.56538621247405, 6.247329169623094, 35.0],
        ]
      }
    }
  ]
};

const lineM = {
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "sistema": "MPLUS",
        "itinerario": "Parque de Aranjuez - Universidad de Medellín",
        "SHAPE__Length": 12781.32563980787,
        "objectid": 10,
        "linea": "M",
        "recorte_desde": [
          -75.56327830924161,
          6.2640097938723756
        ],
        "recorte_hasta": [
          -75.55592313,
          6.262113085
        ],
        "snap_inicio": [
          -75.56327830924161,
          6.2640097938723756,
          31
        ],
        "snap_fin": [
          -75.55592313,
          6.262113085,
          31
        ],
        "distancia_snap_inicio_m": 0,
        "distancia_snap_fin_m": 0
      },
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [
            -75.55592313,
            6.262113085,
            31
          ],
          [
            -75.55592313,
            6.262113085,
            31
          ],
          [
            -75.55605543401643,
            6.261764355267457,
            31
          ],
          [
            -75.55607420295466,
            6.261732299345025,
            31
          ],
          [
            -75.55609782488092,
            6.261703634564915,
            31
          ],
          [
            -75.55612570162117,
            6.261679093450513,
            31
          ],
          [
            -75.55615712154253,
            6.261659301489486,
            31
          ],
          [
            -75.5561912883632,
            6.261644756199716,
            31
          ],
          [
            -75.55622732931513,
            6.261635833418319,
            31
          ],
          [
            -75.55626433204603,
            6.261632758190391,
            31
          ],
          [
            -75.55630135005755,
            6.261635608359395,
            31
          ],
          [
            -75.5563374469633,
            6.261644311639136,
            31
          ],
          [
            -75.5563717001156,
            6.261658648308271,
            31
          ],
          [
            -75.55640323945507,
            6.261678251021333,
            31
          ],
          [
            -75.55668052209862,
            6.26193778238259,
            31
          ],
          [
            -75.55671215738744,
            6.2619767214903,
            31
          ],
          [
            -75.55673852539026,
            6.262019408445889,
            31
          ],
          [
            -75.5567591853596,
            6.262065134776045,
            31
          ],
          [
            -75.5567737947814,
            6.262113140898752,
            31
          ],
          [
            -75.55678211124335,
            6.262162628772408,
            31
          ],
          [
            -75.55683828292845,
            6.262395846042312,
            31
          ],
          [
            -75.55689325868538,
            6.262538169098288,
            31
          ],
          [
            -75.55693072055625,
            6.262606756848982,
            31
          ],
          [
            -75.55695266843739,
            6.262639935202583,
            31
          ],
          [
            -75.55697383535747,
            6.262671932086275,
            31
          ],
          [
            -75.55702229546048,
            6.262733234313026,
            31
          ],
          [
            -75.55707575718021,
            6.262790220385793,
            31
          ],
          [
            -75.55713383545981,
            6.262842486239315,
            31
          ],
          [
            -75.5571961173787,
            6.262889657779817,
            31
          ],
          [
            -75.55726215948228,
            6.262931399034837,
            31
          ],
          [
            -75.55733148506225,
            6.26296741035862,
            31
          ],
          [
            -75.55740360315664,
            6.262997433763524,
            31
          ],
          [
            -75.55751236777076,
            6.263021354806018,
            31
          ],
          [
            -75.55865019866309,
            6.263223490486672,
            31
          ],
          [
            -75.55953703888929,
            6.263372997494075,
            31
          ],
          [
            -75.56016995656279,
            6.26348636879114,
            31
          ],
          [
            -75.56050873808768,
            6.263547620215959,
            31
          ],
          [
            -75.56075973095422,
            6.263585893868998,
            31
          ],
          [
            -75.5616166921859,
            6.263741377789848,
            31
          ],
          [
            -75.56220951328837,
            6.263839452227047,
            31
          ],
          [
            -75.5631859952583,
            6.263990149746983,
            31
          ],
          [
            -75.56327830924161,
            6.2640097938723756,
            31
          ]
        ]
      }
    }
  ]
};


const lineM0 = {
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "sistema": "MPLUS",
        "itinerario": "Parque de Aranjuez - Universidad de Medellín",
        "SHAPE__Length": 12781.32563980787,
        "objectid": 10,
        "linea": "M",
        "recorte_desde": [
          -75.58205816,
          6.231865203
        ],
        "recorte_hasta": [
          -75.5766818170204,
          6.230883277586141
        ],
        "snap_inicio": [
          -75.58205816,
          6.231865203,
          31
        ],
        "snap_fin": [
          -75.57668235305866,
          6.230883463523883,
          31
        ],
        "distancia_snap_inicio_m": 0,
        "distancia_snap_fin_m": 3.6
      },
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [
            -75.57668235305866,
            6.230883463523883,
            31
          ],
          [
            -75.5767376256369,
            6.230822434586094,
            31
          ],
          [
            -75.57674412187619,
            6.230804395228096,
            31
          ],
          [
            -75.57675274973136,
            6.23077199939855,
            31
          ],
          [
            -75.5767583874568,
            6.230480886566663,
            31
          ],
          [
            -75.57675977053555,
            6.230409417153316,
            31
          ],
          [
            -75.57677359436518,
            6.229695663305006,
            31
          ],
          [
            -75.57676971123156,
            6.229673973344791,
            31
          ],
          [
            -75.57676217308283,
            6.229653271331971,
            31
          ],
          [
            -75.57675120242797,
            6.229634166437648,
            31
          ],
          [
            -75.57673712185697,
            6.229617226659755,
            31
          ],
          [
            -75.57672034757958,
            6.229602950828461,
            31
          ],
          [
            -75.57670137765486,
            6.229591763238336,
            31
          ],
          [
            -75.57668077382114,
            6.22958399294435,
            31
          ],
          [
            -75.57665914251562,
            6.229579872045394,
            31
          ],
          [
            -75.57663712667741,
            6.229579522163706,
            31
          ],
          [
            -75.57661537682044,
            6.229582950969535,
            31
          ],
          [
            -75.57659453480308,
            6.229590058589394,
            31
          ],
          [
            -75.57657521846114,
            6.229600635872435,
            31
          ],
          [
            -75.57655799814117,
            6.229614369025722,
            31
          ],
          [
            -75.57654338592094,
            6.229630852324631,
            31
          ],
          [
            -75.57653180945039,
            6.229649596376374,
            31
          ],
          [
            -75.5765236174645,
            6.229670047079652,
            31
          ],
          [
            -75.5765190464405,
            6.22969160296525,
            31
          ],
          [
            -75.57650099851976,
            6.230493074951969,
            31
          ],
          [
            -75.57649463665902,
            6.230775603453973,
            31
          ],
          [
            -75.57650262663982,
            6.230811132097196,
            31
          ],
          [
            -75.57651383941574,
            6.230845778872921,
            31
          ],
          [
            -75.57652818049192,
            6.23087924860612,
            31
          ],
          [
            -75.57655155594078,
            6.230969719367638,
            31
          ],
          [
            -75.57656809873544,
            6.231061685429969,
            31
          ],
          [
            -75.57657771874351,
            6.23115463552232,
            31
          ],
          [
            -75.57657348140228,
            6.231345984573252,
            31
          ],
          [
            -75.57657672836922,
            6.231542362639908,
            31
          ],
          [
            -75.57657733953019,
            6.231575951912766,
            31
          ],
          [
            -75.57658112645346,
            6.231596061996689,
            31
          ],
          [
            -75.57658820109268,
            6.231615263675508,
            31
          ],
          [
            -75.57659836568749,
            6.231633020887823,
            31
          ],
          [
            -75.57661133956552,
            6.23164883956552,
            31
          ],
          [
            -75.57662676011648,
            6.231662282094871,
            31
          ],
          [
            -75.5766457839957,
            6.231673584212585,
            31
          ],
          [
            -75.57703754961913,
            6.231824925235881,
            31
          ],
          [
            -75.57713730533808,
            6.23185807856255,
            31
          ],
          [
            -75.57723863037099,
            6.231886056432399,
            31
          ],
          [
            -75.5773412605574,
            6.231908786906498,
            31
          ],
          [
            -75.57744492003233,
            6.231926206240042,
            31
          ],
          [
            -75.57754933755356,
            6.231938272363935,
            31
          ],
          [
            -75.57806175353657,
            6.231935856653091,
            31
          ],
          [
            -75.57834873444139,
            6.23191447076641,
            31
          ],
          [
            -75.57858523726398,
            6.231875531142458,
            31
          ],
          [
            -75.57886719476777,
            6.231853202198553,
            31
          ],
          [
            -75.57979804458758,
            6.23183022262284,
            31
          ],
          [
            -75.58003232681915,
            6.231851080394891,
            31
          ],
          [
            -75.58042450151837,
            6.231925302560198,
            31
          ],
          [
            -75.5805049711942,
            6.231936230442309,
            31
          ],
          [
            -75.58058594514098,
            6.231942384988971,
            31
          ],
          [
            -75.58066714137443,
            6.231943744075354,
            31
          ],
          [
            -75.58089283510782,
            6.231937192775436,
            31
          ],
          [
            -75.58160939172201,
            6.231916396574992,
            31
          ],
          [
            -75.58174122566783,
            6.231883014876762,
            31
          ],
          [
            -75.58181862172434,
            6.231868443465872,
            31
          ],
          [
            -75.58205816,
            6.231865203,
            31
          ]
        ]
      }
    }
  ]
}

const lineO = {
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "sistema": "MPLUS",
        "itinerario": "La Palma - Caribe",
        "SHAPE__Length": 9217.369327291528,
        "objectid": 13,
        "linea": "O",
        "corte_objetivo": [
          -75.57316774,
          6.276849813
        ],
        "snap_a_linea": [
          -75.57316774,
          6.276849813,
          30
        ],
        "distancia_snap_m": 0,
        "incluye_objetivo": true
      },
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [
            -75.57316774,
            6.276849813,
            30
          ],
          [
            -75.57316774,
            6.276849813,
            30
          ],
          [
            -75.57302394199424,
            6.277376791881054,
            30
          ],
          [
            -75.57294512147853,
            6.277600781263887,
            30
          ],
          [
            -75.57285960268668,
            6.277822296557086,
            30
          ],
          [
            -75.57284512692202,
            6.277843932048088,
            30
          ],
          [
            -75.57282793392196,
            6.277863476181173,
            30
          ],
          [
            -75.57280534225305,
            6.277882816315402,
            30
          ],
          [
            -75.5727833865117,
            6.277896789365612,
            30
          ],
          [
            -75.57275978512888,
            6.277907753563004,
            30
          ],
          [
            -75.5727349482715,
            6.27791551793621,
            30
          ],
          [
            -75.57270930716679,
            6.277919948367904,
            30
          ],
          [
            -75.5726833068789,
            6.277920968534126,
            30
          ],
          [
            -75.57265232748658,
            6.277909155231022,
            30
          ],
          [
            -75.57261978339169,
            6.277890943246307,
            30
          ],
          [
            -75.57259350890705,
            6.277870715056836,
            30
          ],
          [
            -75.57256757257146,
            6.277843908862188,
            30
          ],
          [
            -75.57254606535422,
            6.277813428372837,
            30
          ],
          [
            -75.57252949951528,
            6.277780001574684,
            30
          ],
          [
            -75.57251826746763,
            6.27774442213743,
            30
          ],
          [
            -75.57251298278011,
            6.277711673998656,
            30
          ],
          [
            -75.57255779986168,
            6.277475466649514,
            30
          ],
          [
            -75.5727536009152,
            6.276738236078343,
            30
          ],
          [
            -75.57285524198176,
            6.276348642972274,
            30
          ],
          [
            -75.5728622978981,
            6.276289628268781,
            30
          ],
          [
            -75.57286342933128,
            6.2762236034548,
            30
          ],
          [
            -75.57285749196946,
            6.276157837601301,
            30
          ],
          [
            -75.57284455727488,
            6.276093083461457,
            30
          ],
          [
            -75.5728270527765,
            6.276036286062362,
            30
          ],
          [
            -75.57280129394489,
            6.275975489765681,
            30
          ],
          [
            -75.57276918233964,
            6.275917799494914,
            30
          ],
          [
            -75.5727310853431,
            6.275863879755833,
            30
          ],
          [
            -75.57268994971689,
            6.275838655348073,
            30
          ],
          [
            -75.57264608887455,
            6.275818545197396,
            30
          ],
          [
            -75.57260532329516,
            6.275805203206472,
            30
          ],
          [
            -75.57255806473647,
            6.27579548868283,
            30
          ],
          [
            -75.57250998232341,
            6.275791512837842,
            30
          ],
          [
            -75.57246177024489,
            6.275793333738437,
            30
          ],
          [
            -75.57241412498766,
            6.275800925360159,
            30
          ],
          [
            -75.57236772906047,
            6.275814174955091,
            30
          ],
          [
            -75.57233518523937,
            6.275843848863599,
            30
          ],
          [
            -75.57228013509365,
            6.275894046794281,
            30
          ],
          [
            -75.57221334565239,
            6.275959932300541,
            30
          ],
          [
            -75.57214952182957,
            6.276026977643467,
            30
          ],
          [
            -75.57210871647857,
            6.276076230412736,
            30
          ],
          [
            -75.57207144372245,
            6.276128208828921,
            30
          ],
          [
            -75.57203395527945,
            6.276189629707206,
            30
          ],
          [
            -75.57200139641097,
            6.276253802820304,
            30
          ],
          [
            -75.57197396666116,
            6.276320332101097,
            30
          ],
          [
            -75.57195183479317,
            6.276388808976395,
            30
          ],
          [
            -75.57194424005364,
            6.276447226946164,
            30
          ],
          [
            -75.5719412074451,
            6.276506060981237,
            30
          ],
          [
            -75.57194327452322,
            6.276572297952694,
            30
          ],
          [
            -75.57194996687277,
            6.276630828341345,
            30
          ],
          [
            -75.57196118877316,
            6.276688658403571,
            30
          ],
          [
            -75.5719883478329,
            6.276791196909514,
            30
          ],
          [
            -75.57200637906047,
            6.276842654935645,
            30
          ],
          [
            -75.57202811760772,
            6.276891382473113,
            30
          ],
          [
            -75.57204166436695,
            6.276988802009231,
            30
          ],
          [
            -75.57205072225818,
            6.277086739948675,
            30
          ],
          [
            -75.57205494532876,
            6.27717269986661,
            30
          ],
          [
            -75.57205553112233,
            6.277271055542778,
            30
          ],
          [
            -75.57205233105341,
            6.277357059175719,
            30
          ],
          [
            -75.57204683641723,
            6.277430624780739,
            30
          ],
          [
            -75.57201696784048,
            6.278396380234749,
            30
          ],
          [
            -75.57201099618875,
            6.278635576388924,
            30
          ],
          [
            -75.57199307044736,
            6.278868792898408,
            30
          ],
          [
            -75.57196618015442,
            6.279093040618754,
            30
          ],
          [
            -75.57192733773627,
            6.27935017548081,
            30
          ],
          [
            -75.57186459508326,
            6.279882388461226,
            30
          ],
          [
            -75.57174807212537,
            6.280791335842099,
            30
          ],
          [
            -75.57173313156909,
            6.280866085257382,
            30
          ],
          [
            -75.57172505502587,
            6.280885246454431,
            30
          ],
          [
            -75.57171468604994,
            6.280903268921915,
            30
          ],
          [
            -75.57169756901075,
            6.280925056649276,
            30
          ],
          [
            -75.57167712171295,
            6.28094374978034,
            30
          ],
          [
            -75.57165389283368,
            6.280958843847428,
            30
          ],
          [
            -75.57163177886383,
            6.280968776411489,
            30
          ],
          [
            -75.57160165613266,
            6.2809767159598,
            30
          ],
          [
            -75.57154149947553,
            6.280970201228858,
            30
          ],
          [
            -75.57146959381865,
            6.280960116144145,
            30
          ],
          [
            -75.57135065459394,
            6.28093785003729,
            30
          ],
          [
            -75.5708038292643,
            6.280851147118131,
            30
          ],
          [
            -75.57062753041939,
            6.28081825942775,
            30
          ],
          [
            -75.57057859800618,
            6.280805050676153,
            30
          ],
          [
            -75.57041673656711,
            6.280756669979191,
            30
          ],
          [
            -75.57025700383183,
            6.280701655394959,
            30
          ],
          [
            -75.57002728567159,
            6.280637519705246,
            30
          ],
          [
            -75.56980319131809,
            6.28057858009652,
            30
          ],
          [
            -75.56975676077754,
            6.280562604194642,
            30
          ],
          [
            -75.56972699556668,
            6.280548953102402,
            30
          ],
          [
            -75.56969839635998,
            6.280532998985466,
            30
          ],
          [
            -75.56967114164651,
            6.28051484222504,
            30
          ],
          [
            -75.56964539912178,
            6.280494593200646,
            30
          ],
          [
            -75.56962133205253,
            6.280472380395408,
            30
          ],
          [
            -75.56959556670654,
            6.28044416463246,
            30
          ],
          [
            -75.5695756211303,
            6.280418181408359,
            30
          ],
          [
            -75.5695577834056,
            6.280390706023453,
            30
          ],
          [
            -75.56955208491208,
            6.280364942118482,
            30
          ],
          [
            -75.56954758062976,
            6.280333600435898,
            30
          ],
          [
            -75.56954580405585,
            6.280280884403536,
            30
          ],
          [
            -75.5695481862686,
            6.280249310896239,
            30
          ],
          [
            -75.56955213590041,
            6.280223219327916,
            30
          ],
          [
            -75.56955920732231,
            6.280192356907674,
            30
          ],
          [
            -75.56956700763044,
            6.280167149610623,
            30
          ],
          [
            -75.56958077375788,
            6.280132876622157,
            30
          ],
          [
            -75.5696261653722,
            6.280041524022884,
            30
          ],
          [
            -75.5696616086409,
            6.279962971588636,
            30
          ],
          [
            -75.56969393992055,
            6.27988308553991,
            30
          ],
          [
            -75.56971913484361,
            6.279813644247433,
            30
          ],
          [
            -75.5697782373673,
            6.279698689019431,
            30
          ],
          [
            -75.56983212850844,
            6.279581197202355,
            30
          ],
          [
            -75.56987557153344,
            6.279474822780716,
            30
          ],
          [
            -75.56991933452693,
            6.279353189360254,
            30
          ],
          [
            -75.56995143815477,
            6.279204259962508,
            30
          ],
          [
            -75.57010757541492,
            6.278518989901434,
            30
          ],
          [
            -75.57017928750855,
            6.278249894097165,
            30
          ],
          [
            -75.57024801070597,
            6.277980797621977,
            30
          ]
        ]
      }
    }
  ]
}

const lineK = {
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "sistema": "C",
        "itinerario": "Acevedo - Santo Domingo",
        "SHAPE__Length": 2027.1753607637195,
        "objectid": 4,
        "linea": "K",
        "corte_objetivo": [
          -75.55189694,
          6.296272054
        ],
        "snap_a_linea": [
          -75.55189694,
          6.296272054,
          50
        ],
        "distancia_snap_m": 0,
        "incluye_objetivo": false
      },
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [
            -75.55830802076247,
            6.300272175884505,
            50
          ],
          [
            -75.55189694,
            6.296272054,
            50
          ]
        ]
      }
    }
  ]
}

const lineP = {
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "sistema": "C",
        "itinerario": "Acevedo - Picacho",
        "SHAPE__Length": 2716.658778103622,
        "objectid": 9,
        "linea": "P",
        "corte_objetivo": [
          -75.5673189,
          6.301882672
        ],
        "snap_a_linea": [
          -75.5673189,
          6.301882672,
          50
        ],
        "distancia_snap_m": 0,
        "incluye_objetivo": false
      },
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [
            -75.55880797429955,
            6.2995491281153,
            50
          ],
          [
            -75.5673189,
            6.301882672,
            50
          ]
        ]
      }
    }
  ]
}

const lineZ = {
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "origen": "T05 - Miraflores",
        "destino": "Z01 - El Pinal"
      },
      "geometry": {
        "coordinates": [
          [
            -75.54880376805299,
            6.24190257518569
          ],
          [
            -75.54447595,
            6.24526309
          ]
        ],
        "type": "LineString"
      }
    }
  ]
}



// Function to clear existing route visualization
function getLine(lineValue) {
  if (!linesStations || linesStations.type !== "FeatureCollection") {
    console.error("linesStations no está cargado todavía");
    return { type: "FeatureCollection", features: [] };
  }
  const features = linesStations.features.filter(
    f => f?.properties?.["linea"] === lineValue
  );
  return { type: "FeatureCollection", features };
}

// Function to clear existing route visualization
function getLineComplete(lineValue) {
  if (!linesComplete || linesComplete.type !== "FeatureCollection") {
    console.error("linesComplete no está cargado todavía");
    return { type: "FeatureCollection", features: [] };
  }
  const features = linesComplete.features.filter(
    f => f?.properties?.["linea"] === lineValue
  );
  return { type: "FeatureCollection", features };
}


// Función para encontrar el índice de coordenadas en una línea
function findCoordIndex(lineFC, target, eps = 1e-9) {
  console.log("Buscando coordenada", target, "en línea con", lineFC.features, "features");
  const almostEq = (a, b) => Math.abs(a - b) < eps;
  const isSameCoord = (c) => almostEq(c[0], target[0]) && almostEq(c[1], target[1]);

  for (const f of lineFC.features) {
    const coords = f.geometry.coordinates;
    const idx = coords.findIndex(isSameCoord);
    if (idx !== -1) return idx;
  }
  return -1;
}

// Route visualization functions
function paintLineSegment(lineInput, startIndex, endIndex, sourceId = "sub-line", layerId = "sub-line-layer", rute, rute_coords) {
  // Acepta Feature o FeatureCollection
  let feature = null;
  if (!lineInput) {
    console.error("[paintLineSegment] lineInput es null/undefined");
    return;
  } else if (lineInput.type === "Feature") {
    feature = lineInput;
  } else if (lineInput.type === "FeatureCollection") {
    if (!lineInput.features?.length) {
      console.error("[paintLineSegment] FeatureCollection vacío");
      return;
    }
    feature = lineInput.features[0];
  } else {
    console.error("[paintLineSegment] lineInput no es Feature ni FeatureCollection:", lineInput);
    return;
  }

  // Validar que sea LineString y que existan coords
  const geom = feature.geometry;
  if (!geom || geom.type !== "LineString" || !Array.isArray(geom.coordinates)) {
    console.error("[paintLineSegment] geometry inválida o no LineString:", geom);
    return;
  }

  const coords = geom.coordinates;
  if (!Number.isInteger(startIndex) || !Number.isInteger(endIndex)) {
    console.error("[paintLineSegment] índices no son enteros:", startIndex, endIndex);
    return;
  }

  // Normalizar y acotar índices
  const iMin = Math.max(0, Math.min(startIndex, endIndex));
  const iMax = Math.min(coords.length - 1, Math.max(startIndex, endIndex));

  if (iMin === iMax) {
    console.warn("[paintLineSegment] tramo de un solo punto, necesita al menos 2:", iMin, iMax);
    return;
  }

  const segmentCoords = coords.slice(iMin, iMax + 1);
  if (segmentCoords.length < 2) {
    console.warn("[paintLineSegment] segmento < 2 puntos, no se pinta");
    return;
  }

  const segment = {
    type: "Feature",
    geometry: { type: "LineString", coordinates: segmentCoords },
    properties: { ...(feature.properties || {}), _slice: [iMin, iMax] }
  };

  // Pintar / actualizar
  if (map.getSource(sourceId)) {
    map.getSource(sourceId).setData(segment);
  } else {
    map.addSource(sourceId, { type: "geojson", data: segment });
    map.addLayer({
      id: layerId,
      type: "line",
      source: sourceId,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": "#FF0000", "line-width": 4 }
    });
  }
}

function showLines(selectedLines) {
  if (map.getSource("lineasCompletas")) {
    map.getSource("lineasCompletas").setData(selectedLines);
    return;
  }
  map.addSource("lineasCompletas", {
    type: "geojson",
    data: selectedLines
  });
  map.addLayer({
    id: 'lineas-layer',
    type: 'line',
    source: "lineasCompletas",
    layout: {
      'line-join': 'round',
      'line-cap': 'round'
    },
    paint: {
      "line-color": [
        "match",
        ["get", "linea"],
        "A", "#FF3B30",
        "B", "#008CFF",
        "O", "#2ECC71",
        "Z", "#9B59B6",
        "2", "#F39C12",
        "1", "#34495E",
        "K", "#34495E",
        "P", "#34495E",
        "L", "#00A9A5",
        "J", "#E74C3C",
        "H", "#9B59B6",
        "T", "#00A9A5",
      /* default */ "#000000"
      ],
      'line-width': 3
    }
  });
}

document.getElementById("btnShowLines").addEventListener("click", () => {
  clearRouteVisualization();
  const line = document.getElementById("lineSelection").value
  if (line != "ALL") {
    const selectedLines = getLineComplete(line)
    showLines(selectedLines)
  } else {
    showLines(linesComplete)
  }
})

function addNodesRouteToMap(rute, rute_coords) {
  if (!Array.isArray(rute) || !Array.isArray(rute_coords)) return;
  if (rute.length < 2 || rute_coords.length < 2) return;

  for (let i = 0; i < rute.length - 1; i++) {
    const fromId = rute[i];
    const toId = rute[i + 1];
    const fromCoord = rute_coords[i];
    const toCoord = rute_coords[i + 1];
    if (!fromCoord || !toCoord) continue;

    const sourceId = `sub-line-${i + 1}`;
    const layerId = `sub-line-layer-${i + 1}`;

    const fromLineVal = fromId.charAt(0);
    const toLineVal = toId.charAt(0);

    // ===== Trasbordo detectado (cambio de letra) =====
    if (fromLineVal !== toLineVal) {
      // Caso especial: si la nueva línea es T, pinta SIEMPRE el GeoJSON fallback de T completo
      if (toLineVal === "T" || toId === "A11") {
        const featT = lineT.features[0];
        const endIdxT = featT.geometry.coordinates.length - 1;
        paintLineSegment(featT, 0, endIdxT, sourceId, layerId);
        const colorT = COLOR_BY_LINE?.T || "#00A9A5";
        if (map.getLayer(layerId)) {
          map.setPaintProperty(layerId, "line-color", colorT);
          map.setPaintProperty(layerId, "line-width", 4);
        }
      }

      if (toLineVal === "X") {
        const featX = lineX.features[0];
        const endIdxX = featX.geometry.coordinates.length - 1;
        paintLineSegment(featX, 0, endIdxX, sourceId, layerId);
        const colorT = COLOR_BY_LINE?.T || "#00A9A5";
        if (map.getLayer(layerId)) {
          map.setPaintProperty(layerId, "line-color", colorT);
          map.setPaintProperty(layerId, "line-width", 4);
        }
      }

      if (toLineVal === "M" && toId.charAt(1) === "1") {
        const featM = lineM.features[0];
        const endIdxM = featM.geometry.coordinates.length - 1;
        paintLineSegment(featM, 0, endIdxM, sourceId, layerId);
        const colorT = COLOR_BY_LINE?.M || "#00A9A5";
        if (map.getLayer(layerId)) {
          map.setPaintProperty(layerId, "line-color", colorT);
          map.setPaintProperty(layerId, "line-width", 4);
        }
      }

      if (toLineVal === "M" && toId.charAt(1) === "0" || toId === "A14") {
        const featM = lineM0.features[0];
        const endIdxM = featM.geometry.coordinates.length - 1;
        paintLineSegment(featM, 0, endIdxM, sourceId, layerId);
        const colorT = COLOR_BY_LINE?.M || "#00A9A5";
        if (map.getLayer(layerId)) {
          map.setPaintProperty(layerId, "line-color", colorT);
          map.setPaintProperty(layerId, "line-width", 4);
        }
      }

      if (toLineVal === "O" && toId.charAt(1) === "0") {
        const featO = lineO.features[0];
        const endIdxO = featO.geometry.coordinates.length - 1;
        paintLineSegment(featO, 0, endIdxO, sourceId, layerId);
        const colorT = COLOR_BY_LINE?.O || "#00A9A5";
        if (map.getLayer(layerId)) {
          map.setPaintProperty(layerId, "line-color", colorT);
          map.setPaintProperty(layerId, "line-width", 4);
        }
      }

      if (toLineVal === "K") {
        const featK = lineK.features[0];
        const endIdxK = featK.geometry.coordinates.length - 1;
        paintLineSegment(featK, 0, endIdxK, sourceId, layerId);
        const colorT = COLOR_BY_LINE?.K || "#00A9A5";
        if (map.getLayer(layerId)) {
          map.setPaintProperty(layerId, "line-color", colorT);
          map.setPaintProperty(layerId, "line-width", 4);
        }
      }


      if (toLineVal === "P") {
        const featP = lineP.features[0];
        const endIdxP = featP.geometry.coordinates.length - 1;
        paintLineSegment(featP, 0, endIdxP, sourceId, layerId);
        const colorT = COLOR_BY_LINE?.P || "#00A9A5";
        if (map.getLayer(layerId)) {
          map.setPaintProperty(layerId, "line-color", colorT);
          map.setPaintProperty(layerId, "line-width", 4);
        }
      }

      if (toLineVal === "Z") {
        const featZ = lineZ.features[0];
        const endIdxZ = featZ.geometry.coordinates.length - 1;
        paintLineSegment(featZ, 0, endIdxZ, sourceId, layerId);
        const colorT = COLOR_BY_LINE?.Z || "#00A9A5";
        if (map.getLayer(layerId)) {
          map.setPaintProperty(layerId, "line-color", colorT);
          map.setPaintProperty(layerId, "line-width", 4);
        }
      }
    }

    // ===== Caso normal: misma línea =====
    const lineFC = getLine(fromLineVal);
    const startIdx = findCoordIndex(lineFC, fromCoord);
    const endIdx = findCoordIndex(lineFC, toCoord);

    if (startIdx !== -1 && endIdx !== -1) {
      // Pinta tramo dentro de la misma línea
      paintLineSegment(lineFC, startIdx, endIdx, sourceId, layerId);
      const color = COLOR_BY_LINE?.[fromLineVal] || "#FF0000";
      if (map.getLayer(layerId)) {
        map.setPaintProperty(layerId, "line-color", color);
        map.setPaintProperty(layerId, "line-width", 4);
      }
      continue;
    }

    // Si por alguna razón no encontramos índices (pero no es trasbordo), omite tramo
    console.warn(`[addNodesRouteToMap] No se hallaron índices en la línea ${fromLineVal} para tramo ${fromId}→${toId}`);
  }
}



// Color mapping for metro lines
const COLOR_BY_LINE = {
  "A": "#FF3B30",
  "B": "#008CFF",
  "O": "#2ECC71",
  "Z": "#9B59B6",
  "X": "#F39C12",
  "M": "#34495E",
  "K": "#34495E",
  "P": "#34495E",
  "L": "#00A9A5",
  "J": "#E74C3C",
  "H": "#9B59B6",
  "T": "#00A9A5"
};


function clearRouteVisualization() {
  // Remove all route-related sources and layers
  const sourcesToRemove = [];
  const layersToRemove = [];

  map.getStyle().sources && Object.keys(map.getStyle().sources).forEach(sourceId => {
    if (sourceId.startsWith('route-segment-') || sourceId.startsWith('sub-line') || sourceId.startsWith('lineasCompletas')) {
      sourcesToRemove.push(sourceId);
    }
  });

  map.getStyle().layers && map.getStyle().layers.forEach(layer => {
    if (layer.id.startsWith('route-segment-layer-') || layer.id.startsWith('sub-line-layer') || layer.id.startsWith('lineas-layer')) {
      layersToRemove.push(layer.id);
    }
  });

  layersToRemove.forEach(layerId => {
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }
  });

  sourcesToRemove.forEach(sourceId => {
    if (map.getSource(sourceId)) {
      map.removeSource(sourceId);
    }
  });
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
    selectedStationLocation = closestStationsToUser[0].geometry.coordinates;
    pickStartingPoint(selectedStationLocation);
    map.flyTo({ center: selectedStationLocation });
  }
};
document.getElementById("btnClosestStation2").onclick = function () {
  if (closestStationsToUser[1]) {
    selectedStationLocation = closestStationsToUser[1].geometry.coordinates;
    pickStartingPoint(selectedStationLocation);
    map.flyTo({ center: selectedStationLocation });
  }
};
document.getElementById("btnClosestStation3").onclick = function () {
  if (closestStationsToUser[2]) {
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
    startInput.addEventListener('input', function () {
      showInputSuggestions(this, 'startSuggestions');
    });

    startInput.addEventListener('focus', function () {
      showInputSuggestions(this, 'startSuggestions');
    });
  }

  if (destInput) {
    destInput.addEventListener('input', function () {
      showInputSuggestions(this, 'destSuggestions');
    });

    destInput.addEventListener('focus', function () {
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

    item.addEventListener('click', function () {
      inputElement.value = suggestion.name;
      container.remove();
    });

    item.addEventListener('mouseenter', function () {
      this.style.backgroundColor = '#f8f9fa';
    });

    item.addEventListener('mouseleave', function () {
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

function changeLanguage(lang) {
  document.getElementById("language-input").value = lang;
  document.getElementById("language-form").submit();
}