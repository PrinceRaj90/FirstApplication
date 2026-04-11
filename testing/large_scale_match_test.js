const WebSocket = require('ws');

// CONFIG
const API_URL = "https://chat-backend-production-a878.up.railway.app";
const WS_URL = "wss://chat-backend-production-a878.up.railway.app";
const NUM_USERS = 20;

async function runLargeScaleTest() {
    console.log(`🚀 Starting Large-Scale Matchmaking Simulation (${NUM_USERS} users)...`);
    
    const users = [];
    const connections = [];

    // 1. Defined User Configurations
    const configurations = [
        { sex: 'male', seeking: 'female' }, // 1
        { sex: 'male', seeking: 'female' }, // 2
        { sex: 'male', seeking: 'female' }, // 3
        { sex: 'female', seeking: 'female' }, // 4
        { sex: 'female', seeking: 'female' }, // 5 (Total 5 seek Female)
        
        { sex: 'female', seeking: 'male' }, // 6
        { sex: 'female', seeking: 'male' }, // 7
        { sex: 'female', seeking: 'male' }, // 8
        { sex: 'male', seeking: 'male' },  // 9 (Total 4 seek Male)
        
        { sex: 'male', seeking: 'random' }, // 10
        { sex: 'male', seeking: 'random' }, // 11
        { sex: 'male', seeking: 'random' }, // 12
        { sex: 'male', seeking: 'random' }, // 13
        { sex: 'male', seeking: 'random' }, // 14
        { sex: 'male', seeking: 'random' }, // 15
        { sex: 'female', seeking: 'random' }, // 16
        { sex: 'female', seeking: 'random' }, // 17
        { sex: 'female', seeking: 'random' }, // 18
        { sex: 'female', seeking: 'random' }, // 19
        { sex: 'female', seeking: 'random' }, // 20 (Total 11 seek Random)
    ];

    // 2. Register Users
    console.log("\n[1/4] Registering users...");
    for (let i = 0; i < NUM_USERS; i++) {
        const config = configurations[i];
        const user = {
            name: `User_${i+1}`,
            username: `scaletest_${Date.now()}_${i+1}`,
            age: 20 + (i % 10),
            sex: config.sex,
            password: "password123",
            seeking: config.seeking
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
            console.log(`[AUTH] Registered ${user.username} (${user.id}) as ${user.sex}, seeking ${user.seeking}`);
        } catch (e) {
            console.error(`[AUTH] Registration failed: ${e.message}`);
        }
    }

    // 3. Connect WebSockets
    console.log("\n[2/4] Connecting WebSockets...");
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
            // console.log(`[WS] ${user.id} Connected.`);
        } catch (e) {
            console.error(`[WS] Failed to connect ${user.id}: ${e.message}`);
        }
    }
    console.log(`✅ ${connections.length}/${NUM_USERS} users connected.`);

    // 4. Trigger Matching & Collect Results
    console.log("\n[3/4] Triggering search for all users...");
    const results = {
        matched: [],
        timedOut: [],
        pairs: new Set()
    };

    const matchPromises = connections.map(({ user, ws }) => {
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                results.timedOut.push(user.id);
                console.log(`[TIMEOUT] ⚠️ ${user.id} (${user.sex}) seeking ${user.seeking} - No match found.`);
                resolve();
            }, 45000); // 45s for simulation test (enough for rapid matching)

            ws.on('message', (msg) => {
                const data = JSON.parse(msg);
                if (data.type === 'matched') {
                    clearTimeout(timeout);
                    results.matched.push({ user: user.id, partner: data.partner_id });
                    const pair = [user.id, data.partner_id].sort().join("<->");
                    results.pairs.add(pair);
                    console.log(`[MATCH] ✅ ${user.id} (${user.sex}) <--> ${data.partner_id} (Success!)`);
                    resolve();
                } else if (data.type === 'no_match_found') {
                    clearTimeout(timeout);
                    results.timedOut.push(user.id);
                    console.log(`[RESULT] ⏹️ ${user.id} received 'no_match_found' from server.`);
                    resolve();
                }
            });

            ws.send(JSON.stringify({ type: 'find_match', seeking_gender: user.seeking }));
        });
    });

    await Promise.all(matchPromises);

    // 5. Generate Report
    console.log("\n[4/4] Generating Final Report...");
    console.log("======================================");
    console.log("📊 MATCHMAKING PERFORMANCE REPORT");
    console.log("======================================");
    console.log(`👥 Total Users:        ${NUM_USERS}`);
    console.log(`✅ Connected/Matched:  ${results.matched.length}`);
    console.log(`⏳ Unconnected/Timeout: ${results.timedOut.length}`);
    console.log(`💑 Total Unique Pairs: ${results.pairs.size}`);
    console.log("--------------------------------------");
    
    console.log("\n💑 Formed Pairs:");
    results.pairs.forEach(p => console.log(` - ${p}`));

    if (results.timedOut.length > 0) {
        console.log("\n⏳ Unmatched Users:");
        results.timedOut.forEach(id => {
            const u = users.find(x => x.id === id);
            console.log(` - ${id} (${u.sex}) sought ${u.seeking}`);
        });
    }

    console.log("\n❓ What happens to unconnected users?");
    console.log(" > Users who do not get connected stay in the 'Handshake Loop' (5 minutes).");
    console.log(" > After 5 minutes, the server sends a 'no_match_found' message.");
    console.log(" > Client UI alerts the user and returns them to the Dashboard automatically.");
    console.log("======================================\n");

    connections.forEach(({ws}) => ws.close());
    process.exit(0);
}

runLargeScaleTest();
