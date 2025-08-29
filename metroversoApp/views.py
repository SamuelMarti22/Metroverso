from django.shortcuts import render
from django.http import HttpResponse
from django.http import JsonResponse
from django.utils import translation

from .assets import stationGraphs
from .utils import functions

def map(request):
    language_code = translation.get_language()
    return render(request, 'map.html', {'LANGUAGE_CODE': language_code})

def callRute(request):
    start = request.GET.get('inputStart')  # Default to 'A01' if not provided
    destination = request.GET.get('inputDestination')  # Default to 'A20' if not provided

    # Call the rute function from utils
    rute, distance, transfer_info = functions.calculeRute(start, destination)

    return JsonResponse({ 
        'rute': rute,
        'distance': distance,
        'transfer_info': transfer_info
    })
