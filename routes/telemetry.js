'use strict';
const avro = require('avsc'), // nodejs avro implementation
    streams = require('memory-streams'); // used to pipe the avro buffer to IoT Hub message object
const express = require('express');
const router = express.Router();

const env = require('dotenv').config();
const random = require('random-float')
var util = require('../lib/util');

const type = avro.parse({
    "name": "telemetry",
    "type": "record",
    "fields": [
        { "name": "temperature", "type": "float" },
        { "name": "windSpeed", "type": "float" }
    ]
})

// IoT Hub setup
var Protocol = require('azure-iot-device-mqtt').Mqtt;
var Client = require('azure-iot-device').Client;
var Message = require('azure-iot-device').Message;
var client = Client.fromConnectionString(process.env.iotHubConnectionString, Protocol);


var deviceId = 'unknown', devcs = '', hubcs = '', client, status = 'disconnected';
var sensorArray;
var cs;
var myTimer, lsm = 'no telemetry started', interval = 60000, teleType;

function buildJson() {
    let payload = new Object()

    let sensors = util.getSensorArray()
    for (let i = 0; i < sensors.length; i++) {
        let val = Math.random() * (sensors[i].max - sensors[i].min) + sensors[i].min;
        payload[sensors[i].name] = val;
    }
    return payload;

}
var connectCallback = function (err) {
    if (err) {
        console.error('Could not connect to IoT Hub: ' + err.message);
    } else {
        console.log('Connected to IoT Hub');
        setInterval(teleType === 'json' ? sendJson : sendAvro, 5000);

        // Send events to IoT Hub on a timer.

        client.on('error', function (err) {
            console.error(err.message);
        });

        client.on('disconnect', function () {
            client.removeAllListeners();
        });
    }
};

var sendJson = function () {
    let data = JSON.stringify(buildJson());
    var message = new Message(data);

    client.sendEvent(message, function (err) {
        if (err)
            console.log(err.toString());
    });

}

var sendAvro = function () {
    var avroEncoder = new avro.streams.BlockEncoder(type, { codec: 'deflate' }); // Choose 'deflate' or it will default to 'null'

    // Instantiate a stream to write the avro buffer to, which we'll send to IoT Hub
    var writer = new streams.WritableStream();
    avroEncoder.pipe(writer);

    // Generate the faux json
    var windSpeed = 10 + (Math.random() * 4); // range: [10, 14]
    var temperature = 20 + (Math.random() * 5); // range: [20, 25]
    var json = { windSpeed: windSpeed, temperature: temperature };

    // Write the json
    if (type.isValid(json)) {
        avroEncoder.write(json);
    }

    // Call end to tell avro we are done writing and to trigger the end event.
    avroEncoder.end();

    // end event was triggered, get the avro data from the piped stream and send to IoT Hub.
    avroEncoder.on('end', function () {
        // call toBuffer on the WriteableStream and pass to IoT Hub message ctor
        var message = new Message(writer.toBuffer());

        console.log('Sending message: ' + message.getData());
        client.sendEvent(message, printResultFor('send'));
    })
}
//routing

router.get('/', function (req, res, next) {
    sensorArray = util.getSensorArray();
    res.render('tele', { title: 'Azure MQTT telemetry Simulator', deviceId: util.getDev().deviceId });
});

router.post('/', function (req, res, next) {
    teleType = req.body.payload;
    client.open(connectCallback);
    res.render('tele', { title: 'Azure MQTT telemetry Simulator', deviceId: util.getDev().deviceId });
});

function printResultFor(op) {
    return function printResult(err, res) {
        if (err) console.log(op + ' error: ' + err.toString());
        if (res) console.log(op + ' status: ' + res.constructor.name);
    };
}
module.exports = router;
