from django.shortcuts import render
from django.http import HttpResponse

from .assets import stationGraphs

def map(request):
    # Render the map template
    return render(request, 'map.html')

def callRute(request):
    start = request.GET.get('inputStart')  # Default to 'A01' if not provided
    destination = request.GET.get('inputDestination')  # Default to 'A20' if not provided

    # Call the rute function from utils
    rute, distance = stationGraphs.rute(stationGraphs.G, start, destination)

    # Return the route and distance as a JSON response
    return HttpResponse(f"Rute: {rute}, Distance: {distance} meters")