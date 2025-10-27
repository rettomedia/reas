from django.shortcuts import render
from django.contrib.auth.decorators import login_required
from licensing.models import License

import requests

@login_required
def index(request):
    licenses = License.objects.filter(user=request.user)
    active_licenses = License.objects.filter(is_active=True, user=request.user)

    whatsapp_data = {}
    try:
        response = requests.get("http://0.0.0.0:3000/api/status", timeout=3)
        whatsapp_data = response.json()
    except Exception as e:
        print(f"API Error: {e}")
        whatsapp_data = {
            "state": {
                "isReady": False,
                "isAuthenticated": False,
                "qrCode": None,
                "isConnecting": False,
            }
        }

    state = whatsapp_data.get("state", {})

    return render(request, 'dashboard/index.html', {
        'licenses': licenses,
        'active_licenses': active_licenses,
        "is_ready": state.get("isReady", False),
        "is_authenticated": state.get("isAuthenticated", False),
        "qr_code": state.get("qrCode"),
        "is_connecting": state.get("isConnecting", False),
    })