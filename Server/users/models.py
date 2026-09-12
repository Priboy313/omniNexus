from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):

	class Role(models.TextChoices):
		ADMIN = "admin", "Администратор"
		LEAD = "lead", "Тимлид"
		TESTER = "tester", "Тестировщик"
		DEV = "dev", "Разработчик"
		VIEWER = "viewer", "Наблюдатель"

	role = models.CharField(
		max_length=20,
		choices=Role.choices,
		default=Role.VIEWER,
		verbose_name="Роль"
	)

	department = models.CharField(
		max_length=100,
		blank=True,
		default="",
		verbose_name="Подразделение"
	)

	def __str__(self):
		return f"{self.username}"