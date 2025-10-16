import networkx as nx
from math import sqrt
from copy import deepcopy

from metroversoApp.assets.stationGraphs import G

# Function to determine the pricing package based on the route taken
def get_route_pricing_package(route):
    
    transport_map = {
        'A': 'M',
        'B': 'M',
        'L': 'C',
        'K': 'C',
        'J': 'C',
        'H': 'C',
        'T': 'T',
        'M': 'B',
        'O': 'B',
        'X': 'B',
        'P': 'C',
        'Z': 'C'
    }

    patterns = [
        (['MATBC'], 1),           # MATBC
        (['TB', 'MC'], 1),        # TB + MC
        (['A', 'TB'], 1),         # A + TB
        (['T', 'CM'], 1),         # T + CM
        (['A', 'MC'], 2),         # A + MC
        (['A', 'TB', 'MC'], 2),   # A + TB + MC
        (['A', 'TB', 'A'], 3),    # A + TB + A
        (['A', 'MC', 'A'], 4),    # A + MC + A
        (['A', 'TB', 'MC', 'A'], 4),  # A + TB + MC + A
        (['V'], 0)            # Parque Arví
    ]
    
    price_packages = []
    
    def add_package(working_patterns):
        for pattern_requirements, group_id in working_patterns:
            if pattern_requirements == []:
                price_packages.append(group_id)
                break

    transport_route = []
    for stop in route:
        if stop == 'L01':
            transport_route.append('V') # Parque Arví
        else: 
            first = stop[0].upper()
            transport = transport_map.get(first)
            if transport:
                transport_route.append(transport)

    simplified = []
    for t in transport_route:
        if not simplified or simplified[-1] != t:
            simplified.append(t)
    
    working_patterns = deepcopy(patterns)
    
    i = 0
    
    # Process each transport in the route
    while i < len(simplified):
        current_transport = simplified[i]   
        patterns_to_remove = []

        # Check each pattern to see if current transport satisfies any requirement
        for pattern_requirements, group_id in working_patterns:
            found_match = False
            
            if pattern_requirements == []:
                # Pattern already completed, mark for removal
                patterns_to_remove.append((pattern_requirements, group_id))
            else:
                # Try to match current transport with pattern requirements
                for requirement in pattern_requirements:
                    if current_transport in requirement:
                        pattern_requirements.remove(requirement)
                        found_match = True
                        break
                
                # If no match found, pattern cannot be completed by this route
                if not found_match:
                    patterns_to_remove.append((pattern_requirements, group_id))
        
        if len(working_patterns) == len(patterns_to_remove):
            # There is more than one package that can be used
            add_package(working_patterns)
            working_patterns = deepcopy(patterns)
        else: 
            # Remove completed or impossible patterns
            for pattern_to_remove in patterns_to_remove:
                working_patterns.remove(pattern_to_remove)
            i += 1  # Only move to next transport if some patterns remain
                
    add_package(working_patterns)

    return price_packages

def get_line_from_station(station):
    """
    Extracts the line from a station based on its ID.
    For example: 'A01' -> 'A', 'M05' -> 'M'
    """
    if len(station) >= 2:
        return station[0]  # First letter is the line
    return None

def detect_transfers(route):
    """
    Detects transfer stations in a route.
    Returns a list of stations where line changes are required.
    """
    if len(route) < 2:
        return []
    
    transfers = []
    current_line = get_line_from_station(route[0])
    
    for i in range(1, len(route)):
        station_line = get_line_from_station(route[i])
        if station_line != current_line:
            # Transfer detected at the previous station
            transfers.append(route[i-1])
            current_line = station_line
    
    return transfers

def analyze_route_transfers(route):
    """
    Analyzes a route and provides detailed information about transfers.
    """
    if len(route) < 2:
        return {
            'requires_transfer': False,
            'transfer_count': 0,
            'transfer_stations': [],
            'line_segments': []
        }
    
    transfers = detect_transfers(route)
    line_segments = []
    current_segment = [route[0]]
    current_line = get_line_from_station(route[0])
    
    for i in range(1, len(route)):
        station_line = get_line_from_station(route[i])
        if station_line == current_line:
            current_segment.append(route[i])
        else:
            # Line change
            line_segments.append({
                'line': current_line,
                'stations': current_segment.copy()
            })
            current_segment = [route[i-1], route[i]]  # Include transfer station
            current_line = station_line
    
    # Add last segment
    if current_segment:
        line_segments.append({
            'line': current_line,
            'stations': current_segment
        })
    
    return {
        'requires_transfer': len(transfers) > 0,
        'transfer_count': len(transfers),
        'transfer_stations': transfers,
        'line_segments': line_segments
    }
    
def get_package_price(package, profile):
    try:
        pkg_int = int(package)
    except (TypeError, ValueError):
        return None

    if profile is None:
        return None

    profile_norm = str(profile).strip()

    from metroversoApp.models import Package

    qs = Package.objects.filter(id_package=pkg_int, profile__iexact=profile_norm).values_list('price', flat=True)
    if qs:
        return qs[0]

    return None


def get_price_from_packages(packages, profile):
    
    from metroversoApp.models import Package

    total = 0

    if not packages:
        return 0

    for pkg in packages:
        try:
            # allow numeric or string package ids
            pkg_id = int(pkg)
        except Exception:
            # if it's not an int, try to strip and convert
            try:
                pkg_id = int(str(pkg).strip())
            except Exception:
                continue

        price = get_package_price(pkg_id, profile)
        if price is not None:
            try:
                total += float(price)
            except Exception:
                pass

    return total

def calculeRute(star, destination, criteria, profile='Frecuente'):
    try: 
        print(f"Calculating route from {star} to {destination}")
        print(criteria)
        
        # Check if nodes exist in the graph
        if star not in G.nodes():
            print(f"Error: Start station {star} not found in graph")
            return [], 0, {'requires_transfer': False, 'transfer_count': 0, 'transfer_stations': [], 'line_segments': []}, True, None, False, [], [], [], 0
        
        if destination not in G.nodes():
            print(f"Error: Destination station {destination} not found in graph")
            return [], 0, {'requires_transfer': False, 'transfer_count': 0, 'transfer_stations': [], 'line_segments': []}, True, None, False, [], [], [], 0

        rute = nx.dijkstra_path(G, source=star, target=destination, weight=criteria)
        distance = sum(G[u][v].get("time", 0.0) for u, v in zip(rute, rute[1:]))
        
        # Get route coordinates from the coordinates dictionary
        from metroversoApp.assets.stationGraphs import lineaA, linea1, linea2, lineaL, lineaB, lineaT, lineaZ, lineaJ, lineaH, lineaO, lineaP, lineaK
        
        # Combine all coordinate dictionaries
        all_coords = {**lineaA, **linea1, **linea2, **lineaL, **lineaB, **lineaT, **lineaZ, **lineaJ, **lineaH, **lineaO, **lineaP, **lineaK}
        
        rute_coords = []
        for n in rute:
            if n in all_coords:
                rute_coords.append(all_coords[n])
            else:
                print(f"Warning: Station {n} not found in coordinates")
                rute_coords.append([0, 0])  # Fallback coordinates

        # Analyze transfers
        transfer_info = analyze_route_transfers(rute)

        # Get transfer coordinates
        transfer_coords = []
        for station in transfer_info['transfer_stations']:
            if station in all_coords:
                transfer_coords.append(all_coords[station])
            else:
                print(f"Warning: Transfer station {station} not found in coordinates")
                transfer_coords.append([0, 0])  # Fallback
        # Determine price packages and total price
        price_packages = get_route_pricing_package(rute)
        price = get_price_from_packages(price_packages, profile)

        print("Rute:", rute)
        print("Distance:", round(distance, 2), "minutes")
        print("Price packages:", price_packages)
        print("Price:", price)
        print("Transfer info:", transfer_info)
        print("Rute_coords:", rute_coords)
        print("Transfer_coords:", transfer_coords)
        
        # Check if the trip can be made according to the schedule
        from metroversoApp.assets.stationGraphs import can_make_trip_now_graph, get_current_service_hours, get_arvi_service_hours
        
        # Check if route includes Arvi station (L01)
        uses_arvi_station = 'L01' in rute
        can_make_trip = can_make_trip_now_graph(G, star, destination)
        
        # Get service hours information
        if uses_arvi_station:
            service_hours = get_arvi_service_hours()
        else:
            service_hours = get_current_service_hours()
        
    except nx.NetworkXNoPath:
        print("No path found between the specified nodes.")
        rute = []
        distance = 0
        transfer_info = {
            'requires_transfer': False,
            'transfer_count': 0,
            'transfer_stations': [],
            'line_segments': []
        }
        rute_coords = []
        can_make_trip = False
        service_hours = None
        uses_arvi_station = False
        transfer_coords = []
        price_packages = []
        price = 0
        
    except Exception as e:
        print(f"Error in calculeRute: {e}")
        rute = []
        distance = 0
        transfer_info = {
            'requires_transfer': False,
            'transfer_count': 0,
            'transfer_stations': [],
            'line_segments': []
        }
        rute_coords = []
        can_make_trip = False
        service_hours = None
        uses_arvi_station = False
        transfer_coords = []
        price_packages = []
        price = 0

    return list(rute), distance, transfer_info, can_make_trip, service_hours, uses_arvi_station, rute_coords, transfer_coords, price_packages, price
