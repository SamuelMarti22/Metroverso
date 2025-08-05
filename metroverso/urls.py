from django.contrib import admin
from django.urls import path
from metroversoApp import views as metroversoViews
from . import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', metroversoViews.map),
]
