from django.shortcuts import render
from django.http import HttpResponse

def map(request):
    # Render the map template
    return render(request, 'map.html')