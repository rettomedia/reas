from django.urls import path
from licensing.views import *

urlpatterns = [
    path('add/', add_license, name='add_license'),
    path('<int:license_id>/edit/', edit_license, name='edit_license'),
    path('<int:license_id>/delete/', delete_license, name='delete_license'),
    path('<int:license_id>/toggle/', toggle_license, name='toggle_license'),
    path('verify/', verify_license, name='verify_license'),
]