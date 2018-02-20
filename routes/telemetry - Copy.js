'use strict';
var env = require('dotenv').config();
const express = require('express');

var router = express.Router();
const avro = require('avsc');
const streams = require('memory-streams');
const random = require('random-float')
var util = require('../lib/util');

// azure sdk
var Protocol = require('azure-iot-device-mqtt').Mqtt;
var Client = require('azure-iot-device').Client;

var client = Client.fromConnectionString(process.env.iotHubConnectionString, Protocol);
var Message = require('azure-iot-device').Message;
var payload = {};
const type = avro.parse({
    "name": "telemetry",
    "type": "record",
    "fields": [
        { "name": "temperature", "type": "float" },
        { "name": "humidity", "type": "float" }
    ]
})

var deviceId = 'unknown', devcs = '', hubcs = '', client, status = 'disconnected';
var sensorArray;
var cs;
var myTimer, lsm = 'no telemetry started', interval = 60000;


// auxiliary functions
function printResultFor(op) {
    return function printResult(err, res) {
        if (err) console.log(op + ' error: ' + err.toString());
        if (res) console.log(op + ' status: ' + res.constructor.name);
    };
}
var connectCallback = function (err) {
    if (err) {
        console.error('Could not connect to IoT Hub: ' + err.message);
    } else {
        console.log('Connected to IoT Hub');

        // Send events to IoT Hub on a timer.
        var sendInterval = setInterval(function () {

            // Instantiate a BlockEncoder, which allows you to write avro into a buffer.
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
        }, 5000);

        client.on('error', function (err) {
            console.error(err.message);
        });

        client.on('disconnect', function () {
            clearInterval(sendInterval);
            client.removeAllListeners();
        });
    }
};
function sendAsAvro() {

    console.log('sending avro');
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
        console.log(message)

        console.log('Sending message: ' + message.getData());
        client.sendEvent(message, printResultFor('send'));
    })
}



    /*
    var avroEncoder = new avro.streams.BlockEncoder(type, { codec: 'deflate' }); // Choose 'deflate' or it will default to 'null'

    // Instantiate a stream to write the avro buffer to, which we'll send to IoT Hub
    var writer = new streams.WritableStream();
    avroEncoder.pipe(writer);

    // Generate the faux json
    var humidity = 10 + (Math.random() * 4); // range: [10, 14]
    var temperature = 20 + (Math.random() * 5); // range: [20, 25]
    var json = { humidity: humidity, temperature: temperature };

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
    */

//routing

router.get('/', function (req, res, next) {
    sensorArray = util.getSensorArray();
    res.render('tele', { title: 'Azure MQTT telemetry Simulator', deviceId: util.getDev().deviceId });
});

router.post('/', function (req, res, next) {
    var new_lsm = '';

    switch (req.body.action) {
        case 'start':
            //client.open(connectCallback);
            sensorArray = util.getSensorArray()
            client.open(function (err) {
                if (err) {
                    res.render('error', { error: err });
                } else {
                    // Create a message and send it to the IoT Hub at interval
                    if (req.body.interval !== '')
                        interval = req.body.interval;

                    myTimer = setInterval(function () {
                        for (var i = 0; i < sensorArray.length; i++)
                            payload[sensorArray[i].name] = random(Number(sensorArray[i].max), Number(sensorArray[i].min));

                        // avro encoded json
                        if (req.body.payload == 0) {
                            sendAsAvro()
                        }
                        // plain json
                        else {
                            var message = new Message(payload.toString())
                            client.sendEvent(message, printResultFor('send'));
                        }


                        lsm = new Date(Date.now()).toUTCString();
                        util.setStatus({ 'conn': 'sending telemetry data', 'lsm': lsm })
                    }, interval);
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
