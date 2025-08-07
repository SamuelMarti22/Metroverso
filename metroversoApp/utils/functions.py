import networkx as nx
from math import sqrt

from metroversoApp.assets.stationGraphs import G

def calculeRute(star, destination):
    try: 
        rute = nx.dijkstra_path(G, source=star, target=destination, weight="weight")
        distance = nx.dijkstra_path_length(G, source=star, target=destination, weight="weight")

        print("Rute:", rute)
        print("Distance:", round(distance, 2)*100, "kilometers")
    except nx.NetworkXNoPath:
        print("No path found between the specified nodes.")
        rute = []
        distance = 0

    return list(rute),distance