import networkx as nx
from math import sqrt


from metroversoApp.assets.stationGraphs import G

def rute(G, origen, destino):
    try: 
        rute = nx.dijkstra_path(G, source="A01", target="A20", weight="weight")
        distance = nx.dijkstra_path_length(G, source="A01", target="A20", weight="weight")

        print("Rute:", rute)
        print("Distance:", round(distance, 2), "meters")
    except nx.NetworkXNoPath:
        print("No path found between the specified nodes.")
        rute = []
        distance = 0

    return rute, distance