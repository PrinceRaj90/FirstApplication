const WebSocket = require('ws');

const SERVER_DOMAIN = "chat-backend-production-a878.up.railway.app";
const API_URL = `https://${SERVER_DOMAIN}`;
const WS_URL = `wss://${SERVER_DOMAIN}`;

async function runConcurrencyTest(numUsers = 4) {
    console.log(`🚀 Starting Concurrency Test with ${numUsers} simultaneous users...`);
    const users = [];
    const connections = [];

    // 1. Register Users
    for (let i = 0; i < numUsers; i++) {
        const sex = i % 2 === 0 ? 'male' : 'female';
        const user = {
            name: `User_${i}`,
            username: `concur_user_${Date.now()}_${i}`,
            age: 20 + i,
            sex: sex,
            password: "password123"
        };
        
        try {
            const res = await fetch(`${API_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(user)
            });
            const data = await res.json();
            user.id = data.id;
            users.push(user);
            console.log(`[AUTH] Registered ${user.username} (${user.id}) as ${user.sex}`);
        } catch (e) {
            console.error(`[AUTH] Registration failed for ${user.username}:`, e.message);
        }
    }

    // 2. Connect everyone to WebSockets
    console.log(`\n[WS] Connecting ${users.length} users to WebSocket...`);
    
    const connectUser = (user) => {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(WS_URL);
            ws.on('open', () => {
                ws.send(JSON.stringify({ type: 'init', id: user.id, sex: user.sex }));
                resolve(ws);
            });
            ws.on('error', reject);
        });
    };

    for (const user of users) {
        try {
            const ws = await connectUser(user);
            connections.push({ user, ws });
            console.log(`[WS] ${user.id} Connected.`);
        } catch (e) {
            console.error(`[WS] Failed to connect ${user.id}:`, e.message);
        }
    }

    // 3. Simultaneously Trigger Matchmaking
    console.log(`\n[MATCH] Waiting 1s for database status to settle...`);
    await new Promise(r => setTimeout(r, 1000));

    console.log(`\n[MATCH] Triggering matchmaking for all ${connections.length} users...`);
    
    let matchesFound = 0;
    const matchPromises = connections.map(({ user, ws }) => {
        return new Promise((resolve) => {
            ws.on('message', (msg) => {
                const data = JSON.parse(msg);
                if (data.type === 'matched') {
                    console.log(`[MATCH] ✅ ${user.id} matched with ${data.partner_id}`);
                    matchesFound++;
                    resolve();
                }
            });
            // Everyone seeks the opposite gender
            const seeking = user.sex === 'male' ? 'female' : 'male';
            ws.send(JSON.stringify({ type: 'find_match', seeking_gender: seeking }));
        });
    });

    // Timeout safety
    const timeout = setTimeout(() => {
        console.log(`\n[RESULT] ⚠️ Test timed out. Matches found: ${matchesFound}`);
        connections.forEach(({ws}) => ws.close());
        process.exit(1);
    }, 60000);

    await Promise.all(matchPromises);
    clearTimeout(timeout);
    connections.forEach(({ws}) => ws.close());

    console.log(`\n🎉 SUCCESS! All users matched! Final matches found: ${matchesFound}`);
    process.exit(0);
}

runConcurrencyTest(10);
