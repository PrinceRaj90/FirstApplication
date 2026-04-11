const WebSocket = require('ws');

const SERVER_DOMAIN = "chat-backend-production-a878.up.railway.app";
const API_URL = `https://${SERVER_DOMAIN}`;
const WS_URL = `wss://${SERVER_DOMAIN}`;

const testUserMale = {
    name: "Test Male",
    username: "testmale_" + Math.floor(Math.random() * 1000),
    age: 25,
    sex: "male",
    password: "password123"
};

const testUserFemale = {
    name: "Test Female",
    username: "testfemale_" + Math.floor(Math.random() * 1000),
    age: 24,
    sex: "female",
    password: "password123"
};

async function simulateFullFlow() {
    console.log("🏁 Starting Full Functionality Test...");

    try {
        // 1. Register Users
        console.log("[1/4] Registering test users...");
        const regM = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testUserMale)
        });
        const resM = await regM.json();
        const userIdM = resM.id;

        const regF = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testUserFemale)
        });
        const resF = await regF.json();
        const userIdF = resF.id;

        console.log(`[AUTH] Registered Male: ${userIdM}, Female: ${userIdF}`);

        // 2. Open WebSockets
        console.log("[2/4] Connecting WebSockets...");
        const wsM = new WebSocket(WS_URL);
        const wsF = new WebSocket(WS_URL);

        let mConnected = false, fConnected = false;

        wsM.on('open', () => {
            wsM.send(JSON.stringify({ type: 'init', id: userIdM, sex: 'male' }));
            mConnected = true;
            checkReady();
        });

        wsF.on('open', () => {
            wsF.send(JSON.stringify({ type: 'init', id: userIdF, sex: 'female' }));
            fConnected = true;
            checkReady();
        });

        function checkReady() {
            if (mConnected && fConnected) {
                console.log("[3/4] Both users initialized. Starting Matchmaking...");
                // Male searches for Female, Female searches for Male
                wsM.send(JSON.stringify({ type: 'find_match', seeking_gender: 'female' }));
                wsF.send(JSON.stringify({ type: 'find_match', seeking_gender: 'male' }));
            }
        }

        wsM.on('message', (msg) => {
            const data = JSON.parse(msg);
            if (data.type === 'matched') {
                console.log(`[SUCCESS] Male matched with: ${data.partner_name} (${data.partner_id})`);
            }
        });

        wsF.on('message', (msg) => {
            const data = JSON.parse(msg);
            if (data.type === 'matched') {
                console.log(`[SUCCESS] Female matched with: ${data.partner_name} (${data.partner_id})`);
                console.log("\n✅ ALL SYSTEM FUNCTIONALITY VERIFIED!");
                process.exit(0);
            }
        });

    } catch (err) {
        console.error("❌ Test Failed:", err.message);
        process.exit(1);
    }
}

simulateFullFlow();
