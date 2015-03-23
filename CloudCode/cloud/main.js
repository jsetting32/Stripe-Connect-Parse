var Stripe = require('stripe');
var adminStripeKey = ''

var Mandrill = require('mandrill.js');
Mandrill.initialize('');


Parse.Cloud.define("chargeCard", function(request, response) {
    
    var transaction;
    var eventObject = request.params.eventObject;
    var currentUser = Parse.User.current();
    var vendor;

    Parse.Promise.as().then(function() {
        // First we retrieve the event object since passing PFObjects arent allowed in cloud code
        var query = new Parse.Query('Event');
        query.include('vendor');
    
        return query.get(eventObject).then(null, function(error) {
            // We failed to retrieve the event to get data from.
            console.log('Retrieving event object failed. Error: ' + error);
            return Parse.Promise.error('An error has occurred. Your credit card was not charged.');
        });

    }).then(function(result) {

        eventObject = result;
        vendor = eventObject.get('vendor');

        // Now that we have the event object,
        // We can create the transaction object
        transaction = new Parse.Object('Transaction');
        transaction.set('user', currentUser);
        transaction.set('event', eventObject);
        transaction.set('numberOfTickets', request.params.numberOfTickets);
        transaction.set('vendor', vendor);
        transaction.set('status', 'uncharged');

        // Save the transaction object but we will be using it later
        return transaction.save().then(null, function(error) {
            // This would be a good place to replenish the quantity we've removed.
            // We've ommited this step in this app.
            console.log('Creating order object failed. Error: ' + error);
            return Parse.Promise.error('An error has occurred. Your credit card was not charged.');
        });

    }).then(function(result) {
        // We dont exactly need the result of the previous promise
        // Now we generate the URL to hit the Stripe API to get the one-time use token to make a purchase
        var customerId = currentUser.get('stripeCustomerId');
        var accessToken = vendor.get('stripeAccessToken');
        var tokenURL = 'https://'+accessToken+':@api.stripe.com/v1/tokens';
        return retrieveToken(tokenURL, customerId).then(null, function(error) {
            // If we had an error returned from Stripe, log it and return the app the response
            console.log('Creating token with stripe failed. Error: ' + error);
            return Parse.Promise.error('An error has occurred. Your credit card was not charged.');
        });

    }).then(function(result) {

        // Now we have the response from Stripe,
        // It isn't exactly nicely formatted and we need to get the token id
        // So heres how its done
        var token = (JSON.parse(result.text)).id;
        var price = eventObject.get('price') * request.params.numberOfTickets * 100;

        // Now initialize the Stripe module to be the vendors accesstoken
        Stripe.initialize(vendor.get('stripeAccessToken'));

        // Now we can charge the credit card using the vendors access token, customer's id, and the returned stripe token
        return Stripe.Charges.create({
            amount: price,
            currency: 'usd',
            source: token,
            application_fee: price * .05, // We take 5% commission
        }).then(null, function(error) {
            console.log('Charging with stripe failed. Error: ' + error);
            return Parse.Promise.error('An error has occurred. Your credit card was not charged.');
        });

    }).then(function(purchase) {

          // Credit card charged! Now we save the ID of the purchase on our
          // order and mark it as 'charged'.
          transaction.set('stripePaymentId', purchase.id);
          transaction.set('status', 'charged');

          // Save updated order
          return transaction.save().then(null, function(error) {
              // This is the worst place to fail since the card was charged but the order's
              // 'charged' field was not set. Here we need the user to contact us and give us
              // details of their credit card (last 4 digits) and we can then find the payment
              // on Stripe's dashboard to confirm which order to rectify. 
              console.log('Saving transaction to Parse failed. Error: ' + error);
              return Parse.Promise.error('A critical error has occurred with your order. Please ' + 
                                         'contact jsetting32@yahoo.com at your earliest convinience. ');
          });

    }).then(function(transaction) {
    
        // Credit card charged and order item updated properly!
        // We're done, so let's send an email to the user.

        // Generate the email body string.
        var body = "We've received and processed your order for the following event: \n\n" +
                   "Event: " + eventObject.get('title') + "\n";

        var total = parseInt(eventObject.get('price')) * request.params.numberOfTickets;

        body += "Location:\n" + eventObject.get('formattedLocation') + "\n\n";
        body += "\nPrice: $" + eventObject.get('price') + ".00 x " + request.params.numberOfTickets + 
                "\n\nTotal: $" + total +  
                "\n\n\n\nHere is the id for your purchase. Show this to the event host when asked.\n" + 
                "Purchase Id: " + transaction.get('stripePaymentId') + 
                "\n\n\n\nLet us know if you have any questions!\n\n" +
                "Thank you,\n" +
                "The HotSpot Team";

        var message = {
                text: body,
                subject: 'Your ticket(s) purchase for ' + eventObject.get('title') + ' was successful!',
                from_email: 'crossbook32@gmail.com',
                from_name: "HotSpot",
                to: [{
                    email: currentUser.get('email'),
                    name: currentUser.get('displayName'),
                }]
            };

        return sendMandrillEmailPromise(message).then(null, function(error) {
            console.log('Sending email failed. Error: ' + error);
            return Parse.Promise.error('Your purchase was successful, but we were not able to ' +
                                       'send you an email. Contact us at jsetting32@yahoo.com if ' +
                                       'you have any questions.');
        });

    }).then(function() {

        // Now we send an email to the vendor
        // Generate the email body string.
        var body = "We've processed a ticket order for the following event: \n\n" +
                   "Event: " + eventObject.get('title') + "\n";

        var total = eventObject.get('price') * request.params.numberOfTickets;

        body += "\nPrice: $" + eventObject.get('price') + ".00 x " + request.params.numberOfTickets + 
                "\n\nTotal: $" + total +  
                "\n\n\n\nHere is the id for the purchase.\n" + 
                "Purchase Id: " + transaction.get('stripePaymentId') + 
                "\n\n\n\nLet us know if you have any questions!\n\n" +
                "Thank you,\n" +
                "The HotSpot Team";

        var message = {
                text: body,
                subject: currentUser.get('displayName') + ' bought ticket(s) for ' + eventObject.get('title') + ' was successful!',
                from_email: 'crossbook32@gmail.com',
                from_name: "HotSpot",
                to: [{
                    email: vendor.get('email'),
                    name: vendor.get('displayName'),
                }]
            };

        return sendMandrillEmailPromise(message).then(null, function(error) {
            console.log('Sending email failed. Error: ' + error);
            return Parse.Promise.error('Your purchase was successful, but we were not able to ' +
                                       'send an email to the vendor. Contact us at jsetting32@yahoo.com if ' +
                                       'you have any questions.');
        });

    }).then(function() {
        // And we're done!
        response.success('Success');
    }, function(error) {
        // Any promise that throws an error will propagate to this handler.
        // We use it to return the error from our Cloud Function using the 
        // message we individually crafted based on the failure above.
        response.error(error);
    });

});

/* Send Email
 * We want to send an email
 * Mandrill is tricker than Mailgun
 * It doesnt allow for promises out of the box
 * So we need to do this differently
 */
var sendMandrillEmailPromise = function(message){
    var promise = new Parse.Promise();
    Mandrill.sendEmail({
        message: message,
        async: true,
    },{
        success: function(httpResponse) {
            promise.resolve(httpResponse);
        },
        error: function(error) {
            promise.error(error);
        }
    });
    return promise;
}

/* Retrieve Token
 * We simply need to receive from Stripe a token given the customer's Id
 * Parse doesn't have this method within their Stripe Module so we 
 * need to do a little hacking.
 * We create an httpRequest, hit the Stripe API and receive a token back
 */
var retrieveToken = function(url, customerId) {
    var promise = new Parse.Promise();
    Parse.Cloud.httpRequest({
        method: 'POST',
        url: url, 
        header: 'content-type: application/json',
        body: {'customer' : customerId},
        success: function(httpResponse) {
            promise.resolve(httpResponse);
        },
        error: function(httpResponse) {
            promise.reject(httpResponse);
        }
    });
    return promise;
}

/*
 * Retrieve Card
 * Simply gets the user's card information.
 * We only receive the last 4 digits of the card number, the exp date, and CVC
 */
Parse.Cloud.define("retrieveCard", function(request, response) {
    Parse.Promise.as().then(function() {
        var currentUser = Parse.User.current();
        var customerId = currentUser.get('stripeCustomerId');
        Stripe.initialize(adminStripeKey);
        return Stripe.Customers.retrieve(customerId).then(null, function(error) {
            console.log('Queryig for customer card with stripe failed. Error: ' + error);
            return Parse.Promise.error('An error has occurred. Your credit card information was not found. Please try again by reloading the view!');
        });
    }).then(function(customer) {
        response.success(customer);
    }, function(err) {
        response.error(err);
    });
});


/* 
 * Save Card
 * Here we save the card so they can make transactions with it later.
 * We save the card to the Admin account, not the vendor and use the 
 * 'Shared Customer' feature Stripe has.
 */
Parse.Cloud.define("saveCard", function(request, response) {

    // We should have been passed in the token generated from Stripe when the user entered their card information
    // View your code in Xcode to verify your actually receiving a token.
    var currentUser = Parse.User.current();
    var customerId = currentUser.get('stripeCustomerId');
    var cardToken = request.params.token;

    // Now make a promise
    Parse.Promise.as().then(function() {

        // Here we check if the current user has already registered their card and is just creating a new one
        // If there creating/updating their card, we just run Stripe's Update
        if (customerId) {
            return Stripe.Customers.update(customerId, { source: cardToken }).then(null, function(error) {
                console.log('Updating customers card information with stripe failed. Error: ' + error);
                return Parse.Promise.error('An error has occurred. Your credit card information was not updated. Please submit again!');
            });
        } else {
            // The user hasnt created a card yet so run create.
            // We want to store some information of the user like their email, displayname and objectId
            // One thing, displayName and email are fields in the PFUser object
            // You can change displayName to 'lastName' or whatever, or just not have it.
            // Metadeta is completely optional
            return Stripe.Customers.create({
                email: currentUser.email,
                source: cardToken,
                metadata: {
                    name: currentUser.get('displayName'),
                    userId: currentUser.id,
                }
            }).then(null, function(error) {
                // If there were any issues, send the error response
                console.log('Creating customers card information with stripe failed. Error: ' + error);
                return Parse.Promise.error('An error has occurred. Your credit card information was not created. Please submit again!');
            });
        }

    }).then(function(result) {
        // We created the new card and send this back to the app, result is the customer object. 
        // Refer to stripe to view the response
        response.success(result);
    }, function(err) {
        // Didnt create the card so send the error response and act accordingly
        response.error(err);
    });

});

/* 
 * Refund Charge
 * Here we will refund a portion of the users transaction.
 * The user can refund all or part of their transaction.
 * (e.g If the user purchased 10 tickets but wants to refund 9)
 * You cannot make more purchases after a transaction has been made. Stripe hasnt implemented that feature I guess
 */
Parse.Cloud.define("refundCharge", function(request, response) {

    // We first get the event objects Id. We cannot pass in PFObjects into the parameters of a cloud code function... Sad :(
    var eventObject = request.params.eventObject;
    var transaction;
    var numberOfTickets;


    // Make a promise so we can make sequential requests (one after another, and stop if theres a fail in the chain)
    Parse.Promise.as().then(function() {
        var query = new Parse.Query('Event');
        // Get the event object with a get query
        return query.get(eventObject).then(null, function(error) {
            // If we couldnt find it return an error
            console.log('Querying for the event failed. Error: ' + error);
            return Parse.Promise.error('An error has occurred. Your credit card was not refunded. Please try again!');
        });
    }).then(function(result) {
        // With the result from the get query, store the object into the event global var
        eventObject = result;

        // Now we need to query for the transaction where you can actually make a refund, numberOfTickets > 0
        // The user must be the current user and the event must be the actual event to receive your refund from
        var query = new Parse.Query('Transaction');
        query.equalTo('event', eventObject);
        query.equalTo('user', Parse.User.current());
        query.notEqualTo('numberOfTickets', 0);

        // Vendor is a user object, the user who posted the event
        query.include('vendor');

        // Since you may have had multiple transactions for this event and
        // decided you wanted to purchase tickets after you already refunded your previous transaction
        // we only want the first object in the query
        return query.first().then(null, function(error) {
            console.log('Query for transaction with Parse failed. Error: ' + error);
            return Parse.Promise.error('An error has occurred. Your credit card was not refunded. Please try again!');
        }); 
    }).then(function(result) {

        // Save the transaction to the transaction global var
        transaction = result;
        var vendor = result.get('vendor');
        var chargeId = result.get('stripePaymentId');
        var price = eventObject.get('price');

        // Now we initilize the transaction to be refunded from the vendors Stripe Account
        Stripe.initialize(vendor.get('stripeAccessToken'));
        numberOfTickets = request.params.numberOfTickets;

        // Run the refund, if there are any errors, we stop and return the response.
        return Stripe.Charges.refund(chargeId, price * 100 * numberOfTickets).then(null, function(error) {
            // The card was not refunded
            console.log('Refunding with stripe failed. Error: ' + error);
            return Parse.Promise.error('An error has occurred. Your credit card was not refunded. Please try again!');
        });
    }).then(function(result) {

        // Now update the transaction global var object and save it
        var newNumberOfTickets = transaction.get('numberOfTickets') - numberOfTickets;
        transaction.set('numberOfTickets', newNumberOfTickets);
        if (newNumberOfTickets === 0) {
            transaction.set('status', 'refunded');
        } else {
            transaction.set('status', 'partially refunded');
        }

        // There would be an issue if the transaction had an issue saving. But we wont deal with it. Just send a error response.
        return transaction.save().then(null, function(error) {
            console.log('Refunding with stripe failed. Error: ' + error);
            return Parse.Promise.error('An error has occurred. Your credit card was refunded but there was an issue. Please feel free to send us an email at jsetting32@yahoo.com for further information.');
        });
    }).then(function(result) {
        // The entire process was a success! Return the transaction
        response.success(transaction);
    }, function(err) {

        // There was an error within the chain of Promises. So the promise that failed will be the 'err'
        response.error(err);
    });

});



