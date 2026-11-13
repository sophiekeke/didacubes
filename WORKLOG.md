# DidaCubes Project — Worklog & Status

## Last Updated: 2026-11-13 01:12 AM PST

---

## ✅ COMPLETED

### Session: Nov 12-13, 2026 (7:40 PM – 1:12 AM)

1. **BLE Reconnaissance** — Built `dida_inspector.html`, connected to hub, captured first RX packet `45 0C 00 03 00 02 00 01 62 05 00 21 00 4A`

2. **Protocol Fuzzing** — Sent 700+ packets across 17 fuzzer groups. Zero responses. Confirmed hub needs init handshake.

3. **APK Discovery** — Found correct app name "DidaCoding" (not "智童嘀嗒编程") from reading the physical product manual. Located APK via GameLoop/APK archives.

4. **APK Decompilation** — Extracted `electronic_logic_engine.js` from Cordova hybrid app. Found complete BLE protocol:
   - Header: `0x45` (data), `0x46` (sound)
   - Format: `[header] [length] [payload] [xor_checksum]`
   - Motor: type `0x65`, subtype `0x01`, SET_SPEED cmd `0x31`
   - Init sequence: SETCONNECTINTERVAL → ARANGE x3 → GETBATTERY → Motor config

5. **Motor Control Confirmed** — Motor spins from Mac Chrome using the discovered protocol ✅

6. **TurboWarp Extension** — `dida_extension.js` built with kid-friendly Scratch blocks

7. **iPad/Bluefy Support** — Fixed BLE connection for Bluefy (fallback from `namePrefix` to `acceptAllDevices`)

8. **GitHub Pages Deployed** — https://sophiekeke.github.io/didacubes/

9. **Standalone Blockly App** — `dida_blockly.html` built for lightweight iPad experience

10. **Knowledge Doc** — `KNOWLEDGE.md` written with full reverse-engineering methodology

---

## 🟢 WORKING NOW

| Platform | Method | How |
|----------|--------|-----|
| **Mac Chrome** | TurboWarp + extension | Load `dida_extension.js` as file, run without sandbox |
| **iPad Bluefy** | TurboWarp + text paste | Copy code from `raw.githubusercontent.com/.../dida_extension.js`, paste as Text in Custom Extension, run without sandbox |
| **iPad Bluefy** | Inspector | Open `https://sophiekeke.github.io/didacubes/dida_inspector.html` |
| **Any Chrome** | Inspector | Open `https://sophiekeke.github.io/didacubes/dida_inspector.html` |

---

## 🟡 UNTESTED / TODO

### High Priority
- [ ] **Test Blockly app on iPad** — `https://sophiekeke.github.io/didacubes/dida_blockly.html` — built but not tested in Bluefy yet. This would be the best iPad experience (no TurboWarp paste needed).
- [ ] **Test Motor Port B** — Only Port A confirmed. Need to plug motor into the other physical port and test.
- [ ] **Test speed control** — Confirmed 100% works. Need to test 50%, -100% (reverse), variable speeds.
- [ ] **Test on Android tablet/phone** — Should work out of the box with Chrome.

### Medium Priority
- [ ] **Sensor reading** — The hub supports sensors (button, knob, light, sound, temperature, color, gyro). Protocol is in `electronic_logic_engine.js`. Could add sensor blocks to the extension.
- [ ] **LED control** — Hub supports RGB LED and LED panel. Protocol found in APK. Could add LED color blocks.
- [ ] **Buzzer control** — Hub has buzzer support. Protocol found. Could add sound/music blocks.
- [ ] **Save/load programs** — TurboWarp can save `.sb3` files but extension needs to be reloaded each time. Blockly app could use localStorage.

### Low Priority
- [ ] **Auto-load extension in TurboWarp** — Could submit to TurboWarp's official extension gallery so users don't need to paste code
- [ ] **Build native iOS app** — For users who don't want to use Bluefy
- [ ] **China hosting** — GitHub Pages is blocked/slow in China. Could mirror to Gitee Pages or Netlify.
- [ ] **Multiple hub support** — Connect to more than one DIDA hub simultaneously
- [ ] **Firmware update** — Protocol for firmware update exists in APK source (ENTERBOOTLOADER, FIRMWAREFRAME commands)

---

## 📁 FILE INVENTORY

### GitHub Repo: https://github.com/sophiekeke/didacubes

| File | Description | Status |
|------|-------------|--------|
| `README.md` | User guide — quick start, blocks, troubleshooting | ✅ Current |
| `dida_extension.js` | TurboWarp/Scratch 3.0 extension (11KB) | ✅ Current, Bluefy fix applied |
| `dida_inspector.html` | BLE sniffer & motor testing tool (51KB) | ✅ Current, Bluefy fix applied |
| `dida_blockly.html` | Standalone Blockly block coding app (23KB) | ✅ Built, untested on iPad |
| `KNOWLEDGE.md` | Technical knowledge sharing guide | ✅ Current |

### Local Backup: ~/Downloads/DidaCubes_Project/

All above files plus:
| File | Description |
|------|-------------|
| `DIDA_59D0_handoff_v2.md` | Full protocol documentation & search history |
| `DIDA_59D0_task.markdown` | Original task specification |
| `MyqA-DbpUh_108695.apk` | Original DidaCoding APK (128MB) |
| `WORKLOG.md` | This file |

### Local APK Extraction: ~/Downloads/dida_apk/

| Path | Description |
|------|-------------|
| `assets/www/js/electronic_logic_engine.js` | **THE PROTOCOL SOURCE** — 206KB, contains all BLE commands |
| `assets/www/gui.js` | Scratch 3.0 VM + app UI (huge file) |
| `assets/www/blocks-only.html` | App entry point, lists all script tags |
| `classes.dex` | Android bytecode (minimal, just Cordova bridge) |

### Zip Backup: ~/Downloads/DidaCubes_Project_Backup_20261112.zip
- Created before Bluefy fixes — needs re-zipping for latest files

---

## 🔑 KEY TECHNICAL NOTES

### BLE Connection on Bluefy (iPad)
Bluefy does NOT support `namePrefix` in `requestDevice()`. Must use fallback:
```javascript
try { filters: [{ namePrefix: 'DIDA' }] }        // Chrome ✅, Bluefy ❌
catch → try { acceptAllDevices: true }              // Chrome ✅, Bluefy ✅
catch → try { filters: [{ services: [0xFFE0] }] }  // Chrome ✅, Bluefy ✅
```

### TurboWarp Extension Loading on iPad
- URL loading: ❌ blocked by TurboWarp CORS/security
- File loading: ❌ Bluefy can't browse iPad files easily
- **Text paste: ✅ WORKS** — copy code from raw GitHub URL, paste in TurboWarp

### Motor Init Sequence (MUST send before motor commands)
```
1. 46 04 00 25 01 20                          (SETCONNECTINTERVAL)
2. 45 0A 00 AA 00 01 FF FF 21 00 00 [xor]    (ARANGE, send 3x)
3. 45 08 00 02 00 01 00 01 11 [xor]           (GETBATTERY)
4. 45 0E 00 03 00 01 00 01 21 65 01 01 65 02 02 2C  (Motor config 1)
5. 45 0E 00 03 00 01 00 03 21 65 01 01 65 02 02 2E  (Motor config 2)
```

### GitHub Pages Deployment
- Repo: `sophiekeke/didacubes` (public)
- Branch: `main`, root folder
- First deploy needed a second commit to trigger build
- Takes ~1-2 minutes after push

---

## 📋 TO PICK UP NEXT SESSION

1. **Test Blockly app on iPad Bluefy** — quickest win
2. **Update zip backup** with latest files: `cd ~/Downloads && zip -r DidaCubes_Project_Backup_latest.zip DidaCubes_Project/`
3. **Add sensor/LED/buzzer blocks** if kids want more features — protocol is already extracted in `electronic_logic_engine.js`
4. **Test on Android** if available
