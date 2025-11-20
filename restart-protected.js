#!/usr/bin/env node

const readline = require('readline');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CONFIG_FILE = path.join(__dirname, 'config.json');

// Load config
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Error loading config:', e.message);
  }
  return null;
}

function hashCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n🔒 Be Productive - Protected Restart\n');

const config = loadConfig();

if (!config || !config.parentCodeHash) {
  console.log('⚠️  No parent code configured. Service can be restarted.');
  rl.question('Restart the service? (y/n): ', (answer) => {
    if (answer.toLowerCase() === 'y') {
      try {
        execSync('sudo pkill -f "node server-dns.js"', { stdio: 'inherit' });
        execSync('cd ' + __dirname + ' && sudo nohup node server-dns.js > be-productive.log 2>&1 &', { stdio: 'inherit' });
        console.log('✅ Service restarted');
      } catch (e) {
        console.error('❌ Failed to restart service');
      }
    }
    rl.close();
  });
} else {
  rl.question('Enter parent code (6 digits): ', (code) => {
    if (hashCode(code) === config.parentCodeHash) {
      console.log('\n✅ Parent code verified. Restarting service...\n');
      try {
        execSync('sudo pkill -f "node server-dns.js"', { stdio: 'inherit' });
        execSync('cd ' + __dirname + ' && sudo nohup node server-dns.js > be-productive.log 2>&1 &', { stdio: 'inherit' });
        console.log('\n✅ Service restarted successfully');
      } catch (e) {
        console.error('❌ Failed to restart service:', e.message);
      }
    } else {
      console.log('\n❌ Incorrect parent code. Service NOT restarted.\n');
      process.exit(1);
    }
    rl.close();
  });
}
