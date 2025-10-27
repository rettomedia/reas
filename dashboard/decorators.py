from django.shortcuts import redirect
from functools import wraps
from django.contrib import messages


def service_required(service_name):
    def decorator(view_func):
        @wraps(view_func)
        def _wrapped_view(request, *args, **kwargs):
            if not request.user.is_authenticated:
                return redirect('login')

            if not getattr(request.user, service_name, False):
                messages.warning(
                    request,
                    f"Bu servise erişim yetkiniz yok: {service_name.replace('_', ' ').title()}"
                )
                return redirect('dashboard')

            return view_func(request, *args, **kwargs)

        return _wrapped_view

    return decorator