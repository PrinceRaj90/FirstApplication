const WebSocket = require('ws');
const axios = require('axios');

const API_BASE = 'https://chat-backend-production-a878.up.railway.app';
const WS_BASE = 'wss://chat-backend-production-a878.up.railway.app';

async function register(username, sex) {
    try {
        const res = await axios.post(`${API_BASE}/register`, {
            name: `ProbTester_${username}`,
            username: username,
            password: 'password123',
            age: 25,
            sex: sex
        });
        return { id: res.data.id, sex: res.data.sex, name: `ProbTester_${username}` };
    } catch (e) {
        return { id: username, sex: sex, name: `ProbTester_${username}` }; // Assume exists
    }
}

async function runScenario(name, user1Opts, user2Opts) {
    console.log(`\n🧪 SCENARIO: ${name}`);
    
    const u1 = await register(`p1_${Date.now()}_${Math.random().toString(36).substr(2,5)}`, user1Opts.sex);
    const u2 = await register(`p2_${Date.now()}_${Math.random().toString(36).substr(2,5)}`, user2Opts.sex);

    let u1Matched = false, u2Matched = false;

    const connect = (user, seeking) => new Promise((resolve) => {
        const ws = new WebSocket(WS_BASE);
        ws.on('open', () => {
            ws.send(JSON.stringify({ type: 'init', id: user.id, sex: user.sex }));
            setTimeout(() => {
                ws.send(JSON.stringify({ type: 'find_match', seeking_gender: seeking }));
                resolve(ws);
            }, 500);
        });

        ws.on('message', (msg) => {
            const data = JSON.parse(msg);
            if (data.type === 'matched') {
                if (user.id === u1.id) u1Matched = true;
                if (user.id === u2.id) u2Matched = true;
                ws.close();
            }
        });
    });

    const w1 = await connect(u1, user1Opts.seeking);
    const w2 = await connect(u2, user2Opts.seeking);

    // Wait for resolution
    for(let i=0; i<20; i++) {
        if(u1Matched && u2Matched) break;
        await new Promise(r => setTimeout(r, 500));
    }

    if(u1Matched && u2Matched) {
        console.log(`✅ SUCCESS: ${name}`);
        return true;
    } else {
        console.log(`❌ FAILED: ${name} (U1:${u1Matched}, U2:${u2Matched})`);
        return false;
    }
}

async function startTests() {
    let passed = 0;
    const scenarios = [
        { name: "Direct Specific (M-F / F-M)", u1: {sex:'male', seeking:'female'}, u2: {sex:'female', seeking:'male'}},
        { name: "Hybrid (M-F / F-Random)", u1: {sex:'male', seeking:'female'}, u2: {sex:'female', seeking:'random'}},
        { name: "Hybrid (M-Random / F-M)", u1: {sex:'male', seeking:'random'}, u2: {sex:'female', seeking:'male'}},
        { name: "Pure Random (M-Random / F-Random)", u1: {sex:'male', seeking:'random'}, u2: {sex:'female', seeking:'random'}},
        { name: "Same Gender Random (M-Random / M-Random)", u1: {sex:'male', seeking:'random'}, u2: {sex:'male', seeking:'random'}}
    ];

    for(const s of scenarios) {
        const res = await runScenario(s.name, s.u1, s.u2);
        if(res) passed++;
        await new Promise(r => setTimeout(r, 2000)); // Cool down
    }

    console.log(`\n--- ALL PROBABILITIES RESULT ---`);
    console.log(`PASSED: ${passed}/${scenarios.length}`);
    process.exit(passed === scenarios.length ? 0 : 1);
}

startTests();
