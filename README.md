hoodie-plugin-stripe-link
=========================

A simple Hoodie plugin that references a Stripe customerId in the corresponding Hoodie user.

## Usage

1. Register this plugin as a webhook receiver inside Stripe (see [Stripe docs](https://stripe.com/docs/webhooks)):  
`https://<server url>/_api/_plugins/stripe-link/_api`.
2. When creating a Stripe customer, make sure to provide a "hoodieId" in its metadata:  
`{ metadata: { hoodieId: '<hoodieId>' } }`.

Next time you use `hoodie.account.fetch`, you will receive a userDoc containing the customerId of the user.
Please note that:
- there is an inherent delay between the creation of the Stripe customer and the update of the Hoodie user,
- if a Stripe customer has been created without a hoodieId metadata, you can add it later and the Hoodie user will be correctly linked as well,
- you should avoid modifying manually the hoodieId of a Stripe customer, and the customerId of a Hoodie user.

## That's it!

Now that your Hoodie user and Stripe customer are cross-referencing each others, you're free to move all of your Stripe logic to a different server.
The simplicity of this plugin means that you will have two different backends without data duplication.
This constraint will make your life a lot simpler.

## license

MIT
