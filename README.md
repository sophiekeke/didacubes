# DidaCubes Controller — README

Control the **DidaCubes "Main Board Mini"** (BLE device `DIDA_59D0`) from a web browser using block coding, without the discontinued DidaCoding app.

---

## Quick Start (5 minutes)

### What you need
- **DidaCubes hub** (Main Board Mini) with DC motor plugged in
- **Chrome browser** on Mac, Windows, Chromebook, or Android
- (iPad: use **Bluefy** browser from App Store, ~$2)

### Steps
1. **Turn on the hub** — press the big button, blue LED lights up
2. Open **https://turbowarp.org/editor** in Chrome
3. Click the **Extensions** button (bottom-left puzzle piece 🧩)
4. Scroll down → **Custom Extension** → **File** → select `dida_extension.js`
5. Check **"Run without sandbox"** → click **Load** (this is safe)
6. You now have blue **DidaCubes** blocks in the left palette!

### Your first program
Drag these blocks to the coding area and snap them together:

```
🟢 when green flag clicked
🔗 connect to DIDA hub
⏳ wait (3) seconds
⚙️ set motor [Port A] speed to (100) %
⏳ wait (2) seconds
⏹ stop all motors
```

- Click the **green flag** 🟢 to run
- Chrome shows a BLE pairing popup → select **DIDA_59D0** → click Pair
- Wait 3 seconds → motor spins for 2 seconds → stops

### Speed values
- `100` = full speed forward
- `50` = half speed forward
- `0` = stop
- `-50` = half speed reverse
- `-100` = full speed reverse

---

## Files in This Package

| File | Description |
|------|-------------|
| `README.md` | This file |
| `dida_extension.js` | **TurboWarp/Scratch 3.0 extension** — the main deliverable. Load this in TurboWarp. |
| `dida_inspector.html` | BLE protocol sniffer & testing tool. Open in Chrome to test raw BLE commands. |
| `DIDA_59D0_handoff_v2.md` | Full protocol documentation & project history |
| `DIDA_59D0_task.markdown` | Original task specification |
| `MyqA-DbpUh_108695.apk` | Original DidaCoding Android APK (for reference/decompilation) |

---

## Available Scratch Blocks

| Block | Description |
|-------|-------------|
| 🔗 **connect to DIDA hub** | Opens BLE pairing dialog and initializes the hub |
| 🔌 **disconnect from DIDA hub** | Disconnects Bluetooth |
| **connected?** | Boolean — true when connected |
| **set motor [Port A/B] speed to [speed] %** | Set motor speed (-100 to 100) |
| **stop motor [Port A/B]** | Stop one motor |
| ⏹ **stop all motors** | Stop both motors |
| **when hub button pressed** | Hat block — triggers when hub button is pressed |

---

## Platform Compatibility

| Platform | Browser | Works? |
|----------|---------|--------|
| Mac | Chrome / Edge | ✅ Yes |
| Windows | Chrome / Edge | ✅ Yes |
| Chromebook | Chrome | ✅ Yes |
| Android | Chrome | ✅ Yes |
| iPad / iPhone | Safari / Chrome | ❌ No (Apple blocks Web Bluetooth) |
| iPad / iPhone | **Bluefy** ($2 App Store) | 🟡 Should work (untested) |

---

## Hardware Info

- **Product:** DidaCubes, by Didacubes (Guangdong, China, founded 2017)
- **Hub name:** Main Board Mini
- **BLE broadcast name:** `DIDA_59D0` (or similar `DIDA_XXXX`)
- **Ports:** 2 magnetic pogo-pin ports for motors/sensors
- **Power:** Rechargeable via Micro-USB, big button to turn on/off
- **Motor connector:** Round 3-pin magnetic pogo plug

---

## BLE Protocol Summary

Reverse-engineered from the DidaCoding APK (`electronic_logic_engine.js`).

```
Service UUID:     0xFFE0
Write Char:       0xFFE2 (writeWithoutResponse)
Read Char:        0xFFE1 (notify)

Packet format:    [HEADER] [LENGTH] [PAYLOAD...] [XOR_CHECKSUM]
Data header:      0x45
Sound header:     0x46
Checksum:         XOR of (length byte) and (all payload bytes)
Motor type:       0x65, subtype 0x01
Motor command:    SET_SPEED = 0x31, 1 byte speed value
```

Full protocol details in `DIDA_59D0_handoff_v2.md`.

---

## Using the Inspector Tool

`dida_inspector.html` is a standalone BLE testing tool:

1. Open in Chrome: `file:///path/to/dida_inspector.html`
2. Click **⚡ Connect** → pair with DIDA_59D0
3. **Send HEX** tab → use Quick Start buttons to test motor
4. **Packet Log** (left panel) shows all BLE traffic

---

## Troubleshooting

**Hub doesn't appear in pairing popup:**
- Make sure the hub is on (blue LED lit)
- Turn hub off and on again
- Close Chrome completely, reopen, try again

**Motor doesn't spin:**
- Check motor is plugged firmly into a port
- Try Port A and Port B
- Click "🚀 Quick Start" in the inspector tool first to verify

**Extension won't load in TurboWarp:**
- Make sure you check "Run without sandbox" — it needs this for Bluetooth access
- Use Chrome or Edge, not Safari/Firefox

**"Web Bluetooth not available" error:**
- Use Chrome or Edge browser
- On Mac: should work out of the box
- On Windows: may need Chrome flags → `chrome://flags` → enable "Experimental Web Platform Features"

---

## Project History

This project reverse-engineered the BLE protocol of a discontinued Chinese STEM robotics kit. The original app (DidaCoding) was delisted from app stores when the company (Didacubes) shut down. Through BLE sniffing, APK decompilation, and protocol analysis, we recovered the full command set and built a replacement controller as a TurboWarp extension.

Date: November 12, 2026

