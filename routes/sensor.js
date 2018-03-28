'use strict';
const express = require('express');
const router = express.Router();
var jsonfile = require('jsonfile')
var sensorFile = './sensordata.json'
var util = require('../lib/util');

router.get('/', function (req, res, next) {
    var sensorArray = util.getSensorArray();
    res.render('sensor', { title: 'Azure IoT Telemetry Simulator', deviceId: util.getDev().deviceId, sensors: sensorArray });
  });
  
  router.post('/', function (req, res, next) {
    var sensorArray = util.setSensorArray(req.body);
    res.render('sensor', { title: 'Azure IoT Telemetry Simulator', deviceId: util.getDev().deviceId, sensors: sensorArray });
  });
  
module.exports = router;
