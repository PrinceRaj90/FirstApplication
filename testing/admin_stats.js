const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGO_URL || 'mongodb://localhost:27017/chat_app';
const client = new MongoClient(uri);

async function showStats() {
    try {
        await client.connect();
        const db = client.db();
        
        const totalMales = await db.collection('male_users').countDocuments();
        const totalFemales = await db.collection('female_users').countDocuments();
        const onlineMales = await db.collection('male_users').countDocuments({ status: 'online' });
        const onlineFemales = await db.collection('female_users').countDocuments({ status: 'online' });
        const searchingUsers = (await db.collection('male_users').countDocuments({ occupied: 'no', searching_for: { $ne: null } })) +
                               (await db.collection('female_users').countDocuments({ occupied: 'no', searching_for: { $ne: null } }));

        console.log("\n======================================");
        console.log("📊 STRANGERCHAT - ADMIN LIVE STATS");
        console.log("======================================");
        console.log(`👥 Total Users:    ${totalMales + totalFemales}`);
        console.log(`   - Male:        ${totalMales}`);
        console.log(`   - Female:      ${totalFemales}`);
        console.log("--------------------------------------");
        console.log(`🌐 Users Online:   ${onlineMales + onlineFemales}`);
        console.log(`   - Male:        ${onlineMales}`);
        console.log(`   - Female:      ${onlineFemales}`);
        console.log("--------------------------------------");
        console.log(`🔍 Currently Searching: ${searchingUsers}`);
        console.log("======================================\n");

        process.exit(0);
    } catch (err) {
        console.error("❌ Error fetching stats:", err.message);
        process.exit(1);
    }
}

showStats();
