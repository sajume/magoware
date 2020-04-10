'use strict'

function sendError(req, res, statusCode, errorCode) {
    let language = req.body.language ? req.body.language : 'eng';
    
    let response = {
        error: {
            code: errorCode,
            message: (languages[language]) ? languages[language].language_variables[errorCode] : languages['eng'].language_variables[errorCode]
        }
    }

    res.status(statusCode);
    res.send(response);
}

function sendData (req, res, data) {
    let response = {
        data: data
    }

    res.send(response);
}

module.exports = {
    sendData: sendData,
    sendError: sendError
}