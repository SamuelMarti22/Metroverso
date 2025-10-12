from django.shortcuts import render, redirect
from django.http import HttpResponse
from django.http import JsonResponse
from django.utils import translation
from django.db.models import Count
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User as DjangoUser
from django.contrib import messages
from django.contrib.auth.decorators import login_required

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
    criteria = request.GET.get('inputCriteria')
    # Read passenger profile from request
    profile = request.GET.get('profileSelection', 'Frecuente')
    print(criteria)
    # Call the rute function from utils
    rute, distance, transfer_info, can_make_trip, service_hours, uses_arvi_station, rute_coords, price_packages, rute_price = functions.calculeRute(start, destination, criteria, profile)

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
            price=rute_price,
            criterion="tiempo",
            id_user=user
        )

    return JsonResponse({ 
        'rute': rute,
        'distance': distance,
        'price': rute_price,
        'price_packages': price_packages,
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
            rute, _, _, _, _, _, _, _, _ = calculeRute(start.id_station, end.id_station)
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


# ==================== SISTEMA DE AUTENTICACIÓN ====================

def register_view(request):
    """Vista para registro de nuevos usuarios"""
    if request.method == 'POST':
        username = request.POST.get('username')
        email = request.POST.get('email')
        password = request.POST.get('password')
        confirm_password = request.POST.get('confirm_password')
        
        # Validaciones
        if not all([username, email, password, confirm_password]):
            messages.error(request, 'Todos los campos son obligatorios')
            return render(request, 'auth/register.html')
        
        if password != confirm_password:
            messages.error(request, 'Las contraseñas no coinciden')
            return render(request, 'auth/register.html')
        
        if DjangoUser.objects.filter(username=username).exists():
            messages.error(request, 'El nombre de usuario ya existe')
            return render(request, 'auth/register.html')
        
        if DjangoUser.objects.filter(email=email).exists():
            messages.error(request, 'El email ya está registrado')
            return render(request, 'auth/register.html')
        
        try:
            # Crear usuario Django (SIN privilegios de admin)
            django_user = DjangoUser.objects.create_user(
                username=username,
                email=email,
                password=password,
                is_staff=False,      # NO pueden acceder al admin
                is_superuser=False   # NO son superusers
            )
            
            # Crear perfil Metro asociado con los campos correctos
            metro_profile = User.objects.create(
                django_user=django_user,  # Usar 'django_user', no 'user'
                name=username,            # Usar 'name', no username
                perfil='Frecuente',       # Perfil por defecto
                lenguaje='Español'        # Idioma por defecto
            )
            
            messages.success(request, '¡Registro exitoso! Ya puedes iniciar sesión')
            return redirect('login')
            
        except Exception as e:
            messages.error(request, f'Error al crear la cuenta: {str(e)}')
            return render(request, 'auth/register.html')
    
    return render(request, 'auth/register.html')


def login_view(request):
    """Vista para inicio de sesión"""
    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')
        
        if not username or not password:
            messages.error(request, 'Usuario y contraseña son obligatorios')
            return render(request, 'auth/login.html')
        
        user = authenticate(request, username=username, password=password)
        
        if user is not None:
            login(request, user)
            messages.success(request, f'¡Bienvenido, {user.username}!')
            
            # Redirigir a la página que quería visitar o al mapa
            next_url = request.GET.get('next', 'map')
            return redirect(next_url)
        else:
            messages.error(request, 'Usuario o contraseña incorrectos')
    
    return render(request, 'auth/login.html')


def logout_view(request):
    """Vista para cerrar sesión"""
    logout(request)
    messages.success(request, 'Has cerrado sesión exitosamente')
    return redirect('login')


@login_required
def profile_view(request):
    """Vista del perfil del usuario"""
    try:
        metro_profile = request.user.metro_profile
    except User.DoesNotExist:
        # Si no tiene perfil Metro, crear uno
        metro_profile = User.objects.create(
            django_user=request.user,  # Usar 'django_user'
            name=request.user.username,  # Usar 'name'
            perfil='Frecuente',
            lenguaje='Español'
        )
    
    if request.method == 'POST':
        # Actualizar perfil
        metro_profile.name = request.POST.get('name', metro_profile.name)
        metro_profile.perfil = request.POST.get('perfil', metro_profile.perfil)
        metro_profile.lenguaje = request.POST.get('lenguaje', metro_profile.lenguaje)
        metro_profile.save()
        
        messages.success(request, 'Perfil actualizado exitosamente')
        return redirect('profile')
    
    context = {
        'user': request.user,
        'metro_profile': metro_profile,
        'perfil_choices': User.PERFIL_CHOICES,
        'lenguaje_choices': User.LENGUAJE_CHOICES
    }
    return render(request, 'auth/profile.html', context)
