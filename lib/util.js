'use strict';

var jsonfile = require('jsonfile')
var sensorFile = 'sensordata.json'
var csFile = 'cs.json'

var dev;
var sensorArray = [];
var status = { 'conn': 'disconnected', 'lsm': 'not started' }

jsonfile.readFile(sensorFile, function (err, obj) {
    if (obj)
        sensorArray = obj;      
})

jsonfile.readFile(csFile, function (err, obj) {
    if (obj) 
        dev = obj;
})

var getDev = function () {
    return dev
}

var setDev = function (deviceInfo) {
    dev = deviceInfo
    jsonfile.writeFile(csFile, deviceInfo, function (err) {
        if (err) {
            console.error('error writing to file');
        }
        else {
            console.log('connection string written to file');
        }
    })
}

var getSensorArray = function () {
    console.log('util: ' + JSON.stringify(sensorArray));

    return sensorArray
}

var setSensorArray = function (sensor) {
    if (sensor.action === 'clear')
        sensorArray = [];

    else {
        var meas = {};
        meas['name'] = sensor.name;
        meas['type'] = sensor.type;
        meas['min'] = sensor.min;
        meas['max'] = sensor.max;
        meas['unit'] = sensor.unit;

        sensorArray.push(meas);

    }
    jsonfile.writeFile(sensorFile, sensorArray, function (err) {
        if (err)
            console.error(err);
        else
            console.log('written to file');
    })

    return sensorArray
}

var setStatus = function (st) {
    status = st;
}

var getStatus = function () {
    return status
}

module.exports.getSensorArray = getSensorArray;
module.exports.setSensorArray = setSensorArray;

module.exports.getDev = getDev;
module.exports.setDev = setDev;

module.exports.getStatus = getStatus;
module.exports.setStatus = setStatus;

