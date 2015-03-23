import datetime

from django.db import models
from django.utils import timezone
from django.core.validators import validate_email

class jsObject(models.Model):
	createdAt = models.DateTimeField('createdAt')
	updatedAt = models.DateTimeField('updatedAt')

	class Meta:
		abstract = True

class User(jsObject):
	username = models.CharField(unique=True, max_length=200, null=False, blank=False)
	firstname = models.CharField(max_length=200, null=False, blank=False)
	lastname = models.CharField(max_length=200, null=False, blank=False)
	#email = models.CharField(unique=True, max_length=200, validate_email=True)

	def __str__(self):
		return self.username

class Event(jsObject):
	title = models.CharField(max_length=200, null=False, blank=False, unique=True)
	host = models.ForeignKey(User)

	"""
	def was_recently_published(super):
        return super(Event, self).createdAt >= timezone.now() - datetime.timedelta(days=1)
	"""
	
	def __str__(self):
		return self.title
