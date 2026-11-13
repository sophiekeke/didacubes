# Reverse Engineering BLE STEM Toys — A Complete Guide

## From Discontinued App to Working Controller in One Session

This document shares everything we learned reverse-engineering the **DidaCubes** (DIDA_59D0) BLE robotics hub — a Chinese STEM building block kit whose official app was delisted. The techniques here apply to **any BLE-controlled toy or device** with a discontinued app.

---

## Table of Contents

1. [Overview & Problem](#1-overview--problem)
2. [Phase 1: BLE Reconnaissance](#2-phase-1-ble-reconnaissance)
3. [Phase 2: Protocol Fuzzing](#3-phase-2-protocol-fuzzing)
4. [Phase 3: APK Hunting](#4-phase-3-apk-hunting)
5. [Phase 4: APK Decompilation & Protocol Extraction](#5-phase-4-apk-decompilation--protocol-extraction)
6. [Phase 5: Building the Controller](#6-phase-5-building-the-controller)
7. [Phase 6: Cross-Platform Deployment](#7-phase-6-cross-platform-deployment)
8. [Web Bluetooth Compatibility Guide](#8-web-bluetooth-compatibility-guide)
9. [Common BLE Toy Protocol Patterns](#9-common-ble-toy-protocol-patterns)
10. [Tools & Resources](#10-tools--resources)
11. [Lessons Learned](#11-lessons-learned)

---

## 1. Overview & Problem

**Scenario:** You have a BLE-controlled STEM toy/robot. The companion app has been delisted from app stores because the manufacturer went out of business. The hardware is perfectly functional but useless without the app.

**Goal:** Reverse-engineer the BLE protocol and build a replacement controller.

**Our case:**
- Product: DidaCubes "Main Board Mini" (乐可得/Lect 30-in-1 STEM Building Block)
- BLE device name: `DIDA_59D0`
- Original app: "DidaCoding" (Scratch 3.0-based, Cordova hybrid app)
- Company: Didacubes, Guangdong China (founded 2017, now defunct)

**Time to solve:** ~4 hours from zero knowledge to motor spinning.

---

## 2. Phase 1: BLE Reconnaissance

### Tools
- **Chrome** on Mac/Windows with `chrome://bluetooth-internals`
- A custom **Web Bluetooth inspector** (HTML/JS single-file app)

### Steps

1. **Scan with `chrome://bluetooth-internals`**
   - Open in Chrome, click "Start Scanning"
   - Find your device, note the name, MAC address, and advertised services
   - This tells you the BLE service UUIDs before writing any code

2. **Build a Web Bluetooth Inspector** (or use ours)
   - Connect to the device using `navigator.bluetooth.requestDevice()`
   - Enumerate all services and characteristics
   - Log their UUIDs and properties (read/write/notify/indicate)

3. **Subscribe to all notify characteristics immediately**
   - Many devices send a status/handshake packet right after connection
   - **Capture this first packet** — it's your Rosetta Stone for the protocol

### What we found:
```
Service:        0000ffe0 (HM-10 / CC254x UART passthrough)
Characteristic: 0000ffe1 — notify only (device → phone)
Characteristic: 0000ffe2 — writeWithoutResponse only (phone → device)
First RX packet: 45 0C 00 03 00 02 00 01 62 05 00 21 00 4A
```

### Key insight: The FFE0/FFE1/FFE2 split
Many Chinese BLE toys use the HM-10 (or JDY, CC254x) transparent UART module:
- `FFE0` = service
- `FFE1` = notify (RX from device)
- `FFE2` = write (TX to device)

This is a "dumb pipe" — the BLE module just passes bytes between the app and the toy's MCU. The actual command protocol is entirely custom.

---

## 3. Phase 2: Protocol Fuzzing

### Why fuzzing usually fails for these toys
We sent **700+ packets** across 17 fuzzer groups covering every common protocol pattern. **Zero responses.**

Common patterns tested and ruled out:
- Makeblock / mBot (`FF 55 ...`)
- AA 55 / 55 AA framing
- A5 5A framing
- AT commands
- Raw byte commands
- Every possible header byte (0x00–0xFF)

**Why it failed:** The hub required a **multi-packet initialization handshake** before accepting any commands. Without sending the correct init sequence first, the hub silently ignores all writes.

### When fuzzing DOES work
Fuzzing works well when:
- The device responds to individual commands without initialization
- The device uses a common OEM protocol
- You can observe physical feedback (motor, LED, beep) for each packet

### When fuzzing DOESN'T work
- Device needs a handshake/init sequence
- Device needs authentication
- Commands only work after the correct configuration packets
- **In these cases: get the APK/IPA and decompile it**

---

## 4. Phase 3: APK Hunting

### The hardest part: finding the right app name
Our initial search failed because we had the **wrong app name**. The product manual (physical booklet) had Chinese text that led us to search for "智童嘀嗒编程" and package name `com.lect.Dida`. Neither produced results.

**The breakthrough:** Reading the **English side** of the product manual revealed:
- Product name: **DidaCubes**
- App name: **DidaCoding**
- "Please search DidaCoding in Google Play or App Store"

### Where to search for discontinued APKs

| Priority | Site | URL |
|----------|------|-----|
| 1 | GameLoop (game emulator) | gameloop.com/game/education/ |
| 2 | APKPure | apkpure.com |
| 3 | APKCombo | apkcombo.com |
| 4 | APKMirror | apkmirror.com |
| 5 | Uptodown | uptodown.com |
| 6 | APKFab | apkfab.com |
| 7 | Wayback Machine | web.archive.org |
| 8 | Chinese stores | wandoujia.com, coolapk.com, sj.qq.com |
| 9 | Baidu search | Search in Chinese: "APP名 APK 下载" |

### Tips
- **Search by BOTH the English and Chinese app names**
- **Read the physical product manual** — it often has the exact app name and QR codes
- Check **Crunchbase** for company info (we found Didacubes there)
- Check **education partner sites** (we found Logics Academy which distributed DidaCubes in Canada)
- GameLoop (a Tencent game emulator) unexpectedly had the app listing

---

## 5. Phase 4: APK Decompilation & Protocol Extraction

### APKs are just ZIP files
```bash
mkdir apk_extracted
unzip app.apk -d apk_extracted
```

### Identify the app architecture
Look at the extracted contents:
- **`assets/www/`** → Cordova/PhoneGap hybrid app (HTML/JS) ← **easiest to reverse-engineer**
- **`classes.dex`** → Native Android (Java/Kotlin) — needs jadx
- **`lib/*.so`** → Native C/C++ libraries — hardest
- **`assets/*.js`** or **`assets/*.lua`** → Embedded scripting

### Our case: Cordova hybrid app
The DidaCoding app was Cordova-based with Scratch 3.0:
```
assets/www/
├── blocks-only.html      ← main HTML, lists all script tags
├── gui.js                ← Scratch 3.0 VM (huge, 260K lines)
├── js/
│   └── electronic_logic_engine.js  ← THE PROTOCOL! (206KB)
├── cordova.js
└── lib.min.js
```

### How to find the protocol in the code

**Step 1:** Find the HTML entry point
```bash
find assets/www -name "*.html" | xargs grep "script"
```
This revealed `electronic_logic_engine.js` — the protocol engine.

**Step 2:** Search for BLE UUIDs
```bash
grep -n "ffe0\|ffe1\|ffe2\|bluetooth\|writeCharacteristic" electronic_logic_engine.js
```

**Step 3:** Search for device-specific code
```bash
grep -n "motor\|Motor\|setSpeed\|MOTOR\|0x45\|header\|checksum" electronic_logic_engine.js
```

**Step 4:** Extract the protocol components
Look for:
- **Packet header bytes** (our case: `0x45` for data, `0x46` for sound)
- **Checksum algorithm** (our case: XOR of length + payload)
- **Command definitions** (our case: motor type `0x65`, SET_SPEED `0x31`)
- **Init/handshake sequence** (our case: SETCONNECTINTERVAL → ARANGE → config packets)

### The discovered protocol
```
Packet format: [HEADER] [LENGTH] [PAYLOAD...] [XOR_CHECKSUM]

Header:    0x45 (data) or 0x46 (sound)
Length:    payload_bytes + 1 (includes checksum)
Checksum:  XOR of length and all payload bytes

Init sequence (must send in order):
1. SETCONNECTINTERVAL: 46 04 00 25 01 20
2. ARANGE (x3):       45 0A 00 AA 00 01 FF FF 21 00 00 [xor]
3. GETBATTERY:         45 08 00 02 00 01 00 01 11 [xor]
4. Motor config:       45 0E 00 03 00 01 00 01 21 65 01 01 65 02 02 2C
5. Motor commands:     45 0C [payload] [xor]
```

---

## 6. Phase 5: Building the Controller

### Option A: TurboWarp/Scratch Extension
Best for **educational use** — kids can drag-and-drop program the robot.

```javascript
// TurboWarp unsandboxed extension structure
(function(Scratch) {
  class MyExtension {
    getInfo() {
      return {
        id: 'mydevice',
        name: 'My Device',
        blocks: [
          { opcode: 'connect', blockType: Scratch.BlockType.COMMAND, text: 'connect' },
          { opcode: 'setMotor', blockType: Scratch.BlockType.COMMAND, text: 'motor [SPEED]',
            arguments: { SPEED: { type: Scratch.ArgumentType.NUMBER, defaultValue: 100 } } }
        ]
      };
    }
    async connect() { /* Web Bluetooth connection */ }
    async setMotor(args) { /* Send BLE command */ }
  }
  Scratch.extensions.register(new MyExtension());
})(Scratch);
```

### Option B: Standalone HTML App
Best for **quick testing** — single file, no dependencies.

### Option C: Both
We built both — inspector for testing, TurboWarp extension for coding.

---

## 7. Phase 6: Cross-Platform Deployment

### GitHub Pages (free hosting)
1. Create public repo on GitHub
2. Push your HTML/JS files
3. Settings → Pages → Deploy from branch → main
4. **Important:** First deployment may need a second commit to trigger the build
5. URL: `https://username.github.io/reponame/`

### Triggering the first deployment
GitHub Pages sometimes doesn't build on the initial commit. Fix:
```bash
echo "" >> README.md
git add . && git commit -m "trigger pages" && git push
```

---

## 8. Web Bluetooth Compatibility Guide

| Platform | Browser | Web Bluetooth | Notes |
|----------|---------|:---:|-------|
| Mac | Chrome | ✅ | Best platform for development |
| Mac | Safari | ❌ | Apple doesn't implement it |
| Windows | Chrome/Edge | ✅ | May need chrome://flags |
| Chromebook | Chrome | ✅ | Great for schools |
| Android | Chrome | ✅ | Works well |
| iPad/iPhone | Safari | ❌ | Apple blocks it |
| iPad/iPhone | Chrome | ❌ | Uses WebKit underneath |
| iPad/iPhone | **Bluefy** ($2) | ✅ | Third-party browser with Web Bluetooth |

### Bluefy Compatibility Fix
Bluefy's Web Bluetooth doesn't support `namePrefix` filter + `optionalServices` together. Use fallback:

```javascript
let device;
try {
  // Method 1: Chrome standard
  device = await navigator.bluetooth.requestDevice({
    filters: [{ namePrefix: 'DIDA' }],
    optionalServices: [0xFFE0]
  });
} catch (e1) {
  try {
    // Method 2: acceptAllDevices (Bluefy compatible)
    device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [0xFFE0]
    });
  } catch (e2) {
    // Method 3: service filter only
    device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [0xFFE0] }]
    });
  }
}
```

---

## 9. Common BLE Toy Protocol Patterns

### Header patterns seen in Chinese STEM toys
| Header | Manufacturer/Type |
|--------|------------------|
| `FF 55` | Makeblock / mBot |
| `AA 55` | Common Shantou/Chenghai OEM |
| `55 AA` | Reversed variant |
| `A5 5A` | Another common OEM |
| `45` / `46` | DidaCubes (Didacubes) |
| `FE EF` | Various |

### Typical packet structure
```
[HEADER] [LENGTH] [COMMAND] [DATA...] [CHECKSUM]
```

### Common checksum types
1. **XOR** — XOR all bytes (most common in Chinese toys)
2. **SUM** — Sum all bytes, modulo 256
3. **CRC8** — CRC-8 polynomial
4. **None** — Some toys don't use checksums

### Init handshake patterns
Many BLE toys require an init sequence:
1. **Connection interval negotiation** — tells the BLE module how fast to communicate
2. **Block/module discovery** — polls which sensors/motors are connected
3. **Version query** — app checks firmware compatibility
4. **Configuration packets** — tells the hub which ports have what devices

**If your fuzzer gets zero responses, the device probably needs an init handshake. Get the APK.**

---

## 10. Tools & Resources

### BLE Investigation
- **Chrome `chrome://bluetooth-internals`** — built-in BLE scanner
- **nRF Connect** (Android/iOS) — professional BLE scanner
- **Web Bluetooth API** — `navigator.bluetooth` in Chrome
- **Wireshark + HCI snoop log** (Android) — captures raw BLE packets

### APK Decompilation
- **unzip** — APKs are ZIP files, extract directly for Cordova apps
- **jadx** — Java decompiler for native Android apps (`brew install jadx`)
- **apktool** — APK disassembler
- **strings** — extract readable strings from DEX/SO files

### Web Development
- **TurboWarp** — Scratch 3.0 fork supporting custom extensions
- **Google Blockly** — visual block coding library (what Scratch is built on)
- **GitHub Pages** — free static hosting

### Protocol Reverse Engineering
- **grep** — your best friend for searching decompiled code
- **Source maps** (`.js.map`) — often included in debug builds, reveals original file structure

---

## 11. Lessons Learned

### 1. Read the physical manual first
We wasted time searching for the wrong app name. The English side of the product manual had the exact app name "DidaCoding" — which was different from the Chinese name we'd been searching.

### 2. Fuzzing has limits
700+ packets, zero responses. When a device needs a multi-step handshake, brute-force fuzzing can't find the right combination. APK decompilation is the reliable path.

### 3. Cordova/hybrid apps are easy to reverse-engineer
No decompilation needed — just unzip the APK and read the JavaScript. The BLE protocol is usually in plain text.

### 4. The init handshake is everything
The hub was receiving our packets fine (no write errors) but silently ignoring them because we hadn't sent the initialization sequence. This is a common anti-pattern in BLE toys.

### 5. Cross-browser BLE is tricky
Web Bluetooth works differently across browsers. Always implement multiple fallback connection methods, especially for Bluefy on iPad.

### 6. GitHub Pages needs a kick
The first deployment after enabling Pages sometimes doesn't trigger. Push a small commit to force it.

### 7. One session is enough
With the right approach (BLE recon → try fuzzing → get APK → decompile → extract protocol → build controller), you can go from zero to working in a single session. Don't give up when fuzzing fails — that's normal.

---

## Project Files

| File | Description |
|------|-------------|
| `dida_extension.js` | TurboWarp/Scratch 3.0 extension |
| `dida_inspector.html` | BLE protocol inspector & testing tool |
| `README.md` | User-facing quick start guide |
| `KNOWLEDGE.md` | This file — technical knowledge sharing |
| `DIDA_59D0_handoff_v2.md` | Full protocol documentation |

## Live Demo
- **Inspector:** https://sophiekeke.github.io/didacubes/dida_inspector.html
- **Extension:** https://sophiekeke.github.io/didacubes/dida_extension.js
- **Load in TurboWarp:** https://turbowarp.org/editor

---

*Created: November 12, 2026*
*Protocol reverse-engineered from DidaCoding APK v1.8.5 (com.lect.Dida)*
