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

// ==================== TRAVEL STORAGE SYSTEM ====================

// Variables to track journey state
let journeyStartTime = null;
let journeyStartStation = null;
let journeyEndStation = null;
let journeyCriterion = 'tiempo';
let lastRouteCompletedState = false; // To detect changes

// Load the GeoJSON and store it globally
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

  setClosestStationsBoxVisible(true);

  if (shouldUpdateStations) {
    closestStationsToUser = closestPoints(turf.point(userLocation), 2000);
    closestStations(turf.point(userLocation), 2000);
    lastUserLocation = [...userLocation];

    // Update the button text with the station name/id
    const btn1 = document.getElementById("btnClosestStation1");
    const btn2 = document.getElementById("btnClosestStation2");
    const btn3 = document.getElementById("btnClosestStation3");
    btn1.innerHTML = `<i class="bi bi-geo-alt"></i> ${closestStationsToUser[0]?.properties.name || ""
      }`;
    btn2.innerHTML = `<i class="bi bi-geo-alt"></i> ${closestStationsToUser[1]?.properties.name || ""
      }`;
    btn3.innerHTML = `<i class="bi bi-geo-alt"></i> ${closestStationsToUser[2]?.properties.name || ""
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
  // Hide closest stations box while in route mode to avoid UI conflicts
  try {
    setClosestStationsBoxVisible(!value);
  } catch (e) {
    console.warn('[setInRoute] could not toggle closestStationsBox:', e.message);
  }
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

          // asegurar que sea visible; dejar la posicionamiento a CSS (.estimated-info-container)
          const cs = window.getComputedStyle(estimatedTimeBox);
          // No forzamos 'fixed' aquí porque el contenedor `.estimated-info-container`
          // maneja el anclaje en la esquina superior derecha. Si el estilo computado
          // es 'static' el CSS debería actualizarse en lugar de forzar inline styles.
          estimatedTimeBox.style.zIndex = estimatedTimeBox.style.zIndex || "1060";

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

  // get user profile
  const profileSelectionEl = document.getElementById('profileSelection');
  const profileSelection = profileSelectionEl ? profileSelectionEl.value : 'Frecuente';

  fetch(`/view/callRute?inputStart=${startId}&inputDestination=${endId}` + `&inputCriteria=${encodeURIComponent(inputCriteria)}`
  + `&nameStart=${encodeURIComponent(nameStart)}` + `&nameDestination=${encodeURIComponent(nameDestination)}` + `&profileSelection=${encodeURIComponent(profileSelection)}`)
    .then((res) => res.json())
    .then((data) => {
      console.log("Ruta:", data.rute);
      console.log("Distancia:", data.distance);
      console.log("Precio:", data.price);
      console.log("Información de transferencias:", data.transfer_info);
      console.log("Coordenadas de transferencias:", data.transfer_coords);
      initializeTransferPoints(data.transfer_coords)

      // Show the 'Start Journey' button only if a route is found
      const btnStartJourney = document.getElementById("btnStartJourney");
      btnStartJourney.style.display = "block";

      // Store the last route data globally for access in other functions
      window.lastRouteData = data;

      // Ocultar cualquier alerta previa
      const alertBox = document.getElementById("alerta-validacion");
      alertBox.style.display = "none";

      // Update estimated time display in its own box
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
      // Update price display in its own box
      const estimatedPriceValue = document.getElementById("estimatedPriceValue");
      const estimatedPriceBox = document.getElementById("estimatedPriceBox");
      const estimatedTimeBoxEl = document.getElementById("estimatedTimeBox");
      // Ensure time box is visible
      if (estimatedTimeBoxEl) estimatedTimeBoxEl.style.display = "block";
      if (estimatedPriceValue && estimatedPriceBox) {
        if (data.price !== undefined && data.price !== null) {
          const priceNum = Number(data.price) || 0;
          estimatedPriceValue.textContent = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(priceNum);
          estimatedPriceBox.classList.add('show-price');
          estimatedPriceBox.style.display = 'block';
        } else {
          estimatedPriceValue.textContent = "--";
          estimatedPriceBox.classList.remove('show-price');
          estimatedPriceBox.style.display = 'none';
        }
      }
      // Set up event listener for 'Start Journey' button
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

          // If can make the trip, do not show anything
          if(!initializeJourney()){
            alert("Error initializing journey.");
            return;
          }

          onStartRouteButtonClick();

          // Show estimated time box
          const estimatedTimeBox = document.getElementById("estimatedTimeBox");
          const estimatedTimeValue =
            document.getElementById("estimatedTimeValue");
          if (data.duration) {
            // Round minutes
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
  setInRoute(false);

  const bbox = (window.turf && window.turf.bbox) || null;
  const center = (window.turf && window.turf.center) || null;

  const sourceId = "lineasCompletas";
  const layerId  = "lineas-layer";

  // 1) Crear/actualizar source + layer
  if (map.getSource(sourceId)) {
    map.getSource(sourceId).setData(selectedLines);
  } else {
    map.addSource(sourceId, { type: "geojson", data: selectedLines });
    map.addLayer({
      id: layerId,
      type: "line",
      source: sourceId,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": [
          "match", ["get", "linea"],
          "A", "#005d9a",
          "B", "#e88530",
          "O", "#e3807b",
          "Z", "#e0007a",
          "2", "#66a7ab",
          "1", "#017077",
          "K", "#bacc44",
          "P", "#e10521",
          "L", "#8b622a",
          "J", "#f5c439",
          "H", "#6a206b",
          "T", "#008f37",
          /* default */ "#000000",
        ],
        "line-width": 3,
      },
    });
  }

  // 2) Ajustar la vista al contenido (zoom out)
  try {
    if (!bbox) throw new Error("turf.bbox no disponible");
    const [minX, minY, maxX, maxY] = bbox(selectedLines);

    // Si hay un rectángulo válido, ajusta bounds
    if (
      Number.isFinite(minX) && Number.isFinite(minY) &&
      Number.isFinite(maxX) && Number.isFinite(maxY) &&
      (minX !== maxX || minY !== maxY)
    ) {
      map.fitBounds([[minX, minY], [maxX, maxY]], {
        padding: 80,              // o {top:40,right:40,bottom:40,left:300} si tienes sidebar
        duration: 800,
        maxZoom: 14               // evita acercarte demasiado
      });
    } else if (center) {
      // Fallback: si es un punto o bbox degenerado
      const c = center(selectedLines).geometry.coordinates;
      map.flyTo({ center: c, zoom: 12, duration: 600 });
    }
  } catch (e) {
    console.warn("No pude ajustar bounds:", e);
  }
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
      // ✅ DETECTAR DIRECCIÓN
      const direction = startIdx <= endIdx ? "forward" : "reverse";

      paintLineSegment(lineFC, startIdx, endIdx, sourceId, layerId);

      const color = COLOR_BY_LINE?.[fromLineVal] || "#FF0000";
      if (map.getLayer(layerId)) {
        map.setPaintProperty(layerId, "line-color", color);
        map.setPaintProperty(layerId, "line-width", 4);
      }

      // ✅ PASAR DIRECCIÓN AL REGISTRO
      registerPaintedSegment(sourceId, layerId, startIdx, endIdx, fromLineVal, direction);
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

  clearPaintedSegments();
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

// document
//   .getElementById("btnUserLocationOrigin")
//   .addEventListener("click", () => {
//     selecting = 1;
//     map.getCanvas().classList.add("crosshair");
//     console.log("🟢 Modo selección activado (Origen): haz clic en el mapa");
//   });

// document
//   .getElementById("btnUserLocationDestiny")
//   .addEventListener("click", () => {
//     selecting = 2;
//     map.getCanvas().classList.add("crosshair");
//     console.log("🟢 Modo selección activado (Destino): haz clic en el mapa");
//   });

const pickStartingPoint = (originPoint, heading = 0) => {
  closestStationsToOrigin = closestPoints(turf.point(originPoint), 4000);

  if (markerOrigin) {
    markerOrigin
      .setLngLat(originPoint)
      .setRotation?.(heading);
  } else {

    markerOrigin = NavMarker({
      fill: "#3b82f6",                 // azul del triángulo
      stroke: "#ffffff",               // borde blanco
      halo: "rgba(59,130,246,.18)",    // halo azul claro
      size: 36,
      heading
    })
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
// map.on("click", (e) => {
//   if (selecting === 0) return; // not selecting
//   selecting === 1
//     ? pickStartingPoint([e.lngLat.lng, e.lngLat.lat])
//     : pickDestinationPoint([e.lngLat.lng, e.lngLat.lat]);
//   selecting = 0;
//   map.getCanvas().classList.remove("crosshair");
// });

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
    profileSelection: (document.getElementById('profileSelection') ? document.getElementById('profileSelection').value : null),
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

  if (state.profileSelection && document.getElementById('profileSelection'))
    document.getElementById('profileSelection').value = state.profileSelection;

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

// Setup typeahead (autocomplete) for start and destination inputs
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
    opt.textContent = label || texts.words.noName;
    opt.dataset.lon = String(lon);
    opt.dataset.lat = String(lat);
    sel.appendChild(opt);
    sel.selectedIndex = 0;
  }

  // Para leer luego lo guardado en un select
  window.getSelectedFrom = function (selectId) {
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
      const label = it.poi?.name || it.address?.freeformAddress || it.matchingName || texts.words.noName;
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


function createNavMarkerEl({
  halo = "rgba(0,128,255,.18)",
  fill = "#06b6d4",         // cian
  stroke = "#ffffff",       // borde blanco
  size = 36
} = {}) {
  const root = document.createElement("div");
  root.className = "nav-marker";
  root.style.width = root.style.height = size + "px";

  const haloEl = document.createElement("div");
  haloEl.className = "nav-marker__halo";
  haloEl.style.background = halo;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.classList.add("nav-marker__icon");

  const tri = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  tri.setAttribute("points", "12,3 21,19 3,19"); // triángulo apuntando hacia arriba
  tri.setAttribute("fill", fill);
  tri.setAttribute("stroke", stroke);
  tri.setAttribute("stroke-width", "2");
  tri.setAttribute("stroke-linejoin", "round");
  svg.appendChild(tri);

  root.appendChild(haloEl);
  root.appendChild(svg);
  return root;
}

// Wrapper: similar a new mapboxgl.Marker({ color: "red" })
// pero con opciones del icono y heading (rotación)
function NavMarker({
  halo, fill, stroke, size = 36,
  heading = 0,                // grados (0 = norte)
  anchor = "center",
  offset = [0, 0]
} = {}) {
  const el = createNavMarkerEl({ halo, fill, stroke, size });
  const marker = new mapboxgl.Marker({ element: el, anchor, offset })
    .setRotation(heading)                // rotación del triángulo/marcador
    .setRotationAlignment("map");        // gira con el rumbo del mapa
  return marker;
}

// Funcione macro para despintar

// Registro de segmentos pintados
let paintedSegments = [];
let routeCompleted = false;

function registerPaintedSegment(sourceId, layerId, startIndex, endIndex, lineId, direction) {
  paintedSegments.push({
    sourceId: sourceId,
    layerId: layerId,
    startIndex: startIndex,
    endIndex: endIndex,
    lineId: lineId,
    direction: direction,  // ← NUEVO
    isActive: true
  });

  console.log(`✓ Segmento registrado: ${sourceId} (línea ${lineId}) [${direction}]`, paintedSegments.length, 'segmentos totales');
}

// Obtiene las coordenadas de un segmento desde el source de Mapbox

function getSegmentCoordinates(segment) {
  const source = map.getSource(segment.sourceId);
  if (!source) {
    console.warn(`Source ${segment.sourceId} no encontrado`);
    return null;
  }

  const data = source._data;
  if (!data || !data.geometry || !data.geometry.coordinates) {
    console.warn(`Datos inválidos en source ${segment.sourceId}`);
    return null;
  }

  return data.geometry.coordinates;
}

function clearPaintedSegments() {
  paintedSegments = [];
  console.log('✓ Registro de segmentos limpiado');
}

function getDistanceInMeters(coord1, coord2) {
  const R = 6371e3; // Radio de la Tierra en metros
  const lat1 = coord1[1] * Math.PI / 180;
  const lat2 = coord2[1] * Math.PI / 180;
  const deltaLat = (coord2[1] - coord1[1]) * Math.PI / 180;
  const deltaLng = (coord2[0] - coord1[0]) * Math.PI / 180;

  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Encuentra el punto más cercano proyectado sobre los segmentos de la línea
 * @param {Array} userCoord - [lng, lat] del usuario
 * @param {Array} segmentCoords - Array de coordenadas del segmento
 * @returns {Object|null} { index, distance, coordinate, interpolationFactor }
 */
function findClosestPointInSegment(userCoord, segmentCoords) {
  if (!segmentCoords || segmentCoords.length < 2) {
    return null;
  }

  let closestIndex = 0;
  let minDistance = Infinity;
  let closestCoord = segmentCoords[0];
  let interpolationFactor = 0; // 0-1, posición dentro del segmento [index, index+1]

  // Iterar sobre cada segmento de línea (par de puntos consecutivos)
  for (let i = 0; i < segmentCoords.length - 1; i++) {
    const segmentStart = segmentCoords[i];
    const segmentEnd = segmentCoords[i + 1];

    const projection = projectPointOnSegment(userCoord, segmentStart, segmentEnd);

    if (projection.distance < minDistance) {
      minDistance = projection.distance;
      closestIndex = i;
      closestCoord = projection.coordinate;
      interpolationFactor = projection.t;
    }
  }

  // También verificar el último punto (por si acaso)
  const lastPoint = segmentCoords[segmentCoords.length - 1];
  const lastDistance = getDistanceInMeters(userCoord, lastPoint);
  if (lastDistance < minDistance) {
    minDistance = lastDistance;
    closestIndex = segmentCoords.length - 1;
    closestCoord = lastPoint;
    interpolationFactor = 0;
  }

  return {
    index: closestIndex,
    distance: minDistance,
    coordinate: closestCoord,
    interpolationFactor: interpolationFactor  // NUEVO: para saber posición exacta
  };
}

function findUserPositionInRoute(userCoord) {
  let bestMatch = null;
  let minDistance = Infinity;

  for (let i = 0; i < paintedSegments.length; i++) {
    const segment = paintedSegments[i];

    if (!segment.isActive) continue;

    // Verificar que el source existe antes de intentar leer
    if (!map.getSource(segment.sourceId)) {
      console.warn(`⚠️ Source ${segment.sourceId} no existe, marcando como inactivo`);
      segment.isActive = false;
      continue;
    }

    const coords = getSegmentCoordinates(segment);
    if (!coords) continue;

    const closestPoint = findClosestPointInSegment(userCoord, coords);

    if (closestPoint && closestPoint.distance < minDistance) {
      minDistance = closestPoint.distance;
      bestMatch = {
        segmentIndex: i,
        closestPoint: closestPoint,
        segment: segment
      };
    }
  }

  if (bestMatch) {
    console.log(`✓ Usuario en segmento ${bestMatch.segmentIndex}, distancia: ${bestMatch.closestPoint.distance.toFixed(2)}m`);
  }

  return bestMatch;
}

// Variable global para el marcador de seguimiento
let userFollowMarker = null;
let navigationMode = false;
let routeActive = false;
let recenterButton = null;

/**
 * Calcula el ángulo/rumbo entre dos coordenadas
 * @param {Array} coord1 - [lng, lat] punto inicial
 * @param {Array} coord2 - [lng, lat] punto final
 * @returns {number} Ángulo en grados (0° = Norte, 90° = Este, etc.)
 */
function calculateBearing(coord1, coord2) {
  const lon1 = coord1[0] * Math.PI / 180;
  const lon2 = coord2[0] * Math.PI / 180;
  const lat1 = coord1[1] * Math.PI / 180;
  const lat2 = coord2[1] * Math.PI / 180;

  const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);

  const bearing = Math.atan2(y, x) * 180 / Math.PI;

  return (bearing + 360) % 360;
}

/**
 * Calcula el heading hacia donde debe apuntar el marcador
 * @param {Object} position - Objeto retornado por findUserPositionInRoute
 * @returns {number|null} Heading en grados o null si no se puede calcular
 */
function calculateMarkerHeading(position) {
  const coords = getSegmentCoordinates(position.segment);
  if (!coords) return null;

  const currentIndex = position.closestPoint.index;

  // Si no hay punto siguiente en este segmento, buscar en el siguiente segmento
  if (currentIndex >= coords.length - 1) {
    // Buscar el siguiente segmento activo
    const nextSegment = paintedSegments.find((seg, idx) =>
      idx > position.segmentIndex && seg.isActive
    );

    if (nextSegment) {
      const nextCoords = getSegmentCoordinates(nextSegment);
      if (nextCoords && nextCoords.length > 0) {
        return calculateBearing(coords[currentIndex], nextCoords[0]);
      }
    }

    // Si no hay siguiente segmento, usar el último tramo de este segmento
    if (coords.length >= 2) {
      return calculateBearing(coords[coords.length - 2], coords[coords.length - 1]);
    }

    return null;
  }

  // Calcular heading hacia el siguiente punto en el mismo segmento
  return calculateBearing(coords[currentIndex], coords[currentIndex + 1]);
}

/**
 * Actualiza o crea el marcador de seguimiento del usuario
 * @param {Array} coordinate - [lng, lat] donde posicionar el marcador
 * @param {number} heading - Ángulo en grados hacia donde debe apuntar
 */
function updateUserFollowMarker(coordinate, heading = 0) {
  if (!userFollowMarker) {
    // Crear el marcador por primera vez SIN rotación
    userFollowMarker = NavMarker({
      fill: "#06b6d4",
      stroke: "#ffffff",
      halo: "rgba(0,128,255,.18)",
      size: 36,
      heading: 0  // Siempre 0, sin rotación
    });
    userFollowMarker.setLngLat(coordinate).addTo(map);
    console.log('✓ Marcador de seguimiento creado (sin rotación)');
  } else {
    // Actualizar posición pero NO rotación
    userFollowMarker.setLngLat(coordinate);
    // userFollowMarker.setRotation(heading); // COMENTADO
    console.log('✓ Marcador actualizado (sin rotación)');
  }
}

function unpaintCompletedSegments(upToSegmentIndex, upToPointIndex, interpolationFactor = 0) {
  let segmentsRemoved = 0;

  // Eliminar todos los segmentos anteriores completamente
  for (let i = 0; i < upToSegmentIndex; i++) {
    const segment = paintedSegments[i];

    if (!segment.isActive) continue;

    // Remover del mapa
    if (map.getLayer(segment.layerId)) {
      map.removeLayer(segment.layerId);
    }
    if (map.getSource(segment.sourceId)) {
      map.removeSource(segment.sourceId);
    }

    segment.isActive = false;
    segmentsRemoved++;
    console.log(`✓ Segmento ${i} eliminado completamente (${segment.sourceId})`);
  }

  // Actualizar el segmento actual (donde está el usuario)
  if (upToSegmentIndex < paintedSegments.length) {
    const currentSegment = paintedSegments[upToSegmentIndex];

    if (currentSegment.isActive) {
      const coords = getSegmentCoordinates(currentSegment);

      if (!coords) {
        console.warn(`No se pudieron obtener coordenadas del segmento ${upToSegmentIndex}`);
        return segmentsRemoved;
      }

      const isReverse = currentSegment.direction === "reverse";

      // Ajustar el índice según la interpolación
      // Si interpolationFactor > 0.5, consideramos que ya pasó ese punto
      const effectiveIndex = interpolationFactor > 0.5 ? upToPointIndex + 1 : upToPointIndex;

      console.log(`Segmento actual: ${upToSegmentIndex}, punto: ${upToPointIndex}/${coords.length}, interpolación: ${interpolationFactor.toFixed(2)}, efectivo: ${effectiveIndex}, dirección: ${isReverse ? 'REVERSA' : 'FORWARD'}`);

      if (isReverse) {
        // ===== LÓGICA INVERSA =====

        if (effectiveIndex >= coords.length - 1) {
          // Eliminar segmento completo
          if (map.getLayer(currentSegment.layerId)) {
            map.removeLayer(currentSegment.layerId);
          }
          if (map.getSource(currentSegment.sourceId)) {
            map.removeSource(currentSegment.sourceId);
          }
          currentSegment.isActive = false;
          segmentsRemoved++;
          console.log(`✓ Segmento ${upToSegmentIndex} eliminado (REVERSA - usuario en punto final)`);
        }
        else if (effectiveIndex < coords.length - 1) {
          const remainingCoords = coords.slice(0, effectiveIndex + 1);

          if (remainingCoords.length >= 2) {
            const source = map.getSource(currentSegment.sourceId);
            if (source) {
              source.setData({
                type: "Feature",
                geometry: {
                  type: "LineString",
                  coordinates: remainingCoords
                },
                properties: {}
              });
              console.log(`✓ Segmento ${upToSegmentIndex} recortado (REVERSA): de ${coords.length} a ${remainingCoords.length} puntos`);
            }
          } else {
            // Eliminar si quedan muy pocos puntos
            if (map.getLayer(currentSegment.layerId)) {
              map.removeLayer(currentSegment.layerId);
            }
            if (map.getSource(currentSegment.sourceId)) {
              map.removeSource(currentSegment.sourceId);
            }
            currentSegment.isActive = false;
            segmentsRemoved++;
            console.log(`✓ Segmento ${upToSegmentIndex} eliminado (REVERSA - quedaban muy pocos puntos)`);
          }
        }

      } else {
        // ===== LÓGICA NORMAL =====

        if (effectiveIndex === 0) {
          // Eliminar segmento completo
          if (map.getLayer(currentSegment.layerId)) {
            map.removeLayer(currentSegment.layerId);
          }
          if (map.getSource(currentSegment.sourceId)) {
            map.removeSource(currentSegment.sourceId);
          }
          currentSegment.isActive = false;
          segmentsRemoved++;
          console.log(`✓ Segmento ${upToSegmentIndex} eliminado (FORWARD - usuario en punto inicial)`);
        }
        else if (effectiveIndex > 0) {
          const remainingCoords = coords.slice(effectiveIndex);

          if (remainingCoords.length >= 2) {
            const source = map.getSource(currentSegment.sourceId);
            if (source) {
              source.setData({
                type: "Feature",
                geometry: {
                  type: "LineString",
                  coordinates: remainingCoords
                },
                properties: {}
              });
              console.log(`✓ Segmento ${upToSegmentIndex} recortado (FORWARD): de ${coords.length} a ${remainingCoords.length} puntos`);
            }
          } else {
            // Eliminar si quedan muy pocos puntos
            if (map.getLayer(currentSegment.layerId)) {
              map.removeLayer(currentSegment.layerId);
            }
            if (map.getSource(currentSegment.sourceId)) {
              map.removeSource(currentSegment.sourceId);
            }
            currentSegment.isActive = false;
            segmentsRemoved++;
            console.log(`✓ Segmento ${upToSegmentIndex} eliminado (FORWARD - quedaban muy pocos puntos)`);
          }
        }
      }
    }
  }

  return segmentsRemoved;
}

function updateUserProgress(userGPSCoord, markerOrigin = null) {
  // Eliminar marcador de origen si existe y aún no se ha eliminado
  if (markerOrigin && map.hasImage && markerOrigin.remove) {
    markerOrigin.remove();
    console.log('✓ Marcador de origen eliminado');
  }

  // Encontrar posición del usuario en la ruta
  const position = findUserPositionInRoute(userGPSCoord);

  if (!position) {
    console.warn('⚠️ Usuario no encontrado cerca de la ruta');
    return;
  }

  // Calcular hacia dónde debe apuntar el marcador
  const heading = calculateMarkerHeading(position);

  // Actualizar/crear marcador de seguimiento
  updateUserFollowMarker(position.closestPoint.coordinate, heading || 0);

  checkTransferProximity(userGPSCoord);

  // ✅ APLICAR MODO NAVEGACIÓN SI ESTÁ ACTIVADO
  if (navigationMode) {
    map.easeTo({
      center: position.closestPoint.coordinate,
      zoom: 17, // ← Ajusta entre 17-19 según prefieras
      bearing: heading || 0,
      pitch: 45, // ← Ajusta entre 0-60 según prefieras
      duration: 800,
      essential: true
    });
  }

  // Despintar segmentos completados
  const removed = unpaintCompletedSegments(
    position.segmentIndex,
    position.closestPoint.index
  );

  console.log(`📍 Progreso actualizado: ${removed} segmentos eliminados, distancia a ruta: ${position.closestPoint.distance.toFixed(2)}m`);

  if (checkRouteCompletion()) {
    onRouteCompleted();
  }
}

/**
 * Proyecta un punto sobre un segmento de línea y devuelve el punto más cercano
 * @param {Array} point - [lng, lat] punto a proyectar
 * @param {Array} segmentStart - [lng, lat] inicio del segmento
 * @param {Array} segmentEnd - [lng, lat] fin del segmento
 * @returns {Object} { coordinate: [lng, lat], distance: number, t: number }
 */
function projectPointOnSegment(point, segmentStart, segmentEnd) {
  const [px, py] = point;
  const [ax, ay] = segmentStart;
  const [bx, by] = segmentEnd;

  // Vector del segmento AB
  const abx = bx - ax;
  const aby = by - ay;

  // Vector de A al punto P
  const apx = px - ax;
  const apy = py - ay;

  // Magnitud cuadrada del segmento
  const abSquared = abx * abx + aby * aby;

  // Evitar división por cero (segmento degenerado)
  if (abSquared === 0) {
    return {
      coordinate: segmentStart,
      distance: getDistanceInMeters(point, segmentStart),
      t: 0
    };
  }

  // Proyección escalar de AP sobre AB (normalizada de 0 a 1)
  let t = (apx * abx + apy * aby) / abSquared;

  // Clamping: limitar t al rango [0, 1] para mantenerlo dentro del segmento
  t = Math.max(0, Math.min(1, t));

  // Punto proyectado sobre el segmento
  const projectedX = ax + t * abx;
  const projectedY = ay + t * aby;
  const projectedCoord = [projectedX, projectedY];

  return {
    coordinate: projectedCoord,
    distance: getDistanceInMeters(point, projectedCoord),
    t: t  // 0 = inicio del segmento, 1 = final del segmento
  };
}

/**
 * Activa el modo navegación (seguimiento GPS con cámara)
 */
function startNavigationMode() {
  navigationMode = true;
  hideRecenterButton(); // Ocultar botón cuando está en navegación
  console.log('🧭 Modo navegación activado');
}

function stopNavigationMode() {
  navigationMode = false;

  // Solo mostrar el botón si la ruta sigue activa
  if (routeActive) {
    showRecenterButton();
  }

  console.log('🧭 Modo navegación desactivado');

  // Restablecer pitch y bearing suavemente
  map.easeTo({
    pitch: 0,
    bearing: 0,
    duration: 800
  });
}

// Desactivar modo navegación si el usuario toca/arrastra el mapa
map.on('dragstart', () => {
  if (navigationMode) {
    stopNavigationMode(); // Usar stopNavigationMode en lugar de solo cambiar la variable
    console.log('🧭 Modo navegación pausado - usuario arrastró el mapa');
  }
});

// Opcional: también con zoom manual
map.on('zoomstart', (e) => {
  if (!e.originalEvent) return; // Ignorar zooms programáticos

  if (navigationMode) {
    stopNavigationMode();
    console.log('🧭 Modo navegación pausado - usuario hizo zoom manual');
  }
});

function onStartRouteButtonClick() {
  routeCompleted = false;

  // Marcar ruta como activa
  routeActive = true;
  createRecenterButton();
  startNavigationMode();

  // Inicializar los datos del viaje para guardarlos al finalizar
  initializeJourney();



  const testRoute = [
    // [-75.61420338, 6.281093175],  // Punto 1
    [-75.61401716, 6.275360769],  // Punto 2
    [-75.61370257, 6.26567653],  // Punto 3
    [-75.6136642, 6.256780931],  // Punto 4 
    [-75.6136642, 6.256780931], // Punto 5
    [-75.6136642, 6.256780931], // Punto 5
    [-75.60374625, 6.25808821],
    [-75.5977437, 6.258709043],
    [ -75.56967864286219,6.247175927579917],
    [-75.57014923566216, 6.246098926651181]
    [-75.57043010796497,6.245463747245475],
    [-75.5691065931842,6.24858643686346],
    [-75.56918460560735,6.248433855368293],
    [-75.56934537680426, 6.248083436588248 ],
    [-75.56947112836812,6.2477782199831],
  ];


  // const testRoute = [
  //   [-75.55438934140159, 6.319801665881175],
  //   [-75.55534580389958, 6.316001342229484],
  //   [-75.55851194186361, 6.299961957796953],
  //   [-75.56470061709405, 6.290310300270889],
  //   [-75.56938422818597, 6.278324369727542],
  //   [-75.5657915298572, 6.269405972933399],
  //   [-75.56327830924161, 6.2640097938723756],
  // ];

  // Iniciar simulación (cada 2 segundos por defecto)
  simulateUserMovement(testRoute, 3000, 2000);

  console.log('🚀 Ruta iniciada con simulación');
}
function createRecenterButton() {
  if (recenterButton) return; // Ya existe

  const button = document.createElement('button');
  button.innerHTML = '🧭'; // o '📍' o un SVG
  button.className = 'recenter-button';
  button.title = 'Volver a modo navegación';
  button.style.cssText = `
    position: absolute;
    bottom: 100px;
    right: 10px;
    width: 50px;
    height: 50px;
    border-radius: 50%;
    background: white;
    border: 2px solid #06b6d4;
    font-size: 24px;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    z-index: 1000;
    display: none; /* Inicialmente oculto */
    transition: all 0.3s ease;
  `;

  button.onclick = () => {
    startNavigationMode();
  };

  document.body.appendChild(button);
  recenterButton = button;

  console.log('✓ Botón de recentrar creado');
}

function showRecenterButton() {
  if (recenterButton) {
    recenterButton.style.display = 'block';
    console.log('👁️ Botón de recentrar visible');
  }
}

function hideRecenterButton() {
  if (recenterButton) {
    recenterButton.style.display = 'none';
    console.log('🙈 Botón de recentrar oculto');
  }
}


// Variable global para el simulador
let simulationInterval = null;
let simulationIndex = 0;

/**
 * Simula el recorrido del usuario usando un array de coordenadas
 * @param {Array} coordsArray - Array de coordenadas [[lng, lat], [lng, lat], ...]
 * @param {number} intervalMs - Tiempo entre cada actualización en milisegundos (default: 2000ms = 2seg)
 */
function simulateUserMovement(coordsArray, intervalMs = 2000, initialDelay = 3000) {
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
  }

  simulationIndex = 0;
  console.log(`⏳ La simulación comenzará en ${initialDelay / 1000} segundos...`);

  // ✅ DELAY ANTES DE EMPEZAR
  setTimeout(() => {
    console.log(`🎮 Iniciando simulación con ${coordsArray.length} puntos`);

    // Primera coordenada
    if (coordsArray.length > 0) {
      updateUserProgress(coordsArray[0]);
    }

    // Resto de coordenadas
    simulationInterval = setInterval(() => {
      simulationIndex++;

      if (simulationIndex >= coordsArray.length) {
        console.log('✓ Simulación completada');
        clearInterval(simulationInterval);
        simulationInterval = null;
        return;
      }

      const currentCoord = coordsArray[simulationIndex];
      console.log(`📍 Simulación paso ${simulationIndex}/${coordsArray.length}`);

      updateUserProgress(currentCoord);
    }, intervalMs);

  }, initialDelay);
}

/**
 * Detiene la simulación en curso
 */
function stopSimulation() {
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
    console.log('⏹️ Simulación detenida');
  }
}

function checkRouteCompletion() {
  // Contar segmentos activos
  const activeSegments = paintedSegments.filter(seg => seg.isActive);

  // Si no quedan segmentos activos y había segmentos registrados
  if (activeSegments.length === 0 && paintedSegments.length > 0) {
    return true;
  }

  return false;
}

function onRouteCompleted() {
  if (routeCompleted) return; // Evitar ejecutar múltiples veces

  routeCompleted = true;

  console.log('🎉 RUTA TERMINADA');

  // Detener simulación si está activa
  stopSimulation();
}

/**
 * Initialize the trip by saving the start time and stations
 */
function initializeJourney() {
  const routeData = window.lastRouteData;

  if (!routeData || !routeData.rute || routeData.rute.length < 2) {
    console.error('❌ No hay datos de ruta válidos');
    return false;
  }

  // Save trip data
  journeyStartTime = new Date().toISOString();
  journeyStartStation = routeData.rute[0]; // first station
  journeyEndStation = routeData.rute[routeData.rute.length - 1]; // last station

  // Get the selected criterion
  const criterionElement = document.getElementById('inputCriteria');
  const criterionValue = criterionElement ? criterionElement.value : 'time';

  // Map the criterion value to the DB format
  const criterionMap = {
    'time': 'tiempo',
    'distance_km': 'distancia',
    'transfer': 'transferencias'
  };
  journeyCriterion = criterionMap[criterionValue] || 'tiempo';

  console.log('✅ Viaje inicializado:', {
    startTime: journeyStartTime,
    startStation: journeyStartStation,
    endStation: journeyEndStation,
    criterion: journeyCriterion
  });

  // Reset monitoring state
  lastRouteCompletedState = false;

  return true;
}

/**
 * Saves the completed journey to the server
 */
async function saveCompletedJourney() {
  if (!journeyStartTime || !journeyStartStation || !journeyEndStation) {
    console.error('❌ Faltan datos del viaje para guardar');
    return false;
  }

  console.log('💾 Guardando viaje completado...');

  try {
    const response = await fetch('/save-journey/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        start_station: journeyStartStation,
        end_station: journeyEndStation,
        start_time: journeyStartTime,
        criterion: journeyCriterion,
        // Enviar el precio calculado mostrado en la UI cuando esté disponible
        price: (window.lastRouteData && window.lastRouteData.price !== undefined) ? Number(window.lastRouteData.price) : null,
        // Enviar el perfil seleccionado por el usuario (si existe)
        perfil: (document.getElementById('profileSelection') ? document.getElementById('profileSelection').value : null)
      })
    });

    const data = await response.json();

    if (data.success) {
      console.log('✅ Viaje guardado exitosamente:', data);

      // Show notification to user
      const alertBox = document.getElementById('alerta-validacion');
      const alertMessage = document.getElementById('mensaje-alerta');

      alertMessage.textContent = `🎉 ¡Viaje completado! Duración: ${data.duration_minutes.toFixed(1)} minutos`;
      alertBox.className = 'alert alert-success alert-dismissible fade show position-absolute top-0 start-50 translate-middle-x mt-3';
      alertBox.style.display = 'block';

      setTimeout(() => {
        alertBox.style.display = 'none';
      }, 5000);

      // Reset journey variables
      resetJourneyVariables();

      return true;
    } else {
      console.error('❌ Error al guardar viaje:', data.message);
      alert('Error al guardar el viaje: ' + data.message);
      return false;
    }
  } catch (error) {
    console.error('❌ Error en la petición:', error);
    alert('Error de conexión al guardar el viaje');
    return false;
  }
}

/**
 * Resets the journey variables after saving
 */
function resetJourneyVariables() {
  journeyStartTime = null;
  journeyStartStation = null;
  journeyEndStation = null;
  journeyCriterion = 'tiempo';
  routeActive = false;

  // Hide recenter button
  if (recenterButton) {
    recenterButton.style.display = 'none';
  }

  console.log('🧹 Variables del viaje limpiadas');
}

/**
 * 🔥 MONITOR THAT DETECTS WHEN routeCompleted CHANGES TO TRUE
 * Runs every 500ms to check the status
 */
function monitorRouteCompletion() {
  // Only monitor if the journey was initialized
  if (!journeyStartTime) return;

  // Save the trip
  if (routeCompleted === true && lastRouteCompletedState === false) {
    console.log(' Detectado: routeCompleted cambió a TRUE');

    // Save the trip
    saveCompletedJourney();

    // Update state
    lastRouteCompletedState = true;
  }
}

// 🔄 Start the monitor (runs every 500ms)
setInterval(monitorRouteCompletion, 500);

console.log('✅ Monitor de finalización de ruta activado');

// Notificaciones
let transferPoints = []; // Array de coordenadas de transferencia
let currentTransferAlert = {
  alerted50m: false,
  alerted10m: false
};

/**
 * Inicializa el array de transferencias desde los datos de la ruta
 * @param {Array} transferCoords - Array de coordenadas [[lng, lat], [lng, lat], ...]
 */
function initializeTransferPoints(transferCoords) {
  transferPoints = [];

  if (!transferCoords || transferCoords.length === 0) {
    console.log('ℹ️ No hay transferencias en esta ruta');
    return;
  }

  // Copiar las coordenadas al array
  transferPoints = transferCoords.map(coord => ({
    coords: coord
  }));

  // Resetear alertas
  currentTransferAlert = {
    alerted50m: false,
    alerted10m: false
  };

  console.log(`✅ ${transferPoints.length} transferencias inicializadas`);
}

/**
 * Verifica la proximidad del usuario a la siguiente transferencia
 * @param {Array} userCoord - [lng, lat] posición actual del usuario
 */
function checkTransferProximity(userCoord) {
  // Si no hay transferencias pendientes, no hacer nada
  if (transferPoints.length === 0) return;

  // Obtener la primera transferencia (la siguiente en la ruta)
  const nextTransfer = transferPoints[0];

  // Calcular distancia
  const distance = getDistanceInMeters(userCoord, nextTransfer.coords);

  console.log(`📏 Distancia a próxima transferencia: ${distance.toFixed(2)}m`);

  // Alerta a 50 metros
  if (distance <= 50 && !currentTransferAlert.alerted50m) {
    showTransferAlert('⚠️ Prepárate, transferencia próxima en 50 metros', 'warning');
    currentTransferAlert.alerted50m = true;
    console.log('🔔 Alerta de 50m activada');
  }

  // Alerta a 10 metros y eliminar transferencia
  if (distance <= 10 && !currentTransferAlert.alerted10m) {
    showTransferAlert('🚏 ¡Transferencia! Prepárate para descender', 'danger');
    currentTransferAlert.alerted10m = true;

    // Eliminar esta transferencia del array
    transferPoints.shift();

    // Resetear alertas para la siguiente transferencia
    currentTransferAlert = {
      alerted50m: false,
      alerted10m: false
    };

    console.log(`✅ Transferencia completada. Quedan ${transferPoints.length} transferencias`);
  }
}

/**
 * Muestra una alerta de transferencia en pantalla
 * @param {string} message - Mensaje a mostrar
 * @param {string} type - Tipo de alerta: 'warning' (50m) o 'danger' (10m)
 */
function showTransferAlert(message, type = 'warning') {
  const alertBox = document.getElementById('alerta-validacion');
  const alertMessage = document.getElementById('mensaje-alerta');

  if (!alertBox || !alertMessage) {
    console.warn('⚠️ Elementos de alerta no encontrados en el DOM');
    return;
  }

  // Configurar mensaje
  alertMessage.textContent = message;

  // Configurar estilo según tipo
  const alertClass = type === 'danger'
    ? 'alert alert-danger alert-dismissible fade show position-absolute top-0 start-50 translate-middle-x mt-3'
    : 'alert alert-warning alert-dismissible fade show position-absolute top-0 start-50 translate-middle-x mt-3';

  alertBox.className = alertClass;
  alertBox.style.display = 'block';

  // Ocultar después de 6 segundos
  setTimeout(() => {
    alertBox.style.display = 'none';
  }, 6000);

  console.log(`🔔 Alerta mostrada: ${message}`);
}