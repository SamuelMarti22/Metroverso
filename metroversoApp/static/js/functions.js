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
    alertMessage.textContent = messageText;
    alertBox.style.display = "block";
    alertBox.classList.add('show');

    setTimeout(() => {
        alertBox.classList.remove('show');
        setTimeout(() => {
            alertBox.style.display = 'none';
            alertBox.classList.add('show');
        }, 200);
    }, 3000);
};

window.validateInputsAndStations = function(startInput, endInput, stationPoints, validateFn) {
    const startPoint = stationPoints.find(p => p.properties.ID?.toUpperCase() === startInput);
    const endPoint = stationPoints.find(p => p.properties.ID?.toUpperCase() === endInput);

    if (!startPoint || !endPoint) {
        return { valid: false, message: "No se encontraron una o ambas estaciones." };
    }

    const startValidation = validateFn(startPoint);
    const endValidation = validateFn(endPoint);

    if (!startValidation.isValid || !endValidation.isValid) {
        return { valid: false, message: "Una o ambas estaciones están fuera del área del sistema Metro." };
    }

    return { valid: true, startPoint, endPoint };
};

// ✅ GLOBAL: queda disponible como window.renderRouteChain
window.renderRouteChain = function(route, transferInfo){
  try {
    if (!Array.isArray(route)) return String(route ?? "");

    // Construye el set de estaciones de transbordo
    var transferSet = Object.create(null);
    if (transferInfo && Array.isArray(transferInfo.transfer_stations)) {
      for (var i = 0; i < transferInfo.transfer_stations.length; i++) {
        var s = String(transferInfo.transfer_stations[i] || "");
        transferSet[s] = true;
      }
    }

    // Genera los spans
    var parts = [];
    for (var j = 0; j < route.length; j++) {
      var st = String(route[j] || "");
      var isTransfer = !!transferSet[st];
      var cls = isTransfer ? "station transfer" : "station";
      parts.push('<span class="' + cls + '">' + st + '</span>');
    }

    // Une con el separador
    return parts.join('<span class="sep"> → </span>');
  } catch (e) {
    console.error("renderRouteChain ERROR:", e, { route, transferInfo });
    // Fallback: que al menos se vea algo
    return Array.isArray(route) ? route.join(' → ') : String(route ?? "");
  }
};

