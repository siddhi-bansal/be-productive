#!/usr/bin/env node

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const ACTIVITY_FILE = path.join(__dirname, 'current-activity.json');
const UPDATE_INTERVAL = 2000; // Update every 2 seconds

let currentActivity = {
  timestamp: Date.now(),
  activeWindow: null,
  activeTab: null,
  browserUrl: null
};

// Get active window on macOS
function getMacOSActiveWindow(callback) {
  const script = `
    tell application "System Events"
      set frontApp to name of first application process whose frontmost is true
      set frontWindow to ""
      try
        set frontWindow to name of front window of application process frontApp
      end try
      return frontApp & "|" & frontWindow
    end tell
  `;
  
  exec(`osascript -e '${script}'`, (error, stdout) => {
    if (error) {
      callback(null);
      return;
    }
    
    const [appName, windowTitle] = stdout.trim().split('|');
    callback({ appName, windowTitle });
  });
}

// Get active Chrome/Edge/Safari tab URL on macOS
function getMacOSBrowserTab(appName, callback) {
  let script = '';
  
  if (appName === 'Google Chrome' || appName === 'Chromium') {
    script = `
      tell application "Google Chrome"
        if (count of windows) > 0 then
          get URL of active tab of front window
        end if
      end tell
    `;
  } else if (appName === 'Safari') {
    script = `
      tell application "Safari"
        if (count of windows) > 0 then
          get URL of current tab of front window
        end if
      end tell
    `;
  } else if (appName === 'Microsoft Edge') {
    script = `
      tell application "Microsoft Edge"
        if (count of windows) > 0 then
          get URL of active tab of front window
        end if
      end tell
    `;
  } else {
    callback(null);
    return;
  }
  
  exec(`osascript -e '${script}'`, (error, stdout) => {
    if (error) {
      callback(null);
      return;
    }
    callback(stdout.trim());
  });
}

// Get active window on Windows
function getWindowsActiveWindow(callback) {
  const script = `
    Add-Type @"
      using System;
      using System.Runtime.InteropServices;
      using System.Text;
      public class Window {
        [DllImport("user32.dll")]
        public static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll")]
        public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
        [DllImport("user32.dll")]
        public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
      }
"@
    $hwnd = [Window]::GetForegroundWindow()
    $title = New-Object System.Text.StringBuilder 256
    [void][Window]::GetWindowText($hwnd, $title, 256)
    $processId = 0
    [void][Window]::GetWindowThreadProcessId($hwnd, [ref]$processId)
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    Write-Output "$($process.ProcessName)|$($title.ToString())"
  `;
  
  exec(`powershell -Command "${script.replace(/"/g, '\\"')}"`, (error, stdout) => {
    if (error) {
      callback(null);
      return;
    }
    
    const [appName, windowTitle] = stdout.trim().split('|');
    callback({ appName, windowTitle });
  });
}

// Main monitoring function
function updateActivity() {
  const platform = process.platform;
  
  if (platform === 'darwin') {
    // macOS
    getMacOSActiveWindow((windowInfo) => {
      if (!windowInfo) {
        saveActivity();
        return;
      }
      
      currentActivity.activeWindow = windowInfo.appName;
      currentActivity.activeTab = windowInfo.windowTitle;
      currentActivity.timestamp = Date.now();
      
      // Try to get browser URL if it's a browser
      const browsers = ['Google Chrome', 'Safari', 'Microsoft Edge', 'Chromium'];
      if (browsers.includes(windowInfo.appName)) {
        getMacOSBrowserTab(windowInfo.appName, (url) => {
          currentActivity.browserUrl = url;
          saveActivity();
        });
      } else {
        currentActivity.browserUrl = null;
        saveActivity();
      }
    });
  } else if (platform === 'win32') {
    // Windows
    getWindowsActiveWindow((windowInfo) => {
      if (!windowInfo) {
        saveActivity();
        return;
      }
      
      currentActivity.activeWindow = windowInfo.appName;
      currentActivity.activeTab = windowInfo.windowTitle;
      currentActivity.timestamp = Date.now();
      currentActivity.browserUrl = null; // Windows browser URL detection would need more work
      saveActivity();
    });
  } else {
    console.error('Unsupported platform:', platform);
    process.exit(1);
  }
}

function saveActivity() {
  try {
    fs.writeFileSync(ACTIVITY_FILE, JSON.stringify(currentActivity, null, 2));
  } catch (e) {
    console.error('Error saving activity:', e.message);
  }
}

// Start monitoring
console.log('🔍 Activity monitor started');
console.log('Platform:', process.platform);
console.log('Update interval:', UPDATE_INTERVAL + 'ms');
console.log('');

updateActivity(); // Initial update
setInterval(updateActivity, UPDATE_INTERVAL);
