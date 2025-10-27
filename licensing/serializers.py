from rest_framework import serializers
from licensing.models import *

class LicenseSerializer(serializers.ModelSerializer):
    class Meta:
        model = License
        fields = ['id','key','user','is_active','created_at','updated_at']