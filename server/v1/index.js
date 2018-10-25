const express = require('express');
const router = express.Router();
const shopifyController = require('./shopifyController');
const apiController = require('./apiController');
const viewController = require('./viewController');
const webhookController = require('./webhookController');

router.use(shopifyController.router);
router.use(apiController.router);
router.use(viewController.router);
router.use(webhookController.router);

module.exports = router;