<p align="center">

<img src="https://github.com/homebridge/branding/raw/latest/logos/homebridge-wordmark-logo-vertical.png" width="150">

</p>

<span align="center">

# eGauge Support for Homebridge

</span>

This Homebridge plugin integrates information from [eGauge](https://www.egauge.net) devices hosted on the same network as your Homebridge. The plugin uses the eGauge [WebAPI](https://webapi.redoc.ly) and has been tested with version 4.5 of the API running on a EG4115 device.

Sensors on the device are represented as ambient light sensors & light bulbs in Apple Homekit.

Consumption/production data in W is represented as the ambient light. Read registers are summed and the rate for each register is represented as a % brightness. Bulbs will show as on if the associated register is returning > 1W. 

If it's working correctly, at night the lightbulb associated with the solar register should show as off and the grid 'bulb' should show on and 100%.

To control which registers are read, add a comma separated list of the registers in the 'Registers to Read' field of config. If left blank the first eight registers will be read.

Hat Tip to [Ryan Seddon](https://twitter.com/ryanseddon) for the [idea](https://ryanseddon.com/renewables/virtual-lightbulbs-solar-homekit/) of presenting the data using lightbulbs and light sensors. 

### Known issues

* The plugin has not been tested against the eGauge reverse proxy.
* Currently utilization truncates at 100kw (represented as max light, 100000 lumens). 
* Only the first 8 registers are supported

## Building

### Setup Development Environment

To develop Homebridge plugins you must have Node.js 18 or later installed, and a modern code editor such as [VS Code](https://code.visualstudio.com/). This plugin template uses [TypeScript](https://www.typescriptlang.org/) to make development easier and comes with pre-configured settings for [VS Code](https://code.visualstudio.com/) and ESLint. If you are using VS Code install these extensions:

- [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)

### Install Development Dependencies

Using a terminal, navigate to the project folder and run this command to install the development dependencies:

```shell
$ npm install
```

### Build Plugin

TypeScript needs to be compiled into JavaScript before it can run. The following command will compile the contents of your [`src`](./src) directory and put the resulting code into the `dist` folder.

```shell
$ npm run build
```

### Link To Homebridge

Run this command so your global installation of Homebridge can discover the plugin in your development environment:

```shell
$ npm link
```

You can now start Homebridge, use the `-D` flag, so you can see debug log messages in your plugin:

```shell
$ homebridge -D
```

### Watch For Changes and Build Automatically

If you want to have your code compile automatically as you make changes, and restart Homebridge automatically between changes, you first need to add your plugin as a platform in `~/.homebridge/config.json`:
```
{
...
    "platforms": [
        {
            "name": "Config",
            "port": 8581,
            "platform": "config"
        },
        {
            "name": "homebridge-egauge",
            "server": "<IP Address of Device>",
            "username": "<Username with read access to registers>",
            "password": "<Password>",
        }
    ]
}
```

and then you can run:

```shell
$ npm run watch
```

This will launch an instance of Homebridge in debug mode which will restart every time you make a change to the source code. It will load the config stored in the default location under `~/.homebridge`. You may need to stop other running instances of Homebridge while using this command to prevent conflicts. You can adjust the Homebridge startup command in the [`nodemon.json`](./nodemon.json) file.

### Useful Links
Note these links are here for help but are not supported/verified by the Homebridge team
- [Custom Characteristics](https://github.com/homebridge/homebridge-plugin-template/issues/20)
