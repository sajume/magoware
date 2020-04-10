'use strict'

const path = require('path'),
    db = require(path.resolve('./config/lib/sequelize')),
    models = db.models,
    response = require('../utils/response'),
    winston = require('winston'),
    streamStore =require(path.resolve('./config/lib/stream_store'));

/**
 * @api {get} /apiv4/channel/:id Get Channel
 * @apiName Channel
 * @apiGroup Channel
 * @apiVersion  4.0.0
 * @apiHeader {String} x-authorization/auth Authorization key
 * @apiSuccess (Success 200) {Object} response Response
 * @apiSuccess {Object[]} response.data List of channels
 * @apiSuccess {Number} response.data.id Id
 * @apiSuccess {Number} response.data.genre_id Genre id
 * @apiSuccess {Number} response.data.channel_number Channel number
 * @apiSuccess {String} response.data.title Title
 * @apiSuccess {String} response.data.icon_url Icon url
 * @apiSuccess {Bool} response.data.pin_protected Pin protection status
 * @apiError (Error 4xx) {Object} error Error
 * @apiError {Number} error.code Code
 * @apiError {String} error.message Message description of error
*/
exports.getChannel = function (req, res) {
    if (!req.params.id) {
        response.sendError(req, res, 400, 'BAD_REQUEST_DATA');
        return;
    }

    models.channels.findOne({
        attributes: ['id', 'genre_id', 'channel_number', 'title', [db.sequelize.fn('concat', req.app.locals.backendsettings[req.auth.company_id].assets_url, db.sequelize.col('channels.icon_url')), 'icon_url'], 'pin_protected'],
        where: {id: req.params.id},
        include: [
            {
                model: models.genre,
                attributes: ['id', 'description', 'is_available', 'pin_protected', [db.sequelize.fn('concat', req.app.locals.backendsettings[req.auth.company_id].assets_url, db.sequelize.col('genre.icon_url')), 'icon_url']]
            }
        ]
    }).then(function(channels) {
        response.sendData(req, res, channels);
    }).catch(function(err) {
        winston.error('Getting list of subscribed packages failed with error: ', err);
        response.sendError(req, res, 500, 'DATABASE_ERROR_DATA');
    });
}

exports.getChannelStream = function(req, res) {
    streamStore.getChannelStreams(req.auth.company_id, req.params.id, req.auth.user.channel_stream_source_id, req.query.stream_mode, req.auth.data.appid)
        .then(function(stream) {
            res.send(stream);
        })
        .catch(function(err) {
            if (err.code != 400) {
                winston.error("Getting channel stream failed with error:", err.message);
            }

            response.sendError(req, res, err.code, 'ERR_STREAM_NOT_FOUND');
        });
}