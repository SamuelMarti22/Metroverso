from django.shortcuts import render
from django.http import HttpResponse
from django.http import JsonResponse

from .assets import stationGraphs
from .utils import functions

def map(request):
    # Render the map template
    return render(request, 'map.html')

def getServiceHours(request):
    # Get current service hours
    from metroversoApp.assets.stationGraphs import get_current_service_hours
    service_hours = get_current_service_hours()
    
    return JsonResponse({
        'service_hours': service_hours
    })

def callRute(request):
    start = request.GET.get('inputStart')  # Default to 'A01' if not provided
    destination = request.GET.get('inputDestination')  # Default to 'A20' if not provided

    # Call the rute function from utils
    rute, distance, transfer_info, can_make_trip = functions.calculeRute(start, destination)
    
    # Get current service hours
    from metroversoApp.assets.stationGraphs import get_current_service_hours
    service_hours = get_current_service_hours()
    
    return JsonResponse({ 
        'rute': rute,
        'distance': distance,
        'transfer_info': transfer_info,
        'can_make_trip': can_make_trip,
        'service_hours': service_hours
    })
