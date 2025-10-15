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
from .assets import functions
from .models import Route, Station, User

from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
from datetime import datetime
import json

def map(request):
    language_code = translation.get_language()
    
    # Get user information for profile display
    user_data = {
        'is_authenticated': request.user.is_authenticated,
        'username': request.user.username if request.user.is_authenticated else None,
        'metro_profile': None
    }
    
    # Get Metro profile if user is authenticated
    if request.user.is_authenticated:
        try:
            user_data['metro_profile'] = request.user.metro_profile
        except:
            user_data['metro_profile'] = None
    
    return render(request, 'map.html', {
        'LANGUAGE_CODE': language_code,
        'user_data': user_data
    })

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
    start = request.GET.get('inputStart')
    destination = request.GET.get('inputDestination')
    criteria = request.GET.get('inputCriteria')
    nameStart = request.GET.get('nameStart')
    nameDestination = request.GET.get('nameDestination')
    print(nameStart, nameDestination)
 
    # Read passenger profile from request
    profile = request.GET.get('profileSelection', 'Frecuente')
    print(criteria)
    # Call the rute function from utils
    rute, distance, transfer_info, can_make_trip, service_hours, uses_arvi_station, rute_coords, transfer_coords, price_packages, rute_price = functions.calculeRute(start, destination, criteria, profile)

    # ❌ Ya no guardar automáticamente
    # try:
    #     start_station = Station.objects.get(id_station=start)
    #     end_station = Station.objects.get(id_station=destination)
    # except Station.DoesNotExist:
    #     start_station = None
    #     end_station = None

    # try:
    #     user = User.objects.get(pk=1)
    # except User.DoesNotExist:
    #     user = None
    # if start_station and end_station and user:
    #     Route.objects.create(
    #         id_start=start_station,
    #         id_end=end_station,
    #         price=0.0,
    #         criterion="tiempo",
    #         id_user=user
    #     )

    return JsonResponse({ 
        'rute': rute,
        'distance': distance,
        'price': rute_price,
        'price_packages': price_packages,
        'transfer_info': transfer_info,
        'can_make_trip': can_make_trip,
        'service_hours': service_hours,
        'uses_arvi_station': uses_arvi_station,
        'rute_coords': rute_coords,
        'transfer_coords': transfer_coords
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
    from .assets.functions import calculeRute
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

            rute, _, _, _, _, _, _, _, _, _ = calculeRute(start.id_station, end.id_station, 'time')

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

    # Get the three most recent routes for the logged-in user
    recent_routes = []
    if request.user.is_authenticated:
        try:
            user_profile = request.user.metro_profile
            routes = Route.objects.filter(id_user=user_profile).order_by('-start_time')[:3]
            for route in routes:
                rute, _, _, _, _, _, _, _, _, _ = calculeRute(route.id_start.id_station, route.id_end.id_station, 'time')
                rute_names = []
                for station_id in rute:
                    try:
                        station_obj = Station.objects.get(pk=station_id)
                        rute_names.append(station_obj.name)
                    except Station.DoesNotExist:
                        rute_names.append(station_id)
                recent_routes.append({
                    'start': route.id_start.name,
                    'end': route.id_end.name,
                    'date': route.start_time.strftime('%Y-%m-%d %H:%M'),
                    'rute': rute_names
                })
        except User.DoesNotExist:
            pass

    return JsonResponse({'top_stations': result_stations, 'top_routes': result_routes, 'recent_routes': recent_routes})


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

def profile_data_view(request):
    """Vista AJAX para obtener datos del perfil para el offcanvas"""
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'No autenticado'}, status=401)
    
    try:
        metro_profile = request.user.metro_profile
    except User.DoesNotExist:
        # Si no tiene perfil Metro, crear uno básico
        metro_profile = User.objects.create(
            django_user=request.user,
            name=request.user.username,
            perfil='Frecuente',
            lenguaje='Español'
        )
    
    if request.method == 'POST':
        # Actualizar perfil desde el offcanvas
        metro_profile.name = request.POST.get('name', metro_profile.name)
        metro_profile.perfil = request.POST.get('perfil', metro_profile.perfil)
        metro_profile.lenguaje = request.POST.get('lenguaje', metro_profile.lenguaje)
        metro_profile.save()
        
        return JsonResponse({
            'success': True,
            'message': 'Perfil actualizado exitosamente'
        })
    
    # GET - Devolver datos del perfil
    return JsonResponse({
        'user': {
            'username': request.user.username,
            'email': request.user.email,
            'first_name': request.user.first_name,
            'last_name': request.user.last_name,
        },
        'metro_profile': {
            'name': metro_profile.name,
            'perfil': metro_profile.perfil,
            'lenguaje': metro_profile.lenguaje,
        },
        'perfil_choices': User.PERFIL_CHOICES,
        'lenguaje_choices': User.LENGUAJE_CHOICES
    })

@csrf_exempt
@require_http_methods(["POST"])
def save_journey(request):
    """
    Guarda el viaje cuando el usuario llega a la estación final.
    Recibe: start_station, end_station, start_time, user_id (opcional)
    """
    try:
        data = json.loads(request.body)
        
        # Obtener datos del request
        start_station_id = data.get('start_station')
        end_station_id = data.get('end_station')
        start_time_str = data.get('start_time')
        criterion = data.get('criterion', 'tiempo')  # Por defecto 'tiempo'
        
        # Validar que existan las estaciones
        try:
            start_station = Station.objects.get(id_station=start_station_id)
            end_station = Station.objects.get(id_station=end_station_id)
        except Station.DoesNotExist:
            return JsonResponse({
                'success': False,
                'message': f'Estación no encontrada: {start_station_id} o {end_station_id}'
            }, status=404)
        
        # Obtener usuario (usar el autenticado o el usuario por defecto pk=1)
        if request.user.is_authenticated:
            try:
                user = request.user.metro_profile
            except User.DoesNotExist:
                # Si el usuario autenticado no tiene perfil metro, usar el default
                user = User.objects.get(pk=1)
        else:
            # Usuario no autenticado, usar el default
            user = User.objects.get(pk=1)
        
        # Convertir start_time de ISO string a datetime
        if start_time_str:
            try:
                start_time = datetime.fromisoformat(start_time_str.replace('Z', '+00:00'))
            except (ValueError, AttributeError):
                start_time = timezone.now()
        else:
            start_time = timezone.now()
        
        # Calcular el precio y paquetes usando la función existente
        rute, distance, transfer_info, _, _, _, _, _, price_packages, price_calc = functions.calculeRute(
            start_station_id, 
            end_station_id,
            criterion
        )

        # Allow client to override price/profile by sending them in the request body
        client_price = data.get('price', None)
        client_perfil = data.get('perfil', None)

        # If the client provided a numeric price, prefer it; otherwise fall back to calculated price
        try:
            price = float(client_price) if client_price is not None else (float(price_calc) if price_calc is not None else 0.0)
        except Exception:
            price = float(price_calc) if price_calc is not None else 0.0

        # If a perfil was sent, try to use it when calculating package prices (best-effort)
        if client_perfil:
            # Attempt to compute total from packages using the provided perfil
            try:
                from .assets.functions import get_price_from_packages
                computed_from_packages = get_price_from_packages(price_packages, client_perfil)
                # If computed value is greater than 0, prefer it unless client explicitly sent a price
                if computed_from_packages and client_price is None:
                    price = float(computed_from_packages)
            except Exception:
                pass
        
        # Crear el registro de ruta
        route = Route.objects.create(
            id_start=start_station,
            id_end=end_station,
            price=price,
            criterion=data.get('criterion', 'tiempo'),
            id_user=user,
            start_time=start_time,
            end_time=timezone.now()  # Se guarda al llegar a la última estación
        )
        
        # Calcular duración del viaje
        duration_minutes = (route.end_time - route.start_time).total_seconds() / 60
        
        return JsonResponse({
            'success': True,
            'message': 'Viaje guardado exitosamente',
            'route_id': route.id_route,
            'duration_minutes': round(duration_minutes, 2),
            'start_time': route.start_time.strftime('%H:%M:%S'),
            'end_time': route.end_time.strftime('%H:%M:%S')
        })
        
    except User.DoesNotExist:
        return JsonResponse({
            'success': False,
            'message': 'Usuario no encontrado. Asegúrate de que existe un usuario con pk=1'
        }, status=404)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'Error al guardar el viaje: {str(e)}'
        }, status=500)
