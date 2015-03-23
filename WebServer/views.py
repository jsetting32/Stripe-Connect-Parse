from django.http import HttpResponse
from django.template import RequestContext, loader
from HotSpot.models import User
from rauth.service import OAuth2Service
from django.http import HttpResponseRedirect
from django.shortcuts import redirect

import json

stripe_connect_service = OAuth2Service(
    name = 'stripe',
    client_id = '',
    client_secret = '',
    authorize_url = 'https://connect.stripe.com/oauth/authorize',
    access_token_url = 'https://connect.stripe.com/oauth/token',
    base_url = 'https://api.stripe.com/',
)

def index(request):
    latest_user_list = User.objects.order_by('-createdAt')[:5]
    template = loader.get_template('user/index.html')
    context = RequestContext(request, {
        'latest_user_list': latest_user_list,
    })
    return HttpResponse(template.render(context))

def stripe_auth(request):
    params = {'response_type': 'code', 'scope': 'read_write'}
    url = stripe_connect_service.get_authorize_url(**params)
    return HttpResponseRedirect(url)

def stripe_callback(request):
    # the temporary code returned from stripe
    code = request.GET['code']
    # identify what we are going to ask for from stripe
    data = {
        'grant_type': 'authorization_code',
        'code': code
    }
 
    # Get the access_token using the code provided
    resp = stripe_connect_service.get_raw_access_token(method='POST', data=data)
 
    # process the returned json object from stripe
    stripe_payload = json.loads(resp.text)
 
    scheme = 'partyhard://?' + json.dumps(stripe_payload)
    response = HttpResponse("", status=302)
    response['Location'] = scheme
    return response

def detail(request, user_id):
    return HttpResponse("You're looking at user %s." % user_id)

def results(request, user_id):
    response = "You're looking at the results of user %s."
    return HttpResponse(response % user_id)

def vote(request, question_id):
    return HttpResponse("You're voting on question %s." % question_id)