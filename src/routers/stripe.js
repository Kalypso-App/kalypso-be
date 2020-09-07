const express = require("express");
const router = express.Router();
const bodyParser = require("body-parser");
const User = require("../models/User");

const stripe = require("stripe")(process.env.STRIPE_SECRET);

router.get("/secret", async (req, res) => {
  // Token is created using Stripe Checkout or Elements!
  // Get the payment token ID submitted by the form:
  const token = req.body.stripeToken; // Using Express
  try {
    // const paymentIntent = await stripe.paymentIntents.create({
    //   amount: 20 * 100,
    //   currency: "usd",
    //   payment_method_types: ["card"],
    // });

    res.status(200).json("ok");
  } catch (error) {
    res.status(403).json(error);
  }
});

router.post('/create-customer', async (req, res) => {
  let email = req.body.email;
  // Check user in our DB
  let user = await User.findOne({ email: email });
  if (user) {
    if(user.stripeCustomerId){
      try{
      const customer = await stripe.customers.retrieve(
        user.stripeCustomerId
      );
      return res.send({ customer });
      }
      catch(error){
        return res.status(501).json(error.message);
      }
    }
    else{
      // Create a new customer object
      try{
      const customer = await stripe.customers.create({
        email: email
      });
      // save the customer.id as stripeCustomerId
      // in your database.
      await User.updateOne(
        { _id: user.get('id') },
        {
          stripeCustomerId: customer.id
        }
      );
      return res.send({ customer });
      }
      catch(error){
        return res.status(501).json(error.message);
      }
    } 
  }
  return res.status(403).send({ error: "No user found." });  
});

router.post('/create-subscription', async (req, res) => {
  // Set the default payment method on the customer
  let email = req.body.email;
  let user = await User.findOne({ email: email });
  if (user) {

  try {
    await stripe.paymentMethods.attach(req.body.paymentMethodId, {
      customer: req.body.customerId,
    });
  } 
  catch(error){
    return res.status(501).json(error.message);
  }

  try{
  let updateCustomerDefaultPaymentMethod = await stripe.customers.update(
    req.body.customerId,
    {
      invoice_settings: {
        default_payment_method: req.body.paymentMethodId,
      },
    }
  );
  }
  catch(error){
    return res.status(501).json(error.message);
  }
try{
  // Create the subscription
  const subscription = await stripe.subscriptions.create({
    customer: req.body.customerId,
    items: [{ price: req.body.priceId }],
    expand: ['latest_invoice.payment_intent'],
  });

  await User.updateOne(
    { _id: user.get('id') },
    {
      paymentMethodId: req.body.paymentMethodId,
      subscriptionId: subscription.id,
      paymentEndDate: subscription.current_period_end
    }
  );

    return res.send(subscription);
  }
  catch(error){
    return res.status(501).json(error.message);
  }
  }
  res.status(403).send({ error: "No user found." });  
});

router.post('/retrive-subscription', async (req, res) => {
  // Set the default payment method on the customer
  let email = req.body.email;
  let user = await User.findOne({ email: email });
  if (user) {

    try{
  // Get the subscription
  const subscription = await stripe.subscriptions.retrieve(user.get('subscriptionId'));

    return res.send(subscription);
    }
    catch(error){
      return res.status(501).json(error.message);
    }
  }
  res.status(403).send({ error: "No user found." });  
});


router.post('/retry-invoice', async (req, res) => {
  // Set the default payment method on the customer

  try {
    await stripe.paymentMethods.attach(req.body.paymentMethodId, {
       customer: req.body.customerId,
    });
    await stripe.customers.update(req.body.customerId, {
      invoice_settings: {
        default_payment_method: req.body.paymentMethodId,
      },
    });
  } 
  catch(error){
    return res.status(501).json(error.message);
  }


  try{
  const invoice = await stripe.invoices.retrieve(req.body.invoiceId, {
    expand: ['payment_intent'],
  });
  res.send(invoice);
}
  catch(error){
  return res.status(501).json(error.message);
  }
});

router.post('/retrieve-upcoming-invoice', async (req, res) => {
  try{
  const subscription = await stripe.subscriptions.retrieve(
    req.body.subscriptionId
  );

  const invoice = await stripe.invoices.retrieveUpcoming({
    subscription_prorate: true,
    customer: req.body.customerId,
    subscription: req.body.subscriptionId,
    subscription_items: [
      {
        id: subscription.items.data[0].id,
        deleted: true,
      },
      {
        price: req.body.newPriceId,
        deleted: false,
      },
    ],
  });
  res.send(invoice);  
  }
  catch(error){
    return res.status(501).json(error.message);
  }
});

router.post('/cancel-subscription', async (req, res) => {
  let email = req.body.email;
  let user = await User.findOne({ email: email });
  if (user) {
  try{
  // Delete the subscription
  const deletedSubscription = await stripe.subscriptions.del(
    req.body.subscriptionId
  );
  await User.updateOne(
    { _id: user.get('id') },
    {
      subscriptionId: null,
      paymentEndDate: null
    }
  );

  return res.send(deletedSubscription);
  }
  catch(error){
    return res.status(501).json(error.message);
  }
  }
  res.status(403).send({ error: "No user found." });  

});

router.post('/update-subscription', async (req, res) => {
  let email = req.body.email;
  let user = await User.findOne({ email: email });
  if (user) {
    try{
  const subscription = await stripe.subscriptions.retrieve(
    req.body.subscriptionId
  );
  const updatedSubscription = await stripe.subscriptions.update(
    req.body.subscriptionId,
    {
      cancel_at_period_end: false,
      items: [
        {
          id: subscription.items.data[0].id,
          price: req.body.newPriceId,
        },
      ],
    }
  );
  await User.updateOne(
    { _id: user.get('id') },
    {
     subscriptionId: updatedSubscription.id,
     paymentEndDate: updatedSubscription.current_period_end
    }
  );

  return res.send(updatedSubscription);
  }
  catch(error){
    return res.status(501).json(error.message);
  }
  }
  res.status(403).send({ error: "No user found." });  
});

router.post('/retrieve-customer-payment-method', async (req, res) => {
  try{
  const paymentMethod = await stripe.paymentMethods.retrieve(
    req.body.paymentMethodId
  )
  res.send(paymentMethod);
  }
  catch(error){
    return res.status(501).json(error.message);
  }
});

// Webhook handler for asynchronous events.
router.post('/stripe-webhook', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
    // Retrieve the event by verifying the signature using the raw body and secret.
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        req.headers['stripe-signature'],
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.log(err);
      console.log(`Webhook signature verification failed.`);
      console.log(
        `Check the env file and enter the correct webhook secret.`
      );
      return res.status(400).json(err.message);
    }
    // Extract the object from the event.
    const dataObject = event.data.object;

    let user = await User.findOne({ email: dataObject.customer_email });
    if (user) {

    // Handle the event
    // Review important events for Billing webhooks
    // https://stripe.com/docs/billing/webhooks
    // Remove comment to see the various objects sent for this sample
    switch (event.type) {
      case 'invoice.paid':
        // Used to provision services after the trial has ended.
        // The status of the invoice will show up as paid. Store the status in your
        // database to reference when a user accesses your service to avoid hitting rate limits.
        
        const subscription = await stripe.subscriptions.retrieve(dataObject.subscription);
        if(subscription && subscription.current_period_end){
          await User.updateOne(
            { _id: user.get('id') },
            {
              subscriptionId: subscription.id,
              paymentEndDate: subscription.current_period_end
            }
          );
        }

        break;
      case 'invoice.payment_failed':
        // If the payment fails or the customer does not have a valid payment method,
        //  an invoice.payment_failed event is sent, the subscription becomes past_due.
        // Use this webhook to notify your user that their payment has
        // failed and to retrieve new card details.
        break;
      case 'invoice.finalized':
        // If you want to manually send out invoices to your customers
        // or store them locally to reference to avoid hitting Stripe rate limits.
        break;
      case 'customer.subscription.deleted':
        if (event.request != null) {
          // handle a subscription cancelled by your request
          // from above.
        } else {
          // handle subscription cancelled automatically based
          // upon your subscription settings.
        }
        break;
      case 'customer.subscription.trial_will_end':
        // Send notification to your user that the trial will end
        break;
      default:
      // Unexpected event type
    }
    return res.sendStatus(200);
  }
  return res.status(403).send({ error: "No user found." });  
});

module.exports = router;
