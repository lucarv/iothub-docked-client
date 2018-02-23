
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

var client, Client = require('azure-iot-device').Client, this_twin;
var protocol = 'mqtt', teleType = 'json', interval = 10000;
var deviceId = 'unknown', devcs = '', hubcs = '', status = 'off';
var sensorArray, lastVal = 0;
var cs;
var myTimer, lsm = 'no telemetry started', teleType;

var connectCallback = (err) => {
    if (err) {
      console.log(`Device could not connect to Microsoft IoT Central: ${err.toString()}`);
    } else {
      console.log('Device successfully connected to Microsoft IoT Central');
  
        // Get device twin from Microsoft IoT Central.
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
    }
  };

  function sendDeviceProperties(twin) {
    var properties = {
      serialNumber: '123-ABC',
      manufacturer: 'Contoso'
    };
    twin.properties.reported.update(properties, (err) => console.log(`Sent device properties; ` +
      (err ? `error: ${err.toString()}` : `status: success`)));
  }

  // Add any settings your device supports,
// mapped to a function that is called when the setting is changed.
var settings = {
    'fanSpeed': (newValue, callback) => {
        // Simulate it taking 1 second to set the fan speed.
        setTimeout(() => {
          callback(newValue, 'completed');
        }, 1000);
    },
    'setTemperature': (newValue, callback) => {
      // Simulate the temperature setting taking two steps.
      setTimeout(() => {
        targetTemperature = targetTemperature + (newValue - targetTemperature) / 2;
        callback(targetTemperature, 'pending');
        setTimeout(() => {
          targetTemperature = newValue;
          callback(targetTemperature, 'completed');
        }, 5000);
      }, 5000);
    }
  };
  function handleSettings(twin) {
    twin.on('properties.desired', function (desiredChange) {
      for (let setting in desiredChange) {
        if (settings[setting]) {
          console.log(`Received setting: ${setting}: ${desiredChange[setting].value}`);
          settings[setting](desiredChange[setting].value, (newValue, status, message) => {
            var patch = {
              [setting]: {
                value: newValue,
                status: status,
                desiredVersion: desiredChange.$version,
                message: message
              }
            }
            twin.properties.reported.update(patch, (err) => console.log(`Sent setting update for ${setting}; ` +
              (err ? `error: ${err.toString()}` : `status: success`)));
          });
        }
      }
    });
  }
function buildJson() {
    let payload = new Object()

    let sensors = util.getSensorArray()
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
    return payload;
}

var sendJson = function () {
    let data = JSON.stringify(buildJson());
    var message = new Message(data);

    //add some logic here to generate an usage alert
    message.properties.add('usagealert', 'true');
    client.sendEvent(message, function (err) {
        if (err)
            console.log(err.toString());
        else {
            console.log('Sending message: ' + message.getData());
            lsm = new Date().toISOString()
            util.setStatus({ lsm: lsm, conn: 'on' });
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
        util.setStatus({ lsm: lsm, conn: 'on' });
    })
}
//routing

router.get('/', function (req, res, next) {
    sensorArray = util.getSensorArray();
    res.render('tele', { title: 'Azure IoT Telemetry Simulator', deviceId: util.getDev().deviceId });

});

router.post('/', function (req, res, next) {
    switch (req.body.action) {
        case ('start'):
            myTimer = setInterval(teleType === 'json' ? sendJson : sendAvro, interval);
            util.setStatus({ lsm: lsm, conn: 'off' });
            res.render('status', { title: 'Azure IoT Telemetry Simulator', deviceId: util.getDev().deviceId, lsm: 'starting...', status: 'transmitting' });
            break;
        case ('stop'):
            clearInterval(myTimer);
            util.setStatus({ lsm: lsm, conn: 'off' });
            res.render('status', { title: 'Azure IoT Telemetry Simulator', deviceId: util.getDev().deviceId, lsm: util.getStatus().lsm, status: util.getStatus().conn });
            break;
    }
});

router.get('/connect', function (req, res, next) {
    sensorArray = util.getSensorArray();
    res.render('connect', { title: 'Azure IoT Telemetry Simulator', deviceId: util.getDev().deviceId });

});

router.post('/connect', function (req, res, next) {
    switch (req.body.action) {
        case ('on'):
        let clientFromConnectionString = (protocol == 'mqtt' ? MQTT.clientFromConnectionString : AMQP.clientFromConnectionString);
        client = clientFromConnectionString(util.getDev().cs);
        client.open(connectCallback);

        /*
            teleType = (req.body.payload ? req.body.payload : 'json');
            protocol = (req.body.protocol ? req.body.protocol : 'mqtt')
            interval = (req.body.interval ? parseInt(req.body.interval) : 30000);
            let clientFromConnectionString = (protocol == 'mqtt' ? MQTT.clientFromConnectionString : AMQP.clientFromConnectionString);
            client = clientFromConnectionString(util.getDev().cs);
            client.open(function (err) {
                if (err) {
                    console.error('Could not connect to IoT Hub: ' + err.message);
                } else {
                    console.log('Connected to IoT Hub');
                    res.render('connect', { title: 'Azure IoT Telemetry Simulator', deviceId: util.getDev().deviceId });

                    // client event listeners

                    client.on('error', function (err) {
                        console.error(err.message);
                    });

                    client.on('disconnect', function () {
                        client.removeAllListeners();
                    });

                    client.getTwin((err, twin) => {
                        this_twin = twin;
                        if (err) {
                          console.log(`Error getting device twin: ${err.toString()}`);
                        } else {
                          // Send device properties once on device start up.
                          //sendDeviceProperties(twin);
                          // Apply device settings and handle changes to device settings.
                          util.handleSettings(twin);
                        }
                      });
                }
            });
            */
            break;
        case ('off'):
            //do something here to close the connection
            res.render('connect', { title: 'Azure IoT Telemetry Simulator', deviceId: util.getDev().deviceId });
            break;
    }
});

router.get('/twin', function (req, res, next) {
    res.render('twin', { title: 'Azure IoT Telemetry Simulator', status: util.getStatus().conn, lsm: util.getStatus().lsm, deviceId: util.getDev().deviceId });
  });
  
  router.post('/twin', function (req, res, next) {
    util.sendDeviceProperties(this_twin, req.body.sn, req.body.manuf);
    twin.properties.reported.update(properties, (err) => console.log(`Sent device properties; ` +
      (err ? `error: ${err.toString()}` : `status: success`)));
    res.render('twin', { title: 'Azure IoT Telemetry Simulator', status: util.getStatus().conn, lsm: util.getStatus().lsm, deviceId: util.getDev().deviceId });
  });
function printResultFor(op) {
    return function printResult(err, res) {
        if (err) console.log(op + ' error: ' + err.toString());
        if (res) console.log(op + ' status: ' + res.constructor.name);
    };
}
