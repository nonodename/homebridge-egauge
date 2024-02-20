import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';

import { ExampleHomebridgePlatform } from './platform';
import { eGaugeAPI } from './egauge';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class eGaugePlatformAccessory {
  private _services: Service[] = [];

  constructor(
    private readonly platform: ExampleHomebridgePlatform,
    private readonly accessory: PlatformAccessory,
    private readonly _eAPI:eGaugeAPI,

  ) {
    this.platform.log.debug('device: '+this._eAPI.Sensors['Solar']);
    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'eGauge')
      .setCharacteristic(this.platform.Characteristic.Model, this._eAPI.deviceName)
      .setCharacteristic(this.platform.Characteristic.SerialNumber, this._eAPI.sn);


    /**
     * Creating multiple services of the same type.
     *
     * To avoid "Cannot add a Service with the same UUID another Service without also defining a unique 'subtype' property." error,
     * when creating multiple services of the same type, you need to use the following syntax to specify a name and subtype id:
     * this.accessory.getService('NAME') || this.accessory.addService(this.platform.Service.Lightbulb, 'NAME', 'USER_DEFINED_SUBTYPE_ID');
     *
     * The USER_DEFINED_SUBTYPE must be unique to the platform accessory (if you platform exposes multiple accessories, each accessory
     * can use the same sub type id.)
     */
    for (const sensorName in this._eAPI.Sensors){
      this.platform.log.debug('Adding service: '+sensorName);
      const sensor = this.accessory.getService(sensorName) ||
      this.accessory.addService(this.platform.Service.LightSensor, sensorName, sensorName);
      sensor.setCharacteristic(this.platform.Characteristic.Name, sensorName);
      sensor.getCharacteristic(this.platform.Characteristic.CurrentAmbientLightLevel)
        .onGet(this.handleCurrentAmbientLightLevelGet.bind(this));
      this._services.push(sensor);
    }
    setInterval(() => {
      this._services.forEach(service => {
        const sensorValue = this._eAPI.Sensors[service.displayName];
        if(sensorValue < 0.0001){
          service.updateCharacteristic(this.platform.Characteristic.CurrentAmbientLightLevel, 0.0001);
        } else if(sensorValue > 100000){
          service.updateCharacteristic(this.platform.Characteristic.CurrentAmbientLightLevel, 100000);
        }else {
          service.updateCharacteristic(this.platform.Characteristic.CurrentAmbientLightLevel, sensorValue);
        }
      });
      this._eAPI.readRegisters();
    }, 10000);
  }



  handleCurrentAmbientLightLevelGet(){
    return 0.0001;
  }

}
