# homebridge-milight-v6

Extension to homebridge-milight to interface with the v6 MiLight bridge  (https://github.com/dotsam/homebridge-milight). 

MiLight/LimitlessLED/Easybulb Plugin for [Homebridge](https://github.com/nfarina/homebridge)

This plugin adds support for the new RGBWW bulbs.

# Configuration

Example config:

```
{
    "bridge": {
        "name": "MiLight Bridge",
        "username": "XX:XX:XX:XX:XX:XX",
        "port": 51827,
        "pin": "xxx-xx-xxx"
    },

    "description": "Homebride Milight Control",

    "platforms": [
        {
          "platform": "Milight",
          "name": "Milight Platform",
          "bridges" : [
            {
              "name": "Milight Bridge",
              "ip": "192.168.8.51",
              "type": "v6",
              "devices": [
                {
                  "name": "My Lightbulb",
                  "zone": 1,
                  "type": "fullcolor"
                }
              ]
            }
          ]
        }
      ]

}

```

Supported types:
*`fullcolor`: The newer (2016 onwards) RGBWW bulbs and strip controllers, with WW, CW and mix white/color functionality.
*`bridge`: the light on the bride itself.
*`rgbww`: The newer (2016 onwards) RGBWW bulbs and strip controllers, with WW enabled, but CW channel disabled. I use this to connect a RGBW strip with only 1 white channel.
*`rgbw`: The old type of RGBW bulb and strip controllers, that don't mix color with white.
*`rgb`: The old type RGB only bulbs.

# Troubleshooting
The node-milight-promise library provides additional debugging output when the MILIGHT_DEBUG environmental variable is set

# Changelog

### 0.0.1
 * Initial release
