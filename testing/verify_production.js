const WebSocket = require('ws');

const SERVER_DOMAIN = "chat-backend-production-a878.up.railway.app";
const API_URL = `https://${SERVER_DOMAIN}`;
const WS_URL = `wss://${SERVER_DOMAIN}`;

async function testConnection() {
    console.log(`🔍 Testing connection to: ${SERVER_DOMAIN}`);

    // 1. Test REST API (Health Check)
    try {
        console.log(`[HTTP] Sending health check to ${API_URL}/health...`);
        const response = await fetch(`${API_URL}/health`);
        const data = await response.json();
        console.log(`[HTTP] ✅ Response received:`, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error(`[HTTP] ❌ Failed to connect to REST API:`, err.message);
    }

    // 2. Test WebSocket
    console.log(`[WS] Opening WebSocket to ${WS_URL}...`);
    const ws = new WebSocket(WS_URL);

    ws.on('open', () => {
        console.log('[WS] ✅ Success! Connection established.');
        ws.close();
        process.exit(0);
    });

    ws.on('error', (err) => {
        console.error(`[WS] ❌ error:`, err.message);
        process.exit(1);
    });
    
    // Safety timeout
    setTimeout(() => {
        console.error('[TIME] ❌ Connection timed out after 10s.');
        process.exit(1);
    }, 10000);
}

testConnection();
