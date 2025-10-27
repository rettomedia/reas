from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.contrib import messages
from django.db.models import Q, Count
from django.contrib.auth import get_user_model
from licensing.models import *
from dashboard.decorators import service_required

User = get_user_model()

@login_required
@service_required('license_service')
def licensing(request):
    search_query = request.GET.get('search', '')
    status_filter = request.GET.get('status', '')

    licenses = License.objects.all().select_related('user')

    if search_query:
        licenses = licenses.filter(
            Q(key__icontains=search_query) |
            Q(user__username__icontains=search_query)
        )

    if status_filter == 'active':
        licenses = licenses.filter(is_active=True)
    elif status_filter == 'inactive':
        licenses = licenses.filter(is_active=False)
    elif status_filter == 'assigned':
        licenses = licenses.filter(user__isnull=False)
    elif status_filter == 'unassigned':
        licenses = licenses.filter(user__isnull=True)

    stats = License.objects.aggregate(
        total_licenses=Count('id'),
        active_licenses=Count('id', filter=Q(is_active=True)),
        inactive_licenses=Count('id', filter=Q(is_active=False)),
        assigned_licenses=Count('id', filter=Q(user__isnull=False))
    )

    users = User.objects.filter(is_active=True)

    context = {
        'licenses': licenses,
        'total_licenses_count': stats['total_licenses'],
        'active_licenses_count': stats['active_licenses'],
        'inactive_licenses_count': stats['inactive_licenses'],
        'assigned_licenses_count': stats['assigned_licenses'],
        'users': users,
        'search_query': search_query,
        'status_filter': status_filter,
    }
    return render(request, 'dashboard/licensing.html', context)