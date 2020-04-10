"use strict";

const path = require('path'),
    EventEmitter = require('events');

//All event types should be declared here
const EventType = {
    Customer_Created: 'Customer_Created',
    Customer_Updated: 'Customer_Updated',
    Subscription_Created: 'Subscription_Created',
    Subscription_Canceled: 'Subscription_Canceled'
};
Object.freeze(EventType);

const EventTypes = Object.keys(EventType);
Object.freeze(EventTypes);

const eventEmitter = new EventEmitter();

function subscribe(companyID, eventType, handler) {
    if (!EventType[eventType]) {
        throw new Error('Event type given is not a valid one!');
    }

    //Compose event key because not just one company
    let eventKey = companyID + ':' + eventType;

    eventEmitter.addListener(eventKey, handler);
}

function unSubscribe(companyID, eventType, handler) {
    let eventKey = companyID + ':' + eventType;
    eventEmitter.removeListener(eventKey, handler);
}

function emit(companyID, eventType, args) {
    let eventKey = companyID + ':' + eventType;
    eventEmitter.emit(eventKey, companyID, eventType, args);
}

module.exports = {
    EventType: EventType,
    EventTypes: EventTypes,
    subscribe: subscribe,
    unSubscribe: unSubscribe,
    emit: emit
}