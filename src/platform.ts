import type {
  API, DynamicPlatformPlugin, Logger, MatterAccessory, PlatformAccessory, PlatformConfig, Service, Characteristic,
} from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';
import { eGaugePlatformAccessory } from './platformAccessory.js';
import { eGaugeMatterAccessory } from './matterAccessory.js';
import { eGaugeAPI } from './egauge.js';

/**
 * DynamicPlatform implementation, only supports one device on the network currently
 */
export class HomebridgeEGaugePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;
  private readonly _eAPI:eGaugeAPI;
  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];
  public readonly matterAccessories: MatterAccessory[] = [];
  private readonly _exposeHap: boolean;
  private readonly _exposeMatter: boolean;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.Service = this.api.hap.Service;
    this.Characteristic = this.api.hap.Characteristic;
    this._exposeHap = config.hap !== false;
    this._exposeMatter = config.matter !== false;
    let server = '';
    let username = '';
    let password = '';
    let readRegisters = '';
    Object.entries(config).forEach((entry) => {
      const [key, val] = entry;
      if(typeof val !== 'string'){
        return;
      }
      switch (key) {
        case 'server':
          server = val;
          break;
        case 'username':
          username = val;
          break;
        case 'password':
          password = val;
          break;
        case 'registers':
          readRegisters = val;
          break;
      }
    });
    this._eAPI = new eGaugeAPI(server, username, password, log);
    this.log.debug('Finished initializing platform:', this.config.name);
    if(readRegisters.length>1){
      this._eAPI.RequiredRegisters = readRegisters.split(',');
    } else {
      this._eAPI.RequiredRegisters = [];
    }
    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      this._eAPI.discoverDevice().then(async () => {
        this.discoverDevices();
        await this.discoverMatterDevices();
        this._eAPI.startPolling();
      });
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  /**
   * Matter equivalent of configureAccessory, invoked by Homebridge 2.x for cached Matter accessories
   */
  configureMatterAccessory(accessory: MatterAccessory) {
    this.log.info('Loading Matter accessory from cache:', accessory.displayName);
    this.matterAccessories.push(accessory);
  }



  /**
   * Map the current device (or create it) to the accessory cache
   */
  discoverDevices() {
    this.log.debug('Discovering devices');
    for (const sensorIDX in this._eAPI.Sensors){
      // unique ID based on hostname & register ID
      const uuid = this.api.hap.uuid.generate(this._eAPI.hostname+sensorIDX);
      // see if an accessory with the same uuid has already been registered and restored from
      // the cached devices we stored in the `configureAccessory` method above
      const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

      if (existingAccessory) {
      // the accessory already exists
        this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

        new eGaugePlatformAccessory(this, existingAccessory, this._eAPI, sensorIDX);
        if(!this._exposeHap || !this._eAPI.requiredRegister(sensorIDX)){
          this.log.debug('Unregistered item with idx: '+sensorIDX);
          this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
        }
      } else {
        if(this._exposeHap && this._eAPI.requiredRegister(sensorIDX)){
          // the accessory does not yet exist, so we need to create it
          this.log.info('Adding new accessory:', this._eAPI.hostname+sensorIDX);

          // create a new accessory
          const accessory = new this.api.platformAccessory(this._eAPI.hostname+sensorIDX, uuid);

          accessory.context.device = this._eAPI.hostname+sensorIDX;

          new eGaugePlatformAccessory(this, accessory, this._eAPI, sensorIDX);

          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        }
      }
    }


  }

  /**
   * Expose each required power register as a Matter Electrical Sensor (Homebridge 2.x with Matter enabled only)
   */
  async discoverMatterDevices() {
    const matter = this.api.matter;
    if (!this._exposeMatter || !this.api.isMatterEnabled?.() || !matter) {
      this.log.debug('Matter not enabled, skipping Matter accessories');
      return;
    }
    const wanted: eGaugeMatterAccessory[] = [];
    for (const sensorIDX in this._eAPI.Sensors) {
      // only power registers make sense as electrical sensors
      if (!this._eAPI.requiredRegister(sensorIDX) || this._eAPI.Sensors[sensorIDX].type !== 'P') {
        continue;
      }
      const uuid = matter.uuid.generate(this._eAPI.hostname + sensorIDX + '-matter');
      wanted.push(new eGaugeMatterAccessory(this, this._eAPI, sensorIDX, uuid));
    }

    const stale = this.matterAccessories.filter(cached => !wanted.some(w => w.accessory.UUID === cached.UUID));
    try {
      if (stale.length > 0) {
        this.log.info('Removing Matter accessories: ' + stale.map(a => a.displayName).join(', '));
        await matter.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, stale);
      }
      // registering a cached accessory re-attaches it, so register everything we want every launch
      await matter.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, wanted.map(w => w.accessory));
      wanted.forEach(w => w.startPolling());
    } catch (err: unknown) {
      this.log.error('Failed to register Matter accessories: ' + err);
    }
  }
}
