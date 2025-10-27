from django.contrib.auth import authenticate
from django.contrib.auth import login as logg
from django.shortcuts import render, redirect
from django.contrib import messages


def login(request):
    if request.user.is_authenticated:
        return redirect('dashboard')
    else:
        if request.method == 'POST':
            username = request.POST.get('username')
            password = request.POST.get('password')
            user = authenticate(request, username=username, password=password)

            if user is not None:
                logg(request, user)
                return redirect('dashboard')
            else:
                messages.error(request, 'Kullanıcı adı ve şifre uyuşmuyor')

        return render(request, 'account/login.html')