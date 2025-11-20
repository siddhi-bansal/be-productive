# 🔒 Be Productive

System-wide website blocker for parents. Blocks distracting sites across all browsers using a manual blocklist.

---

## 🚀 Quick Setup

### 1. Install
```bash
npm install
```

### 2. Start (requires sudo for DNS)
```bash
# macOS/Linux
sudo ./start-background.sh

# Windows (Run as Administrator)
start-background.bat
```

### 3. Configure DNS

**macOS:**
- System Settings → Network → Wi-Fi → Details → DNS
- Add `127.0.0.1` at the top

**Windows:**
- Settings → Network & Internet → Your Connection → Edit DNS
- Manual → IPv4: `127.0.0.1`

### 4. Setup Parent Code
Visit `http://localhost:8888/setup.html`
- Enter 6-digit parent code
- This protects settings and stop/restart commands

### 5. Add Blocked Sites
Visit `http://localhost:8888/settings.html` (requires parent code)
- Sites default to allowed
- Manually add distracting domains to the blocklist
- Common ones are pre-loaded: youtube.com, poki.com, etc.

### 6. Test
Try visiting `youtube.com` - should fail to load if in blocklist.

---

## 📋 How It Works

1. **Browser asks DNS**: "What's the IP for youtube.com?"
2. **Our DNS intercepts**: Checks if domain is in blocklist
3. **If blocked**: Returns `127.0.0.1` (nowhere) → site fails to load
4. **If allowed**: Returns real IP → site loads normally

**Speed**: Instant lookups from local blocklist
**Privacy**: All local, no external API calls

---

## 🎛️ Managing

### Settings Page
Visit `http://localhost:8888/settings.html` (requires parent code) to:
- Add/remove domains from blocklist
- Grant temporary 30-min access
- View current blocklist

### Activity Monitor
Visit `http://localhost:8888/monitor.html` (requires parent code) to:
- See real-time activity (current app, browser URL)
- Check if current site is blocked or allowed
- Access from phone on same network

**Accessing from Another Device (Phone/Tablet):**

1. Find the computer's IP address:
   - **macOS**: `System Settings → Network → Wi-Fi → Details → TCP/IP` (look for "IP Address")
   - **macOS (Terminal)**: `ipconfig getifaddr en0`
   - **Windows**: `Settings → Network & Internet → Wi-Fi → Properties` (look for "IPv4 address")
   - **Windows (Command Prompt)**: `ipconfig` (look for "IPv4 Address")

2. On your phone/tablet, open browser and visit:
   - `http://<computer-ip>:8888/monitor.html`
   - Example: `http://192.168.1.100:8888/monitor.html`

3. Enter parent code to view real-time activity

**Note**: Both devices must be on the same Wi-Fi network.

### Commands
```bash
npm run logs            # View logs
npm run stop            # Stop (requires parent code)
npm run restart         # Restart (requires parent code)
npm run status          # Check if running
```

---

## ⚙️ Auto-Start on Boot

### macOS
Create a LaunchDaemon:
```bash
sudo tee /Library/LaunchDaemons/com.beproductive.plist <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.beproductive</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/path/to/be-productive/server-dns.js</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
EOF
sudo launchctl load /Library/LaunchDaemons/com.beproductive.plist
```

### Windows
Create a scheduled task that runs `start-background.bat` at startup with Administrator privileges.

---

## ⚠️ Limitations

**Can be bypassed by:**
- Changing DNS settings back
- Killing process from Task Manager/Activity Monitor
- Running `sudo pkill -f "node server-dns.js"`

**Best for:** Non-technical children who don't know about DNS or terminal commands.

**Stronger security:** Combine with OS-level parental controls and password-protect System Settings.

---

## 📁 Files

```
be-productive/
├── server-dns.js              # DNS server + web interface
├── monitor.js                 # Activity tracking
├── start-background.sh        # Startup script (macOS/Linux)
├── start-background.bat       # Startup script (Windows)
├── stop-protected.js          # Protected stop
├── restart-protected.js       # Protected restart
├── package.json
├── domain-cache-starter.json  # Pre-populated blocklist template
├── config.json                # Auto-generated config (gitignored)
├── domain-cache.json          # Runtime blocklist cache (gitignored)
└── public/
    ├── setup.html            # Initial setup page
    ├── settings.html         # Parent management page
    └── monitor.html          # Real-time activity monitor
```

---

## 🐛 Troubleshooting

**⚠️ IMPORTANT: After Stopping Service**
When you stop the service, you **must** change DNS settings back to automatic or a public DNS (like `8.8.8.8`) - otherwise websites won't load!

**macOS:**
- System Settings → Network → Wi-Fi → Details → DNS
- Remove `127.0.0.1` or click `-` button
- Add `8.8.8.8` or leave empty for automatic

**Windows:**
- Settings → Network & Internet → Your Connection → Edit DNS
- Switch to "Automatic (DHCP)" or set to `8.8.8.8`

---

**Sites not blocking:**
- Check DNS is set to `127.0.0.1`
- Verify service is running: `npm run status`
- Check logs: `npm run logs`

**Forgot parent code:**
- Stop service: `npm run stop` (or `sudo pkill -f "node server-dns.js"`)
- Delete `config.json`
- Restart and reconfigure

**Port 53 in use:**
```bash
# macOS
sudo lsof -i :53
# Windows
netstat -ano | findstr :53
```

---

## 💡 Notes

- **All sites allowed by default** - Manually add distracting sites to blocklist
- **Subdomain matching** - Blocking `youtube.com` also blocks `www.youtube.com`, `m.youtube.com`, etc.
- **Activity monitoring** - Real-time tracking of active app and browser URLs
- **Privacy:** All local, no external API calls or tracking
- **Requires:** Node.js v14+ and sudo/admin access

---

**MIT License**
