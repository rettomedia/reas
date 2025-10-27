from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
import secrets
import string
from django.shortcuts import redirect, get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from licensing.models import *
from django.contrib import messages

from licensing.serializers import LicenseSerializer
from dashboard.decorators import service_required


@login_required
@service_required('license_service')
def add_license(request):
    if request.method == 'POST':
        try:
            alphabet = string.ascii_uppercase + string.digits
            license_key = 'LIC-' + ''.join(secrets.choice(alphabet) for i in range(16))

            user_id = request.POST.get('user')

            license_obj = License.objects.create(
                key=license_key,
                user=request.user,
                is_active=True
            )

            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse({
                    'success': True,
                    'message': 'Lisans başarıyla oluşturuldu',
                    'license_key': license_key
                })
            else:
                messages.success(request, f'Lisans başarıyla oluşturuldu: {license_key}')
                return redirect('licensing')

        except Exception as e:
            error_msg = f'Lisans oluşturulurken hata: {str(e)}'
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse({
                    'success': False,
                    'message': error_msg
                })
            else:
                messages.error(request, error_msg)
                return redirect('licensing')

    return JsonResponse({'success': False, 'message': 'Geçersiz istek'})


@login_required
@service_required('license_service')
def edit_license(request, license_id):
    print(f"Edit license called: {license_id}, user: {request.user}")

    try:
        license_obj = License.objects.get(id=license_id, user=request.user)
        print(f"License found: {license_obj.key}")
    except License.DoesNotExist:
        print(f"License not found or access denied: {license_id}")
        user_licenses = License.objects.filter(user=request.user).values('id', 'key')
        print(f"User's licenses: {list(user_licenses)}")

        return JsonResponse({
            'success': False,
            'message': 'Lisans bulunamadı veya erişim izniniz yok'
        })

    if request.method == 'POST':
        try:
            is_active = request.POST.get('is_active') == 'true'
            print(f"Updating license {license_id} is_active to: {is_active}")

            license_obj.is_active = is_active
            license_obj.save()

            return JsonResponse({
                'success': True,
                'message': 'Lisans başarıyla güncellendi'
            })

        except Exception as e:
            print(f"Error updating license: {str(e)}")
            return JsonResponse({
                'success': False,
                'message': f'Lisans güncellenirken hata: {str(e)}'
            })

    return JsonResponse({
        'success': True,
        'license': {
            'id': license_obj.id,
            'key': license_obj.key,
            'is_active': license_obj.is_active,
        }
    })


@login_required
@service_required('license_service')
def delete_license(request, license_id):
    license_obj = get_object_or_404(License, id=license_id)

    if request.method == 'POST':
        try:
            license_key = license_obj.key
            license_obj.delete()

            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse({
                    'success': True,
                    'message': f'Lisans başarıyla silindi: {license_key}'
                })
            else:
                messages.success(request, f'Lisans başarıyla silindi: {license_key}')
                return redirect('licensing')

        except Exception as e:
            error_msg = f'Lisans silinirken hata: {str(e)}'
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse({
                    'success': False,
                    'message': error_msg
                })
            else:
                messages.error(request, error_msg)
                return redirect('licensing')

    return JsonResponse({'success': False, 'message': 'Geçersiz istek'})

@login_required
@service_required('license_service')
def toggle_license(request, license_id):
    try:
        license_obj = License.objects.get(id=license_id, user=request.user)
    except License.DoesNotExist:
        return JsonResponse({
            'success': False,
            'message': 'Lisans bulunamadı veya erişim izniniz yok'
        })

    if request.method == 'POST':
        try:
            license_obj.is_active = not license_obj.is_active
            license_obj.save()

            status = "aktif" if license_obj.is_active else "pasif"

            return JsonResponse({
                'success': True,
                'message': f'Lisans {status} duruma getirildi',
                'is_active': license_obj.is_active
            })

        except Exception as e:
            return JsonResponse({
                'success': False,
                'message': f'Lisans durumu değiştirilirken hata: {str(e)}'
            })

    return JsonResponse({'success': False, 'message': 'Geçersiz istek'})

@api_view(['POST'])
@permission_classes([AllowAny])
@service_required('license_service')
def verify_license(request):
    key = request.data.get('key')

    if not key:
        return Response({
            'valid': False,
            'message': 'Key is required'
        }, status=status.HTTP_400_BAD_REQUEST)

    try:
        license_obj = License.objects.get(key=key)
    except License.DoesNotExist:
        return Response({
            'valid': False,
            'message': 'Key is invalid'
        }, status=status.HTTP_400_BAD_REQUEST)

    if not license_obj.is_active:
        return Response({
            'valid': False,
            'message': 'License is inactive.'
        }, status=status.HTTP_403_FORBIDDEN)

    serializer = LicenseSerializer(license_obj)
    return Response({
        'valid': True,
        'message': 'License is active.',
        'license': serializer.data
    }, status=status.HTTP_200_OK)