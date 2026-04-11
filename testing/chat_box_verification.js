const WebSocket = require('ws');
const axios = require('axios');

const API_BASE = 'https://chat-backend-production-a878.up.railway.app';
const WS_BASE = 'wss://chat-backend-production-a878.up.railway.app';

async function register(username, sex) {
    try {
        const res = await axios.post(`${API_BASE}/register`, {
            name: `Tester_${username}`,
            username: username,
            password: 'password123',
            age: 25,
            sex: sex
        });
        return { id: res.data.id, sex: res.data.sex, name: `Tester_${username}` };
    } catch (e) {
        console.error("Reg failed", e.message);
        throw e;
    }
}

async function verifyChatBox() {
    console.log("🚀 STARTING RIGOROUS CHAT-BOX VERIFICATION...");

    try {
        const u1 = await register(`chat_test_a_${Date.now()}`, 'male');
        const u2 = await register(`chat_test_b_${Date.now()}`, 'female');

        let u1Ws, u2Ws;
        let u1Matched = false, u2Matched = false;
        let messageReceived = false;

        const connect = (user, seeking) => new Promise((resolve) => {
            const ws = new WebSocket(WS_BASE);
            ws.on('open', () => {
                ws.send(JSON.stringify({ type: 'init', id: user.id, sex: user.sex }));
                setTimeout(() => {
                    ws.send(JSON.stringify({ type: 'find_match', seeking_gender: seeking }));
                    resolve(ws);
                }, 1000);
            });

            ws.on('message', (msg) => {
                const data = JSON.parse(msg);
                if (data.type === 'matched') {
                    console.log(`[MATCH] ✅ ${user.id} matched! Data:`, data);
                    
                    // RIGOROUS DATA CHECK
                    if (data.partner_id && data.partner_name && data.partner_age) {
                        console.log(`[DATA] ✅ ALL FIELDS PRESENT for ${user.id}`);
                        if (user.id === u1.id) u1Matched = true;
                        if (user.id === u2.id) u2Matched = true;
                    } else {
                        console.log(`[DATA] ❌ MISSING FIELDS for ${user.id}`);
                    }

                    // TRY CHATTING INSTANTLY
                    if (user.id === u1.id) {
                        setTimeout(() => {
                            console.log("[CHAT] Sending verification message from U1 -> U2...");
                            ws.send(JSON.stringify({ type: 'message', message: "HELLO_FROM_VERIFIER" }));
                        }, 1000);
                    }
                }
                
                if (data.type === 'message' && data.message === "HELLO_FROM_VERIFIER") {
                    console.log(`[CHAT] ✅ Message successfully received by partner!`);
                    messageReceived = true;
                }
            });
        });

        u1Ws = await connect(u1, 'female');
        u2Ws = await connect(u2, 'male');

        console.log("[WAIT] Verifying handshake and data flow (12s)...");
        await new Promise(r => setTimeout(r, 12000));

        // FINAL TALLY
        console.log("\n--- FINAL VERIFICATION RESULTS ---");
        console.log("Match U1:", u1Matched ? "✅" : "❌");
        console.log("Match U2:", u2Matched ? "✅" : "❌");
        console.log("Real-time Chat:", messageReceived ? "✅" : "❌");

        if (u1Matched && u2Matched && messageReceived) {
            console.log("\n🎊 RIGOROUS CHAT-BOX TEST PASSED! The user will definitely see the partner and can chat instantly.");
            process.exit(0);
        } else {
            console.log("\n🛑 TEST FAILED. Check backend logs at /debug/logs");
            process.exit(1);
        }

    } catch (e) {
        console.error("Test Error:", e.name, e.message);
        process.exit(1);
    }
}

verifyChatBox();
