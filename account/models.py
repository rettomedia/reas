from django.db import models
from django.contrib.auth.models import AbstractUser


# Create your models here.
class CustomUser(AbstractUser):
    whatsapp_service = models.BooleanField(default=False)
    license_service = models.BooleanField(default=False)
    email_service = models.BooleanField(default=False)

    def __str__(self):
        if self.username is None:
            return self.get_full_name()
        else:
            return self.username