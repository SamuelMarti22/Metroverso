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

def calculeRute(star, destination):
    try: 
        rute = nx.dijkstra_path(G, source=star, target=destination, weight="weight")
        distance = nx.dijkstra_path_length(G, source=star, target=destination, weight="weight")

        # Analyze transfers
        transfer_info = analyze_route_transfers(rute)

        # Check if the trip can be made according to the schedule
        from metroversoApp.assets.stationGraphs import can_make_trip_now_graph
        can_make_trip = can_make_trip_now_graph(G, star, destination)

        print("Rute:", rute)
        print("Distance:", round(distance, 2)*100, "kilometers")
        print("Transfer info:", transfer_info)

        
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
        can_make_trip = False

    return list(rute), distance, transfer_info, can_make_trip