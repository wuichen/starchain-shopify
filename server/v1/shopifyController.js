const express = require('express');
const router = express.Router();

const ShopifyAPIClient = require('shopify-api-node');
const ShopifyExpress = require('@shopify/shopify-express');
const {RedisStrategy} = require('@shopify/shopify-express/strategies');
const admin = require('../firebase-admin');
const db = admin.firestore()

const {
  SHOPIFY_APP_KEY,
  SHOPIFY_APP_HOST,
  SHOPIFY_APP_SECRET,
  NODE_ENV,
} = require('../constants');

const shopifyConfig = {
  host: SHOPIFY_APP_HOST,
  apiKey: SHOPIFY_APP_KEY,
  secret: SHOPIFY_APP_SECRET,
  scope: ['write_orders, write_products, read_product_listings'],
  shopStore: new RedisStrategy({
    url: 'redis://redistogo:6e7f3b6477fe7ce7c7dca1e2594910ae@gibberfish.redistogo.com:9015/'
  }),
  async afterAuth(request, response) {
    const { session: { accessToken, shop } } = request;
    const shopify = new ShopifyAPIClient({ shopName: shop, accessToken: accessToken });
    try {
      const authShop = await shopify.shop.get()
      const id = authShop.id.toString()
      const dbShop = await db.collection('shops').doc(id).get()

      if (dbShop.exists) {
        const customToken = await admin.auth().createCustomToken(dbShop.data().uid)
        request.session.id_token = customToken
      }
      response.redirect('/');

    } catch (err) {
      // TODO: find a better solution for error handling here 
      // TODO: log error
      return response.render('error', {
        message: err,
        error: {
          status: 500,
          stack: err
        }
      });
    }
  },
};

// Create shopify middlewares and router
const shopify = ShopifyExpress(shopifyConfig);

// Mount Shopify Routes
const {routes, middleware} = shopify;
const {withShop, withWebhook} = middleware;

router.use('/shopify', routes);

module.exports = {
  router,
  withShop,
  withWebhook
}
