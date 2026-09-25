import type { MatterAccessory } from 'homebridge';
import { HomebridgeEGaugePlatform } from './platform.js';
import { eGaugeAPI } from './egauge.js';

/**
 * Exposes one eGauge power register as a Matter Electrical Sensor.
 * Homebridge adds the PowerTopology and ElectricalPowerMeasurement clusters automatically
 * when the accessory declares electricalPowerMeasurement state.
 */
export class eGaugeMatterAccessory {
  public readonly accessory: MatterAccessory;
  private _pollInterval?: NodeJS.Timeout;

  constructor(
    private readonly platform: HomebridgeEGaugePlatform,
    private readonly _eAPI: eGaugeAPI,
    private readonly sensorIndex: string,
    uuid: string,
  ) {
    const register = this._eAPI.Sensors[sensorIndex];
    this.accessory = {
      UUID: uuid,
      displayName: register.name,
      deviceType: this.platform.api.matter!.deviceTypes.ElectricalSensor,
      manufacturer: 'eGauge',
      model: this._eAPI.deviceName + ' ' + sensorIndex,
      serialNumber: this._eAPI.sn + ' ' + sensorIndex,
      context: { index: sensorIndex },
      clusters: {
        electricalPowerMeasurement: { activePower: eGaugeMatterAccessory.toMilliWatts(register.rate) },
      },
    };
  }

  /**
   * eGauge reports watts (negative when a register is generating); Matter wants integer milliwatts
   */
  private static toMilliWatts(watts: number): number | null {
    return Number.isFinite(watts) ? Math.round(watts * 1000) : null;
  }

  public startPolling() {
    if (this._pollInterval) {
      clearInterval(this._pollInterval);
    }
    this._pollInterval = setInterval(() => {
      const activePower = eGaugeMatterAccessory.toMilliWatts(this._eAPI.Sensors[this.sensorIndex].rate);
      this.platform.api.matter?.updateAccessoryState(this.accessory.UUID, 'electricalPowerMeasurement', { activePower })
        .catch((err: unknown) => {
          this.platform.log.debug('Matter update failed for ' + this.accessory.displayName + ': ' + err);
        });
    }, 10000);
  }
}
