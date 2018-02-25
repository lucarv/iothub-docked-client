'use strict';
var os = require('os');
var express = require('express');
var router = express.Router();

var csFile = './cs.json'
var util = require('../lib/util');

var hubName, customerList, custIdx;

var request = require('request');
var requestJ = require("request-json");
var registrarUri = 'https://luca-devreg.azurewebsites.net'

const AMQP = require('azure-iot-device-amqp');
const MQTT = require('azure-iot-device-mqtt');
const Message = require('azure-iot-device').Message;

var clientFromConnectionString, client;
var ConnectionString = require('azure-iot-device').ConnectionString;

var deviceId, devcs = '', hubcs = '';
var since, connected = false;
var telemetry = false, looper, lsm = 'no telemetry started';

// properties: reported properties
var properties = {
  serialNumber: '123-ABC',
  manufacturer: 'LucaMeter'
};

// settings: desired properties
var settings = {
  'frequency': 'not set',
  'payload': 'not set',
  'protocol': 'mqtt'
}

// Handle settings changes that come from Microsoft IoT Central via the device twin.
function handleSettings(twin) {
  twin.on('properties.desired', function (desiredChange) {
    for (let setting in desiredChange) {
      if (settings[setting])
        settings[setting] = desiredChange[setting].value;
    }
    if (telemetry) {
      clearInterval(looper);
      looper = setInterval(sendTelemetry, settings.frequency);
    }
  })
}

var sendDeviceProperties = function (twin) {
  twin.properties.reported.update(properties, function (err) {
    if (err)
      console.log(err)
  });
}

// auxiliary functions
var connectCallback = (err) => {
  if (err) {
    console.log(`Device could not connect to Microsoft IoT Central: ${err.toString()}`);
  } else {
    console.log('Device successfully connected to Microsoft IoT Central');
    client.getTwin((err, twin) => {
      if (err) {
        console.log(`Error getting device twin: ${err.toString()}`);
      } else {
        // Send device properties once on device start up.
        sendDeviceProperties(twin);
        // Apply device settings and handle changes to device settings.
        handleSettings(twin);
      }
    });
  };
}

var payloadCB = (data) => {
  var message = new Message(data);
  client.sendEvent(message, (err, res) => console.log(`Sent message: ${message.getData()}` +
    (err ? `; error: ${err.toString()}` : '') +
    (res ? `; status: ${res.constructor.name}` : '')));
}


function sendTelemetry() {
  if (settings.payload == 'json') {
    let data = util.buildJson();
    var message = new Message(data);
    message.properties.add("tenant", util.getDev().tenantId);

    client.sendEvent(message, (err, res) => console.log(`Sent message: ${message.getData()}` +
      (err ? `; error: ${err.toString()}` : '') +
      (res ? `; status: ${res.constructor.name}` : '')));
  } else {
    let data = util.buildAvro(payloadCB)
  }
}
function renderSPA(res) {
  res.render('spa', {
    title: 'Azure IoT Telemetry Simulator',
    deviceId: util.getDev().deviceId, tenantId: util.getDev().tenantId, hubName: hubName,
    connected: connected, since: since,
    telemetry: telemetry, lsm: lsm,
    properties: properties, settings: settings
  })
}
//routing
router.get('/', function (req, res, next) {
  since = new Date().toISOString()
  let dev = util.getDev();
  deviceId = (dev ? dev.deviceId : '')

  if (!dev) {
    request(registrarUri, function (error, response, body) {
      customerList = JSON.parse(body).customerList;

      res.render('new', {
        title: "Azure MQTT telemetry Simulator",
        status: 'inactive',
        customerList: customerList
      });
    });
  } else {
    let cs = util.getDev().cs;
    let semicolon = cs.indexOf(';');
    hubName = cs.substring(9, semicolon)
    renderSPA(res);
  }

});

router.post('/', function (req, res, next) {
  hubName = customerList[req.body.custIdx] + '.azure-devices.net'
  var dpsClient = requestJ.createClient(registrarUri);

  let deviceId = req.body.deviceId;
  let tenantId = req.body.tenantId;
  var data = {
    "deviceId": deviceId,
    "customerId": req.body.custIdx
  };
  dpsClient.put('/', data, function (err, result, body) {
    if (err)
      res.render('error', { error: err });
    else {
      let cs = { "deviceId": deviceId, "cs": 'HostName=' + hubName + ';DeviceId=' + deviceId + ';SharedAccessKey=' + result.body.deviceKey, "tenantId": tenantId }
      util.setDev(cs)
      renderSPA(res);
    }
  });
});

router.post('/connect', function (req, res, next) {
  if (!connected) {
    clientFromConnectionString = (settings.protocol == 'mqtt' ? MQTT.clientFromConnectionString : AMQP.clientFromConnectionString);
    client = clientFromConnectionString(util.getDev().cs);
    client.open(connectCallback);
    connected = true;
    lsm = since = new Date().toISOString();
  } else {
    connected = false;
    since = new Date().toISOString()
    //do something here to close the connection
  }
  renderSPA(res);
});

router.post('/telemetry', function (req, res, next) {
  if (!telemetry) {
    telemetry = true;
    looper = setInterval(sendTelemetry, settings.frequency);
  }
  else {
    //do something here to close the connection
    telemetry = false;
    clearInterval(looper);
  }
  renderSPA(res);
});

router.get('/device', function (req, res, next) {
  res.render('device', { title: 'Azure IoT Telemetry Simulator', status: util.getStatus().conn, deviceId: util.getDev().deviceId });
});

router.post('/device', function (req, res, next) {
  switch (req.body.change) {
    case 'twin':
      if (req.body.sn !== "")
        properties.serialNumber = req.body.sn;
      if (req.body.manuf !== "")
        properties.manufacturer = req.body.manuf;

      client.getTwin((err, twin) => {
        if (err) {
          console.log(`Error getting device twin: ${err.toString()}`);
        } else {
          sendDeviceProperties(twin)
        }
      });

      renderSPA(res);
    case 'register':
      console.log(req.body)
      renderSPA(res);
      break;
    case 'device':
      res.render('device', { title: 'Azure IoT Telemetry Simulator', status: telemetry });
      break;
    default:
      console.log(req.body)
      renderSPA(res);
      break;
  }
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
