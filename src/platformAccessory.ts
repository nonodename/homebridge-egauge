import { Service, PlatformAccessory } from 'homebridge';
import { HomebridgeEGaugePlatform } from './platform';
import { eGaugeAPI } from './egauge';

/**
 * Implementation of the platform accessory. A sensor will be created for each register that
 * the eGauge is tracking, 1-8
 */
export class eGaugePlatformAccessory {
  private _services: Service[] = [];

  constructor(
    private readonly platform: HomebridgeEGaugePlatform,
    private readonly accessory: PlatformAccessory,
    private readonly _eAPI:eGaugeAPI,

  ) {

    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'eGauge')
      .setCharacteristic(this.platform.Characteristic.Model, this._eAPI.deviceName)
      .setCharacteristic(this.platform.Characteristic.SerialNumber, this._eAPI.sn);

    for (const sensorIDX in this._eAPI.Sensors){
      const sensorName = this._eAPI.Sensors[sensorIDX].name;
      this.platform.log.debug('Adding service: '+sensorName+ ', with index: '+sensorIDX);
      const sensor = this.accessory.getService(sensorName) ||
        this.accessory.addService(this.platform.Service.LightSensor, sensorName, sensorIDX+'');
      sensor.setCharacteristic(this.platform.Characteristic.Name, sensorName);
      this._services.push(sensor);
    }
    setInterval(() => {
      this._services.forEach(service => {
        if(typeof service.subtype === 'string'){
          const sensorValue = this._eAPI.Sensors[service.subtype].rate*10;
          if(sensorValue < 0.0001){
            service.updateCharacteristic(this.platform.Characteristic.CurrentAmbientLightLevel, 0.0001);
          } else if(sensorValue > 100000){
            service.updateCharacteristic(this.platform.Characteristic.CurrentAmbientLightLevel, 100000);
          }else {
            service.updateCharacteristic(this.platform.Characteristic.CurrentAmbientLightLevel, sensorValue);
          }
        } else {
          this.platform.log.error('Sensor has no subtype');
        }
      });
      this._eAPI.readRegisters();
    }, 10000);
  }

}
