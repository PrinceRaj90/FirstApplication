const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGO_URL;
if (!uri) {
    console.error("MONGO_URL not found in environment.");
    process.exit(1);
}

const client = new MongoClient(uri);

async function cleanup() {
    try {
        await client.connect();
        const db = client.db();
        console.log("🧹 Cleaning up production database...");
        
        await db.collection('male_users').updateMany({}, { $set: { status: 'offline', occupied: 'no', searching_for: null } });
        await db.collection('female_users').updateMany({}, { $set: { status: 'offline', occupied: 'no', searching_for: null } });
        await db.collection('male_users').deleteMany({ username: { $regex: /^boy_|^girl_/ } });
        await db.collection('female_users').deleteMany({ username: { $regex: /^boy_|^girl_/ } });

        console.log("✅ Cleanup complete.");
        process.exit(0);
    } catch (err) {
        console.error("❌ Cleanup failed:", err.message);
        process.exit(1);
    }
}

cleanup();
