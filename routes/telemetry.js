'use strict';
var env = require('dotenv').config();
var express = require('express');
var router = express.Router();
var util = require('../lib/util');

// azure sdk
var clientFromConnectionString = require('azure-iot-device-mqtt').clientFromConnectionString;
var Message = require('azure-iot-device').Message;
var Client = require('azure-iot-device').Client;
var Protocol = require('azure-iot-device-mqtt').Mqtt;

var deviceId = 'unknown', devcs = '', hubcs = '', client, status = 'disconnected';
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

function composeMessage() {
    var msg = {};
    for (var i = 0; i < sensorArray.length; i++)
        msg[sensorArray[i].name] = Math.random() * (sensorArray[i].max - sensorArray[i].min) + sensorArray[i].min;

    return msg;
}
//routing

router.get('/', function (req, res, next) {
    sensorArray = util.getSensorArray();
    res.render('tele', { title: 'Azure MQTT telemetry Simulator', deviceId: util.getDev().deviceId });
});

router.post('/', function (req, res, next) {
    var new_lsm = '';
    switch (req.body.action) {
        case 'start':
            var client = clientFromConnectionString(util.getDev().cs);
            client.open(function (err) {
                if (err) {
                    res.render('error', { error: err });
                } else {
                    // Create a message and send it to the IoT Hub at interval
                    if (req.body.interval !== '')
                        interval = req.body.interval;
                    console.log('setting telemetry at: ' + interval + ' ms');
                    myTimer = setInterval(function () {
                        var data = JSON.stringify(composeMessage());
                        var message = new Message(data);
                        client.sendEvent(message, printResultFor('send'));
                        lsm = new Date(Date.now()).toUTCString();
                        util.setStatus({ 'conn': 'sending telemetry data', 'lsm': lsm })
                    },
                        interval);
                    util.setStatus({ 'conn': 'starting to transmit', 'lsm': lsm })
                    res.render('status', { title: 'Azure MQTT telemetry Simulator', status: 'connected', deviceId: util.getDev().deviceId, lsm: 'starting to transmit' });
                }
            });
            break;
        case 'replay':
            //implement
            res.render('status', { title: 'Azure MQTT telemetry Simulator', deviceId: util.getDev().deviceId, lsm: lsm });
            break;
        case 'stop':
            clearInterval(myTimer);
            util.setStatus({ 'conn': 'idle', 'lsm': lsm })
            res.render('status', { title: 'Azure MQTT telemetry Simulator', status: 'idle', deviceId: util.getDev().deviceId, lsm: lsm });
            break;
        case 'fault':
            res.send('not implemented');
            break;
        case 'refresh':
            res.render('status', { title: 'Azure MQTT telemetry Simulator', deviceId: util.getDevId(), lsm: lsm });
            break;
    }
});





module.exports = router;
