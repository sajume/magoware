'use strict'

const path = require('path'),
    db = require(path.resolve('./config/lib/sequelize')),
    models = require(path.resolve('./config/lib/sequelize')).models,
    response = require('../utils/response'),
    winston = require('winston');

/**
 * @api {get} /apiv4/packages Packages
 * @apiName Packages
 * @apiGroup Package
 * @apiVersion  4.0.0
 * @apiHeader {String} x-authorization/auth Authorization key
 * @apiSuccess (Success 200) {Object} response Response
 * @apiSuccess {Object[]} response.data List of packages
 * @apiSuccess {Number} response.data.id Package id
 * @apiSuccess {String} response.data.package_name Package name
 * @apiError (Error 4xx) {Object} error Error
 * @apiError {Number} error.code Code
 * @apiError {String} error.message Message description of error
*/
exports.getPackagesWithSubscription = function (req, res) {
    models.package.findAll({
        attributes: ['id', 'package_name'],
        where: { package_type_id: req.auth.data.screensize },
        include: [
            {
                model: models.subscription,
                required: true,
                attributes: [],
                where: { login_id: req.auth.id, end_date: { $gte: Date.now() } }
            }
        ]
    }).then(function (subscribedPackages) {
        response.sendData(req, res, subscribedPackages);
    }).catch(function (err) {
        winston.error('Getting list of subscribed packages failed with error: ', err);
        response.sendError(req, res, 500, 'DATABASE_ERROR_DATA');
    });
}

/**
 * @api {get} /apiv4/packages/:id/channels Package Channels
 * @apiName PackageChannels
 * @apiGroup Package
 * @apiVersion  4.0.0
 * @apiHeader {String} x-authorization/auth Authorization key
 * @apiParam (Query param) {Bool} pin_protected Pin protected filter
 * @apiSuccess (Success 200) {Object} response Response
 * @apiSuccess {Object[]} response.data List of package channels
 * @apiSuccess {Number} response.data.id Id
 * @apiSuccess {Number} response.data.genre_id Genre id
 * @apiSuccess {Number} response.data.channel_number Channel number
 * @apiSuccess {String} response.data.title Title
 * @apiSuccess {String} response.data.icon_url Icon url
 * @apiSuccess {Bool} response.data.pin_protected Pin protection status
 * @apiSuccess {String} response.data.stream_mode Stream mode
 * @apiError (Error 4xx) {Object} error Error
 * @apiError {Number} error.code Code
 * @apiError {String} error.message Message description of error
*/
exports.getPackageChannels = function (req, res) {
    if (!req.params.id) {
        response.sendError(req, res, 400, 'BAD_REQUEST_DATA');
        return;
    }

    let where = {
        isavailable: 1,
        company_id: req.auth.company_id
    }

    if (req.auth.user.show_adult == 0) {
        where.pin_protected = 0; //show adults filter
    }
    else {
        where.pin_protected != ''; //avoid adult filter
    }

    models.channels.findAll({
        attributes: ['id', 'genre_id', 'channel_number', 'title', [db.sequelize.fn('concat', req.app.locals.backendsettings[req.auth.company_id].assets_url, db.sequelize.col('channels.icon_url')), 'icon_url'], 'pin_protected',
        [db.sequelize.literal('(SELECT IF(COUNT(id)>0, "catchup", "live") AS "stream_mode"  FROM channel_stream WHERE stream_source_id=' + req.auth.user.channel_stream_source_id + ' AND channel_id=channels.id AND stream_mode="catchup" AND stream_resolution LIKE "%' + req.auth.data.appid + '%")'), 'stream_mode']],
        where: where,
        group: ['id'],
        include: [
            { model: models.genre, required: true, attributes: [], where: { is_available: true } },
            {
                model: models.packages_channels,
                required: true,
                attributes: [],
                include: [
                    {
                        model: models.package,
                        required: true,
                        attributes: [],
                        where: { id: req.params.id },
                    }
                ]
            }
        ]
    }).then(function(channels) {
        response.sendData(req, res, channels);
    }).catch(function(err) {
        winston.error('Getting list of subscribed packages failed with error: ', err);
        response.sendError(req, res, 500, 'DATABASE_ERROR_DATA');
    });
}