from django.contrib import admin
from django.urls import path, include
from metroversoApp import views as metroversoViews
from metroversoApp.views import dashboard


urlpatterns = [
    path("i18n/", include("django.conf.urls.i18n")),
    path('admin/', admin.site.urls),
    path('', metroversoViews.map, name='map'),
    path('view/callRute', metroversoViews.callRute, name='callRute'),
    path('view/getServiceHours', metroversoViews.getServiceHours, name='getServiceHours'),
    path('dashboard/', dashboard, name='dashboard'),
    path('save-journey/', metroversoViews.save_journey, name='save_journey'),
    
    # URLs de Autenticación
    path('auth/register/', metroversoViews.register_view, name='register'),
    path('auth/login/', metroversoViews.login_view, name='login'),
    path('auth/logout/', metroversoViews.logout_view, name='logout'),
    path('auth/profile/', metroversoViews.profile_view, name='profile'),
    path('auth/profile-data/', metroversoViews.profile_data_view, name='profile_data'),
    path('station/<str:station_id>/', metroversoViews.station_info, name='station_info'),
    path('stations-with-data/', metroversoViews.stations_with_data, name='stations_with_data'),
    
    # URLs del Blog
    path('blog/', metroversoViews.blog_view, name='blog'),
    path('blog/delete/<int:post_id>/', metroversoViews.delete_blog_post, name='delete_blog_post'),
]
