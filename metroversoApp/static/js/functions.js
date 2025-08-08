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