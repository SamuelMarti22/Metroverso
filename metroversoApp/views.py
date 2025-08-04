from django.shortcuts import render
from django.http import HttpResponse

from .assets import stationGraphs

def map(request):
    # Render the map template
    return render(request, 'map.html')