'use strict';

const jsonfile = require('jsonfile')
const avro = require('avsc'),
    streams = require('memory-streams');

const sensorFile = 'sensordata.json'
const csFile = 'cs.json'
const type = avro.parse(__dirname + '/schema.avsc')

var dev = null;
var sensorArray = [], lastVal = 0;
var status = { 'conn': 'off', 'lsm': 'not started' }

jsonfile.readFile(sensorFile, function (err, obj) {
    if (obj)
        sensorArray = obj;
})

jsonfile.readFile(csFile, function (err, obj) {
    if (obj)
        dev = obj;
})

var getDev = function () {
    if (dev == '')
        return null
    else return dev
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

    buildSchema();

    return sensorArray
}

function buildSchema() {
    var fieldArray = [];

    for (var i = 0; i < sensorArray.length; i++) {
        fieldArray[i] = { 'name': sensorArray[i].name, 'type': sensorArray[i].type }
    }

    var type = avro.parse({
        name: 'telemetry',
        type: 'record',
        fields: fieldArray
    });

    return type;
}

var setStatus = function (st) {
    status = st;
}

var getStatus = function () {
    return status
}

function buildJson() {
    let payload = new Object()

    let sensors = getSensorArray()
    for (let i = 0; i < sensors.length; i++) {
        let val = 0;
        if (sensors[i].type == 'snapshot')
            val = Math.random() * (sensors[i].max - sensors[i].min) + sensors[i].min;
        else {
            val = lastVal + Math.floor(Math.random() * 11); //not really a good way to do this
            lastVal = val
        }
        payload[sensors[i].name] = val;
    }
    return JSON.stringify(payload);
}

var buildAvro = function (callback) {

    var avroEncoder = new avro.streams.BlockEncoder(type, { codec: 'deflate' }); // Choose 'deflate' or it will default to 'null'
    var writer = new streams.WritableStream();
    avroEncoder.pipe(writer);

    // Generate the faux json
    var power = 20 + (Math.random() * 5); // range: [20, 25]
    var json = { power: power };


    // Write the json
    if (type.isValid(json)) {
        avroEncoder.write(json);
    }
    // Call end to tell avro we are done writing and to trigger the end event.
    avroEncoder.end();

    // end event was triggered, get the avro data from the piped stream and send to IoT Hub.
    avroEncoder.on('end', function () {
        console.log(writer.toBuffer())
        return callback(writer.toBuffer());
    })
}
module.exports.getSensorArray = getSensorArray;
module.exports.setSensorArray = setSensorArray;
module.exports.buildSchema = buildSchema;
module.exports.buildJson = buildJson;
module.exports.buildAvro = buildAvro;

module.exports.getDev = getDev;
module.exports.setDev = setDev;

module.exports.getStatus = getStatus;
module.exports.setStatus = setStatus;
