'use strict'

var path = require('path'),
    db = require(path.resolve('./config/lib/sequelize')).models,
    saleFunctions = require(path.resolve('./custom_functions/sales.js')),
    sequelize = require('sequelize'),
    winston = require('winston');

/**
 * @api {post} /api/public/subscription Add Subscription
 * @apiVersion 0.2.0
 * @apiName AddSubscription
 * @apiGroup Subscription
 * @apiParam (Query parameters) {String} apikey Authorization key as query parameter
 * @apiParam {String} username Username of the customer
 * @apiParam {String} product_id Product id of that will be subscribed
 * @apiParam {String} type Type can be subscr or vod
 * @apiParam {String} transaction_id Transaction id
 * @apiParam {String} [start_date] Subscription start date
 * @apiSuccess (200) {Object[]} data Response
 * @apiSuccess {String} data.message Message
 * @apiError (40x) {Object} error Error-Response
 * @apiError {Number} error.code Code
 * @apiError {String} error.message Message description of error
 */
exports.addSubscription = function (req, res) {

    if (!req.body.username || !req.body.product_id || !req.body.type || !req.body.transaction_id) {
        return res.status(400).send({
            error: {
                code: 400,
                message: 'Username or product id or type or transaction_id parameter missing'
            }
        });
    }

    db.salesreport.findOne({
        where: {transaction_id: req.body.transaction_id}
    }).then(function (sale) {
        if (sale) {
            res.status(409).send({
                error: {
                    code: 409,
                    message: 'Transaction is already processed'
                    }
                });
            return;
        }

        db.login_data.findOne({
            attributes: ['id'],
            where: { username: req.body.username } })
            .then(function (customer) {
                if (customer) {
                    if (req.body.type == 'subscr') {
                        db.combo.findOne({
                            where: {product_id: req.body.product_id}
                        }).then(function (result) {
                            if (!result) {
                                res.status(409).send({error: {code: 409, message: 'Product not found' }});
                                return;
                            }
                            let startDate = undefined;

                            if (req.body.start_date) {
                                startDate = Date.parse(req.body.start_date);
                                if (isNaN(startDate)) {
                                    res.status(400).send({code: 400, message: 'Start date is invalid'});
                                    return;
                                }
                            }

                            req.body.login_data_id = customer.dataValues.id;
                            
                            saleFunctions.add_subscription_transaction(req, res, 1, req.body.transaction_id, startDate).then(function (result) {
                                if (result.status) {
                                    res.send({ data: {message:result.message}});
                                }
                                else {
                                    res.status(409).send({error: {code: 409, message: result.message}});
                                }
                            }).catch(function (err) {
                                winston.error('Adding subscription failed with error: ', err);
                                res.status(500).send({ error: { code: 500, message: 'Internal error' } });
                            });
                        })

                    } else if (req.body.type == 'vod') {
                        saleFunctions.buy_movie(req, res, req.body.username, req.body.product_id, req.body.transaction_id).then(function (resul) {
                            if (resul.status) {
                                res.send({data: {message: resul.message}});
                            } else {
                                res.status(409).send({error: {code: 409, message: resul.message}});
                            }
                        }).catch(function (err) {
                            winston.error('Adding vod subscription failed with error: ', err)
                            res.status(500).send({error: 500, message: 'Internal error'});
                        });
                    }
                } else {
                    res.status(404).send({error: {code: 404, message: 'User not found'}})
                }
            }).catch(function (err) {
            winston.error('Subscription transaction failed with error: ', err);
            res.status(500).send({error: {code: 500, message: 'Internal error'}})
        });
    })
}


/**
 * @api {get} /api/public/subscription Get Salesreport List
 * @apiName GetSalesreport
 * @apiGroup Subscription
 * @apiParam (Query parameters) {String} apikey Authorization key as query parameter
 * @apiSuccess (200) {Object[]} data Response
 * @apiSuccess {Number} data.id Subscription id
 * @apiSuccess {String} data.user_username User name
 * @apiSuccess {Date} data.saledate Sale date
 * @apiSuccess {Date} data.createdAt Created Date
 * @apiSuccess {Date} data.updatedAt Updated Date
 * @apiSuccess {String} data.username Name of login user
 * @apiSuccess {Number} data.customer_datum.id Customer id
 * @apiSuccess {String} data.customer_datum.email Customer Email
 * @apiSuccess {String} data.customer_datum.email Email of the customer
 * @apiSuccess {String} data.combo.product_id Product id
 * @apiSuccess {String} data.combo.name Product Name
 * @apiError (40x) {Object} error Error-Response
 * @apiError {Number} error.code Code
 * @apiError {String} error.message Message description of error
 *
 */


exports.listSubscription = function (req, res){
    db.salesreport.findAll({
        attributes: ['id', 'user_username', 'saledate', 'createdAt', 'updatedAt'],
        include: [
            {
                model: db.login_data,
                attributes: ['username'],
                required: true,
                include: [{
                    model: db.customer_data,
                    attributes: ['email'],
                    required: true
                }],
            },
            {  model: db.combo,
                attributes: ['product_id','name'],
                required: true,}
        ],
        limit: 100,
        order: 'updatedAt desc',
        raw: true
    }).then(function (results) {
        if (!results) {
            res.status(204).send({data: []});
            return;
        }

        res.json({data: results});
    }).catch(function (err) {
        winston.error('Getting subscription list failed with error: ', err);
        res.status(500).send({error: {code: 500, message: 'Internal error'}});
    });
}



/**
 * @api {put} /api/public/subscription Cancel Subscription
 * @apiName CancelSubscription
 * @apiGroup Subscription
 * @apiParam (Query parameters) {String} apikey Authorization key as query parameter
 * @apiParam {String} transaction_id Transaction id
 * @apiSuccess (200) {Object[]} data Response
 * @apiSuccess {String} data.message Message
 * @apiError (40x) {Object} error Error-Response
 * @apiError {Number} error.code Code
 * @apiError {String} error.message Message description of error
 */
exports.cancelSubscription = function (req, res) {
    if (!req.body.transaction_id) {
        return res.status(400).send({error: {code: 400, message: 'Parameter transaction_id  missing'}})
    }

    db.salesreport.findOne({where: {transaction_id: req.body.transaction_id}})
        .then(function (transaction) {
            if (!transaction) {
                res.status(404).send({error: {code: 404, message: 'Transaction not found'}})
            } else {
                req.body.combo_id = transaction.combo_id;
                db.login_data.findOne({where: {id: transaction.login_data_id}})
                    .then(function (user) {
                        if (user) {
                            req.body.username = user.username;
                            saleFunctions.add_subscription_transaction(req, res, -1, req.body.transaction_id).then(function (result) {
                                if (result.status) {
                                    res.send({data: {message: result.message}});
                                } else {
                                    res.status(409).send({data: {message: result.message}});
                                }
                            });
                        }
                    });
            }
        })
}


/**
 * @api {post} /api/public/subscription Cancel Subscription
 * @apiName CancelSubscription
 * @apiGroup Subscription
 * @apiParam (Query parameters) {String} apikey Authorization key as query parameter
 * @apiParam {String} transaction_id Transaction id
 * @apiSuccess (200) {Object[]} data Response
 * @apiSuccess {String} data.message Message
 * @apiError (40x) {Object} error Error-Response
 * @apiError {Number} error.code Code
 * @apiError {String} error.message Message description of error
 */
exports.cancelSubscription = function (req, res) {
    if (!req.body.transaction_id) {
        return res.status(400).send({error: {code: 400, message: 'Parameter transaction_id  missing'}})
    }

    db.salesreport.findOne({where: {transaction_id: req.body.transaction_id}})
        .then(function (transaction) {
            if (!transaction) {
                res.status(404).send({error: {code: 404, message: 'Transaction not found'}})
            } else {
                req.body.combo_id = transaction.combo_id;
                db.login_data.findOne({where: {id: transaction.login_data_id}})
                    .then(function (user) {
                        if (user) {
                            req.body.username = user.username;
                            saleFunctions.add_subscription_transaction(req, res, -1, req.body.transaction_id).then(function (result) {
                                if (result.status) {
                                    res.send({data: {message: result.message}});
                                } else {
                                    res.status(409).send({data: {message: result.message}});
                                }
                            });
                        }
                    });
            }
        })
}


/**
 * @api {get} /api/public/customer/package/:username Get User Packages
 * @apiName GetUserPackages
 * @apiGroup Subscription
 * @apiParam (Path parameters) {String} username Username of the customer
 * @apiParam (Query parameters) {String} apikey Authorization key as query parameter
 * @apiSuccess (200) {Object[]} data Response
 * @apiSuccess {Date} data.start_data Start date
 * @apiSuccess {Date} data.end_date End date
 * @apiSuccess {String} data.package_name Package Name
 * @apiError (40x) {Object} error Error-Response
 * @apiError {Number} error.code Code
 * @apiError {String} error.message Message description of error
 *
 */
exports.getCustomerPackages = function (req, res) {
    if (!req.params.username) {
        req.status(400).send({error: {code: 400, message: 'Parameter username missing'}});
        return;
    }

    db.login_data.findOne({where: {username: req.params.username}})
        .then(function (login_data) {
            if (!login_data) {
                res.status(400).send({error: {code: 404, message: 'User not found'}});
                return
            }

            db.subscription.findAll({
                attributes: ['start_date', 'end_date'],
                where: {login_id: login_data.id},
                include: [
                    {
                        model: db.package,
                        attributes: ['package_name'],
                        required: true
                    }
                ],
                order: 'end_date desc',
                raw: true
            }).then(function (results) {
                if (!results) {
                    res.status(204).send({data: []});
                    return;
                }

                res.json({data: results});
            }).catch(function (err) {
                winston.error('Getting subscription list failed with error: ', err);
                res.status(500).send({error: {code: 500, message: 'Internal error'}});
            });
        });
}


/**
 * @api {get} /api/public/customer/salesreport/:username Get User Salesreport
 * @apiName GetUserSalesreport
 * @apiGroup Subscription
 * @apiParam (Path parameters) {String} username Username of the customer
 * @apiParam (Query parameters) {String} apikey Authorization key as query parameter
 * @apiSuccess (200) {Object[]} data Response
 * @apiSuccess {Number} data.id Salesreport id
 * @apiSuccess {Number} data.company_id Company id_on_behalf_id
 * @apiSuccess {String} data.transaction_id Transaction id
 * @apiSuccess {Number} data.user_id User id
 * @apiSuccess {Number} data.on_behalf_id On Behalf id
 * @apiSuccess {Number} data.combo_id Combo id
 * @apiSuccess {Number} data.login_data_id User id
 * @apiSuccess {String} data.user_username Username
 * @apiSuccess {String} data.distributorname Distributor name
 * @apiSuccess {Date} data.saledate Sale date
 * @apiSuccess {Number} data.active Salesreport active or not
 * @apiSuccess {Date} data.cancelation_date Cancelation Date
 * @apiSuccess {String} data.cancelation_user Cancelation user name
 * @apiSuccess {String} data.cancelation_reason Cancelation reason
 * @apiSuccess {Number} data.value Value of salesreport
 * @apiSuccess {Number} data.duration Duration
 * @apiSuccess {String} data.username Username of login user
 * @apiSuccess {String} data.email User email
 * @apiSuccess {String} data.combo.product_id Product code
 * @apiSuccess {String} data.combo.name Product name
 * @apiSuccess {Date} data.createdAt Created date
 * @apiSuccess {Date} data.updatedAt Updated date
 * @apiError (40x) {Object} error Error-Response
 * @apiError {Number} error.code Code
 * @apiError {String} error.message Message description of error
 *
 */
exports.getCustomerSalesreport = function (req, res) {
    if (!req.params.username) {
        req.status(400).send({error: {code: 400, message: 'Parameter username missing'}});
        return;
    }

    db.login_data.findOne({where: {username: req.params.username}})
        .then(function (login_data) {
            if (!login_data) {
                res.status(400).send({error: {code: 404, message: 'User not found'}});
                return
            }

            db.salesreport.findAll({
                where: {
                    login_data_id: login_data.id
                },
                raw: true,
                include: [
                    {
                        model: db.login_data,
                        attributes: ['username'],
                        required: true,
                        include: [{
                            model: db.customer_data,
                            attributes: ['email'],
                            required: true
                        }],
                    },
                    {
                        model: db.combo,
                        attributes: ['product_id', 'name'],
                        required: true

                    }
                ],
                order: 'saledate asc'
                //raw: true

            }).then(function (results) {
                if (!results) {
                    res.status(204).send({data: []});
                    return;
                }

                res.json({data: results});
            }).catch(function (err) {
                winston.error('Getting salesreport list failed with error: ', err);
                res.status(500).send({error: {code: 500, message: 'Internal error'}});
            });
        });
}

/**
 * @api {get} /api/public/packages Get Package List
 * @apiName GetPackages
 * @apiGroup Subscription
 * @apiParam (Query parameters) {String} apikey Authorization key as query parameter
 * @apiSuccess (200) {Object[]} data Response
 * @apiSuccess {Number} data.id Package id
 * @apiSuccess {String} data.customer_username Customer Name
 * @apiSuccess {Number} data.login_id Login id
 * @apiSuccess {Number} data.count Count login times
 * @apiSuccess {Date} data.start_date Started date
 * @apiSuccess {Date} data.end_date End date
 * @apiSuccess {Date} data.updatedAt Updated date
 * @apiSuccess {String} data.package.package_name Package Name
 * @apiSuccess {String} data.login_datum.username Name of login user
 * @apiSuccess {String} data.login_datum.customer_datum.id Customer id
 * @apiSuccess {String} data.login_datum.customer_datum.email Customer email
 * @apiError (40x) {Object} error Error-Response
 * @apiError {Number} error.code Code
 * @apiError {String} error.message Message description of error
 *
 */
exports.listPackages = function (req, res) {
    db.subscription.findAll({
        attributes: ['id', 'customer_username', 'login_id', [sequelize.fn('count', sequelize.col('login_id')), 'count'], 'start_date', 'end_date', 'updatedAt', [sequelize.fn('max', sequelize.col('end_date')), 'end_date'],],
        group: ['login_id'],
        include: [
            {
                model: db.package,
                attributes: ['package_name'],
                required: true
            },
            {
                model: db.login_data,
                required: true,
                attributes: ['username'],
                include: [    {
                    model: db.customer_data,
                    attributes: ['email'],
                    required: true
                },]
            },

        ],
        limit: 100,
        order: 'updatedAt desc',
        raw: true
    }).then(function (results) {
        if (!results) {
            res.status(204).send({data: []});
            return;
        }

        res.json({data: results});
    }).catch(function (err) {
        winston.error('Getting subscription list failed with error: ', err);
        res.status(500).send({error: {code: 500, message: 'Internal error'}});
    });
}
