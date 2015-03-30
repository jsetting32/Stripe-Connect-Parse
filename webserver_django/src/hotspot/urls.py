from django.conf.urls import patterns, url
from hotspot import views

urlpatterns = patterns('',
	url(r'^privacy/$', views.privacy, name='privacy'),
	url(r'^terms/$', views.terms, name='terms'),
	url(r'^stripe_callback/$', views.stripe_callback, name='stripe_callback'),
	url(r'^stripe_auth/$', views.stripe_auth, name='stripe_auth'),
)