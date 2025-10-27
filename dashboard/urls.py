from django.urls import path
from django.contrib.auth import views as auth_views

from .views import *

urlpatterns = [
    path('', index, name='dashboard'),
    path('licensing/', licensing, name='licensing'),
    path('logout/', auth_views.LogoutView.as_view(), name='logout'),
    path('assistant/', assistant, name='assistant'),
]