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

// Función para resolver input de estación (ID o nombre) a ID
window.resolveStationInput = function(input) {
    if (!input || typeof input !== 'string') {
        return null;
    }
    
    const cleanInput = input.trim().toUpperCase();
    
    // Primero verificar si es un ID directo
    if (stationNames[cleanInput]) {
        return cleanInput;
    }
    
    // Si no es un ID, buscar por nombre (case-insensitive)
    for (const [id, name] of Object.entries(stationNames)) {
        if (name.toUpperCase() === cleanInput) {
            return id;
        }
    }
    
    // Si no se encuentra, retornar null
    return null;
};

// Función para obtener el nombre de una estación por ID
window.getStationName = function(id) {
    return stationNames[id] || id;
};

// Función para obtener sugerencias de estaciones basadas en input parcial
window.getStationSuggestions = function(partialInput) {
    if (!partialInput || partialInput.length < 2) {
        return [];
    }
    
    const suggestions = [];
    const cleanInput = partialInput.trim().toLowerCase();
    
    // Buscar por ID
    for (const [id, name] of Object.entries(stationNames)) {
        if (id.toLowerCase().includes(cleanInput)) {
            suggestions.push({ id, name, type: 'ID' });
        }
    }
    
    // Buscar por nombre
    for (const [id, name] of Object.entries(stationNames)) {
        if (name.toLowerCase().includes(cleanInput)) {
            // Evitar duplicados si ya está en la lista por ID
            if (!suggestions.find(s => s.id === id)) {
                suggestions.push({ id, name, type: 'Nombre' });
            }
        }
    }
    
    // Ordenar por relevancia (exact matches primero, luego por longitud)
    suggestions.sort((a, b) => {
        const aExact = a.id.toLowerCase() === cleanInput || a.name.toLowerCase() === cleanInput;
        const bExact = b.id.toLowerCase() === cleanInput || b.name.toLowerCase() === cleanInput;
        
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        
        return a.name.length - b.name.length;
    });
    
    return suggestions.slice(0, 10); // Limitar a 10 sugerencias
};

window.validateInputsAndStations = function(startInput, endInput, stationPoints, validateFn) {
    // Resolver inputs a IDs de estación
    const startId = resolveStationInput(startInput);
    const endId = resolveStationInput(endInput);
    
    if (!startId) {
        return { valid: false, message: "No se encontró la ubicación de inicio" };
    }
    
    if (!endId) {
        return { valid: false, message: "No se encontró la ubicación de destino" };
    }
    
    // Buscar los puntos de estación usando los IDs resueltos
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

    // Generates the spans
    var parts = [];
    for (var j = 0; j < route.length; j++) {
      var st = String(route[j] || "");
      var isTransfer = !!transferSet[st];
      var cls = isTransfer ? "station transfer" : "station";
      parts.push('<span class="' + cls + '">' + st + '</span>');
    }

    // Unites with the separator
    return parts.join('<span class="sep"> → </span>');
  } catch (e) {
    console.error("renderRouteChain ERROR:", e, { route, transferInfo });
    // Fallback: if at least something is visible
    return Array.isArray(route) ? route.join(' → ') : String(route ?? "");
  }
};

