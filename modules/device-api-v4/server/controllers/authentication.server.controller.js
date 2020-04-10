'use strict';
const path = require('path'),
  db = require(path.resolve('./config/lib/sequelize')),
  response = require(path.resolve("./config/responses.js")),
  password_encryption = require(path.resolve('./modules/deviceapiv2/server/controllers/authentication.server.controller.js')),
  models = db.models,
  async = require("async"),
  winston = require("winston");


/**
 * @api {get} /apiv4/credentials/company_list GetCompanyList
 * @apiName GetCompanyList
 * @apiGroup DeviceAPI
 *
 * @apiUse header_auth
 *
 *@apiDescription Returns list of companies that have a an account with this username
 *
 * Copy paste this auth for testing purposes
 *auth=%7Bapi_version%3D22%2C+appversion%3D1.1.4.2%2C+screensize%3D480x800%2C+appid%3D2%2C+devicebrand%3D+SM-G361F+Build%2FLMY48B%2C+language%3Deng%2C+ntype%3D1%2C+app_name%3DMAGOWARE%2C+device_timezone%3D2%2C+os%3DLinux%3B+U%3B+Android+5.1.1%2C+auth%3D8yDhVenHT3Mp0O2QCLJFhCUfT73WR1mE2QRc1ZE7J22cRfmskdTmhCk9ssGWhoIBpIzoTEOLIqwl%0A47NaUwLoLZjH1i2WRYaiioIRMqhRvH2FsSuf1YG%2FFoT9fEw4CrxF%0A%2C+hdmi%3Dfalse%2C+firmwareversion%3DLMY48B.G361FXXU1APB1%7D
 *
 */
exports.company_list = function (req, res, next) {

  models.login_data.findAll({
    attributes: ['id', 'username', 'password', 'salt', 'company_id'],
    where: {username: req.auth_obj.username},
    include: [{model: models.settings, attributes: ['id', 'company_name', 'new_encryption_key'], required: true}]
  }).then(function (companies) {

    if (!companies) {
      response.send_res_get(req, res, [], 704, -1, 'WRONG_PASSWORD_DESCRIPTION', 'WRONG_PASSWORD_DATA', 'no-store');
    } else {
      var company_list = [];
      for (var i = 0; i < companies.length; i++) {
        if (password_encryption.encryptPassword(req.body.password, companies[i].salt) === companies[i].password) {
          company_list.push(companies[i].setting);
        }
      }

      //if no password match
      if (company_list.length === 0) {
        response.send_res_get(req, res, [], 704, -1, 'WRONG_PASSWORD_DESCRIPTION', 'WRONG_PASSWORD_DATA', 'no-store');
      }
      //if one password match
      else if (company_list.length === 1 && companies[0].setting.id === 1) {
        req.auth_obj.company_id = companies[0].setting.id;
        req.body.company_id = companies[0].setting.id;
        req.body.isFromCompanyList = true;
        req.url = '/apiv4/auth/login';
        return req.app._router.handle(req, res, next);
      } else {
        response.send_res_get(req, res, company_list, 300, 1, 'OK_DESCRIPTION', 'OK_DATA', 'private,max-age=86400');
      }
    }

  }).catch(function (error) {
    winston.error("Finding the list of companies for this user failed with error: ", error);
    response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
  });
};


//improved function to controll login on multiple devices per screen size.
/**
 * @api {post} /apiv4/credentials/login /apiv2/credentials/login
 * @apiVersion 0.2.0
 * @apiName DeviceLogin
 * @apiGroup DeviceAPI
 *
 * @apiParam {String} username Customers login username.
 * @apiParam {String} password Customers login password.
 * @apiParam {String} boxid Unique device ID.
 *
 * @apiDescription If token is not present, plain text values are used to login
 */
exports.loginv2 = function (req, res) {
  models.app_group.findOne({
    attributes: ['app_group_id'],
    where: {app_id: req.auth_obj.appid}
  }).then(function (app_group) {
    models.devices.findAll({
      include: [{
        model: models.app_group,
        required: true,
        attributes: [],
        where: {app_group_id: app_group.app_group_id}
      }],
      where: {username: req.auth_obj.username, device_active: true, device_id: {not: req.auth_obj.boxid}}
    }).then(function (device) {

      if (!device || device.length < Number(req.thisuser.max_login_limit)) {
        upsertDevice({
          device_active: true,
          login_data_id: req.thisuser.id,
          username: req.auth_obj.username,
          device_mac_address: decodeURIComponent(req.body.macaddress),
          appid: req.auth_obj.appid,
          app_name: (req.body.app_name) ? req.body.app_name : '',
          app_version: req.body.appversion ? req.body.appversion : "1.0.0",
          ntype: req.body.ntype ? req.body.ntype : 1,
          device_id: req.auth_obj.boxid,
          hdmi: (req.body.hdmi == 'true') ? 1 : 0,
          firmware: decodeURIComponent(req.body.firmwareversion),
          device_brand: decodeURIComponent(req.body.devicebrand),
          screen_resolution: decodeURIComponent(req.body.screensize),
          api_version: decodeURIComponent(req.body.api_version),
          device_ip: req.ip.replace('::ffff:', ''),
          os: decodeURIComponent(req.body.os),
          language: req.body.language,
          company_id: req.thisuser.company_id,
          // googleappid:        req.body.googleappid
        }).then(function (result) {
          response.send_res(req, res, {token: req.deviceToken, company_id: req.thisuser.company_id}, 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'no-store');
          return null;
        }).catch(function (error) {
          winston.error("device upsert error : ", error);
          response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
        });
      } else {
        response.send_res(req, res, [], 705, -1, 'DUAL_LOGIN_ATTEMPT_DESCRIPTION', 'DUAL_LOGIN_ATTEMPT_DATA', 'no-store'); //same user try to login on another device
      }
      return null;
    }).catch(function (error) {
      winston.error("database error device search : ", error);
      response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
    });
    return null;
  }).catch(function (error) {
    winston.error("Searching for the app group's data failed with error: ", error);
    response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION_7', 'DATABASE_ERROR_DATA', 'no-store');
  });

};

function upsertDevice(device) {
  return new Promise(function (resolve, reject) {
    models.devices.findOne({
      where: {device_id: device.device_id}
    }).then(function (result) {
      if (!result) {
        return models.devices.create(device)
          .then(function () {
            resolve();
          })
          .catch(function (err) {
            reject(err);
          });
      } else {
        return result.update(device)
          .then(function () {
            resolve();
          })
          .catch(function (err) {
            reject(err);
          });
      }
    }).catch(function (err) {
      reject(err);
    });
  });
}

exports.login1 = (req, res) => {
  return response.send_res_get(req, res, req.deviceToken, 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'private,max-age=86400');
};