from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
	list_display = (
		'username',
		'email',
		'role',
		'department',
		'is_staff'
	)

	list_filter = (
		'role',
		'department',
		'is_staff',
		'is_superuser'
	)

	fieldsets = UserAdmin.fieldsets + (
		('Служебная информация отдела', {'fields': ('role', 'department')}),
	)
