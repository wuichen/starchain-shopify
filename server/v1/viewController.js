const express = require('express');
const router = express.Router();
const withShop = require('./shopifyController').withShop
const {
  SHOPIFY_APP_KEY,
} = require('../constants');


router.get(['/', '/apiconsole', '/account'], withShop({authBaseUrl: '/shopify'}), function(request, response) {
  const { session: { shop, accessToken, id_token } } = request;
  if (id_token) {
    response.cookie('id_token', id_token)
  }
  console.log(shop, accessToken, id_token)

  return response.render('app', {
    title: 'Starchain',
    apiKey: SHOPIFY_APP_KEY,
    shop: shop,
  });
});

module.exports = {
	router
}