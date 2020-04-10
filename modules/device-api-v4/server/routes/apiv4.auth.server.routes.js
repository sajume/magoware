'use strict';
/**
 * Module dependencies.
 */
const path = require('path'),
  config = require(path.resolve('./config/config')),
  winston = require(path.resolve('./config/lib/winston')),
  cache = require(path.resolve('./config/lib/cache')),
  authMiddleware = require('../middlewares/auth.middleware.server.controller'),
  authv4Controller = require('../controllers/authentication.server.controller'),
  channelsController = require(path.resolve('./modules/deviceapiv2/server/controllers/channels.server.controller')),
  credentialsController = require(path.resolve('./modules/deviceapiv2/server/controllers/credentials.server.controller'));


  module.exports = function (app) {

    app.use('/apiv2', function (req, res, next) {
      winston.info(req.ip.replace('::ffff:', '') + ' # ' + req.originalUrl + ' # ' + JSON.stringify(req.body));
      //res.header("Access-Control-Allow-Origin", "*");
      next();
    });

    app.route('/apiv4/auth/login')
      .all(authMiddleware.requireSignIn)
      .post(authv4Controller.loginv2);

    app.route('/apiv4/auth/company/list')
      .all(authMiddleware.requireSignIn)
      .post(authv4Controller.company_list);

    app.route('/apiv4/channels')
      .all(authMiddleware.requireToken)
      .get(channelsController.list_get);

  };
