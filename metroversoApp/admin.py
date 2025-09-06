from django.contrib import admin
from .models import User, Station, Route, Package

admin.site.register(User)
admin.site.register(Station)
admin.site.register(Route)
admin.site.register(Package)
