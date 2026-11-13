// DidaCubes (DIDA_59D0) — TurboWarp / Scratch 3.0 Unsandboxed Extension
// Reverse-engineered BLE protocol from DidaCoding APK (electronic_logic_engine.js)
// 
// Usage: Load as unsandboxed extension in TurboWarp
//   https://turbowarp.org/editor
//   → Extension menu → "Custom Extension" → paste URL or load file
//
// Protocol: 0x45 [len] [payload...] [xor_checksum]
// BLE: service ffe0, write ffe2, read ffe1

(function (Scratch) {
  'use strict';

  if (!Scratch.extensions.unsandboxed) {
    throw new Error('DidaCubes extension must run unsandboxed');
  }

  // ─── BLE Constants ─────────────────────────────────────────────────────────
  const BLE_SERVICE = 0xFFE0;
  const BLE_WRITE_CHAR = '0000ffe2-0000-1000-8000-00805f9b34fb';
  const BLE_READ_CHAR = '0000ffe1-0000-1000-8000-00805f9b34fb';

  // ─── Protocol Constants ────────────────────────────────────────────────────
  const HEADER_DATA = 0x45;
  const HEADER_SOUND = 0x46;
  const ONLINE_FLAG = 0x01;

  // Block types
  const MOTOR_TYPE = 0x65;
  const MOTOR_SUBTYPE = 0x01;
  const CMD_SET_SPEED = 0x31;

  // ─── State ─────────────────────────────────────────────────────────────────
  let bleDevice = null;
  let bleServer = null;
  let writeChar = null;
  let readChar = null;
  let isConnected = false;
  let isInitialized = false;
  let lastRxData = null;
  let buttonPressed = false;

  // ─── Protocol Helpers ──────────────────────────────────────────────────────

  /**
   * Build a data packet: 0x45 [len] [payload] [xor]
   */
  function buildDataPacket(payload) {
    const len = payload.length + 1; // +1 for checksum byte
    let xor = len;
    for (const b of payload) xor ^= b;
    return new Uint8Array([HEADER_DATA, len, ...payload, xor & 0xFF]);
  }

  /**
   * Build a sound packet: 0x46 [len] [payload] [xor]
   */
  function buildSoundPacket(payload) {
    const len = payload.length + 1;
    let xor = len;
    for (const b of payload) xor ^= b;
    return new Uint8Array([HEADER_SOUND, len, ...payload, xor & 0xFF]);
  }

  /**
   * Build SETCONNECTINTERVAL packet (first thing sent after BLE connect)
   */
  function buildSetConnectInterval() {
    // serializeSoundbuf: [pkgnum=0, type=0x25, data=0x01 (non-iOS)]
    return buildSoundPacket([0x00, 0x25, 0x01]);
  }

  /**
   * Build ARANGE packet (block discovery, sent every 500ms by app)
   */
  function buildArange() {
    // [pkgnum=0, bluecommand=0xAA, btId=0, online=1, mainid=0xFF, subid=0xFF, type=0x21, data=0x00, 0x00]
    return buildDataPacket([0x00, 0xAA, 0x00, ONLINE_FLAG, 0xFF, 0xFF, 0x21, 0x00, 0x00]);
  }

  /**
   * Build GETBATTERY packet
   */
  function buildGetBattery() {
    // [pkgnum=0, bluecommand=0x02, btId=0, online=1, mainid=0x00, subid=0x01, type=0x11]
    return buildDataPacket([0x00, 0x02, 0x00, ONLINE_FLAG, 0x00, 0x01, 0x11]);
  }

  /**
   * Build motor SET_SPEED command
   * @param {number} port - 1 or 2
   * @param {number} speed - -100 to 100
   */
  function buildMotorSpeed(port, speed) {
    speed = Math.max(-100, Math.min(100, Math.round(speed)));
    const speedByte = speed < 0 ? (256 + speed) : speed;
    // [pkgnum=0, bluecommand=0x02, btId=0, online=1, mainid, subid, type=0x65, subtype=0x01, port, cmd=0x31, speed]
    // Use mainid=0x00, subid=0x01 for first motor block
    const mainid = 0x00;
    const subid = port === 1 ? 0x01 : 0x02;
    return buildDataPacket([
      0x00, 0x02, 0x00, ONLINE_FLAG,
      mainid, subid,
      MOTOR_TYPE, MOTOR_SUBTYPE,
      port,
      CMD_SET_SPEED, speedByte & 0xFF
    ]);
  }

  // ─── BLE Communication ─────────────────────────────────────────────────────

  async function write(data) {
    if (!writeChar) return;
    try {
      await writeChar.writeValueWithoutResponse(data);
    } catch (e) {
      console.warn('BLE write error:', e);
    }
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function onNotification(event) {
    const dv = event.target.value;
    const bytes = [];
    for (let i = 0; i < dv.byteLength; i++) bytes.push(dv.getUint8(i));
    lastRxData = bytes;
    console.log('DIDA RX:', bytes.map(b => b.toString(16).padStart(2, '0')).join(' '));

    // Check for button press events (type 0x62, subtype 0x05)
    if (bytes.length > 8 && bytes[0] === HEADER_DATA) {
      // Parse for button status
      for (let i = 0; i < bytes.length - 2; i++) {
        if (bytes[i] === 0x62 && bytes[i + 1] === 0x05) {
          buttonPressed = true;
          setTimeout(() => { buttonPressed = false; }, 100);
        }
      }
    }
  }

  /**
   * Full initialization sequence (matches what DidaCoding app does on connect)
   */
  async function initializeHub() {
    if (!writeChar) return;

    // 1. SETCONNECTINTERVAL
    await write(buildSetConnectInterval());
    await sleep(300);

    // 2. ARANGE x3 (block discovery)
    for (let i = 0; i < 3; i++) {
      await write(buildArange());
      await sleep(500);
    }

    // 3. GETBATTERY
    await write(buildGetBattery());
    await sleep(300);

    // 4. Motor config packets (tell hub motors are available)
    await write(new Uint8Array([0x45, 0x0E, 0x00, 0x03, 0x00, 0x01, 0x00, 0x01, 0x21, 0x65, 0x01, 0x01, 0x65, 0x02, 0x02, 0x2C]));
    await sleep(200);
    await write(new Uint8Array([0x45, 0x0E, 0x00, 0x03, 0x00, 0x01, 0x00, 0x03, 0x21, 0x65, 0x01, 0x01, 0x65, 0x02, 0x02, 0x2E]));
    await sleep(300);

    isInitialized = true;
    console.log('DIDA hub initialized');
  }

  // ─── Extension Class ───────────────────────────────────────────────────────

  class DidaCubesExtension {
    getInfo() {
      return {
        id: 'didacubes',
        name: 'DidaCubes',
        color1: '#4A90D9',
        color2: '#3A7BC8',
        color3: '#2A6AB7',
        blockIconURI: '', // Could add a data URI icon here
        blocks: [
          {
            opcode: 'connect',
            blockType: Scratch.BlockType.COMMAND,
            text: '🔗 connect to DIDA hub',
          },
          {
            opcode: 'disconnect',
            blockType: Scratch.BlockType.COMMAND,
            text: '🔌 disconnect from DIDA hub',
          },
          {
            opcode: 'isConnected',
            blockType: Scratch.BlockType.BOOLEAN,
            text: 'connected?',
          },
          '---',
          {
            opcode: 'setMotorSpeed',
            blockType: Scratch.BlockType.COMMAND,
            text: 'set motor [PORT] speed to [SPEED] %',
            arguments: {
              PORT: {
                type: Scratch.ArgumentType.STRING,
                menu: 'portMenu',
                defaultValue: '1',
              },
              SPEED: {
                type: Scratch.ArgumentType.NUMBER,
                defaultValue: 100,
              },
            },
          },
          {
            opcode: 'stopMotor',
            blockType: Scratch.BlockType.COMMAND,
            text: 'stop motor [PORT]',
            arguments: {
              PORT: {
                type: Scratch.ArgumentType.STRING,
                menu: 'portMenu',
                defaultValue: '1',
              },
            },
          },
          {
            opcode: 'stopAllMotors',
            blockType: Scratch.BlockType.COMMAND,
            text: '⏹ stop all motors',
          },
          '---',
          {
            opcode: 'whenButtonPressed',
            blockType: Scratch.BlockType.HAT,
            text: 'when hub button pressed',
            isEdgeActivated: true,
          },
        ],
        menus: {
          portMenu: {
            acceptReporters: true,
            items: [
              { text: 'Port A', value: '1' },
              { text: 'Port B', value: '2' },
            ],
          },
        },
      };
    }

    // ─── Block Implementations ─────────────────────────────────────────────

    async connect() {
      if (isConnected) return;

      try {
        // Check Web Bluetooth availability
        if (!navigator.bluetooth) {
          console.error('Web Bluetooth not available');
          return;
        }

        // Request device
        bleDevice = await navigator.bluetooth.requestDevice({
          filters: [{ namePrefix: 'DIDA' }],
          optionalServices: [BLE_SERVICE],
        });

        bleDevice.addEventListener('gattserverdisconnected', () => {
          isConnected = false;
          isInitialized = false;
          writeChar = null;
          readChar = null;
          console.log('DIDA hub disconnected');
        });

        // Connect GATT
        bleServer = await bleDevice.gatt.connect();

        // Get service and characteristics
        const service = await bleServer.getPrimaryService(BLE_SERVICE);
        const chars = await service.getCharacteristics();

        for (const c of chars) {
          if (c.uuid === BLE_WRITE_CHAR || c.properties.writeWithoutResponse) {
            writeChar = c;
          }
          if (c.uuid === BLE_READ_CHAR || c.properties.notify) {
            readChar = c;
            await c.startNotifications();
            c.addEventListener('characteristicvaluechanged', onNotification);
          }
        }

        isConnected = true;
        console.log('DIDA hub connected:', bleDevice.name);

        // Run initialization sequence
        await initializeHub();

      } catch (e) {
        console.error('DIDA connect error:', e);
        isConnected = false;
      }
    }

    disconnect() {
      if (bleDevice && bleDevice.gatt.connected) {
        bleDevice.gatt.disconnect();
      }
      isConnected = false;
      isInitialized = false;
      writeChar = null;
      readChar = null;
    }

    isConnected() {
      return isConnected;
    }

    async setMotorSpeed(args) {
      if (!isConnected || !writeChar) return;

      // Auto-initialize if needed
      if (!isInitialized) {
        await initializeHub();
      }

      const port = parseInt(args.PORT, 10) || 1;
      const speed = Math.max(-100, Math.min(100, Math.round(Number(args.SPEED) || 0)));

      // Send motor command with multiple mainid/subid combos for reliability
      const combos = [[0x00, 0x01], [0x00, 0x02]];
      for (const [mid, sid] of combos) {
        const speedByte = speed < 0 ? (256 + speed) : speed;
        const payload = [0x00, 0x02, 0x00, ONLINE_FLAG, mid, sid, MOTOR_TYPE, MOTOR_SUBTYPE, port, CMD_SET_SPEED, speedByte & 0xFF];
        await write(buildDataPacket(payload));
        await sleep(50);
      }
    }

    async stopMotor(args) {
      await this.setMotorSpeed({ PORT: args.PORT, SPEED: 0 });
    }

    async stopAllMotors() {
      await this.setMotorSpeed({ PORT: '1', SPEED: 0 });
      await this.setMotorSpeed({ PORT: '2', SPEED: 0 });
    }

    whenButtonPressed() {
      if (buttonPressed) {
        buttonPressed = false;
        return true;
      }
      return false;
    }
  }

  // Register the extension
  Scratch.extensions.register(new DidaCubesExtension());

})(Scratch);
