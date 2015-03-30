from django.http import HttpResponse, HttpResponseRedirect
from django.conf import settings
from rauth.service import OAuth2Service
import json

stripe_connect_service = OAuth2Service(
    name = 'stripe',
    client_id = '',
    client_secret = '',
    authorize_url = 'https://connect.stripe.com/oauth/authorize',
    access_token_url = 'https://connect.stripe.com/oauth/token',
    base_url = 'https://api.stripe.com/',
)

def terms(request):
    with open(settings.STATIC_ROOT + '/images/hotspot_privacy.pdf', 'r') as pdf:
        response = HttpResponse(pdf.read(), content_type='application/pdf')
        response['Content-Disposition'] = 'inline;filename=some_file.pdf'
        return response
    pdf.closed

def privacy(request):
    with open(settings.STATIC_ROOT + '/images/hotspot_privacy.pdf', 'r') as pdf:
        response = HttpResponse(pdf.read(), content_type='application/pdf')
        response['Content-Disposition'] = 'inline;filename=some_file.pdf'
        return response
    pdf.closed

def stripe_auth(request):
    params = {'response_type': 'code', 'scope': 'read_write'}
    url = stripe_connect_service.get_authorize_url(**params)
    return HttpResponseRedirect(url)


def stripe_callback(request):
    code = request.GET['code']
    data = {
        'grant_type': 'authorization_code',
        'code': code
    }
 
    resp = stripe_connect_service.get_raw_access_token(method='POST', data=data)
    stripe_payload = json.loads(resp.text)
 
    scheme = 'partyhard://?' + json.dumps(stripe_payload)
    response = HttpResponse("", status=302)
    response['Location'] = scheme
    return response
