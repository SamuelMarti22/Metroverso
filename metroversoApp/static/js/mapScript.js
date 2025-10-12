mapboxgl.accessToken =
  "pk.eyJ1IjoibGFjYXRyaWxmIiwiYSI6ImNtZG00eGJqZjAxMGYyaXBrcGY3b2tjYzIifQ.gx3C4J17a-6YrUBt6sZTmQ";

const initialLocationView = [-75.5752, 6.2491]; // Coordinates of San Antonio
const stateStr = localStorage.getItem("metroversoMapState");
const state = stateStr ? JSON.parse(stateStr) : null;
let lastSelectedLine = state ? state.selectedLines : null;

const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mapbox/standard", // Style of the map
  config: {
    basemap: {
      theme: "monochrome",
    },
  },
  center: state ? state.mapCenter : initialLocationView,
  zoom: state ? state.mapZoom : 15,
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
      headers: { Accept: "application/json" },
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
      headers: { Accept: "application/json" },
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
      }`;
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
        }).setText(texts.labels.myLocation)
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
  const alertBox = document.getElementById("alerta-validacion");
  const alertMessage = document.getElementById("mensaje-alerta");

  switch (error.code) {
    case error.PERMISSION_DENIED:
      console.warn("Permission denied to access location.");
      break;
    case error.POSITION_UNAVAILABLE:
      showAutoClosingAlert(
        alertBox,
        alertMessage,
        texts.alerts.locationUnavailable
      );
      break;
    case error.TIMEOUT:
      showAutoClosingAlert(
        alertBox,
        alertMessage,
        texts.alerts.locationTimeout
      );
      break;
    default:
      showAutoClosingAlert(alertBox, alertMessage, texts.alerts.locationError);
      break;
  }
}

const setInRoute = (value) => {
  inRoute = value;
  document.getElementById("estimatedTimeBox").style.display = value
    ? "block"
    : "none";
};

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
            texts.alerts.originTooFar
          );
        }
        addRouteToMap(route, "routeToOrigin");

        // --- ESTIMATED TIME: mostrar sin mover ---
        (function () {
          const estimatedTimeBox = document.getElementById("estimatedTimeBox");
          if (!estimatedTimeBox) {
            console.log("[map] no encontrado #estimatedTimeBox");
            return;
          }

          // asegurar que sea visible y fijo
          const cs = window.getComputedStyle(estimatedTimeBox);
          if (cs.position === "static" || !cs.position) {
            estimatedTimeBox.style.position = "fixed";
          }
          estimatedTimeBox.style.zIndex =
            estimatedTimeBox.style.zIndex || "1060";

          // función para actualizar el valor mostrado (acepta segundos)
          function setEstimatedFromSeconds(sec) {
            const estimatedTimeValue =
              document.getElementById("estimatedTimeValue");
            if (estimatedTimeValue) {
              if (typeof sec === "number") {
                const minutes = Math.round(sec / 60);
                estimatedTimeValue.textContent = `${minutes} min`;
              } else {
                estimatedTimeValue.textContent = "-- min";
              }
            }
            estimatedTimeBox.style.display = "block";
          }

          // si estamos dentro de un .then(route) y existe `route`, actualiza con ello;
          // si no, intenta usar window.lastRouteData si está disponible
          if (typeof route !== "undefined" && route && route.duration) {
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
            texts.alerts.destinationTooFar
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
  //setupInputSuggestions();

  // Restore page state if available
  restorePageState();
});

// Function to load and display service hours
function loadServiceHours() {
  fetch("/view/getServiceHours")
    .then((res) => res.json())
    .then((data) => {
      displayServiceHours(data.service_hours);
    })
    .catch((error) => {
      console.error("Error loading service hours:", error);
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
    const isOpen = !!serviceHours.is_operating;
    const statusClass = isOpen ? "text-success" : "text-danger";
    const statusText = isOpen ? texts.words.open : texts.words.closed;

    let html = "";

    if (usesArviStation) {
      const showSchedule = serviceHours.day && serviceHours.open_time && serviceHours.close_time;
      html = `
        <h6 class="mb-2">🕒 ${texts.serviceHours.arviStation}</h6>
        ${showSchedule ? `<p class="mb-1"><strong>${serviceHours.day}:</strong> ${serviceHours.open_time} - ${serviceHours.close_time}</p>` : ""}
        <p class="mb-0 ${statusClass}"><strong>${texts.words.state}:</strong> ${statusText}</p>
      `;
    } else {
      const dayIdx = serviceHours.day;
      const dayLabel =
        (texts.serviceHours.days && texts.serviceHours.days[dayIdx] !== undefined)
          ? texts.serviceHours.days[dayIdx]
          : (serviceHours.day ?? "");
      const schedule =
        (serviceHours.open_time && serviceHours.close_time)
          ? `${serviceHours.open_time} - ${serviceHours.close_time}`
          : "";
      html = `
        <h6 class="mb-2">🕒 ${texts.serviceHours.title}</h6>
        ${dayLabel && schedule ? `<p class="mb-1"><strong>${dayLabel}:</strong> ${schedule}</p>` : ""}
        <p class="mb-0 ${statusClass}"><strong>${texts.words.state}:</strong> ${statusText}</p>
      `;
    }

    infoContainer.innerHTML = html;
  } else {
    infoContainer.innerHTML = "";
  }
}

function displayArviServiceHours(serviceHours) {
  const existingArviContainer = document.getElementById("arviServiceHoursInfo");
  if (existingArviContainer) existingArviContainer.remove();
  if (!serviceHours) return;

  const isOpen = !!serviceHours.is_operating;
  const statusClass = isOpen ? "text-success" : "text-danger";
  const statusText = isOpen ? texts.words.open : texts.words.closed;

  const arviContainer = document.createElement("div");
  arviContainer.id = "arviServiceHoursInfo";
  arviContainer.style.marginTop = "10px";
  arviContainer.style.padding = "10px";
  arviContainer.style.backgroundColor = "#e8f5e8";
  arviContainer.style.borderRadius = "5px";
  arviContainer.style.border = "1px solid #28a745";

  const showSchedule = serviceHours.day && serviceHours.open_time && serviceHours.close_time;

  const html = `
    <h6 class="mb-2">🕒 ${texts.serviceHours.arviStation}</h6>
    ${showSchedule ? `<p class="mb-1"><strong>${serviceHours.day}:</strong> ${serviceHours.open_time} - ${serviceHours.close_time}</p>` : ""}
    <p class="mb-0 ${statusClass}"><strong>${texts.words.state}:</strong> ${statusText}</p>
  `;

  arviContainer.innerHTML = html;

  const normalServiceHoursContainer = document.getElementById("serviceHoursInfo");
  if (normalServiceHoursContainer) {
    normalServiceHoursContainer.parentNode.insertBefore(
      arviContainer,
      normalServiceHoursContainer.nextSibling
    );
  } else {
    document.querySelector(".divRute").appendChild(arviContainer);
  }
}

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

// Function to handle route finding
const routeFindingFunction = (centerOnRoute = true) => {
  // Clear any existing route visualization
  clearRouteVisualization();

  // Clear any existing Arvi service hours display
  const existingArviContainer = document.getElementById("arviServiceHoursInfo");
  if (existingArviContainer) {
    existingArviContainer.remove();
  }

  selectStart = getSelectedFrom('selectStart'); 
  selectDestination = getSelectedFrom('selectDestination'); 

  const inputStart = selectStart.id;
  const inputDestination = selectDestination.id;
  const inputCriteria = document.getElementById("inputCriteria").value;
  const nameStart = selectStart.label;
  const nameDestination = selectDestination.label;

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

  const { startPoint, endPoint, startId, endId, startName, endName } =
    validationResult;

  // Hide alert if all is valid
  alertBox.style.display = "none";

  console.log(
    `Inicio: ${startName} (${startId}), Destino: ${endName} (${endId})`
  );

  setInRoute(true); // Set route mode

  fetch(`/view/callRute?inputStart=${startId}&inputDestination=${endId}` 
  + `&inputCriteria=${encodeURIComponent(inputCriteria)}`+ `&nameStart=${encodeURIComponent(nameStart)}`+ `&nameDestination=${encodeURIComponent(nameDestination)}`)
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
      document
        .getElementById("btnStartJourney")
        .addEventListener("click", function () {
          const data = window.lastRouteData;
          if (!data) return;

          if (
            data.can_make_trip === false ||
            String(data.can_make_trip).toLowerCase() === "false"
          ) {
            const alertBox = document.getElementById("alerta-validacion");
            const alertMessage = document.getElementById("mensaje-alerta");
            let alertMessageText = texts.alerts.tripNotPossible;
            if (data.uses_arvi_station) {
              alertMessageText = texts.alerts.arviTripNotPossible;
            }
            showAutoClosingAlert(alertBox, alertMessage, alertMessageText);
            return;
          }
          // Si puede realizar el viaje, no mostrar nada

          // Mostrar el tiempo estimado en el contenedor
          const estimatedTimeBox = document.getElementById("estimatedTimeBox");
          const estimatedTimeValue =
            document.getElementById("estimatedTimeValue");
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
      showAutoClosingAlert(
        alertBox,
        alertMessage,
        texts.alerts.routeError
      );
    });

  // Adjust map view to include both points
  if (centerOnRoute) {
    const bounds = new mapboxgl.LngLatBounds();
    bounds.extend(startPoint.geometry.coordinates);
    bounds.extend(endPoint.geometry.coordinates);
    map.fitBounds(bounds, { padding: 40 });
  }
};

// Call the route finding function when the button is clicked
document
  .getElementById("btnSearchRute")
  .addEventListener("click", routeFindingFunction);

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

  let html = `<h6>${texts.routeInformation.title}</h6>`;
  html +=
    `<p class="route-chain"><strong>${texts.routeInformation.fullRoute}:</strong> ` +
    window.renderRouteChain(route, transferInfo) +
    "</p>";

  if (transferInfo.requires_transfer) {
    const transferCount = transferInfo.transfer_count;
    const transferText = transferCount > 1
      ? texts.routeInformation.transferTextPlural
      : texts.routeInformation.transferTextSingular;
    const transfersRequiredText = transferText.replace('{n}', transferCount);

    html += `<p><strong>${transfersRequiredText}</strong></p>`;
    html += `<p><strong>${texts.routeInformation.transferStationsTitle}:</strong></p>`;
    html += `<ul>`;
    transferInfo.transfer_stations.forEach((station) => {
      const stationName = window.getStationName(station);
      // Traducción para "Transferencia en: ..."
      html += `<li>${texts.routeInformation.transferAt.replace('{station}', `<strong>${stationName}</strong>`)}</li>`;
    });
    html += `</ul>`;
  } else {
    // Traducción para "No se requieren transferencias"
    html += `<p><strong>${texts.routeInformation.noTransfersRequired}</strong></p>`;
    // Traducción para "Viaje directo en la línea ..."
    html += `<p>${texts.routeInformation.directTrip.replace('{line}', transferInfo.line_segments[0]?.line)}</p>`;
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

      // Traducción para la instrucción de transbordo
      transferHints.push(
        texts.routeInformation.transferHint
          .replace('{station}', `<strong>${transferStationName}</strong>`)
          .replace('{line}', `<strong>${newLine}</strong>`)
          .replace('{nextStation}', `<strong>${nextStationName}</strong>`)
      );
    }

    html += `
      <hr class="my-2">
      <h6 class="mb-2 text-success fw-bold">${texts.routeInformation.transferFollowTitle}</h6>
      <div class="small">
      ${transferHints.map((h) => `<div>• ${h}</div>`).join("")}
      </div>
    `;
  }
  infoContainer.innerHTML = html;
}



// Function to clear existing route visualization
function getLine(lineValue) {
  if (!linesStations || linesStations.type !== "FeatureCollection") {
    console.error("linesStations no está cargado todavía");
    return { type: "FeatureCollection", features: [] };
  }
  const features = linesStations.features.filter(
    (f) => f?.properties?.["linea"] === lineValue
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
    (f) => f?.properties?.["linea"] === lineValue
  );
  return { type: "FeatureCollection", features };
}

// Función para encontrar el índice de coordenadas en una línea
function findCoordIndex(lineFC, target, eps = 1e-9) {
  console.log(
    "Buscando coordenada",
    target,
    "en línea con",
    lineFC.features,
    "features"
  );
  const almostEq = (a, b) => Math.abs(a - b) < eps;
  const isSameCoord = (c) =>
    almostEq(c[0], target[0]) && almostEq(c[1], target[1]);

  for (const f of lineFC.features) {
    const coords = f.geometry.coordinates;
    const idx = coords.findIndex(isSameCoord);
    if (idx !== -1) return idx;
  }
  return -1;
}

// Route visualization functions
function paintLineSegment(
  lineInput,
  startIndex,
  endIndex,
  sourceId = "sub-line",
  layerId = "sub-line-layer",
  rute,
  rute_coords
) {
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
    console.error(
      "[paintLineSegment] lineInput no es Feature ni FeatureCollection:",
      lineInput
    );
    return;
  }

  // Validar que sea LineString y que existan coords
  const geom = feature.geometry;
  if (!geom || geom.type !== "LineString" || !Array.isArray(geom.coordinates)) {
    console.error(
      "[paintLineSegment] geometry inválida o no LineString:",
      geom
    );
    return;
  }

  const coords = geom.coordinates;
  if (!Number.isInteger(startIndex) || !Number.isInteger(endIndex)) {
    console.error(
      "[paintLineSegment] índices no son enteros:",
      startIndex,
      endIndex
    );
    return;
  }

  // Normalizar y acotar índices
  const iMin = Math.max(0, Math.min(startIndex, endIndex));
  const iMax = Math.min(coords.length - 1, Math.max(startIndex, endIndex));

  if (iMin === iMax) {
    console.warn(
      "[paintLineSegment] tramo de un solo punto, necesita al menos 2:",
      iMin,
      iMax
    );
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
    properties: { ...(feature.properties || {}), _slice: [iMin, iMax] },
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
      paint: { "line-color": "#FF0000", "line-width": 4 },
    });
  }
}

function showLines(selectedLines) {
  setInRoute(false); // Set inRoute to false
  if (map.getSource("lineasCompletas")) {
    map.getSource("lineasCompletas").setData(selectedLines);
    return;
  }
  map.addSource("lineasCompletas", {
    type: "geojson",
    data: selectedLines,
  });
  map.addLayer({
    id: "lineas-layer",
    type: "line",
    source: "lineasCompletas",
    layout: {
      "line-join": "round",
      "line-cap": "round",
    },
    paint: {
      "line-color": [

        "match",
        ["get", "linea"],
        "A",
        "#005d9a",
        "B",
        "#e88530",
        "O",
        "#e3807b",
        "Z",
        "#e0007a",
        "2",
        "#66a7ab",
        "1",
        "#017077",
        "K",
        "#bacc44",
        "P",
        "#e10521",
        "L",
        "#8b622a",
        "J",
        "#f5c439",
        "H",
        "#6a206b",
        "T",
        "#008f37",
        /* default */
        "#000000",
      ],
      "line-width": 3,
    },
  });
}

document.getElementById("btnShowLines").addEventListener("click", () => {
  clearRouteVisualization();
  const line = document.getElementById("lineSelection").value;
  lastSelectedLine = line;
  if (line != "ALL") {
    const selectedLines = getLineComplete(line);
    showLines(selectedLines);
  } else {
    showLines(linesComplete);
  }
});

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

    // ===== Caso normal: misma línea =====
    const lineFC = getLine(fromLineVal);
    const startIdx = findCoordIndex(lineFC, fromCoord);
    const endIdx = findCoordIndex(lineFC, toCoord);

    console.log("________________")
    console.log(fromId, toId, lineFC, startIdx, endIdx);

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
    console.warn(
      `[addNodesRouteToMap] No se hallaron índices en la línea ${fromLineVal} para tramo ${fromId}→${toId}`
    );
  }
}

// Color mapping for metro lines
const COLOR_BY_LINE = {
  A: "#005d9a",
  B: "#e88530",
  O: "#e3807b",
  Z: "#e0007a",
  X: "#66a7ab",
  M: "#017077",
  K: "#bacc44",
  P: "#e10521",
  L: "#8b622a",
  J: "#f5c439",
  H: "#6a206b",
  T: "#008f37",
};

function clearRouteVisualization() {
  // Remove all route-related sources and layers
  const sourcesToRemove = [];
  const layersToRemove = [];

  map.getStyle().sources &&
    Object.keys(map.getStyle().sources).forEach((sourceId) => {
      if (
        sourceId.startsWith("route-segment-") ||
        sourceId.startsWith("sub-line") ||
        sourceId.startsWith("lineasCompletas")
      ) {
        sourcesToRemove.push(sourceId);
      }
    });

  map.getStyle().layers &&
    map.getStyle().layers.forEach((layer) => {
      if (
        layer.id.startsWith("route-segment-layer-") ||
        layer.id.startsWith("sub-line-layer") ||
        layer.id.startsWith("lineas-layer")
      ) {
        layersToRemove.push(layer.id);
      }
    });

  layersToRemove.forEach((layerId) => {
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }
  });

  sourcesToRemove.forEach((sourceId) => {
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
// function setupInputSuggestions() {
//   const startInput = document.getElementById("inputStart");
//   const destInput = document.getElementById("inputDestination");

//   if (startInput) {
//     startInput.addEventListener("input", function () {
//       showInputSuggestions(this, "startSuggestions");
//     });

//     startInput.addEventListener("focus", function () {
//       showInputSuggestions(this, "startSuggestions");
//     });
//   }

//   if (destInput) {
//     destInput.addEventListener("input", function () {
//       showInputSuggestions(this, "destSuggestions");
//     });

//     destInput.addEventListener("focus", function () {
//       showInputSuggestions(this, "destSuggestions");
//     });
//   }
// }

// Función para mostrar sugerencias de input
// function showInputSuggestions(inputElement, containerId) {
//   const value = inputElement.value.trim();

//   // Remover contenedor de sugerencias existente
//   let existingContainer = document.getElementById(containerId);
//   if (existingContainer) {
//     existingContainer.remove();
//   }

//   if (value.length < 2) return;

//   const suggestions = getStationSuggestions(value);
//   if (suggestions.length === 0) return;

//   // Crear contenedor de sugerencias
//   const container = document.createElement("div");
//   container.id = containerId;
//   container.className = "suggestions-container";
//   container.style.cssText = `
//         position: absolute;
//         background: white;
//         border: 1px solid #ddd;
//         border-radius: 4px;
//         max-height: 200px;
//         overflow-y: auto;
//         z-index: 1000;
//         width: ${inputElement.offsetWidth}px;
//         box-shadow: 0 2px 8px rgba(0,0,0,0.1);
//     `;

//   // Añadir sugerencias
//   suggestions.forEach((suggestion) => {
//     const item = document.createElement("div");
//     item.className = "suggestion-item";
//     item.style.cssText = `
//             padding: 8px 12px;
//             cursor: pointer;
//             border-bottom: 1px solid #eee;
//             font-size: 14px;
//         `;
//     // Extract line from station ID (first character)
//     const line = suggestion.id.charAt(0);
//     item.innerHTML = `
//             <strong>${suggestion.name}</strong> 
//             <span class="station-id">Línea ${line}</span>
//         `;

//     item.addEventListener("click", function () {
//       inputElement.value = suggestion.name;
//       container.remove();
//     });

//     item.addEventListener("mouseenter", function () {
//       this.style.backgroundColor = "#f8f9fa";
//     });

//     item.addEventListener("mouseleave", function () {
//       this.style.backgroundColor = "white";
//     });

//     container.appendChild(item);
//   });

//   // Posicionar contenedor
//   const rect = inputElement.getBoundingClientRect();
//   container.style.top = `${rect.bottom + window.scrollY}px`;
//   container.style.left = `${rect.left + window.scrollX}px`;

//   // Añadir al DOM
//   document.body.appendChild(container);

//   // Cerrar sugerencias al hacer clic fuera
//   document.addEventListener("click", function closeSuggestions(e) {
//     if (!container.contains(e.target) && e.target !== inputElement) {
//       container.remove();
//       document.removeEventListener("click", closeSuggestions);
//     }
//   });
// }

function savePageState() {
  const state = {
    mapCenter: map.getCenter(),
    mapZoom: map.getZoom(),
    routeStarted: inRoute,
    selectedLines: lastSelectedLine,
    inputStart: document.getElementById("inputStart").value,
    inputDestination: document.getElementById("inputDestination").value,
    markerOrigin: markerOrigin ? markerOrigin.getLngLat() : null,
    markerDestiny: markerDestiny ? markerDestiny.getLngLat() : null,
    userLocation: userLocation,
  };
  localStorage.setItem("metroversoMapState", JSON.stringify(state));
}

// Restores the state from localStorage
async function restorePageState() {
  const stateStr = localStorage.getItem("metroversoMapState");
  if (!stateStr) return;
  const state = JSON.parse(stateStr);

  if (state.inputStart)
    document.getElementById("inputStart").value = state.inputStart;

  if (state.inputDestination)
    document.getElementById("inputDestination").value = state.inputDestination;

  if (state.routeStarted) routeFindingFunction(false);
  else if (state.selectedLines) {
    if (!window.linesComplete) await loadLinesComplete();
    if (state.selectedLines != "ALL")
      showLines(getLineComplete(state.selectedLines));
    else showLines(window.linesComplete);
  }

  if (state.selectedLines) {
    document.getElementById("lineSelection").value = state.selectedLines;
  }

  if (state.markerOrigin)
    pickStartingPoint([state.markerOrigin.lng, state.markerOrigin.lat]);

  if (state.markerDestiny)
    pickDestinationPoint([state.markerDestiny.lng, state.markerDestiny.lat]);

  localStorage.removeItem("metroversoMapState");
}

// Function to change language and submit the form
function changeLanguage(lang) {
  savePageState();
  document.getElementById("language-input").value = lang;
  document.getElementById("language-form").submit();
}

document.addEventListener('DOMContentLoaded', () => {
  // --- Config ---
  const TOMTOM_KEY = "ZSQTyReLpzsNCFXnCzRGkepsbsZr5hWq";
  const CENTER = { lat: 6.2491, lng: -75.5752 }; // Medellín

  function searchRightCoords(lon, lat) {
    const key = JSON.stringify([lon, lat]);
    const coord = (typeof coordenadas === 'object') ? coordenadas[key] : null;
    return coord ? [coord[0], coord[1]] : [lon, lat];
  }

  function getNearestStationId(lon, lat, featureCollection) {
    const target = turf.point([lon, lat]);
    const nearest = turf.nearestPoint(target, featureCollection);
    return nearest?.properties?.ID ?? null;
  }

  // Guarda el resultado en el select indicado (value=ID, text=label, data-lon/lat)
  function saveToSelect(selectId, { id, label, lon, lat }) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    sel.innerHTML = '';
    const opt = document.createElement('option');
    opt.value = id ?? '';
    opt.textContent = label || '(sin nombre)';
    opt.dataset.lon = String(lon);
    opt.dataset.lat = String(lat);
    sel.appendChild(opt);
    sel.selectedIndex = 0;
  }

  // Para leer luego lo guardado en un select
  window.getSelectedFrom = function(selectId) {
    const sel = document.getElementById(selectId);
    if (!sel || !sel.options.length) return null;
    const opt = sel.options[sel.selectedIndex];
    return {
      id: opt.value,
      label: opt.textContent,
      lon: Number(opt.dataset.lon),
      lat: Number(opt.dataset.lat),
    };
  };

  async function runTypeahead(query) {
    const url = new URL(`https://api.tomtom.com/search/2/search/${encodeURIComponent(query)}.json`);
    url.search = new URLSearchParams({
      key: TOMTOM_KEY,
      typeahead: 'true',
      lat: String(CENTER.lat),
      lon: String(CENTER.lng),
      countrySet: 'CO',
      limit: '8'
    });
    const r = await fetch(url);
    const data = await r.json();
    return (data.results || []).filter(x => x.position);
  }

  function drawSuggestions(items, sugsEl, onPick, qEl) {
    sugsEl.innerHTML = '';
    if (!items.length) { sugsEl.style.display = 'none'; return; }

    for (const it of items) {
      const label = it.poi?.name || it.address?.freeformAddress || it.matchingName || '(sin nombre)';
      const { lat, lon } = it.position; // TomTom entrega {lat, lon}

      const li = document.createElement('li');
      li.className = 'list-group-item list-group-item-action';
      li.textContent = label;
      li.title = label;
      li.style.cursor = 'pointer';
      li.addEventListener('click', () => {
        const [lonR, latR] = searchRightCoords(lon, lat);
        const id = getNearestStationId(lonR, latR, featureCollection);

        onPick({ id, label, lon: lonR, lat: latR });
        qEl.value = label;

        sugsEl.style.display = 'none';
        sugsEl.innerHTML = '';
      });

      sugsEl.appendChild(li);
    }
    sugsEl.style.display = 'block';
  }

  // Ahora acepta un hook onChoose para ejecutar lógica extra tras elegir
  function setupTypeahead({ inputId, sugsId, selectId, onChoose }) {
    const qEl = document.getElementById(inputId);
    const sugsEl = document.getElementById(sugsId);
    if (!qEl || !sugsEl) return;

    let debounce;
    qEl.addEventListener('input', () => {
      clearTimeout(debounce);
      const v = qEl.value.trim();
      sugsEl.style.display = 'none';
      sugsEl.innerHTML = '';
      if (v.length < 3) return;
      debounce = setTimeout(async () => {
        try {
          const items = await runTypeahead(v);
          drawSuggestions(
            items,
            sugsEl,
            ({ id, label, lon, lat }) => {
              // 1) Guardar en el select
              saveToSelect(selectId, { id, label, lon, lat });
              // 2) Ejecutar callback para tu mapa/ruta
              if (typeof onChoose === 'function') {
                try { onChoose({ lon, lat, id, label }); }
                catch (e) { console.warn('onChoose error:', e); }
              }
            },
            qEl
          );
        } catch (e) {
          console.warn('Typeahead error:', e);
        }
      }, 220);
    });

    // ENTER: si hay 1 sugerencia visible → selección rápida
    qEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && sugsEl.children.length === 1) {
        e.preventDefault();
        sugsEl.children[0].click();
      }
    });

    // Cerrar sugerencias al click fuera
    document.addEventListener('click', (e) => {
      if (!qEl.contains(e.target) && !sugsEl.contains(e.target)) {
        sugsEl.style.display = 'none';
        sugsEl.innerHTML = '';
      }
    });
  }

  // =========================
  // Inicializa ambos campos con su respectivo callback
  // =========================
  setupTypeahead({
    inputId: 'inputStart',
    sugsId: 'sugsStart',
    selectId: 'selectStart',
    onChoose: ({ lon, lat }) => {
      // Llama tu función de inicio con [lon, lat]
      if (typeof pickStartingPoint === 'function') {
        pickStartingPoint([lon, lat]);
      } else {
        console.warn('pickStartingPoint no está definida');
      }
    }
  });

  setupTypeahead({
    inputId: 'inputDestination',
    sugsId: 'sugsDestination',
    selectId: 'selectDestination',
    onChoose: ({ lon, lat }) => {
      // Llama tu función de destino con [lon, lat]
      if (typeof pickDestinationPoint === 'function') {
        pickDestinationPoint([lon, lat]); // lng === lon
      } else {
        console.warn('pickDestinationPoint no está definida');
      }
    }
  });
});
