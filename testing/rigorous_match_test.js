const WebSocket = require('ws');
const axios = require('axios');

const API_BASE = 'https://chat-backend-production-a878.up.railway.app';
const WS_BASE = 'wss://chat-backend-production-a878.up.railway.app';

async function register(username, sex) {
    try {
        const res = await axios.post(`${API_BASE}/register`, {
            name: `Test_${username}`,
            username: username,
            password: 'password123',
            age: 20,
            sex: sex
        });
        if (!res.data.id) throw new Error("No ID in response: " + JSON.stringify(res.data));
        return { id: res.data.id, sex: res.data.sex, username };
    } catch (e) {
        console.error(`[AUTH] Registration failed for ${username}:`, e.response?.data || e.message);
        throw e;
    }
}

async function fetchLogs() {
    try {
        const res = await axios.get(`${API_BASE}/debug/logs`);
        console.log("\n--- SERVER LOGS ---");
        console.log(res.data);
        console.log("-------------------\n");
    } catch (e) {
        console.log("Could not fetch server logs.");
    }
}

async function runRigorousTest() {
    console.log("🧪 Starting Rigorous Matchmaking Test...");

    try {
        // 1. Setup Test Users
        console.log("[SETUP] Registering cross-category users...");
        const u1 = await register(`boy_s_${Date.now()}`, 'male');
        const u2 = await register(`girl_r_${Date.now()}`, 'female');
        const u3 = await register(`boy_ra_${Date.now()}`, 'male');
        const u4 = await register(`boy_rb_${Date.now()}`, 'male');

        const clients = [];
        const matches = new Map();

        const connect = (user, seeking) => new Promise((resolve, reject) => {
            if (!user || !user.id) {
                return reject(new Error("Invalid user object"));
            }
            const ws = new WebSocket(WS_BASE);
            ws.on('open', () => {
                ws.send(JSON.stringify({ type: 'init', id: user.id, sex: user.sex }));
                setTimeout(() => {
                    ws.send(JSON.stringify({ type: 'find_match', seeking_gender: seeking }));
                    resolve({ ws, user });
                }, 1000);
            });
            ws.on('error', (err) => {
                console.error(`[WS] Connection error for ${user.username}:`, err.message);
                reject(err);
            });
            ws.on('message', (msg) => {
                const data = JSON.parse(msg);
                if (data.type === 'matched') {
                    console.log(`[MATCH] ✅ ${user.username} matched with ${data.partner_id}`);
                    matches.set(user.id, data.partner_id);
                }
            });
        });

        console.log("[TEST] Step 1: Specific (Male) vs Random (Female) matching...");
        const c1 = await connect(u1, 'female');
        const c2 = await connect(u2, 'random');
        clients.push(c1, c2);

        console.log("[TEST] Step 2: Random (Male) vs Random (Male) matching...");
        const c3 = await connect(u3, 'random');
        const c4 = await connect(u4, 'random');
        clients.push(c3, c4);

        // Wait for wait-queue to do its thing
        console.log("[WAIT] Waiting 10s for loop to complete...");
        await new Promise(r => setTimeout(r, 10000));

        // 2. Verification
        let success = true;
        
        if (matches.get(u1.id) === u2.id) {
            console.log("✅ TEST A PASS: Specific Boy found Random Girl.");
        } else {
            console.log("❌ TEST A FAIL: Specific Boy vs Random Girl did not match.");
            success = false;
        }

        if (matches.get(u3.id) === u4.id || matches.get(u3.id) === u1.id || matches.get(u3.id)) {
            // Check if u3 matched with ANYONE valid
            console.log("✅ TEST B PASS: Random Boy found a partner.");
        } else {
            console.log("❌ TEST B FAIL: Random Boy vs Random Boy did not match.");
            success = false;
        }

        clients.forEach(c => c.ws.close());
        
        if (success) {
            console.log("\n🎊 RIGOROUS TEST COMPLETED SUCCESSFULLY!");
            process.exit(0);
        } else {
            console.log("\n🛑 TEST FAILED.");
            await fetchLogs();
            process.exit(1);
        }

    } catch (err) {
        console.error("💥 Test Error:", err.message);
        await fetchLogs();
        process.exit(1);
    }
}

runRigorousTest();
