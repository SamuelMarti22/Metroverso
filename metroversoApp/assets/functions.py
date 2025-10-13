import networkx as nx
from math import sqrt

from metroversoApp.assets.stationGraphs import G

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

def calculeRute(star, destination, criteria):

    try: 
        print(f"Calculating route from {star} to {destination}")
        print(criteria)
        
        # Check if nodes exist in the graph
        if star not in G.nodes():
            print(f"Error: Start station {star} not found in graph")
            return [], 0, {'requires_transfer': False, 'transfer_count': 0, 'transfer_stations': [], 'line_segments': []}, True, None, False, [], []
        
        if destination not in G.nodes():
            print(f"Error: Destination station {destination} not found in graph")
            return [], 0, {'requires_transfer': False, 'transfer_count': 0, 'transfer_stations': [], 'line_segments': []}, True, None, False, [], []
        
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

        print("Rute:", rute)
        print("Distance:", round(distance, 2), "minutes")
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

    return list(rute), distance, transfer_info, can_make_trip, service_hours, uses_arvi_station, rute_coords, transfer_coords
