"use strict";

var eventSystem = require('./event_system'),
    db = require('./sequelize').models,
    axios = require('axios');

function initWebhooks(app) {
    db.webhooks.findAll({
        where: {enable: true}
    }).then(function(webhooks) {
        webhooks.forEach(webhook => {
            webhook.events.forEach(event => {
                registerWebhook(webhook.company_id, event);
            })
        });
    })
}

function registerWebhook(companyID, eventType) {
    eventSystem.subscribe(companyID, eventType, onEvent)
}

function unRegisterWebhook(companyID, eventType) {
    eventSystem.unSubscribe(companyID, eventType, onEvent);
}

function onEvent(companyID, eventType, args) {
    db.webhooks.findOne({
        where: {company_id: companyID, enable: true}
    }).then(function(webhook) {
        if (!webhook || webhook.events.indexOf(eventType) == -1) {
            //todo unsubscribe
            return;
        }

        sendWebhook(webhook.url, eventType, args);
    })
}

function sendWebhook(url, eventType, data) {
    let webhookEvent = {
        version: '0.1',
        event_type: eventType,
        data: data
    }

    axios.post(url, webhookEvent)
        .catch(function(err) {

        });
}

module.exports = {
    initWebhooks: initWebhooks,
    registerWebhook: registerWebhook,
    unRegisterWebhook: unRegisterWebhook
}