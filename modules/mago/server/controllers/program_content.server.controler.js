'use strict';

/**
 * Module dependencies.
 */
var path = require('path'),
    errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller')),
    winston = require('winston'),
    models = require(path.resolve('./config/lib/sequelize')).models;

/**
 * Create
 */
exports.create = function(req, res) {
    req.body.company_id = req.token.company_id; //save record for this company
    models.program_content.create(req.body).then(function(result) {
        if (!result) {
            res.status(400).send({message: 'Failed to create program content'});
            return;
        }

        res.json(result);
    }).catch(function(err) {
        winston.error('Creating program content failed with error: ', err);
        res.status(400).send({
            message: errorHandler.getErrorMessage(err)
        });
    });
};

/**
 * Show current
 */
exports.read = function(req, res) {
    if(req.program_content.company_id === req.token.company_id) res.json(req.program_content);
    else res.status(404).send({message: 'No data with that identifier has been found'});
};

/**
 * Update
 */
exports.update = function(req, res) {
    if(req.program_content.company_id === req.token.company_id){
        req.program_content.updateAttributes(req.body).then(function(result) {
            res.json(result);
        }).catch(function(err) {
            winston.error("Updating program content failed with errro: ", err);
            return res.status(400).send({
                message: errorHandler.getErrorMessage(err)
            });
        });
    }
    else{
        res.status(404).send({message: 'User not authorized to access these data'});
    }
};

/**
 * Delete
 */
exports.delete = function(req, res) {
    req.program_content.destroy().then(function() {
        res.json(req.program_content);
    }).catch(function(err) {
        winston.error('Deleting program content failed with error: ', err);
        res.status(400).send({
            message: errorHandler.getErrorMessage(err)
        });
    });
};

/**
 * List
 */
exports.list = function(req, res) {

    var qwhere = {company_id: req.token.company_id},
        final_where = {},
        query = req.query;

    if(query.q) {
        qwhere.$or = {};
        qwhere.$or.title = {};
        qwhere.$or.title.$like = '%'+query.q+'%';
    }

    //start building where
    final_where.where = qwhere;
    if(parseInt(query._end) !== -1){
        if(parseInt(query._start)) final_where.offset = parseInt(query._start);
        if(parseInt(query._end)) final_where.limit = parseInt(query._end)-parseInt(query._start);
    }
    models.program_content.findAndCountAll(final_where)
    .then(function(results) {
        if (!results) {
            return res.status(404).send({
                message: 'No data found'
            });
        } else {
            res.setHeader("X-Total-Count", results.count);
            res.json(results.rows);
        }
    }).catch(function(err) {
        winston.error("Error listing tv episode stream, error: ",err);
        res.json(err);
    });
};

/**
 * middleware
 */
exports.dataByID = function(req, res, next) {
    let id = req.params.id;

    models.program_content.find({
        where: {id: id, company_id: req.token.company_id},
    }).then(function(result) {
        if (!result) {
            res.status(404).send({
                message: 'No data with that identifier has been found'
            });
        } else {
            req.program_content = result;
            next();
        }
    }).catch(function(err) {
        winston.error("Error tv episode stream at dataById, error: ",err);
        res.status(400).send({
            message: errorHandler.getErrorMessage(err)
        });
    });
};
