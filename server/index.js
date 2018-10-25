require('isomorphic-fetch');
require('dotenv').config();

const fs = require('fs');
const express = require('express');
const session = require('express-session');
const RedisStore = require('connect-redis')(session);
const path = require('path');
const logger = require('morgan');

const webpack = require('webpack');
const webpackMiddleware = require('webpack-dev-middleware');
const webpackHotMiddleware = require('webpack-hot-middleware');
const config = require('../config/webpack.config.js');

const ShopifyAPIClient = require('shopify-api-node');
const ShopifyExpress = require('@shopify/shopify-express');
const {MemoryStrategy} = require('@shopify/shopify-express/strategies');
const admin = require('./firebase-admin');
const db = admin.firestore()
const firebaseMiddleware = require('express-firebase-middleware');
const randomstring = require('randomstring')

const {
  SHOPIFY_APP_KEY,
  SHOPIFY_APP_HOST,
  SHOPIFY_APP_SECRET,
  NODE_ENV,
} = process.env;

const shopifyConfig = {
  host: SHOPIFY_APP_HOST,
  apiKey: SHOPIFY_APP_KEY,
  secret: SHOPIFY_APP_SECRET,
  scope: ['write_orders, write_products, read_product_listings'],
  shopStore: new MemoryStrategy(),
  async afterAuth(request, response) {
    const { session: { accessToken, shop } } = request;
    console.log(session)
    const shopify = new ShopifyAPIClient({ shopName: shop, accessToken: accessToken });
    try {
      const authShop = await shopify.shop.get()
      const id = authShop.id.toString()
      const dbShop = await db.collection('shops').doc(id).get()
      

      if (dbShop.exists) {
        response.cookie('shop_exists', true).redirect('/');
      } else {
        response.cookie('shop_exists', false).redirect('/');
      }
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

const registerWebhook = function(shopDomain, accessToken, webhook) {
  const shopify = new ShopifyAPIClient({ shopName: shopDomain, accessToken: accessToken });
  shopify.webhook.create(webhook).then(
    response => console.log(`webhook '${webhook.topic}' created`),
    err => console.log(`Error creating webhook '${webhook.topic}'. ${JSON.stringify(err.response.body)}`)
  );
}

const app = express();
const isDevelopment = NODE_ENV !== 'production';

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(logger('dev'));
app.use(
  session({
    store: isDevelopment ? undefined : new RedisStore(),
    secret: SHOPIFY_APP_SECRET,
    resave: true,
    saveUninitialized: false,
  })
);

// Run webpack hot reloading in dev
if (isDevelopment) {
  const compiler = webpack(config);
  const middleware = webpackMiddleware(compiler, {
    hot: true,
    inline: true,
    publicPath: config.output.publicPath,
    contentBase: 'src',
    stats: {
      colors: true,
      hash: false,
      timings: true,
      chunks: false,
      chunkModules: false,
      modules: false,
    },
  });

  app.use(middleware);
  app.use(webpackHotMiddleware(compiler));
} else {
  const staticPath = path.resolve(__dirname, '../assets');
  app.use('/assets', express.static(staticPath));
}

// Install
app.get('/install', (req, res) => res.render('install'));

// Create shopify middlewares and router
const shopify = ShopifyExpress(shopifyConfig);

// Mount Shopify Routes
const {routes, middleware} = shopify;
const {withShop, withWebhook} = middleware;

app.use('/shopify', routes);

// Client
app.get(['/', '/apiconsole', '/account'], withShop({authBaseUrl: '/shopify'}), function(request, response) {
  const { session: { shop, accessToken, id_token } } = request;
  console.log(shop, accessToken, id_token)

  return response.render('app', {
    title: 'Starchain',
    apiKey: shopifyConfig.apiKey,
    shop: shop,
    id_token: id_token
  });
});

// Client
app.post('/api/connect', async (req, res) => {
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

app.post('/order-create', withWebhook((error, request) => {
  if (error) {
    console.error(error);
    return;
  }

  console.log('We got a webhook!');
  console.log('Details: ', request.webhook);
  console.log('Body:', request.body);
}));

// Error Handlers
app.use(function(req, res, next) {
  const err = new Error('Not Found');
  err.status = 404;
  next(err);
});

app.use(function(error, request, response, next) {
  response.locals.message = error.message;
  response.locals.error = request.app.get('env') === 'development' ? error : {};

  response.status(error.status || 500);
  response.render('error');
});

module.exports = app;
