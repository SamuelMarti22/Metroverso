function closestPoints(userPoint, radius) {
    let defineArea = turf.buffer(userPoint, radius, { units: 'meters' });
    let pointsArea = turf.pointsWithinPolygon(featureCollection, defineArea);

    if (pointsArea.features.length === 0 && radius < 10000) {
        console.log("No points found within the specified radius. Increasing radius by 2000 meters.");
        return closestPoints(userPoint, radius + 2000);
    }
    else if (pointsArea.features.length > 0) {
        const distancePoints = pointsArea.features.map((f) => {
            const distance = turf.distance(userPoint, f, { units: 'meters' });
            return { ...f, distance };
        });

        distancePoints.sort((pointX, pointY) => pointX.distance - pointY.distance);
        
        return distancePoints.slice(0, 3);
    } else {
        return [];
    }
}

// metropolitan area where the Metro system operates
const METRO_AREA_BOUNDARY = {
    type: "Feature",
    geometry: {
        type: "Polygon",
        coordinates: [[
            [-75.66284674398898, 6.137122170160765],
            [-75.49552136667803, 6.137122170160765],
            [-75.49552136667803, 6.359824423500001],
            [-75.66284674398898, 6.359824423500001],
            [-75.66284674398898, 6.137122170160765]
        ]]
    }
};

function validateLocation(point) {
    const isInside = turf.booleanPointInPolygon(point, METRO_AREA_BOUNDARY);
    return { isValid: isInside };
}

window.showAutoClosingAlert = function(alertBox, alertMessage, messageText) {
    if (!alertBox || !alertMessage) {
        console.error('Alert elements not found');
        return;
    }
    
    // Set the message
    alertMessage.textContent = messageText;
    
    // Show the alert
    alertBox.style.display = 'block';
    alertBox.classList.add('show');
    
    // Auto-hide after 5 seconds with gradual fade-out
    setTimeout(() => {
        // Start the fade-out transition by removing the show class
        alertBox.classList.remove('show');
        
        // After the transition completes (0.5s), hide the element completely
        setTimeout(() => {
            alertBox.style.display = 'none';
        }, 500); // Match the CSS transition duration
    }, 5000);
};

// Function to resolve station input (ID or name) to ID
window.resolveStationInput = function(input) {
    if (!input || typeof input !== 'string') {
        return null;
    }
    
    const cleanInput = input.trim().toUpperCase();
    
    // First check if it's a direct ID
    if (stationNames[cleanInput]) {
        return cleanInput;
    }
    
    // If it's not an ID, search by name (case-insensitive)
    for (const [id, name] of Object.entries(stationNames)) {
        if (name.toUpperCase() === cleanInput) {
            return id;
        }
    }
    
    // If not found, return null
    return null;
};

// Function to get station name by ID
window.getStationName = function(id) {
    return stationNames[id] || id;
};

// Function to get station suggestions based on partial input
window.getStationSuggestions = function(partialInput) {
    if (!partialInput || partialInput.length < 2) {
        return [];
    }
    
    const suggestions = [];
    const cleanInput = partialInput.trim().toLowerCase();
    
    // Search by ID
    for (const [id, name] of Object.entries(stationNames)) {
        if (id.toLowerCase().includes(cleanInput)) {
            suggestions.push({ id, name, type: 'ID' });
        }
    }
    
    // Search by name
    for (const [id, name] of Object.entries(stationNames)) {
        if (name.toLowerCase().includes(cleanInput)) {
            // Avoid duplicates if already in the list by ID
            if (!suggestions.find(s => s.id === id)) {
                suggestions.push({ id, name, type: 'Name' });
            }
        }
    }
    
    // Sort by relevance (exact matches first, then by length)
    suggestions.sort((a, b) => {
        const aExact = a.id.toLowerCase() === cleanInput || a.name.toLowerCase() === cleanInput;
        const bExact = b.id.toLowerCase() === cleanInput || b.name.toLowerCase() === cleanInput;
        
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        
        return a.name.length - b.name.length;
    });
    
    return suggestions.slice(0, 10); // Limit to 10 suggestions
};

window.validateInputsAndStations = function(startInput, endInput, stationPoints, validateFn) {
    // Resolve inputs to station IDs
    const startId = resolveStationInput(startInput);
    const endId = resolveStationInput(endInput);
    
    if (!startId) {
        return { valid: false, message: "No se encontró la ubicación de inicio" };
    }
    
    if (!endId) {
        return { valid: false, message: "No se encontró la ubicación de destino" };
    }
    
    // Find station points using resolved IDs
    const startPoint = stationPoints.find(p => p.properties.ID === startId);
    const endPoint = stationPoints.find(p => p.properties.ID === endId);

    if (!startPoint || !endPoint) {
        return { valid: false, message: "No se encontraron una o ambas estaciones en el mapa." };
    }

    const startValidation = validateFn(startPoint);
    const endValidation = validateFn(endPoint);

    if (!startValidation.isValid || !endValidation.isValid) {
        return { valid: false, message: "Una o ambas estaciones están fuera del área del sistema Metro." };
    }

    return { 
        valid: true, 
        startPoint, 
        endPoint,
        startId,
        endId,
        startName: getStationName(startId),
        endName: getStationName(endId)
    };
};

window.renderRouteChain = function(route, transferInfo){
  try {
    if (!Array.isArray(route)) return String(route ?? "");

    // build the transfer station set
    var transferSet = Object.create(null);
    if (transferInfo && Array.isArray(transferInfo.transfer_stations)) {
      for (var i = 0; i < transferInfo.transfer_stations.length; i++) {
        var s = String(transferInfo.transfer_stations[i] || "");
        transferSet[s] = true;
      }
    }

    // Color mapping for metro lines
    const lineColors = {
      'A': '#005d9a', 'B': '#e88530', 'O': '#e3807b', 
      'Z': '#e0007a', 'X': '#66a7ab', 'M': '#017077',
      'K': '#bacc44', 'P': '#e10521', 'L': '#8b622a',
      'J': '#f5c439', 'H': '#6a206b', 'T': '#008f37',
      '1': '#005d9a', '2': '#e88530'
    };

    // Mapping for transport type images
    const lineTransportType = {
      'A': 'metro', 'B': 'metro',           // Metro
      'K': 'metrocable', 'L': 'metrocable', 'H': 'metrocable', 'J': 'metrocable', // Metrocable
      'M': 'bus', 'X': 'bus', 'P': 'bus', 'O': 'bus', 'Z': 'bus',  // Metroplus (bus)
      'T': 'tranvia',                       // Tranvía
      '1': 'metro', '2': 'metro'            // Metro lines (alternative naming)
    };

    // Generates the card HTML for each station
    var cards = [];
    for (var j = 0; j < route.length; j++) {
      var stationId = String(route[j] || "");
      var stationName = getStationName(stationId);
      var isTransfer = !!transferSet[stationId];
      var line = stationId.charAt(0); // Extract line from station ID
      var lineColor = lineColors[line] || '#20c997';
      var transportType = lineTransportType[line] || 'metro';
      
      // Determine if it's the first or last station
      var isFirst = j === 0;
      var isLast = j === route.length - 1;
      
      var cardClass = 'route-station-card';
      if (isFirst) cardClass += ' first-station';
      if (isLast) cardClass += ' last-station';
      if (isTransfer) cardClass += ' transfer-station';
      
      // Icon for first/last/transfer stations, or transport type image
      var iconHtml;
      if (isFirst) {
        iconHtml = '<span style="font-size: 32px;"><svg xmlns="http://www.w3.org/2000/svg" width="35" height="35" fill="currentColor" class="bi bi-person-walking" viewBox="0 0 16 16"> <path d="M9.5 1.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0M6.44 3.752A.75.75 0 0 1 7 3.5h1.445c.742 0 1.32.643 1.243 1.38l-.43 4.083a1.8 1.8 0 0 1-.088.395l-.318.906.213.242a.8.8 0 0 1 .114.175l2 4.25a.75.75 0 1 1-1.357.638l-1.956-4.154-1.68-1.921A.75.75 0 0 1 6 8.96l.138-2.613-.435.489-.464 2.786a.75.75 0 1 1-1.48-.246l.5-3a.75.75 0 0 1 .18-.375l2-2.25Z"/> <path d="M6.25 11.745v-1.418l1.204 1.375.261.524a.8.8 0 0 1-.12.231l-2.5 3.25a.75.75 0 1 1-1.19-.914zm4.22-4.215-.494-.494.205-1.843.006-.067 1.124 1.124h1.44a.75.75 0 0 1 0 1.5H11a.75.75 0 0 1-.531-.22Z"/> </svg></span>';
      } else if (isLast) {
        iconHtml = '<span style="font-size: 32px;">🏁</span>';
      } else if (isTransfer) {
        iconHtml = '<span style="font-size: 32px;"><svg xmlns="http://www.w3.org/2000/svg" width="35" height="35" fill="currentColor" class="bi bi-arrow-left-right" viewBox="0 0 16 16"> <path fill-rule="evenodd" d="M1 11.5a.5.5 0 0 0 .5.5h11.793l-3.147 3.146a.5.5 0 0 0 .708.708l4-4a.5.5 0 0 0 0-.708l-4-4a.5.5 0 0 0-.708.708L13.293 11H1.5a.5.5 0 0 0-.5.5m14-7a.5.5 0 0 1-.5.5H2.707l3.147 3.146a.5.5 0 1 1-.708.708l-4-4a.5.5 0 0 1 0-.708l4-4a.5.5 0 1 1 .708.708L2.707 4H14.5a.5.5 0 0 1 .5.5"/> </svg></span>';
      } else {
        iconHtml = `<img src="/static/images/${transportType}.png" alt="${transportType}" style="width: 35px; height: 35px; object-fit: contain;">`;
      }
      
      cards.push(`
        <div class="${cardClass}" style="background-color: ${lineColor}; border-color: ${lineColor};">
          <div class="station-card-icon">${iconHtml}</div>
          <div class="station-card-content">
            <div class="station-card-name" style="color: white;">${stationName}</div>
            <div class="station-card-line" style="background-color: ${lineColor}; color: white;">
              Línea ${line}
            </div>
          </div>
          ${!isLast ? '<div class="station-card-connector" style="background: linear-gradient(to bottom, ' + lineColor + ', rgba(0,0,0,0.1));"></div>' : ''}
        </div>
      `);
    }

    // Return cards wrapped in a container
    return '<div class="route-cards-container">' + cards.join('') + '</div>';
  } catch (e) {
    console.error("renderRouteChain ERROR:", e, { route, transferInfo });
    // Fallback: if at least something is visible
    return Array.isArray(route) ? route.join(' → ') : String(route ?? "");
  }
};


