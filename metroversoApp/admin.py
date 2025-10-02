from django.contrib import admin
from .models import User, Station, Route, Package, BlogPost, PointOfInterest, StationService

# Registro de modelos básicos
admin.site.register(User)
admin.site.register(Station)
admin.site.register(Route)
admin.site.register(Package)
admin.site.register(BlogPost)
admin.site.register(PointOfInterest)
admin.site.register(StationService)
