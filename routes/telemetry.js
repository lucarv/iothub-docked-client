'use strict';
const avro = require('avsc'), // nodejs avro implementation
    streams = require('memory-streams'); // used to pipe the avro buffer to IoT Hub message object
const express = require('express');
const router = express.Router();

const env = require('dotenv').config();
const random = require('random-float')
const util = require('../lib/util');

const type = avro.parse({
    "name": "telemetry",
    "type": "record",
    "fields": [
        { "name": "temperature", "type": "float" },
        { "name": "windSpeed", "type": "float" }
    ]
})

// IoT Hub setup
const AMQP = require('azure-iot-device-amqp');
const MQTT = require('azure-iot-device-mqtt');
const Message = require('azure-iot-device').Message;

var client, Client = require('azure-iot-device').Client;
var deviceId = 'unknown', devcs = '', hubcs = '', client, status = 'disconnected';
var sensorArray;
var cs;
var myTimer, lsm = 'no telemetry started', teleType;

function buildJson() {
    let payload = new Object()

    let sensors = util.getSensorArray()
    for (let i = 0; i < sensors.length; i++) {
        let val = Math.random() * (sensors[i].max - sensors[i].min) + sensors[i].min;
        payload[sensors[i].name] = val;
    }
    return payload;

}

var sendJson = function () {
    let data = JSON.stringify(buildJson());
    var message = new Message(data);

    client.sendEvent(message, function (err) {
        if (err)
            console.log(err.toString());
        else {
            console.log('Sending message: ' + message.getData());
            lsm = new Date().toISOString()
            util.setStatus({ lsm: lsm, conn: status });
        }
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
        lsm = new Date().toISOString();
        util.setStatus({ lsm: lsm, conn: status });
    })
}
//routing

router.get('/', function (req, res, next) {
    sensorArray = util.getSensorArray();
    res.render('tele', { title: 'Azure MQTT telemetry Simulator', deviceId: util.getDev().deviceId });

});

router.post('/', function (req, res, next) {
    switch (req.body.action) {
        case ('start'):
            let teleType = (req.body.payload ? req.body.payload : 'json');
            let protocol = (req.body.protocol ? req.body.protocol : 'mqtt')
            let interval = (req.body.interval ? parseInt(req.body.interval) : 30000);
            let clientFromConnectionString = (protocol == 'mqtt' ? MQTT.clientFromConnectionString : AMQP.clientFromConnectionString);
            client = clientFromConnectionString(util.getDev().cs);
            client.open(function (err) {
                if (err) {
                    console.error('Could not connect to IoT Hub: ' + err.message);
                } else {
                    console.log('Connected to IoT Hub');

                    myTimer = setInterval(teleType === 'json' ? sendJson : sendAvro, interval);
                    res.render('status', { title: 'Azure MQTT telemetry Simulator', deviceId: util.getDev().deviceId, lsm: 'starting...', status: 'transmitting' });

                    // Send events to IoT Hub on a timer.

                    client.on('error', function (err) {
                        console.error(err.message);
                    });

                    client.on('disconnect', function () {
                        client.removeAllListeners();
                    });
                };
            });
            break;
        case ('stop'):
            clearInterval(myTimer);
            util.setStatus({ lsm: lsm, conn: 'silent' });
            res.render('status', { title: 'Azure MQTT telemetry Simulator', deviceId: util.getDev().deviceId, lsm: lsm, status: 'silent' });
            break;
    }
});

function printResultFor(op) {
    return function printResult(err, res) {
        if (err) console.log(op + ' error: ' + err.toString());
        if (res) console.log(op + ' status: ' + res.constructor.name);
    };
}

module.exports = router;
