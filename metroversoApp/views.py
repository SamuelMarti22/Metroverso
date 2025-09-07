from django.shortcuts import render
from django.http import HttpResponse
from django.http import JsonResponse
from django.utils import translation
from django.db.models import Count

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

    if start_station and end_station and user:
        Route.objects.create(
            id_start=start_station,
            id_end=end_station,
            price=0.0,
            criterion="tiempo",
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

def dashboard(request):
    # Most used stations (top 4)
    start_counts = Route.objects.values('id_start').annotate(count=Count('id_start'))
    end_counts = Route.objects.values('id_end').annotate(count=Count('id_end'))
    station_usage = {}
    for item in start_counts:
        station_usage[item['id_start']] = station_usage.get(item['id_start'], 0) + item['count']
    for item in end_counts:
        station_usage[item['id_end']] = station_usage.get(item['id_end'], 0) + item['count']
    top_stations = sorted(station_usage.items(), key=lambda x: x[1], reverse=True)[:4]
    result_stations = []
    for station_id, usage in top_stations:
        try:
            station = Station.objects.get(pk=station_id)
            result_stations.append({
                'id': station_id,
                'name': station.name,
                'line': station.line,
                'type': station.type,
                'usage': usage
            })
        except Station.DoesNotExist:
            continue
    # DBR04: Group similar routes (by start, end, criterion)
    from .utils.functions import calculeRute
    route_groups = (
        Route.objects.values('id_start', 'id_end', 'criterion')
        .annotate(count=Count('id_route'))
        .order_by('-count')[:4]
    )
    result_routes = []
    for group in route_groups:
        try:
            start = Station.objects.get(pk=group['id_start'])
            end = Station.objects.get(pk=group['id_end'])
            rute, _, _, _, _, _, _ = calculeRute(start.id_station, end.id_station)
            rute_names = []
            for station_id in rute:
                try:
                    station_obj = Station.objects.get(pk=station_id)
                    rute_names.append(station_obj.name)
                except Station.DoesNotExist:
                    rute_names.append(station_id)
            result_routes.append({
                'start': start.name,
                'end': end.name,
                'criterion': group['criterion'],
                'count': group['count'],
                'rute': rute_names
            })
        except Station.DoesNotExist:
            continue
    return JsonResponse({'top_stations': result_stations, 'top_routes': result_routes})
