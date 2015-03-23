# Stripe-Connect-Parse
Simple E-commerce drop in feature for iOS apps that use Parse

<h2>Introduction</h2>
After several days of working on this problem, my application is finally an e-commerce application to allow for users to become merchants! We won't be using Parse Cloud Code to handle redirect response. But in the future, maybe Parse will come up with a solution for that. Issue was the handling the redirects, which is what the small Django web app will be responsible for. 

<h2>Requirements</h2>
- Django 1.7
- Parse 

<h2>How to run</h2>
Ensure your Django server is running and you have your redirect urls setup correctly, in the iOS app, web server (django), and your Stripe Admin account.

<h2>Getting Started</h2>
First, we will implement the Django Web Server. I recommend you run through the Django tutorial and ensure that you can get through part 4 of the tutorial. This tutorial runs on Django 1.7 but I'm sure lesser versions will be just as compatible.

The web server's purpose is to handle redirecting your ios app to Stripe Connect, receive a response from Stripe Connect (fail or success), handle the response, and open the iOS app again.

Heres what it looks like

```Python
from django.http import HttpResponseRedirect
from rauth.service import OAuth2Service
stripe_connect_service = OAuth2Service(
    name = 'stripe',
    client_id = admin_client_id_key,
    client_secret = admin_publisher_secret_key,
    authorize_url = 'https://connect.stripe.com/oauth/authorize',
    access_token_url = 'https://connect.stripe.com/oauth/token',
    base_url = 'https://api.stripe.com/',
)
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
```

So what happens is when the user taps 'Setup Stripe Account' in the iOS app, it redirects the user to open the web server (in safari, this is required), then calls the 'stripe_auth' function. Once the function is called, the user is send to the Stripe Connect screen at Stripe.com. Once the user fills in there information or rejects linking accounts, Stripe sends the user to the redirect URL you supplied Stripe (which is the web server url, in my case - '127.0.0.1/hotspot/stripe_callback'). Redirecting to that URL automatically calls the method 'stripe_callback' which handles the response, then makes another post to Stripe to receive an access token which needs to be saved to Parse for later use. This token will be used to make any purchases for any user that wants to buy from the current user setting up their Stripe Account. Once we have gotten a token from the POST method, we redirect the user back to the app and let the app handle the response. The response typically has all the tokens that are necessary to make purchases as a user to a merchant/vendor.

You can view how the directory heirarchy in the django web server is setup in the source code.

Also within urls.py, you need to implement what url needs to be sent to Safari to call the methods for the redirects

```Python
	url(r'^stripe_callback/$', views.stripe_callback, name='stripe_callback'),
	url(r'^stripe_auth/$', views.stripe_auth, name='stripe_auth'),
```

Mainly, this just says, when we see stripe_callback or stripe_auth in the url, call the method stripe_callback or stripe_auth. This isnt EXACTLY whats going on but its the gist of it.

Okay now that you have the Web server setup... Lets go to the iOS app...

When te button is pressed to 'Setup Stripe Account' have the action be this:

```Objective-C
[[UIApplication sharedApplication] openURL:[NSURL URLWithString:@"http://127.0.0.1:8000/hotspot/stripe_auth"]];
```

The supplied URL is what I use for development. Whats important here is that we include our django app name, and the method that we need to call.

Once the button is pressed, our web server does its magic.

Now we need to handle this response. Within your App delegate, theres a method to handle the response that is send to the App when it opens from another app, like how we can open the Maps app from an iOS app and pass in coordinates of a location to get directions from or whatever.

So heres what I have in my handleURL method in AppDelegate:

```Objective-C
- (BOOL)application:(UIApplication *)application openURL:(NSURL *)url sourceApplication:(NSString *)sourceApplication annotation:(id)annotation {

    if ([[url scheme] isEqualToString:@"partyhard"]) {
        NSString *query = [[url query] stringByReplacingPercentEscapesUsingEncoding:NSUTF8StringEncoding];
        NSData *data = [query dataUsingEncoding:NSUTF8StringEncoding];
        NSDictionary *json = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
        NSString *errorString = [json objectForKey:@"error"];
        NSString *accessToken = [json objectForKey:@"access_token"];
        NSString *stripePubKey = [json objectForKey:@"stripe_publishable_key"];
        NSString *stripeUserId = [json objectForKey:@"stripe_user_id"];

        if (errorString) {
            NSString *errorDescription = [json objectForKey:@"errorDescription"];
            [[[UIAlertView alloc] initWithTitle:errorString
                                        message:errorDescription
                                       delegate:nil
                              cancelButtonTitle:@"Okay"
                              otherButtonTitles:nil]
             show];
        } else if (accessToken && stripeUserId && stripePubKey){
            [[PFUser currentUser] setObject:accessToken forKey:kPHUserStripeConnectAccessTokenKey];
            [[PFUser currentUser] setObject:stripePubKey forKey:kPHUserStripeConnectPublisherKey];
            [[PFUser currentUser] setObject:stripeUserId forKey:kPHUserStripeConnectUserIdKey];
            [[PFUser currentUser] saveEventually:^(BOOL succeeded, NSError *error) {
                if (!error) {
                    [[[UIAlertView alloc] initWithTitle:@"Success"
                                                message:@"Your Stripe account has been successfully linked! Go ahead and start making some money!" delegate:nil
                                      cancelButtonTitle:@"Okay"
                                      otherButtonTitles:nil]
                     show];
                } else {
                    [PHUtility showErrorForConnection];
                }
            }];
        }
        return YES;
    }
    return NO;
}
```

So here we are basically parsing the response. We first check if the response contains 'error', if it does show an alert. Else parse the tokens that we need and save it to Parse, then show an alert saying success. Once this is done, we have successfuly setup the user to become a merchant and receive transactions.


