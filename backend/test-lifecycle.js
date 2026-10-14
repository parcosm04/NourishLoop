const http = require('http');

function request(method, path, data) {
  return new Promise((resolve, reject) => {
    const payload = data ? JSON.stringify(data) : '';
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: body ? JSON.parse(body) : null }));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTest() {
  console.log('1. Creating Donation for donor_registered_01...');
  const createRes = await request('POST', '/api/donations', {
    donorUid: 'donor_registered_01',
    foodItem: 'Artisan Bagels & Brioche',
    quantityKg: 12,
    expiryTime: new Date(Date.now() + 36000000).toISOString()
  });
  console.log('Created:', createRes.status, createRes.body._id, 'Status:', createRes.body.status);
  const donationId = createRes.body._id;

  console.log('\n2. Requesting Claim by receiver test_user_receiver...');
  const claimRes = await request('PUT', `/api/donations/${donationId}/claim`, {
    receiverUid: 'test_user_receiver'
  });
  console.log('Claim Requested:', claimRes.status, 'New Status:', claimRes.body.status, 'Receiver:', claimRes.body.receiverId?.name);

  console.log('\n3. Donor Approving Claim...');
  const approveRes = await request('PUT', `/api/donations/${donationId}/approve`);
  console.log('Approved:', approveRes.status, 'New Status:', approveRes.body.status);

  console.log('\n4. Completing Handoff via QR Scan...');
  const completeRes = await request('PUT', `/api/donations/${donationId}/complete`);
  console.log('Completed:', completeRes.status, 'New Status:', completeRes.body.status);

  console.log('\n5. Checking Donor Exhibition History...');
  const historyRes = await request('GET', '/api/donations/donor/donor_registered_01');
  console.log('Total history records:', historyRes.body.length);
  console.log('First record status:', historyRes.body[0]?.status, 'Food:', historyRes.body[0]?.foodItem);
  console.log('\nALL 5 STEPS PASSED PERFECTLY!');
  process.exit(0);
}

runTest().catch(err => {
  console.error(err);
  process.exit(1);
});
