from django.contrib import admin
from HotSpot.models import User, Event

#We are simply changing the ordering of the admin User form
class UserAdmin(admin.ModelAdmin):
	#We are simply changing the ordering of the admin User form
	#fields = ['username', 'firstname', 'lastname', 'createdAt', 'updatedAt']

	#We are now grouping the form
	fieldsets = [ 
					('Basic Information', {'fields': ['username', 'firstname', 'lastname']}),
					('Date Information', {'fields': ['createdAt', 'updatedAt'], 'classes': ['collapse']})
				]


class EventAdmin(admin.ModelAdmin):
	fieldsets = [ 
					('Basic Information', {'fields': ['title', 'host']}),
					('Date Information', {'fields': ['createdAt', 'updatedAt'], 'classes': ['collapse']})
				]

admin.site.register(User, UserAdmin)
admin.site.register(Event, EventAdmin)
