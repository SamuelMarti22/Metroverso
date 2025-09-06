from django.shortcuts import render
from django.http import HttpResponse
from django.http import JsonResponse
from django.utils import translation

from .assets import stationGraphs
from .utils import functions
from .models import Route, Station, User

def map(request):
    language_code = translation.get_language()
    return render(request, 'map.html', {'LANGUAGE_CODE': language_code})

def getServiceHours(request):
    # Get current service hours
    from metroversoApp.assets.stationGraphs import get_current_service_hours
    service_hours = get_current_service_hours()
    
    return JsonResponse({
        'service_hours': service_hours
    })

# def getLineToShow(request):
#     linea = request.GET.get("linea")
#     print("Línea seleccionada:", linea)

def callRute(request):
    start = request.GET.get('inputStart')  # Default to 'A01' if not provided
    destination = request.GET.get('inputDestination')  # Default to 'A20' if not provided

    # Call the rute function from utils
    rute, distance, transfer_info, can_make_trip, service_hours, uses_arvi_station, rute_coords = functions.calculeRute(start, destination)

    # Guardar el viaje en la base de datos
    try:
        start_station = Station.objects.get(id_station=start)
        end_station = Station.objects.get(id_station=destination)
    except Station.DoesNotExist:
        start_station = None
        end_station = None

    # Always use the default user (pk=1) for saving routes
    try:
        user = User.objects.get(pk=1)
    except User.DoesNotExist:
        user = None

    # Guardar solo si existen estaciones y usuario
    if start_station and end_station and user:
        Route.objects.create(
            id_start=start_station,
            id_end=end_station,
            price=0.0,  # Puedes calcular el precio si tienes lógica
            criterion="tiempo",  # O "precio" según tu lógica
            id_user=user
        )

    return JsonResponse({ 
        'rute': rute,
        'distance': distance,
        'transfer_info': transfer_info,
        'can_make_trip': can_make_trip,
        'service_hours': service_hours,
        'uses_arvi_station': uses_arvi_station,
        'rute_coords': rute_coords
    })
