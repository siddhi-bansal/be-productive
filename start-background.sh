#!/bin/bash
# Start the Be Productive service in the background using PM2

echo "🚀 Starting Be Productive DNS blocker in background..."
echo "⚠️  This requires sudo access to bind to port 53 (DNS)"
echo ""

# Ensure dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check if already running
if pgrep -f "node server-dns.js" > /dev/null; then
    echo "⚠️  Service is already running!"
    echo "🛑 Stop it first with: npm run stop"
    exit 1
fi

# Start with nohup (requires sudo)
echo "Starting DNS server in background (requires password)..."
sudo nohup node server-dns.js > be-productive.log 2>&1 &
echo $! > be-productive.pid

# Start activity monitor
echo "Starting activity monitor..."
nohup node monitor.js > monitor.log 2>&1 &
echo $! > monitor.pid

sleep 2

if pgrep -f "node server-dns.js" > /dev/null; then
    echo ""
    echo "✅ Be Productive is now running in the background!"
    echo "📊 View logs with: npm run logs"
    echo "🛑 Stop with: npm run stop (requires parent code)"
    echo ""
    echo "🌐 Visit http://localhost:8888/setup.html to configure"
    echo "👁️  Visit http://localhost:8888/monitor.html to view activity"
    echo ""
    echo "⚙️  Configure your system DNS to 127.0.0.1 to activate blocking"
else
    echo "❌ Failed to start. Check be-productive.log for errors"
    exit 1
fi
