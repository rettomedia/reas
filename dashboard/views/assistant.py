from django.contrib.auth.decorators import login_required
from django.shortcuts import render
from dashboard.decorators import service_required


@login_required
@service_required('whatsapp_service')
def assistant(request):
    return render(request, "dashboard/assistant.html")
