from django.urls import path
from account.views import *

urlpatterns = [
    path('', index, name='index'),
    path('login/', login, name='login'),
]