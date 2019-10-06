var Milight = require('node-milight-promise');
var inherits = require('util').inherits;
var Service, Characteristic;

var debug = process.env.hasOwnProperty('MILIGHT_DEBUG') ? consoleDebug : function () {
};

function consoleDebug() {
    console.log.apply(this, arguments);
}

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  Characteristic.WhiteMode = makeWhiteModeCharacteristic(homebridge.hap.uuid);
  Characteristic.WhiteTemperature = makeWhiteTemperatureCharacteristic(homebridge.hap.uuid);
  Characteristic.NightMode = makeNightModeCharacteristic(homebridge.hap.uuid);
  homebridge.registerPlatform("homebridge-milight-v6", "MiLight-v6", MiLightPlatform);
};

//
// MiLight Platform
//
function MiLightPlatform(log, config) {
  this.log = log;
  this.config = config;
}

MiLightPlatform.prototype.accessories = function(callback) {
  var foundDevices = [];

  if (this.config.bridges) {

    var bridgesLength = this.config.bridges.length;

    if (bridgesLength === 0) {
      this.log.error("No bridges found in configuration.");
      return;
    } else {
      for (var i = 0; i < bridgesLength; i++) {
        if ( !! this.config.bridges[i]) {
          returnedDevices = this._addDevices(this.config.bridges[i]);
          foundDevices.push.apply(foundDevices, returnedDevices);
          returnedDevices = null;
        }
      }
    }
  } else {
    this.log.error("Could not read any bridges from configuration.");
    return;
  }

  if (foundDevices.length > 0) {
    callback(foundDevices);
  } else {
    this.log.error("Unable to find any valid devices.");
    return;
  }
};

MiLightPlatform.prototype._addDevices = function(bridgeConfig) {
  var devices = [];
  var devicesLength = 0;
  // Various error checking
  if (!bridgeConfig.devices || (devicesLength = bridgeConfig.devices.length) === 0) {
    this.log.error("Could not read devices from configuration.");
    return;
  }

  // Initialize a new controller to be used for all zones defined for this bridge
  // We interface the bridge directly via serial port
  bridgeController = new Milight.MilightController({
    ip: bridgeConfig.ip || false,
    type: bridgeConfig.type || 'v6',
    delayBetweenCommands: bridgeConfig.delay || 25,
    commandRepeat: bridgeConfig.repeat || undefined
  });

  // Create accessories for all of the defined devices
  for (var i = 0; i < devicesLength; i++) {
    if ( !! bridgeConfig.devices[i]) {
      dev = new MiLightAccessory(this.log, bridgeConfig.devices[i], bridgeController);
      if (dev) {
        devices.push(dev);
      }
    }
  }
  this._devices = devices;
  return devices;
};


//
// MiLight Accessory
//
function MiLightAccessory(log, config, controller) {
  this.log = log;
  this.config = config;
  this.controller = controller;
  this.name = config.name || Milight;
  this.type = config.type || "fullcolor8zone";
  this.zone = config.zone || 0;
  this.hasnightmode = config.hasnightmode || false;

  this.service = new Service.Lightbulb(this.name);

  this.service.getCharacteristic(Characteristic.On).on('set', this.setOn.bind(this));
  this.service.addCharacteristic(Characteristic.Brightness).on('set', this.setBrightness.bind(this));
  this.service.addCharacteristic(Characteristic.Hue).on('set', this.setHue.bind(this));

  if (this.type.toLowerCase() == "fullcolor8zone") {
    this.service.addCharacteristic(Characteristic.Saturation).on('set', this.setSaturation.bind(this));
    this.service.addCharacteristic(Characteristic.WhiteMode).on('set', this.setWhiteMode.bind(this));
    this.service.addCharacteristic(Characteristic.ColorTemperature).on('set', this.setTemperature.bind(this));
    this.commands = Milight.commandsV6.fullColor8Zone;
  } else if (this.type.toLowerCase() == "fullcolor") {
    this.service.addCharacteristic(Characteristic.Saturation).on('set', this.setSaturation.bind(this));
    this.service.addCharacteristic(Characteristic.WhiteMode).on('set', this.setWhiteMode.bind(this));
    this.service.addCharacteristic(Characteristic.ColorTemperature).on('set', this.setTemperature.bind(this));
    this.commands = Milight.commandsV6.fullColor;
  }
  if (this.type.toLowerCase() == "bridge") {
    this.service.addCharacteristic(Characteristic.WhiteMode).on('set', this.setWhiteMode.bind(this));
    this.service.addCharacteristic(Characteristic.Saturation);
    this.commands = {};

    // conform interface of bridge commands
    this.commands.on = function(dummy) {
      return Milight.commandsV6.bridge.on();
    };

    this.commands.off = function(dummy) {
      return Milight.commandsV6.bridge.off();
    };

    this.commands.brightness = function(dummy, brightness) {
      return Milight.commandsV6.bridge.brightness(brightness);
    };
    this.commands.whiteMode = function(dummy) {
      return Milight.commandsV6.bridge.whiteMode();
    };
    this.commands.hue = function(dummy, hue, offset) {
      return Milight.commandsV6.bridge.hue(hue, offset);
    };

  }
  if (this.type.toLowerCase() == "rgbww") {
    this.service.addCharacteristic(Characteristic.Saturation).on('set', this.setSaturation.bind(this));
    this.service.addCharacteristic(Characteristic.WhiteMode).on('set', this.setWhiteMode.bind(this));
    this.commands = Milight.commandsV6.fullColor;
  }
  if (this.type.toLowerCase() == "rgbw") {
    this.service.addCharacteristic(Characteristic.WhiteMode).on('set', this.setWhiteMode.bind(this));
    this.service.addCharacteristic(Characteristic.Saturation);
    this.commands = this.controller.type = 'v6' ? Milight.commandsV6.rgbw : Milight.commands2.rgbw;
  }
  if (this.type.toLowerCase() == "rgb") {
    this.service.addCharacteristic(Characteristic.Saturation);
    this.commands = this.controller.type = 'v6' ? Milight.commandsV6.rgb : Milight.commands2.rgb;
  }
  if (this.hasnightmode) {
    this.service.addCharacteristic(Characteristic.NightMode).on('set', this.setNightMode.bind(this));
  }
  if (this.commands === undefined) {
    this.log("[Warning] Unknown zone type: %s, using 'fullcolor' instead", this.type);
    this.commands = Milight.commandsV6.fullColor;
    this.type = 'fullcolor';
  }

  //console.log(this.commands);

  // Set device information
  this.informationService = new Service.AccessoryInformation();
  this.informationService
    .setCharacteristic(Characteristic.Manufacturer, "MiLight")
    .setCharacteristic(Characteristic.Model, this.type);

  this.log("Added MiLight device: %s, type: %s, zone: %d", this.name, this.type, this.zone);

}

MiLightAccessory.prototype.getServices = function() {
  return [this.service, this.informationService];
};


MiLightAccessory.prototype.setOn = function(on, callback, context) {
  if (context !== 'internal') {
    debug('Setting %s (%s, %d) power to %s', this.name, this.type, this.zone, on);
    if (on) {
      this.controller.sendCommands(this.commands.on(this.zone));
      this.setWhiteMode(this.service.getCharacteristic(Characteristic.WhiteMode).value,
        function(dummy) {}, 'setmode');
    } else {
      this.controller.sendCommands(this.commands.off(this.zone));
    }
  }
  return callback(null);
};

MiLightAccessory.prototype.setBrightness = function(brightness, callback, context) {
  if (context !== 'internal') {
    debug('Setting %s (%s, %d) brightness to %d', this.name, this.type, this.zone, brightness);
    this.controller.sendCommands(this.commands.brightness(this.zone, brightness));
  }
  return callback(null);
};

MiLightAccessory.prototype.setHue = function(hue, callback, context) {
  if (context !== 'internal') {
    debug('Setting %s (%s, %d) hue to %d', this.name, this.type, this.zone, hue);
    hue = Math.round((hue+14) * 255 / 360)%256;
    this.controller.sendCommands(this.commands.hue(this.zone, hue, false));
    this.service.getCharacteristic(Characteristic.WhiteMode).setValue(0, false, 'internal');
  }
  return callback(null);
};

MiLightAccessory.prototype.setSaturation = function(saturation, callback, context) {
  if (context !== 'internal') {
    debug('Setting %s (%s, %d) saturation to %d', this.name, this.type, this.zone, saturation);
    this.controller.sendCommands(this.commands.saturation(this.zone, saturation, true));
  }
  return callback(null);
};


MiLightAccessory.prototype.setWhiteMode = function(on, callback, context) {
  if (context !== 'internal') {
    if (context !== 'setmode') {
      debug('Setting %s (%s, %d) white mode to %s', this.name, this.type, this.zone, on);
    }
    if (on) {
      if( this.type.toLowerCase() == 'rgbw' || this.type.toLowerCase() == 'bridge') {
        this.controller.sendCommands(this.commands.whiteMode(this.zone));
      } else if (this.type.toLowerCase() == 'rgbww') {
        this.controller.sendCommands(this.commands.whiteTemperature(this.zone, 0));
      } else {
        var temp = 100-Math.round((this.service.getCharacteristic(Characteristic.ColorTemperature).value - 140)*100/(500-140));
        this.controller.sendCommands(this.commands.whiteTemperature(this.zone, temp));
      }
      this.controller.sendCommands(this.commands.brightness(this.zone,
        this.service.getCharacteristic(Characteristic.Brightness).value));
    } else {
      this.controller.sendCommands(this.commands.hue(this.zone,
        Math.round((this.service.getCharacteristic(Characteristic.Hue).value + 14) * 255 / 360)%256));
      if (this.type.toLowerCase() == 'rgbww'|| this.type.toLowerCase() == 'fullcolor') {
        this.controller.sendCommands(this.commands.saturation(this.zone, this.service.getCharacteristic(Characteristic.Saturation).value, true));
      }
      this.controller.sendCommands(this.commands.brightness(this.zone,
        this.service.getCharacteristic(Characteristic.Brightness).value));
    }
  }
  return callback(null);
};

MiLightAccessory.prototype.setTemperature = function(temperature, callback, context) {
  if (context !== 'internal') {
    debug('Setting %s (%s, %d) temperature to %d', this.name, this.type, this.zone, temperature);
    var temp = 100-Math.round((temperature - 140)*100/(500-140));
    this.controller.sendCommands(this.commands.whiteTemperature(this.zone, temp));
    this.service.getCharacteristic(Characteristic.WhiteMode).setValue(1, false, 'internal');
  }
  return callback(null);
};

MiLightAccessory.prototype.setNightMode = function(on, callback, context) {
  if (context !== 'internal') {
    debug('Setting %s (%s, %d) night mode to %s', this.name, this.type, this.zone, on);
    if (on) {
      this.controller.sendCommands(this.commands.nightMode(this.zone));
    } else {
      this.setWhiteMode(this.service.getCharacteristic(Characteristic.WhiteMode).value,
        function(dummy) {}, 'setmode');
    }
  }
  return callback(null);
};

function makeWhiteTemperatureCharacteristic(uuid) {

  var id = uuid.generate("WhiteTemperature");

  tempCharacteristic = function() {
    Characteristic.call(this, 'White Temperature', id);
    this.setProps({
      format: Characteristic.Formats.INT,
      maxValue: 100,
      minValue: 0,
      minStep: 1,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };

  inherits(tempCharacteristic, Characteristic);

  return tempCharacteristic;

}

function makeWhiteModeCharacteristic(uuid) {

  var id = uuid.generate("WhiteMode");
  whiteCharacteristic = function() {
    Characteristic.call(this, 'White mode', id);
    this.setProps({
      format: Characteristic.Formats.BOOL,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };

  inherits(whiteCharacteristic, Characteristic);

  return whiteCharacteristic;

}

function makeNightModeCharacteristic(uuid) {

  var id = uuid.generate("NightMode");
  nightCharacteristic = function() {
    Characteristic.call(this, 'Night mode', id);
    this.setProps({
      format: Characteristic.Formats.BOOL,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };

  inherits(nightCharacteristic, Characteristic);

  return nightCharacteristic;

}
