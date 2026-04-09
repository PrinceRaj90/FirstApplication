// server.js (Full Migration for FirstApplication)
const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const path = require('path');
const http = require('http');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const IP = '0.0.0.0'; 
const PORT = process.env.PORT || 8080;

const app = express();
app.use(cors());
app.use(express.json()); 

app.get('/debug/logs', (req, res) => {
    res.set('Content-Type', 'text/plain');
    res.send(serverLogs.join('\n'));
});

app.get('/debug/stats', (req, res) => {
    res.json({
        active_ws: wsClients.size,
        tracked_ids: idToWs.size,
        uptime: process.uptime()
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', engine: 'Matchmaking Engine 4.0' });
});

// Simple log buffer for remote debugging
let serverLogs = [];
const log = (msg) => {
    const entry = `[${new Date().toISOString()}] ${msg}`;
    console.log(entry);
    serverLogs.push(entry);
    if (serverLogs.length > 200) serverLogs.shift();
};

// === DATABASE SETUP (MONGODB) ===
const uri = process.env.MONGO_URL || 'mongodb://localhost:27017/chat_app';
const client = new MongoClient(uri);
let db;

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

async function initDB() {
    try {
        await client.connect();
        db = client.db('chat_app');
        
        await db.collection('male_users').createIndex({ username: 1 }, { unique: true });
        await db.collection('female_users').createIndex({ username: 1 }, { unique: true });
        
        // COLD START: Clear all stale matchmaking flags
        await db.collection('male_users').updateMany({}, { $set: { status: 'offline', occupied: 'no', searching_for: null } });
        await db.collection('female_users').updateMany({}, { $set: { status: 'offline', occupied: 'no', searching_for: null } });
        
        console.log('Main DB Matchmaking Engine initialized.');
        
        server.listen(PORT, IP, () => {
            console.log(`🚀 Server running on port ${PORT}`);
        });
    } catch(err) {
        console.error('MongoDB Setup Error:', err.message);
    }
}
initDB();

// Unique ID Generator
function generateUserId(name, age) {
    let prefix = name.replace(/[^A-Za-z]/g, '').substring(0, 4).toUpperCase();
    if (prefix.length < 4) prefix = prefix.padEnd(4, 'X');
    const rnd = Math.floor(Math.random() * 900) + 100;
    return `${prefix}${age}${rnd}`;
}

// === REST API ENDPOINTS ===

app.get('/health', (req, res) => {
    res.json({ status: 'Backend is running', db: db ? 'connected' : 'disconnected' });
});

app.post('/register', async (req, res) => {
    if (!db) return res.status(503).json({ error: 'Database not ready.' });
    
    const { name, username, age, sex, password } = req.body;
    
    if (!name || !username || !age || !sex || !password) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    // Password length validation with suggestion
    if (password.length < 6) {
        return res.status(400).json({ 
            error: 'Password too short.',
            suggestion: 'Password length should be greater than or equal to 6 characters.' 
        });
    }

    try {
        const collectionName = sex === 'female' ? 'female_users' : 'male_users';
        const mCheck = await db.collection('male_users').findOne({ username });
        const fCheck = await db.collection('female_users').findOne({ username });
        if (mCheck || fCheck) {
            return res.status(409).json({ error: 'Username already exists!' });
        }

        let userId;
        let idExists = true;
        while (idExists) {
            userId = generateUserId(name, age);
            let mId = await db.collection('male_users').findOne({ id: userId });
            let fId = await db.collection('female_users').findOne({ id: userId });
            if (!mId && !fId) idExists = false;
        }

        await db.collection(collectionName).insertOne({
            id: userId, name, username, age, password, status: 'offline', occupied: 'no'
        });

        res.status(201).json({ message: 'Registration successful!', id: userId, sex });
    } catch (err) {
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

app.post('/login', async (req, res) => {
    if (!db) return res.status(503).json({ error: 'Database not ready.' });
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing fields.' });

    try {
        let userRow = await db.collection('male_users').findOne({ username, password });
        let foundSex = 'male';

        if (!userRow) {
            userRow = await db.collection('female_users').findOne({ username, password });
            foundSex = 'female';
        }

        if (!userRow) return res.status(401).json({ error: 'Invalid credentials.' });

        res.status(200).json({
            message: 'Login successful!',
            user: { id: userRow.id, name: userRow.name, username: userRow.username, sex: foundSex, age: userRow.age }
        });
    } catch (err) {
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

app.get('/friends/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        const friendships = await db.collection('friendships').find({ 
            $or: [{ user1_id: userId }, { user2_id: userId }], status: 'friends'
        }).toArray();
        
        let friendsProfiles = [];
        for (let f of friendships) {
            const friendId = f.user1_id === userId ? f.user2_id : f.user1_id;
            let fDoc = await db.collection('male_users').findOne({ id: friendId }) || await db.collection('female_users').findOne({ id: friendId });
            if (fDoc) {
                const roomId = [userId, friendId].sort().join('_');
                const lastMsg = await db.collection('messages').find({ roomId }).sort({ timestamp: -1 }).limit(1).toArray();
                friendsProfiles.push({ id: fDoc.id, name: fDoc.name, status: fDoc.status, latestMessage: lastMsg[0]?.text || 'Start chatting!' });
            }
        }
        res.json({ friends: friendsProfiles });
    } catch (e) { res.status(500).json({error: 'db err'}) }
});

app.get('/messages/:roomId', async (req, res) => {
    try {
        const roomId = req.params.roomId;
        const messages = await db.collection('messages').find({ roomId }).sort({ timestamp: 1 }).toArray();
        res.json({ messages });
    } catch (e) { res.status(500).json({error: 'db err'}) }
});

app.get('/blocks/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        const blockedRecords = await db.collection('blocks').find({ blocker_id: userId }).toArray();
        let blockedProfiles = [];
        for (let b of blockedRecords) {
            let fDoc = await db.collection('male_users').findOne({ id: b.blocked_id }) || await db.collection('female_users').findOne({ id: b.blocked_id });
            if (fDoc) blockedProfiles.push({ id: fDoc.id, name: fDoc.name, username: fDoc.username });
        }
        res.json({ blocked: blockedProfiles });
    } catch (e) { res.status(500).json({error: 'db err'}) }
});

app.delete('/account/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        let col = (await db.collection('male_users').findOne({ id: userId })) ? 'male_users' : ((await db.collection('female_users').findOne({ id: userId })) ? 'female_users' : null);
        if (!col) return res.status(404).json({ error: 'User not found.' });

        await db.collection(col).deleteOne({ id: userId });
        await db.collection('friendships').deleteMany({ $or: [{ user1_id: userId }, { user2_id: userId }] });
        await db.collection('messages').deleteMany({ sender_id: userId });
        await db.collection('blocks').deleteMany({ $or: [{ blocker_id: userId }, { blocked_id: userId }] });

        res.json({ message: 'Account deleted successfully.' });
    } catch (e) { res.status(500).json({ error: 'db err: ' + e.message }) }
});

// === WEBSOCKET MATCHMAKING ===
const wsClients = new Map(); 
const idToWs = new Map(); 

wss.on('connection', (ws) => {
    ws.on('message', async (message) => {
        if (!db) return;
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'init') {
                const col = data.sex === 'female' ? 'female_users' : 'male_users';
                
                // CRITICAL FIX: Clear any old 'ghost' connections for this ID
                const oldWs = idToWs.get(data.id);
                if (oldWs && oldWs !== ws) {
                    wsClients.delete(oldWs);
                }

                await db.collection(col).updateOne({ id: data.id }, { $set: { status: 'online', occupied: 'no' } });

                wsClients.set(ws, { id: data.id, collection: col, partnerWs: null });
                idToWs.set(data.id, ws);
                
                log(`INIT SUCCESS: User ${data.id} registered in memory.`);
            } 

            else if (data.type === 'find_match') {
                const info = wsClients.get(ws);
                if (!info) { log("MATCH: No info found for WS"); return; }
                const myCol = info.collection;
                const pref = data.seeking_gender; 
                const myGender = myCol === 'male_users' ? 'male' : 'female';
                const sleep = ms => new Promise(res => setTimeout(res, ms));

                log(`MATCH START: User ${info.id} (${myGender}) seeking ${pref}`);

                // 1. Force state reset and mark as searching
                await db.collection(myCol).updateOne(
                    { id: info.id }, 
                    { $set: { status: 'online', occupied: 'no', searching_for: pref } }
                );

                const myBlocks = await db.collection('blocks').find({ blocker_id: info.id }).toArray();
                const blockedMe = await db.collection('blocks').find({ blocked_id: info.id }).toArray();
                const excludedIds = [info.id, ...myBlocks.map(b=>b.blocked_id), ...blockedMe.map(b=>b.blocker_id)];

                let matchId = null; 
                let finalOppCol = null;

                // 2. SEARCH LOOP (5s)
                for (let attempt = 0; attempt < 10; attempt++) {
                    const me = await db.collection(myCol).findOne({ id: info.id });
                    if (me && me.occupied === 'yes') {
                        log(`MATCH RESOLVED: User ${info.id} matched by external context.`);
                        return; 
                    }

                    let colsToCheck = pref === 'random' ? ['female_users', 'male_users'] : (pref === 'female' ? ['female_users'] : ['male_users']);
                    
                    for (let oppCol of colsToCheck) {
                        const targets = [myGender, 'random'];
                        const match = await db.collection(oppCol).findOneAndUpdate(
                            { status: 'online', occupied: 'no', searching_for: { $in: targets }, id: { $nin: excludedIds } },
                            { $set: { occupied: 'yes', searching_for: null } },
                            { returnDocument: 'after' }
                        );

                        if (match) { 
                            const foundDoc = match.value || match;
                            if (foundDoc && foundDoc.id) {
                                matchId = foundDoc.id;
                                finalOppCol = oppCol;
                                log(`MATCH FIND: ${info.id} found doc ${matchId} in ${oppCol}`);
                                break;
                            }
                        }
                    }

                    if (matchId) break;
                    await sleep(500);
                }

                if (matchId) {
                    const partnerWs = idToWs.get(matchId);
                    log(`MATCH SYNC: Partner ID ${matchId} -> WS is ${partnerWs ? 'PRESENT' : 'MISSING (LOAD BALANCER?)'}`);
                    
                    if (partnerWs && wsClients.has(partnerWs)) {
                        await db.collection(myCol).updateOne({ id: info.id }, { $set: { occupied: 'yes', searching_for: null } });
                        
                        info.partnerWs = partnerWs;
                        wsClients.get(partnerWs).partnerWs = ws;
                        
                        const me = await db.collection(myCol).findOne({ id: info.id });
                        const pt = await db.collection(finalOppCol).findOne({ id: matchId });
                        
                        ws.send(JSON.stringify({ type: 'matched', partner_id: matchId, partner_name: pt.name, partner_age: pt.age }));
                        partnerWs.send(JSON.stringify({ type: 'matched', partner_id: info.id, partner_name: me.name, partner_age: me.age }));
                        log(`MATCH SUCCESS: ${info.id} bonded with ${matchId}`);
                    } else {
                        log(`MATCH FAIL: Rollback ${matchId}. Reason: No local WS pointer.`);
                        await db.collection(finalOppCol).updateOne({ id: matchId }, { $set: { occupied: 'no', searching_for: pref } });
                        ws.send(JSON.stringify({ type: 'no_match_found', retry: true }));
                    }
                } else {
                    log(`MATCH TIMEOUT: ${info.id} found no one.`);
                    ws.send(JSON.stringify({ type: 'no_match_found' }));
                }
            }

            else if (data.type === 'direct_connect') {
                const info = wsClients.get(ws);
                const targetId = data.target_id;
                const partnerWs = idToWs.get(targetId);
                if (partnerWs && partnerWs.readyState === 1) {
                    const me = await db.collection(info.collection).findOne({ id: info.id });
                    partnerWs.send(JSON.stringify({ type: 'chat_request', from_id: info.id, from_name: me.name }));
                } else {
                    ws.send(JSON.stringify({ type: 'direct_failed', message: 'User unavailable.' }));
                }
            }

            else if (data.type === 'accept_request') {
                const info = wsClients.get(ws);
                const reqWs = idToWs.get(data.target_id);
                if (reqWs) {
                    info.partnerWs = reqWs;
                    wsClients.get(reqWs).partnerWs = ws;
                    const me = await db.collection(info.collection).findOne({ id: info.id });
                    const req = await db.collection(wsClients.get(reqWs).collection).findOne({ id: data.target_id });
                    ws.send(JSON.stringify({ type: 'matched', partner_name: req.name, partner_id: req.id }));
                    reqWs.send(JSON.stringify({ type: 'matched', partner_name: me.name, partner_id: info.id }));
                }
            }

            else if (data.type === 'chat_message' || data.type === 'partner_active') {
                const info = wsClients.get(ws);
                if (info?.partnerWs && info.partnerWs.readyState === 1) {
                    if (data.type === 'chat_message') {
                        const partnerId = wsClients.get(info.partnerWs).id;
                        const roomId = [info.id, partnerId].sort().join('_');
                        await db.collection('messages').insertOne({ roomId, sender_id: info.id, text: data.message, timestamp: new Date(), msg_id: data.msg_id });
                        info.partnerWs.send(JSON.stringify({ type: 'chat_message', message: data.message, from: info.id, msg_id: data.msg_id }));
                    } else {
                        info.partnerWs.send(JSON.stringify({ type: 'partner_active', from: info.id }));
                    }
                }
            }

            else if (data.type === 'add_friend_req') {
               const pWs = idToWs.get(data.target_id);
               if (pWs?.readyState === 1) {
                   const me = await db.collection(wsClients.get(ws).collection).findOne({ id: wsClients.get(ws).id });
                   pWs.send(JSON.stringify({ type: 'friend_request', from_id: me.id, from_name: me.name }));
               }
            }

            else if (data.type === 'accept_friend') {
                const info = wsClients.get(ws);
                const u1 = [info.id, data.target_id].sort()[0];
                const u2 = [info.id, data.target_id].sort()[1];
                await db.collection('friendships').updateOne({ user1_id: u1, user2_id: u2 }, { $set: { status: 'friends' } }, { upsert: true });
                const rWs = idToWs.get(data.target_id);
                if (rWs) rWs.send(JSON.stringify({ type: 'friend_accepted', from_id: info.id }));
            }

            else if (data.type === 'block_user') {
                const info = wsClients.get(ws);
                await db.collection('blocks').updateOne({ blocker_id: info.id, blocked_id: data.target_id }, { $set: { blocked_id: data.target_id } }, { upsert: true });
                const tWs = idToWs.get(data.target_id);
                if (tWs) tWs.send(JSON.stringify({ type: 'partner_disconnected', message: 'User blocked you.' }));
            }
        } catch(e) {}
    });

    ws.on('close', async () => {
        const info = wsClients.get(ws);
        if (info) {
            idToWs.delete(info.id);
            await db.collection(info.collection).updateOne({ id: info.id }, { $set: { status: 'offline', occupied: 'no' } });
            if (info.partnerWs?.readyState === 1) {
                info.partnerWs.send(JSON.stringify({ type: 'partner_disconnected' }));
                const pInfo = wsClients.get(info.partnerWs);
                if (pInfo) { pInfo.partnerWs = null; await db.collection(pInfo.collection).updateOne({ id: pInfo.id }, { $set: { occupied: 'no' } }); }
            }
        }
        wsClients.delete(ws);
    });
});

// START THE ENGINE
initDB();
