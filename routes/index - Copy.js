'use strict';
var os = require('os');
var express = require('express');
var router = express.Router();
var jsonfile = require('jsonfile')
var sensorFile = './sensordata.json'
var csFile = './cs.json'
var util = require('../lib/util');
var hubName, customerList, custIdx;

var request = require('request');
var requestJ = require("request-json");
var registrarUri = 'https://luca-devreg.azurewebsites.net'

var deviceId, devcs = '', hubcs = '', client, status = '';
var cs;
var myTimer, lsm = 'no telemetry started', interval = 60000;
var sensorArray = [], twinArray = [], sysArray = [], tagArray = [], propArray = [];

// auxiliary functions
function printResultFor(op) {
  return function printResult(err, res) {
    if (err) console.log(op + ' error: ' + err.toString());
    if (res) console.log(op + ' status: ' + res.constructor.name);
  };
}

function printDeviceInfo(err, deviceInfo, res) {
  if (deviceInfo) {
    deviceKey = deviceInfo.authentication.symmetricKey.primaryKey;
  }
}

//routing
router.get('/', function (req, res, next) {
  let dev = util.getDev();
  deviceId = (dev ? dev.deviceId : os.hostname())

  if (!dev) {
    request(registrarUri, function (error, response, body) {
      customerList = JSON.parse(body).customerList;

      res.render('new', {
        title: "Azure MQTT telemetry Simulator",
        deviceId: deviceId,
        status: 'inactive',
        customerList: customerList
      });
    });
  } else {
    res.render('connect', { title: 'Azure IoT Telemetry Simulator', deviceId: deviceId });
  }

});

router.post('/', function (req, res, next) {
  hubName = customerList[req.body.custIdx] + '.azure-devices.net'
  var dpsClient = requestJ.createClient(registrarUri);

  if (req.body.deviceId !== '')
    deviceId = req.body.deviceId;
  var data = {
    "deviceId": deviceId,
    "customerId": req.body.custIdx
  };
  dpsClient.put('/', data, function (err, result, body) {
    if (err)
      res.render('error', { error: err });
    else {
      cs = {"deviceId": deviceId, "cs": 'HostName=' + hubName + ';DeviceId=' + deviceId + ';SharedAccessKey=' + result.body.deviceKey}
      util.setDev(cs)
      res.render('status', { title: 'Azure IoT Telemetry Simulator', status: status, lsm: lsm, deviceId: util.getDev().deviceId });
    }
  });
});

router.get('/status', function (req, res, next) {
  res.render('status', { title: 'Azure IoT Telemetry Simulator', status: util.getStatus().conn, lsm: util.getStatus().lsm, deviceId: util.getDev().deviceId });
});

router.get('/device', function (req, res, next) {
  res.render('device', { title: 'Azure IoT Telemetry Simulator', status: util.getStatus().conn, deviceId: util.getDev().deviceId });
});

router.post('/device', function (req, res, next) {
  console.log('Status: ' + util.getStatus().conn)
  console.log(req.body)
  res.render('device', { title: 'Azure IoT Telemetry Simulator', status: util.getStatus().conn, deviceId: util.getDev().deviceId });
});

router.get('/sensor', function (req, res, next) {
  var sensorArray = util.getSensorArray();
  res.render('sensor', { title: 'Azure IoT Telemetry Simulator', deviceId: util.getDev().deviceId, sensors: sensorArray });
});

router.post('/sensor', function (req, res, next) {
  var sensorArray = util.setSensorArray(req.body);
  res.render('sensor', { title: 'Azure IoT Telemetry Simulator', deviceId: util.getDev().deviceId, sensors: sensorArray });
});

module.exports = router;
