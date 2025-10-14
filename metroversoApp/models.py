from django.db import models
from django.contrib.auth.models import User as DjangoUser

from django.utils import timezone
from datetime import timedelta

class User(models.Model):

    PERFIL_CHOICES = [
        ("Frecuente", "Frecuente"),
        ("AdultoMayor", "Adulto Mayor"),
        ("Estudiantil", "Estudiantil"),
        ("PcD", "PcD"),
        ("Eventual", "Al portador y eventual"),
    ]
    LENGUAJE_CHOICES = [
        ("Español", "Español"),
        ("Ingles", "Inglés"),
    ]
    
    id_user = models.AutoField(primary_key=True)
    django_user = models.OneToOneField(DjangoUser, on_delete=models.CASCADE, related_name='metro_profile', null=True, blank=True)
    name = models.CharField(max_length=50)
    perfil = models.CharField(max_length=20, choices=PERFIL_CHOICES)
    lenguaje = models.CharField(max_length=10, choices=LENGUAJE_CHOICES, null=True, blank=True)
    
    def __str__(self):
        return f"{self.name} - {self.perfil}"

class Station(models.Model):
    TYPE_CHOICES = [
        ("metro", "Metro"),
        ("cable", "Cable"),
        ("bus", "Bus"),
        ("tranvia", "Tranvia"),
        ("metroplus", "Metroplus"),
    ]
    id_station = models.CharField(max_length=3, primary_key=True)
    name = models.CharField(max_length=30)
    line = models.CharField(max_length=1)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)

class Route(models.Model):
    CRITERION_CHOICES = [
        ("precio", "Precio"),
        ("tiempo", "Tiempo"),
    ]
    id_route = models.AutoField(primary_key=True)
    id_start = models.ForeignKey(Station, related_name='start_routes', on_delete=models.CASCADE)
    id_end = models.ForeignKey(Station, related_name='end_routes', on_delete=models.CASCADE)
    price = models.FloatField()
    criterion = models.CharField(max_length=20, choices=CRITERION_CHOICES)
    id_user = models.ForeignKey(User, on_delete=models.CASCADE)
    start_time = models.DateTimeField(default=timezone.now)
    end_time = models.DateTimeField(null=True, blank=True)
    
    def is_expired(self):
        """Verifica si la ruta tiene más de un mes"""
        return timezone.now() - self.start_time > timedelta(days=30)
    
    @classmethod
    def delete_expired_routes(cls):
        """Elimina rutas con más de un mes de antigüedad"""
        expiration_date = timezone.now() - timedelta(days=30)
        expired_routes = cls.objects.filter(start_time__lt=expiration_date)
        count = expired_routes.count()
        expired_routes.delete()
        return count

class Package(models.Model):
    PERFIL_CHOICES = [
        ("Frecuente", "Frecuente"),
        ("AdultoMayor", "Adulto Mayor"),
        ("Estudiantil", "Estudiantil"),
        ("PcD", "PcD"),
        ("Eventual","Eventual"),
    ]
    id_package = models.IntegerField()
    perfil = models.CharField(max_length=20, choices=PERFIL_CHOICES)
    price = models.FloatField()
    class Meta:
        unique_together = ('id_package', 'perfil')




class BlogPost(models.Model):
    POST_TYPES = [
        ('route', 'Shared Route'),
        ('comment', 'General Comment'),
    ]
    
    id = models.AutoField(primary_key=True)
    author = models.ForeignKey(DjangoUser, on_delete=models.CASCADE, related_name='blog_posts')
    post_type = models.CharField(max_length=10, choices=POST_TYPES)
    title = models.CharField(max_length=200)
    content = models.TextField()
    shared_route = models.ForeignKey(Route, on_delete=models.CASCADE, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def get_metro_profile(self):
        try:
            return self.author.metro_profile
        except User.DoesNotExist:
            return None
    
    def __str__(self):
        return f"{self.title} - {self.author.username}"


class PointOfInterest(models.Model):
    CATEGORY_CHOICES = [
        ('restaurant', 'Restaurant'),
        ('shop', 'Shop'),
        ('bank', 'Bank'),
        ('pharmacy', 'Pharmacy'),
        ('hospital', 'Hospital'),
        ('hotel', 'Hotel'),
        ('gas_station', 'Gas Station'),
        ('entertainment', 'Entertainment'),
        ('other', 'Other'),
    ]
    
    id = models.AutoField(primary_key=True)
    author = models.ForeignKey(DjangoUser, on_delete=models.CASCADE, related_name='points_of_interest')
    station = models.ForeignKey(Station, on_delete=models.CASCADE, related_name='nearby_points')
    name = models.CharField(max_length=100)
    description = models.TextField()
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    address = models.CharField(max_length=200, blank=True)
    distance_from_station = models.CharField(max_length=50, blank=True)  # "50m", "2 blocks"
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['station', 'name']
    
    def get_metro_profile(self):
        try:
            return self.author.metro_profile
        except User.DoesNotExist:
            return None
    
    def __str__(self):
        return f"{self.name} (near {self.station.name})"


class StationService(models.Model):
    SERVICE_TYPES = [
        ('restroom', 'Restrooms'),
        ('wifi', 'WiFi'),
        ('atm', 'ATM'),
        ('ticket_office', 'Ticket Office'),
        ('accessibility', 'Accessibility Features'),
        ('commercial', 'Commercial Area'),
        ('parking', 'Parking'),
        ('security', 'Security'),
        ('elevator', 'Elevator'),
        ('escalator', 'Escalator'),
        ('phone', 'Public Phone'),
        ('lost_found', 'Lost & Found'),
        ('information', 'Information Desk'),
        ('first_aid', 'First Aid'),
    ]
    
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('maintenance', 'Under Maintenance'),
        ('coming_soon', 'Coming Soon'),
    ]
    
    id = models.AutoField(primary_key=True)
    station = models.ForeignKey(Station, on_delete=models.CASCADE, related_name='services')
    service_type = models.CharField(max_length=20, choices=SERVICE_TYPES)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='active')
    description = models.TextField(blank=True)
    hours = models.CharField(max_length=100, blank=True, default="6:00-23:00")
    floor = models.CharField(max_length=20, blank=True)  # "Ground", "Mezzanine", "Platform"
    notes = models.TextField(blank=True)
    last_updated = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['station', 'service_type']
        ordering = ['station', 'service_type']
    
    def __str__(self):
        return f"{self.station.name} - {self.get_service_type_display()}"
