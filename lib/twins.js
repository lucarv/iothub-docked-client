'use strict';

var properties = {
  serialNumber: '123-ABC',
  manufacturer: 'Contoso'
};

// Add any settings your device supports,
// mapped to a function that is called when the setting is changed.

var cfg = {
  'telFreq': 1000
}
var settings = {
  'telFreq': (newValue, callback) => {
    // Simulate it taking 1 second to set the fan speed.
    setTimeout(() => {
      callback(newValue, 'completed');
    }, 1000);
  },
};

function sendDeviceProperties(twin) {
  twin.properties.reported.update(properties, (err) => console.log(`Sent device properties; ` +
    (err ? `error: ${err.toString()}` : `status: success`)));
}
// Handle settings changes that come from Microsoft IoT Central via the device twin.
function handleSettings(twin) {
  twin.on('properties.desired', function (desiredChange) {
    for (let setting in desiredChange) {
      if (settings[setting]) {
        cfg[setting] = desiredChange[setting].value;
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

function getConfig() {
  return cfg
}

module.exports.getConfig = getConfig;
module.exports.handleSettings = handleSettings;
module.exports.sendDeviceProperties = sendDeviceProperties;


