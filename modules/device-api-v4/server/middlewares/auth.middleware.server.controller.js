const jwt = require('jsonwebtoken'),
  jwtSecret = process.env.JWT_DEVICE_SECRET || "djsalkdjslkajkdsaldja",
  jwtIssuer = process.env.JWT_ISSUER;

const CryptoJS = require("crypto-js"),
  crypto = require("crypto"),
  cryptoAsync = require('@ronomon/crypto-async'),
  querystring = require("querystring"),
  path = require('path'),
  db = require(path.resolve('./config/lib/sequelize')),
  models = db.models,
  authenticationHandler = require(path.resolve('./modules/deviceapiv2/server/controllers/authentication.server.controller.js')),
  redis = require(path.resolve('./config/lib/redis')),
  response = require(path.resolve("./config/responses.js")),
  winston = require("winston");

const mobileAppIDs = [2, 3];
const appIDs = [1, 2, 3, 4, 5, 6, 7];

function missing_params(auth_obj) {
  return auth_obj.sub === undefined || auth_obj.data.appid === undefined || auth_obj.data.boxid === undefined;
}

function set_screensize(auth_obj) {
  if (mobileAppIDs.indexOf(auth_obj.appid) !== -1) {
    auth_obj.screensize = 2;
  } else {
    auth_obj.screensize = 1;
  }
}

function valid_appid(auth_obj) {
  return appIDs.indexOf(auth_obj.appid) !== -1;
}

function verifyAuth(req, res, auth) {
  return new Promise((resolve, reject) => {
    if (req.body.hdmi === 'true' && mobileAppIDs.indexOf(auth.data.appid) !== -1) {
      resolve();
      response.send_res(req, res, [], 888, -1, 'BAD_TOKEN_DESCRIPTION', 'INVALID_INSTALLATION', 'no-store'); //hdmi cannot be active for mobile devices
    } else if (valid_appid(auth.data) === true) {
      set_screensize(auth.data);
      if (req.empty_cred) {
        req.auth_obj = auth;
        resolve();
      } else {
        //reading client data
        models.login_data.findOne({
          where: {username: auth.sub, company_id: auth.company_id}
        }).then(function (result) {
          if (result) {
            if (result.account_lock) {
              response.send_res(req, res, [], 703, -1, 'ACCOUNT_LOCK_DESCRIPTION', 'ACCOUNT_LOCK_DATA', 'no-store');
              return;
            }
            req.auth.user = result;
            req.thisuser = result;
            req.auth_obj = auth;
            resolve();
          } else response.send_res(req, res, [], 702, -1, 'USER_NOT_FOUND_DESCRIPTION', 'USER_NOT_FOUND_DATA', 'no-store');
        }).catch(function (error) {
          reject(error);
          winston.error("Searching for the user account failed with error: ", error);
          response.send_res(req, res, [], 888, -1, 'BAD_TOKEN_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
        });
      }
    } else {
      reject();
      response.send_res(req, res, [], 888, -1, 'BAD_TOKEN_DESCRIPTION', 'INVALID_APPID', 'no-store');
    }
  })
}

const requireToken = async (req, res, next) => {
  const token = req.get("x-authorization").split(' ')[1];
  let companyId = req.headers.company_id || 1;
  const encryptionKey = req.app.locals.backendsettings[companyId].new_encryption_key;


  if (!token || token === '') {
    return response.send_res(req, res, [], 888, -1, 'BAD_TOKEN_DESCRIPTION', 'INVALID_TOKEN', 'no-store');
  }

  try {
    const tokenDecrypted = jwt.verify(token, encryptionKey);


    if (req.body.isFromCompanyList) {
      companyId = req.body.company_id;
    }

    if (!req.app.locals.backendsettings[companyId]) {
      response.send_res(req, res, [], 888, -1, 'BAD_TOKEN_DESCRIPTION', 'INVALID_TOKEN', 'no-store');
      return;
    }

    req.auth = tokenDecrypted;

    const missingParams = missing_params(tokenDecrypted);
    if (!missingParams) {
      //call verifyAuth
      await verifyAuth(req, res, tokenDecrypted);
    }


    if (!req.body.language) {
      if (tokenDecrypted.data) {
        req.body.language = tokenDecrypted.data.language || "en"
      } else {
        req.body.language = 'eng'
      }
    }


    next();
  } catch (err) {
    return response.send_res(req, res, [], 888, -1, 'BAD_TOKEN_DESCRIPTION', 'INVALID_TOKEN', 'no-store');
  }
};

const requireSignIn = (req, res, next) => {
  const username = req.body.username;
  const password = req.body.password;
  const companyId = req.body.company_id || 1;
  const screensize = req.body.screensize;
  const appid = req.body.appid;
  const devicebrand = req.body.devicebrand;
  const ntype = req.body.ntype;
  const app_name = req.body.app_name;
  const os = req.body.os;
  const api_verson = req.body.api_version;
  const appversion = req.body.appversion;
  // const macaddress = req.body.macaddress;
  const language = req.body.language || "en";
  const device_id = req.body.device_id; //this is the boxid
  const timestamp = req.body.timestamp;
  const mac_address = req.body.mac_address;
  const device_timezone = req.body.device_timezone;
  const hdmi = req.body.hdmi;
  const firmwareversion = req.body.firmwareversion;
  const encryptionKey = req.app.locals.backendsettings[companyId].new_encryption_key;


  if (!username || !password || !appid || !device_id) {
    return response.send_res(req, res, [], 888, -1, 'BAD_TOKEN_DESCRIPTION', 'Not all parameters are right', 'no-store');
  }

  //now we take the username and password, login and we generate the jwt
  models.login_data.findOne({
    where: {username: username, company_id: companyId}
  }).then(function (result) {
    if (result) {
      if (result.account_lock) {
        response.send_res(req, res, [], 703, -1, 'ACCOUNT_LOCK_DESCRIPTION', 'ACCOUNT_LOCK_DATA', 'no-store');
        next();
        return;
      }

      authenticationHandler.encryptPasswordAsync(password, result.salt, pass => {
        if (pass === result.password) {
          //here login success
          const data = {
            username,
            companyId,
            screensize,
            appid,
            api_verson,
            app_name,
            device_timezone,
            devicebrand,
            timestamp,
            mac_address,
            hdmi,
            firmwareversion,
            appversion,
            language,
            os,
            ntype,
            boxid: device_id
          };

          req.auth_obj = data;
          req.thisuser = result;

          req.deviceToken = jwt.sign(
            {
              id: result.id,
              company_id: result.company_id,
              data: data,
              iss: jwtIssuer,
              sub: result.username,
            }, encryptionKey, {
              expiresIn: "4h"
            });

          next();
        } else {
          response.send_res(req, res, [], 704, -1, 'WRONG_PASSWORD_DESCRIPTION', 'WRONG_PASSWORD_DATA', 'no-store');
          next("Wrong password");
        }
      });
    } else {
      response.send_res_get(req, res, [], 704, -1, 'USER_NOT_FOUND_DATA', 'USER_NOT_FOUND_DATA', 'no-store');
      next();
    }


  }).catch(err => {
    winston.error("There has been a error in here", err);
    response.send_res(req, res, [], 704, -1, 'WRONG_PASSWORD_DESCRIPTION', 'WRONG_PASSWORD_DATA', 'no-store');
    next(err);
  })
};

exports.requireToken = requireToken;
exports.requireSignIn = requireSignIn;