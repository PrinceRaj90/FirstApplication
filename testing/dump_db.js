const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGO_URL;
const client = new MongoClient(uri);

async function dump() {
    try {
        await client.connect();
        const db = client.db();
        console.log("\nDATABASE DUMP:");
        
        const males = await db.collection('male_users').find({}).toArray();
        const females = await db.collection('female_users').find({}).toArray();

        console.log("MALES:", males.map(u => ({ id: u.id, user: u.username, status: u.status, occ: u.occupied, seek: u.searching_for })));
        console.log("FEMALES:", females.map(u => ({ id: u.id, user: u.username, status: u.status, occ: u.occupied, seek: u.searching_for })));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

dump();
