from django.contrib import admin
from django.urls import path, include
from metroversoApp import views as metroversoViews


urlpatterns = [
    path("i18n/", include("django.conf.urls.i18n")),
    path('admin/', admin.site.urls),
    path('', metroversoViews.map),
    path('view/callRute', metroversoViews.callRute, name='callRute'),
]
