import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { HomebridgeEGaugePlatform } from './platform';
import { eGaugeAPI } from './egauge';

/**
 * Implementation of the platform accessory. A sensor will be created for each register that
 * the eGauge is tracking, 1-8
 */
export class eGaugePlatformAccessory {
  private _service: Service;
  private _sensorService: Service;
  private _index:string;

  constructor(
    private readonly platform: HomebridgeEGaugePlatform,
    private readonly accessory: PlatformAccessory,
    private readonly _eAPI:eGaugeAPI,
    private readonly sensorIndex:string,

  ) {
    this._index = sensorIndex;
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'eGauge')
      .setCharacteristic(this.platform.Characteristic.Model, this._eAPI.deviceName+' '+sensorIndex)
      .setCharacteristic(this.platform.Characteristic.SerialNumber, this._eAPI.sn+' '+sensorIndex);

    const sensorName = this._eAPI.Sensors[sensorIndex].name;
    this.platform.log.debug('Adding service: '+sensorName+ ', with index: '+sensorIndex);
    this._service = this.accessory.getService(sensorName) ||
        this.accessory.addService(this.platform.Service.Lightbulb, sensorName, sensorIndex);
    this._sensorService = this.accessory.getService(sensorName+'-sensor') ||
        this.accessory.addService(this.platform.Service.LightSensor, sensorName+'-sensor', sensorIndex);
    this._service.setCharacteristic(this.platform.Characteristic.Name, sensorName);
    this._sensorService.setCharacteristic(this.platform.Characteristic.Name, sensorName+'-sensor');
    this._service.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setOn.bind(this))
      .onGet(this.getOn.bind(this));

    setInterval(() => {
      const sensorValue = this._eAPI.Sensors[this._index].rate;

      if(sensorValue < 0.0001){
        this._sensorService.updateCharacteristic(this.platform.Characteristic.CurrentAmbientLightLevel, 0.0001);
      } else if(sensorValue > 100000){
        this._sensorService.updateCharacteristic(this.platform.Characteristic.CurrentAmbientLightLevel, 100000);
      }else {
        this._sensorService.updateCharacteristic(this.platform.Characteristic.CurrentAmbientLightLevel, sensorValue);
      }

      const sensorPercent = sensorValue/this._eAPI.RegisterSum*100;
      if(isNaN(sensorPercent) || sensorPercent < 0){
        this._service.updateCharacteristic(this.platform.Characteristic.Brightness, 0);
      } else if(sensorPercent > 100){
        this._service.updateCharacteristic(this.platform.Characteristic.Brightness, 100);
      } else {
        this._service.updateCharacteristic(this.platform.Characteristic.Brightness, sensorPercent);
      }
      this._eAPI.readRegisters();
    }, 10000);
  }

  /**
   *
   * Next two functions are completely fake for the sensor
   * But we need for device to appear as lightbulb
   */
  async setOn(value: CharacteristicValue) {
    this.platform.log.debug('Set Characteristic On ->', value);
  }

  async getOn(): Promise<CharacteristicValue> {
    const sensorValue = this._eAPI.Sensors[this._index].rate;
    const sensorName = this._eAPI.Sensors[this._index].name;
    this.platform.log.debug('Get Characteristic for '+sensorName+' On ->', (sensorValue > 1));
    return (sensorValue > 1);
  }
}
