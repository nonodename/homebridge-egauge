# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build          # Compile TypeScript to dist/ (clears dist first)
npm run lint           # ESLint with zero warnings allowed
npm run watch          # Build, npm link, then nodemon for auto-rebuild during development
npm run prepublishOnly # Lint + build gate (runs automatically before npm publish)
```

There is no test suite. Development uses `npm run watch` which runs `homebridge -I -D` (insecure + debug mode) on file changes. Requires a valid `~/.homebridge/config.json`.

## Architecture

This is a **Homebridge Dynamic Platform Plugin** that polls an eGauge energy monitor device and exposes its energy registers as HomeKit accessories.

**Key concept:** Energy register rates (watts) are mapped to HomeKit using light sensor services (lux = watts) and lightbulb services (brightness = % of total energy, on/off = rate > 1W). This is a workaround since HomeKit has no native energy sensor type.

### Source Files

| File | Role |
|------|------|
| [src/index.ts](src/index.ts) | Entry point — registers the platform with Homebridge |
| [src/settings.ts](src/settings.ts) | `PLATFORM_NAME` and `PLUGIN_NAME` constants |
| [src/platform.ts](src/platform.ts) | `HomebridgeEGaugePlatform` — manages accessory lifecycle, config parsing, device discovery |
| [src/platformAccessory.ts](src/platformAccessory.ts) | `eGaugePlatformAccessory` — wraps one register as a Lightbulb + Light Sensor pair; polls every 10s |
| [src/egauge.ts](src/egauge.ts) | `eGaugeAPI` — HTTP client for eGauge device: MD5 digest auth, JWT management, register reading |

### Data Flow

1. **Startup**: Platform parses config, creates `eGaugeAPI`, waits for `didFinishLaunching`
2. **Discovery** (`eGaugeAPI.discoverDevice`): MD5 challenge-response → JWT, fetches device info, sets 9-minute JWT refresh interval (eGauge tokens expire after 10 minutes)
3. **Accessory creation** (`platform.discoverDevices`): UUID per register (hostname + index), restores cached accessories or creates new ones
4. **Polling** (`platformAccessory`): Every 10 seconds calls `readRegisters()`, then updates HomeKit characteristics for both Lightbulb and Light Sensor services

### Configuration

Defined in [config.schema.json](config.schema.json):
- `server` — IP address of the eGauge device
- `username` / `password` — eGauge WebAPI credentials (used for MD5 digest auth)
- `registers` — comma-separated register indices to expose (e.g. `"1,2,3"`); defaults to all 8 if blank

Only one eGauge device per Homebridge instance is supported.

### ESLint Rules

Single quotes, 2-space indent, max line length 140, semicolons required, no `console.log` (use Homebridge's `this.platform.log`).
