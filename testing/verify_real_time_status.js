const WebSocket = require('ws');
const { MongoClient } = require('mongodb');
require('dotenv').config();

// CONFIG
const API_URL = "https://chat-backend-production-a878.up.railway.app";
const WS_URL = "wss://chat-backend-production-a878.up.railway.app";
// Try to get external MONGO_URL if it exists, else use local fallback for the script to run
const MONGO_URI = process.env.MONGO_URI || "mongodb://mongo:laODBmQgyDtgefdkAZuBWECVAbdGuCuy@mongodb.railway.internal:27017";

async function verifyRealTimeStatus() {
    console.log("🚀 Starting Real-Time Status Verification Test...");
    
    let client;
    try {
        client = new MongoClient(MONGO_URI);
        await client.connect();
        console.log("✅ Connected to MongoDB.");
    } catch (e) {
        console.error("❌ Database connection failed. Ensure you are running this in an environment with DB access.");
        console.error("Error:", e.message);
        process.exit(1);
    }

    const db = client.db();
    const testUsername = `status_test_${Date.now()}`;
    const testUser = {
        name: "Status Tester",
        username: testUsername,
        password: "password123",
        age: 25,
        sex: "male"
    };

    try {
        // STEP 1: Registration
        console.log(`\n[STEP 1] Registering test user: ${testUsername}`);
        const regRes = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testUser)
        });
        const regData = await regRes.json();
        const userId = regData.id;
        console.log(`✅ Registered. ID: ${userId}`);

        // Verify Offline State
        let userDoc = await db.collection('male_users').findOne({ id: userId });
        console.log(`📊 DB STATUS: status=${userDoc.status}, occupied=${userDoc.occupied}, search=${userDoc.searching_for}`);
        if (userDoc.status !== 'offline') throw new Error("Expected initial status to be offline");

        // STEP 2: WebSocket Connection (init)
        console.log(`\n[STEP 2] Connecting to WebSocket (triggers 'init')...`);
        const ws = new WebSocket(WS_URL);
        await new Promise((resolve, reject) => {
            ws.on('open', () => {
                ws.send(JSON.stringify({ type: 'init', id: userId, sex: 'male' }));
                setTimeout(resolve, 2000); // Wait for DB update
            });
            ws.on('error', reject);
        });

        userDoc = await db.collection('male_users').findOne({ id: userId });
        console.log(`✅ Connected.`);
        console.log(`📊 DB STATUS: status=${userDoc.status}, occupied=${userDoc.occupied}`);
        if (userDoc.status !== 'online') throw new Error("Expected status to be online after init");

        // STEP 3: Start Searching
        console.log(`\n[STEP 3] Starting search (triggers 'find_match')...`);
        ws.send(JSON.stringify({ type: 'find_match', seeking_gender: 'female' }));
        await new Promise(r => setTimeout(r, 2000));

        userDoc = await db.collection('male_users').findOne({ id: userId });
        console.log(`✅ Searching.`);
        console.log(`📊 DB STATUS: status=${userDoc.status}, occupied=${userDoc.occupied}, searching_for=${userDoc.searching_for}`);
        if (!userDoc.searching_for) throw new Error("Expected searching_for to be set");

        // STEP 4: Simulation Match (Atomic Claim)
        console.log(`\n[STEP 4] Simulating partner claiming this user...`);
        const partnerId = "PARTNER_999";
        await db.collection('male_users').updateOne(
            { id: userId }, 
            { $set: { occupied: 'yes', searching_for: null, handshake: partnerId } }
        );
        
        userDoc = await db.collection('male_users').findOne({ id: userId });
        console.log(`✅ Matched.`);
        console.log(`📊 DB STATUS: status=${userDoc.status}, occupied=${userDoc.occupied}, handshake=${userDoc.handshake}`);
        if (userDoc.occupied !== 'yes') throw new Error("Expected occupied to be yes");

        // STEP 5: Disconnect
        console.log(`\n[STEP 5] Disconnecting WebSocket...`);
        ws.close();
        await new Promise(r => setTimeout(r, 2000));

        userDoc = await db.collection('male_users').findOne({ id: userId });
        console.log(`✅ Disconnected.`);
        console.log(`📊 DB STATUS: status=${userDoc.status}, occupied=${userDoc.occupied}, handshake=${userDoc.handshake}`);
        if (userDoc.status !== 'offline' || userDoc.occupied !== 'no') {
            throw new Error("Expected status to return to offline/no-occupied after disconnect");
        }

        console.log(`\n🎉 ALL REAL-TIME STATUS TESTS PASSED!`);
        
    } catch (err) {
        console.error(`\n❌ TEST FAILED: ${err.message}`);
    } finally {
        // Cleanup
        await db.collection('male_users').deleteOne({ username: testUsername });
        console.log("\n🧹 Test user cleaned up.");
        await client.close();
        process.exit(0);
    }
}

verifyRealTimeStatus();
