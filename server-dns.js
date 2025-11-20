const dns = require('native-dns');
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Ports
const DNS_PORT = 53;
const WEB_PORT = 8888;
const UPSTREAM_DNS = '8.8.8.8'; // Google DNS as fallback

// Config file paths
const CONFIG_FILE = path.join(__dirname, 'config.json');
const CACHE_FILE = path.join(__dirname, 'domain-cache.json');

// In-memory state
let config = {
  parentCodeHash: null,
  whitelist: [],
  temporaryAccess: {} // { domain: expiryTimestamp }
};

let domainCache = {
  productive: [],
  distracting: []
}; // { productive: [...domains], distracting: [...domains] }

// ======================
// Config Management
// ======================

function hashCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      const loaded = JSON.parse(data);
      config = { ...config, ...loaded };
    }
  } catch (e) {
    console.error('Error loading config:', e.message);
  }
}

function saveConfig() {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (e) {
    console.error('Error saving config:', e.message);
  }
}

function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      
      // Support both old format {domain: "type"} and new format {productive: [], distracting: []}
      if (Array.isArray(data.distracting)) {
        domainCache = data;
      } else {
        // Convert old format to new
        domainCache = { productive: [], distracting: [] };
        for (const [domain, type] of Object.entries(data)) {
          if (type === 'distracting') {
            domainCache.distracting.push(domain);
          }
          // Don't store productive ones
        }
      }
    }
  } catch (e) {
    console.error('Error loading cache:', e.message);
  }
}

function saveCache() {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(domainCache, null, 2));
  } catch (e) {
    console.error('Error saving cache:', e.message);
  }
}

function verifyParentCode(code) {
  if (!config.parentCodeHash) return false;
  return hashCode(code) === config.parentCodeHash;
}

// ======================
// AI Classification
// ======================

async function classifyDomain(domain) {
  // Check if in distracting list
  if (domainCache.distracting.includes(domain)) {
    return 'distracting';
  }

  // Check for parent domain match (e.g., if "youtube.com" is distracting, so is "i.ytimg.com")
  const parts = domain.split('.');
  for (let i = 0; i < parts.length - 1; i++) {
    const parentDomain = parts.slice(i).join('.');
    if (domainCache.distracting.includes(parentDomain)) {
      console.log(`📋 ${domain} inherits classification from ${parentDomain}: distracting`);
      // Add this subdomain to cache too
      if (!domainCache.distracting.includes(domain)) {
        domainCache.distracting.push(domain);
        saveCache();
      }
      return 'distracting';
    }
  }

  // Default to productive (don't cache it)
  console.log(`❓ ${domain} not in blocklist - allowing`);
  return 'productive';
}

// ======================
// Domain Blocking Logic
// ======================

function shouldBlockDomain(domain) {
  // Always allow localhost and our management interface
  if (domain === 'localhost' || domain === '127.0.0.1' || domain.includes('be-productive')) {
    return false;
  }

  // Always allow critical infrastructure domains
  const criticalDomains = [
    // DNS and system services
    'dns.google',
    'cloudflare-dns.com',
    '1.1.1.1',
    '8.8.8.8',
    // Apple services (for macOS)
    'apple.com',
    'icloud.com',
    'apple-cloudkit.com',
    'push.apple.com',
    // Microsoft services
    'microsoft.com',
    'windows.com',
    // Other critical services
    'github.com',
    'githubcopilot.com'
  ];

  for (const critical of criticalDomains) {
    if (domain === critical || domain.endsWith('.' + critical)) {
      return false;
    }
  }

  // Check whitelist
  if (config.whitelist.includes(domain)) {
    return false;
  }

  // Check temporary access
  if (config.temporaryAccess[domain]) {
    if (Date.now() < config.temporaryAccess[domain]) {
      return false; // Still within temporary access window
    } else {
      // Expired, remove it
      delete config.temporaryAccess[domain];
      saveConfig();
    }
  }

  return true;
}

// ======================
// DNS Server
// ======================

const dnsServer = dns.createServer();

dnsServer.on('request', async (request, response) => {
  const question = request.question[0];
  const domain = question.name;
  
  console.log(`DNS Query: ${domain}`);

  // Classify the domain
  const classification = await classifyDomain(domain);
  
  if (classification === 'distracting' && shouldBlockDomain(domain)) {
    // Block by returning 127.0.0.1
    console.log(`🚫 BLOCKED: ${domain}`);
    response.answer.push(dns.A({
      name: domain,
      address: '127.0.0.1',
      ttl: 300
    }));
    response.send();
  } else {
    // Forward to upstream DNS
    console.log(`✓ ALLOWED: ${domain}`);
    
    const upstreamRequest = dns.Request({
      question: question,
      server: { address: UPSTREAM_DNS, port: 53, type: 'udp' },
      timeout: 1000,
    });

    upstreamRequest.on('message', (err, answer) => {
      answer.answer.forEach(a => response.answer.push(a));
      response.send();
    });

    upstreamRequest.on('timeout', () => {
      console.error('DNS upstream timeout');
      response.send();
    });

    upstreamRequest.send();
  }
});

dnsServer.on('error', (err) => {
  console.error('DNS Server error:', err);
});

// ======================
// Web Interface (Express)
// ======================

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// API: Setup parent code
app.post('/api/setup', (req, res) => {
  const { parentCode } = req.body;

  if (!parentCode || parentCode.length !== 6 || !/^\d+$/.test(parentCode)) {
    return res.status(400).json({ error: 'Parent code must be exactly 6 digits' });
  }

  config.parentCodeHash = hashCode(parentCode);
  
  saveConfig();

  res.json({ success: true, message: 'Parent code set successfully' });
});

// API: Verify parent code
app.post('/api/verify', (req, res) => {
  const { parentCode } = req.body;

  if (verifyParentCode(parentCode)) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Incorrect parent code' });
  }
});

// API: Unlock domain temporarily
app.post('/api/unlock', (req, res) => {
  const { parentCode, domain, minutes } = req.body;

  if (!verifyParentCode(parentCode)) {
    return res.status(401).json({ error: 'Incorrect parent code' });
  }

  const expiryTime = Date.now() + (minutes || 30) * 60 * 1000;
  config.temporaryAccess[domain] = expiryTime;
  saveConfig();

  res.json({ success: true, message: `Domain unlocked for ${minutes || 30} minutes` });
});

// API: Add to whitelist permanently
app.post('/api/whitelist', (req, res) => {
  const { parentCode, domain } = req.body;

  if (!verifyParentCode(parentCode)) {
    return res.status(401).json({ error: 'Incorrect parent code' });
  }

  if (!config.whitelist.includes(domain)) {
    config.whitelist.push(domain);
    saveConfig();
  }

  res.json({ success: true, message: 'Domain added to whitelist' });
});

// API: Remove from whitelist
app.post('/api/whitelist/remove', (req, res) => {
  const { parentCode, domain } = req.body;

  if (!verifyParentCode(parentCode)) {
    return res.status(401).json({ error: 'Incorrect parent code' });
  }

  config.whitelist = config.whitelist.filter(d => d !== domain);
  saveConfig();

  res.json({ success: true, message: 'Domain removed from whitelist' });
});

// API: Get settings (requires auth)
app.post('/api/settings', (req, res) => {
  const { parentCode } = req.body;

  if (!verifyParentCode(parentCode)) {
    return res.status(401).json({ error: 'Incorrect parent code' });
  }

  res.json({
    whitelist: config.whitelist,
    temporaryAccess: config.temporaryAccess
  });
});

// API: Get current activity (requires parent code)
app.post('/api/activity', (req, res) => {
  const { parentCode } = req.body;

  if (!verifyParentCode(parentCode)) {
    return res.status(401).json({ error: 'Incorrect parent code' });
  }

  try {
    const activityFile = path.join(__dirname, 'current-activity.json');
    if (fs.existsSync(activityFile)) {
      const activity = JSON.parse(fs.readFileSync(activityFile, 'utf8'));
      
      // Check if the current URL/domain is blocked
      let isBlocked = false;
      let domain = null;
      
      if (activity.browserUrl) {
        try {
          const url = new URL(activity.browserUrl);
          domain = url.hostname;
          
          // Check if this domain would be blocked
          const classification = domainCache.distracting.includes(domain) ? 'distracting' : 'productive';
          if (classification === 'distracting' && shouldBlockDomain(domain)) {
            isBlocked = true;
          }
        } catch (e) {
          // Invalid URL
        }
      }
      
      activity.isBlocked = isBlocked;
      activity.checkedDomain = domain;
      
      res.json(activity);
    } else {
      res.json({ 
        timestamp: Date.now(),
        activeWindow: null,
        activeTab: null,
        browserUrl: null,
        isBlocked: false,
        error: 'Activity monitor not running'
      });
    }
  } catch (e) {
    res.status(500).json({ error: 'Failed to read activity' });
  }
});

// API: Shutdown (requires parent code)
app.post('/api/shutdown', (req, res) => {
  const { parentCode } = req.body;

  if (!verifyParentCode(parentCode)) {
    return res.status(401).json({ error: 'Incorrect parent code' });
  }

  res.json({ success: true, message: 'Shutting down...' });
  
  setTimeout(() => {
    console.log('Server shutdown requested by parent');
    process.exit(0);
  }, 1000);
});

// ======================
// Start Servers
// ======================

loadConfig();
loadCache();

// Check if running as root (required for port 53)
if (process.getuid && process.getuid() !== 0) {
  console.error('\n❌ ERROR: DNS server requires root privileges to bind to port 53');
  console.error('Please run with sudo:');
  console.error('  sudo npm run pm2-start\n');
  process.exit(1);
}

// Start DNS server
dnsServer.serve(DNS_PORT);

// Start web interface
app.listen(WEB_PORT, () => {
  console.log(`\n===========================================`);
  console.log(`Be Productive - DNS-Based Website Blocker`);
  console.log(`===========================================`);
  console.log(`✓ DNS Server running on port ${DNS_PORT}`);
  console.log(`✓ Web Interface on http://localhost:${WEB_PORT}`);
  console.log(`\nSetup Instructions:`);
  console.log(`1. Configure your system DNS to: 127.0.0.1`);
  console.log(`2. Visit http://localhost:${WEB_PORT}/setup.html to set parent code`);
  console.log(`3. Visit http://localhost:${WEB_PORT}/settings.html for management`);
  console.log(`===========================================\n`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nAttempted shutdown detected!');
  console.log('Parent code required to stop the server.');
  console.log(`Visit http://localhost:${WEB_PORT}/settings.html to shutdown properly.\n`);
});

process.on('SIGTERM', () => {
  console.log('\n\nAttempted shutdown detected!');
  console.log('Parent code required to stop the server.');
});
