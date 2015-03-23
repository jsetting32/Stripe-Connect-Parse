from django.conf.urls import patterns, url

from HotSpot import views

urlpatterns = patterns('',
	# ex: /polls/
    url(r'^$', views.index, name='index'),
    # ex: /polls/5/
    url(r'^(?P<user_id>\d+)/$', views.detail, name='detail'),
    # ex: /polls/5/results/
    url(r'^(?P<user_id>\d+)/results/$', views.results, name='results'),
	# ex: /polls/stripe_callback/
	url(r'^stripe_callback/$', views.stripe_callback, name='stripe_callback'),
	# ex: /polls/stripe_auth/
	url(r'^stripe_auth/$', views.stripe_auth, name='stripe_auth'),
)