from django.db import models

class User(models.Model):
    PERFIL_CHOICES = [
        ("Frecuente", "Frecuente"),
        ("AdultoMayor", "Adulto Mayor"),
        ("Estudiantil", "Estudiantil"),
        ("PcD", "PcD"),
    ]
    LENGUAJE_CHOICES = [
        ("Español", "Español"),
        ("Ingles", "Inglés"),
    ]
    id_user = models.AutoField(primary_key=True)
    name = models.CharField(max_length=50)
    perfil = models.CharField(max_length=20, choices=PERFIL_CHOICES)
    lenguaje = models.CharField(max_length=10, choices=LENGUAJE_CHOICES, null=True, blank=True)

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
