const express = require("express");
const router = express.Router();

const stripe = require("stripe")("sk_test_51GKnoQEyjkUaFZlBt5FKh9IwwsLxohroTXl6iw1iLg9EzvKOWrd0HQyZwMQZr8ipbDMUG18NJo0QqkRRsfOfj7HS00S5cRopde");

router.get("/secret", async (req, res) => {
  // Token is created using Stripe Checkout or Elements!
  // Get the payment token ID submitted by the form:
  const token = req.body.stripeToken; // Using Express

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 20 * 100,
      currency: "usd",
      payment_method_types: ["card"],
    });

    res.status(200).json(paymentIntent);
  } catch (error) {
    res.status(403).json(error);
  }
});

module.exports = router;
