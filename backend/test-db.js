const dns = require('dns');
// Set public DNS servers so Node.js resolves SRV records on Windows networks
dns.setServers(['8.8.8.8', '1.1.1.1']);

const mongoose = require('mongoose');

const srvUri = 'mongodb+srv://shivchole05_db_user:gbnk5Q3e7CyPJghg@cluster0.ixxneol.mongodb.net/food-rescue?retryWrites=true&w=majority&appName=Cluster0';

async function testConnection() {
  console.log('Connecting with SRV and public DNS...');
  try {
    await mongoose.connect(srvUri, { serverSelectionTimeoutMS: 15000 });
    console.log('SUCCESS: Connected to MongoDB Atlas cluster successfully!');
    console.log('Database name:', mongoose.connection.name);
    console.log('Host:', mongoose.connection.host);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Connection error:', err.message);
    process.exit(1);
  }
}

testConnection();

