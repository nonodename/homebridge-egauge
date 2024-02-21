import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { eGaugePlatformAccessory } from './platformAccessory';
import { eGaugeAPI } from './egauge';

/**
 * DynamicPlatform implementation, only supports one device on the network currently
 */
export class HomebridgeEGaugePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;
  private readonly _eAPI:eGaugeAPI;
  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    let server = '';
    let username = '';
    let password = '';
    Object.entries(config).forEach((entry) => {
      const [key, val] = entry;
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
      }
    });
    this._eAPI = new eGaugeAPI(server, username, password, log);
    this.log.debug('Finished initializing platform:', this.config.name);


    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      this._eAPI.discoverDevice().then(() => {
        this.discoverDevices();
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
   * Map the current device (or create it) to the accessory cache
   */
  discoverDevices() {
    this.log.debug('Discovering devices');
    // unique ID based on hostname
    const uuid = this.api.hap.uuid.generate(this._eAPI.hostname);

    // see if an accessory with the same uuid has already been registered and restored from
    // the cached devices we stored in the `configureAccessory` method above
    const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

    if (existingAccessory) {
      // the accessory already exists
      this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

      new eGaugePlatformAccessory(this, existingAccessory, this._eAPI);

    } else {
      // the accessory does not yet exist, so we need to create it
      this.log.info('Adding new accessory:', this._eAPI.hostname);

      // create a new accessory
      const accessory = new this.api.platformAccessory(this._eAPI.hostname, uuid);

      accessory.context.device = this._eAPI.hostname;

      new eGaugePlatformAccessory(this, accessory, this._eAPI);

      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    }
  }
}

