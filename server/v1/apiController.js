const express = require('express');
const router = express.Router();
const ShopifyAPIClient = require('shopify-api-node');
const admin = require('../firebase-admin');
const db = admin.firestore()
const firebaseMiddleware = require('express-firebase-middleware');
const randomstring = require('randomstring')

const {
  SHOPIFY_APP_KEY,
  SHOPIFY_APP_HOST,
  SHOPIFY_APP_SECRET,
  NODE_ENV,
} = require('../constants');

router.post('/api/connect', async (req, res) => {
  const { session: { shop, accessToken } } = req;
  if (!shop || !accessToken) {
    return res.status(500).send('missing shop or accessToken')
  } else {
    try {
      const shopify = new ShopifyAPIClient({ shopName: shop, accessToken: accessToken });
      const authShop = await shopify.shop.get()
      const authShop_id = authShop.id.toString()
      const authShop_email = authShop.email
      authShop.accessToken = accessToken

      // possible way of creating user password with security
      // create user record first and generate a random uuid to store with
      // create firebase user with this id. so in the future, we have to look up user table before 
      // we get the password to log in
      const shopObject = await db.collection('shops').doc(authShop_id).get();
      let newShopUser
      if (!shopObject.exists) {

        // generate a random password for the user and save it in shop for security?
        const randomPassword = randomstring.generate(12)
        authShop.password = randomPassword  
        newShopUser = await admin.auth().createUser({
          email: authShop_email,
          emailVerified: false,
          password: randomPassword,
          disabled: false
        })

        const product_listings = await shopify.productListing.list()
        let products = await shopify.product.list()

        // aggregate a list of products with indicator of whether the product has been imported into 
        // the sales channel and batch write into db with new shop info
        products = products.map((product) => {
          product.imported = false;
          product.shop_id = authShop_id;
          product.domain = authShop.domain;
          product.shop_name = authShop.name;
          product.country_code = authShop.country_code

          for (let i = 0; i < product_listings.length; i++) {
            if(product_listings[i].product_id === product.id) {
              product.imported = true
            }
          }
          return product;
        })
        const newShopBatch = db.batch()
        const shopRef = db.collection('shops').doc(authShop_id);
        newShopBatch.set(shopRef, authShop);

        
        for (var i = 0; i < products.length; i++) {
          const product_id = products[i].id.toString()
          const productRef = db.collection('products').doc(product_id)
          newShopBatch.set(productRef, products[i])
        } 
        const newShopBatchWrite = await newShopBatch.commit()

        // create a custom token and send it back to the client with cookie to store
        const customToken = await admin.auth().createCustomToken(uid)

        // TODO: register webhooks here !!
        // registerWebhook(shop, accessToken, {
        //   topic: 'orders/create',
        //   address: `${SHOPIFY_APP_HOST}/order-create`,
        //   format: 'json'
        // });
        req.session.id_token = customToken
        return res.send('success')
      } else {
        return res.status(500).send('shop exists')
      }
    } catch (err) {
      if (newShopUser) {
        try {
          await admin.auth().deleteUser(newShopUser.uid)
        } catch (rollbackErr) {
          // TODO: error logger for rollback error
          return res.status(500).send(err)
        }
      }
      // data creation error
      return res.status(500).send(err)
    }

  }
});

module.exports = {
  router
}