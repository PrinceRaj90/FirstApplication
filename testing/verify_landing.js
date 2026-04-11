const WebSocket = require('ws');

// CONFIG
const API_URL = "https://chat-backend-production-a878.up.railway.app";
const WS_URL = "wss://chat-backend-production-a878.up.railway.app";

async function verifyLanding() {
    console.log("🧪 Verifying 'Chatbox Landing' logic...");

    // Simulate two users
    const users = [];
    for (let i = 0; i < 2; i++) {
        const username = `landing_test_${Date.now()}_${i}`;
        const res = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: `User${i}`, username, password: "pw", age: 25, sex: i === 0 ? 'male' : 'female' })
        });
        const data = await res.json();
        users.push({ id: data.id, sex: i === 0 ? 'male' : 'female', username });
    }

    console.log(`✅ Users Registered: ${users[0].id} and ${users[1].id}`);

    const connectAndMatch = (user, pref) => {
        return new Promise((resolve) => {
            const ws = new WebSocket(WS_URL);
            let landed = false;

            ws.on('open', () => {
                ws.send(JSON.stringify({ type: 'init', id: user.id, sex: user.sex }));
                setTimeout(() => {
                    ws.send(JSON.stringify({ type: 'find_match', seeking_gender: pref }));
                }, 500);
            });

            ws.on('message', (msg) => {
                const data = JSON.parse(msg);
                if (data.type === 'matched') {
                    console.log(`[CLIENT-SIDE] User ${user.id} received MATCHED message. Landing on chatbox...`);
                    landed = true;
                    ws.close();
                    resolve(landed);
                }
            });

            setTimeout(() => {
                if (!landed) {
                    console.log(`[CLIENT-SIDE] User ${user.id} FAILED to land (Timeout).`);
                    ws.close();
                    resolve(false);
                }
            }, 10000);
        });
    };

    const results = await Promise.all([
        connectAndMatch(users[0], 'female'),
        connectAndMatch(users[1], 'male')
    ]);

    if (results.every(r => r === true)) {
        console.log("\n结论 (Verdict): Both users successfully reached the 'Chatbox' state simultaneously.");
    } else {
        console.log("\n❌ Logic Failure: One or more users did not land on the chatbox.");
    }

    process.exit(0);
}

verifyLanding();
