const dns = require('dns');
const net = require('net');

console.log('=== 1. Testing Default DNS for SRV ===');
dns.resolveSrv('_mongodb._tcp.cluster0.ixxneol.mongodb.net', (err, addresses) => {
  if (err) {
    console.log('Default DNS SRV Error:', err.code, err.message);
  } else {
    console.log('Default DNS SRV Success:', addresses);
  }

  console.log('\n=== 2. Testing Google DNS (8.8.8.8) for SRV ===');
  dns.setServers(['8.8.8.8', '1.1.1.1']);
  dns.resolveSrv('_mongodb._tcp.cluster0.ixxneol.mongodb.net', (err2, addresses2) => {
    if (err2) {
      console.log('Google DNS SRV Error:', err2.code, err2.message);
    } else {
      console.log('Google DNS SRV Success:', addresses2);
    }

    testTcp();
  });
});

function testTcp() {
  console.log('\n=== 3. Testing TCP connection to port 27017 on Atlas shard ===');
  const host = 'ac-cat3uva-shard-00-00.ixxneol.mongodb.net';
  const port = 27017;
  console.log(`Connecting to ${host}:${port}...`);
  const socket = net.createConnection({ host, port, timeout: 5000 }, () => {
    console.log(`TCP Connection SUCCESSFUL to ${host}:${port}! Port 27017 is open.`);
    socket.end();
  });

  socket.on('timeout', () => {
    console.log(`TCP Connection TIMED OUT to ${host}:${port}. Port 27017 might be blocked or IP not whitelisted.`);
    socket.destroy();
  });

  socket.on('error', (err) => {
    console.log(`TCP Connection ERROR to ${host}:${port}:`, err.message);
  });
}
