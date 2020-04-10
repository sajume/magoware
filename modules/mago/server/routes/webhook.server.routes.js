'use strict';
var passport = require('passport'),
    JwtStrategy = require('passport-jwt').Strategy,
    ExtractJwt = require('passport-jwt').ExtractJwt;

var path = require('path'),
    db = require(path.resolve('./config/lib/sequelize')).models,
    policy = require('../policies/mago.server.policy'),
    webhooks = require(path.resolve('./modules/mago/server/controllers/webhooks.server.controller')),
    webhookSystem = require(path.resolve('./config/lib/webhook'));

module.exports = function (app) {

    webhookSystem.initWebhooks(app);
    /* ===== webhooks ===== */

    app.route('/api/webhooks')
        .all(policy.Authenticate)
        .all(policy.isAllowed)
        .post(webhooks.create);

    app.route('/api/webhooks/event_types')
        .get(webhooks.getEventTypes);
};