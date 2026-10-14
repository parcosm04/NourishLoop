import { io } from "socket.io-client";
import Chart from 'chart.js/auto';
import { initializeApp } from "firebase/app";
import { getAuth, signOut } from "firebase/auth";
import { initFeedbackModal, setupLogout } from "./feedbackHelper";

const firebaseConfig = {
  apiKey: "AIzaSyDmKjiQ6H8PuOqDYgyIdKmmDAATHmnqE90",
  authDomain: "food-rescue-b0a7c.firebaseapp.com",
  projectId: "food-rescue-b0a7c",
  storageBucket: "food-rescue-b0a7c.firebasestorage.app",
  messagingSenderId: "500630558105",
  appId: "1:500630558105:web:79fc03f7c54a2460b06f08",
  measurementId: "G-SGTZ8FEHRS"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const userProfile = JSON.parse(sessionStorage.getItem('user') || localStorage.getItem('user') || 'null');
const socket = io("http://localhost:5000");

// Check auth
if (!userProfile || userProfile.role !== 'donor') {
  console.warn('Redirecting to login: current profile is', userProfile);
  window.location.href = '/';
}

// User Badge in Navbar
const userInfoEl = document.getElementById('user-info');
if (userInfoEl && userProfile) {
  const orgName = userProfile.organizationName ? ` • ${userProfile.organizationName}` : '';
  userInfoEl.innerHTML = `<strong>${userProfile.name}</strong>${orgName} <span class="role-pill donor">DONOR</span>`;
}

// Initialize Feedback Modal and Logout
initFeedbackModal(userProfile);
setupLogout(auth, signOut);

// In-Memory Listings State
let donorListings = [];

// Initialize ESG Impact Chart
const ctx = document.getElementById('impactChart').getContext('2d');
let totalRescuedKg = 0;
let co2PreventedKg = 0;

const impactChart = new Chart(ctx, {
  type: 'bar',
  data: {
    labels: ['Food Rescued (kg)', 'CO2 Prevented (kg)'],
    datasets: [{
      label: 'Cumulative ESG Impact',
      data: [0, 0],
      backgroundColor: [
        'rgba(233, 135, 50, 0.65)',
        'rgba(78, 154, 81, 0.65)'
      ],
      borderColor: [
        '#E98732',
        '#4E9A51'
      ],
      borderWidth: 1.5,
      borderRadius: 6
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: { 
        beginAtZero: true, 
        grid: { color: '#39332D' },
        ticks: { color: '#A9A49D', font: { family: "'DM Sans', sans-serif" } }
      },
      x: { 
        grid: { color: '#39332D' },
        ticks: { color: '#F4F0E9', font: { family: "'DM Sans', sans-serif", weight: '500' } }
      }
    },
    plugins: {
      legend: { 
        labels: { 
          color: '#F4F0E9',
          font: { family: "'DM Sans', sans-serif", size: 12 }
        } 
      }
    }
  }
});

function updateImpactChart() {
  const completedOrClaimed = donorListings.filter(i => i.status === 'completed' || i.status === 'claimed');
  totalRescuedKg = completedOrClaimed.reduce((sum, item) => sum + (item.quantityKg || 0), 0);
  co2PreventedKg = totalRescuedKg * 2; // ESG metric: 2kg CO2 saved per 1kg rescued food

  impactChart.data.datasets[0].data = [totalRescuedKg, co2PreventedKg];
  impactChart.update();
}

// 1. Fetch Listings by Current Donor
async function fetchDonorListings() {
  try {
    const res = await fetch(`http://localhost:5000/api/donations/donor/${userProfile.uid}`);
    if (res.ok) {
      donorListings = await res.json();
      renderLiveMonitor();
      renderHistoryTable();
      updateMetrics();
      updateImpactChart();
    } else {
      console.error('Failed to load donor listings');
    }
  } catch (error) {
    console.error('Error fetching donor listings:', error);
  }
}

// 2. Render Real-Time Live Surplus Monitor
function renderLiveMonitor() {
  const container = document.getElementById('live-surplus-grid');
  if (!container) return;

  // Active items: available, pending_approval, or claimed
  const activeItems = donorListings.filter(item => item.status !== 'completed' && item.status !== 'rejected');

  if (activeItems.length === 0) {
    container.innerHTML = `
      <div class="monitor-empty-state">
        <p>No active surplus listings right now.</p>
        <small>Use the form above to list items. They will appear here for live tracking and claim approvals.</small>
      </div>
    `;
    return;
  }

  container.innerHTML = '';

  activeItems.forEach(item => {
    const card = document.createElement('div');
    card.className = `monitor-card card-${item.status}`;
    card.id = `monitor-card-${item._id}`;

    const expiry = new Date(item.expiryTime);
    const isExpired = expiry < new Date();

    let statusBadge = '';
    let actionSection = '';

    if (item.status === 'available') {
      statusBadge = `<span class="badge-status status-available">● AVAILABLE</span>`;
      actionSection = `<p class="monitor-subtext">Waiting for recipient to request claim...</p>`;
    } else if (item.status === 'pending_approval') {
      const recipientName = item.receiverId?.organizationName || item.receiverId?.name || 'Community Recipient';
      const recipientPhone = item.receiverId?.phone ? ` • 📞 ${item.receiverId.phone}` : '';

      statusBadge = `<span class="badge-status status-pending pulse-amber">⚠️ APPROVAL REQUIRED</span>`;
      actionSection = `
        <div class="approval-box">
          <div class="approval-header">
            <strong>Claim Request Received</strong>
            <p><strong>${recipientName}</strong>${recipientPhone} wishes to claim this surplus.</p>
          </div>
          <div class="approval-actions">
            <button class="neon-btn lime btn-sm btn-approve" data-id="${item._id}">✓ Approve</button>
            <button class="neon-btn danger btn-sm btn-reject" data-id="${item._id}">✕ Decline</button>
          </div>
        </div>
      `;
    } else if (item.status === 'claimed') {
      const recipientName = item.receiverId?.organizationName || item.receiverId?.name || 'Charity';
      statusBadge = `<span class="badge-status status-claimed">✓ CLAIM APPROVED</span>`;
      actionSection = `
        <div class="claimed-box">
          <p>Approved for <strong>${recipientName}</strong>.</p>
          <div class="handoff-cta">
            <small>Claim ID: <code>${item._id}</code></small>
            <button class="autofill-id-btn" data-id="${item._id}">Auto-fill Handoff &rarr;</button>
          </div>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="card-top">
        <div>
          <h3 class="monitor-title">${item.foodItem}</h3>
          <span class="monitor-expiry ${isExpired ? 'expired-text' : ''}">
            Valid until: ${expiry.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (${expiry.toLocaleDateString()})
          </span>
        </div>
        <div class="monitor-weight">${item.quantityKg} kg</div>
      </div>
      <div class="card-status-bar">
        ${statusBadge}
      </div>
      <div class="card-action-bar">
        ${actionSection}
      </div>
    `;

    container.appendChild(card);
  });

  // Attach Approve & Reject Listeners
  container.querySelectorAll('.btn-approve').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-id');
      handleApproveClaim(id);
    });
  });

  container.querySelectorAll('.btn-reject').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-id');
      handleRejectClaim(id);
    });
  });

  container.querySelectorAll('.autofill-id-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-id');
      const qrInput = document.getElementById('qr-data');
      if (qrInput) {
        qrInput.value = id;
        qrInput.focus();
      }
    });
  });
}

// 3. Render Chronological Exhibition History Table
function renderHistoryTable() {
  const tbody = document.getElementById('history-table-body');
  if (!tbody) return;

  if (donorListings.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No listings recorded yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = donorListings.map(item => {
    const createdDate = new Date(item.createdAt || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const recipient = item.receiverId ? `${item.receiverId.organizationName || item.receiverId.name}` : '<span class="text-muted">—</span>';

    let statusClass = 'status-available';
    let statusLabel = item.status.toUpperCase();

    if (item.status === 'completed') {
      statusClass = 'status-completed';
      statusLabel = 'HANDED OVER';
    } else if (item.status === 'pending_approval') {
      statusClass = 'status-pending';
      statusLabel = 'PENDING APPROVAL';
    } else if (item.status === 'claimed') {
      statusClass = 'status-claimed';
      statusLabel = 'CLAIMED';
    }

    return `
      <tr>
        <td><strong>${item.foodItem}</strong></td>
        <td>${item.quantityKg} kg</td>
        <td>${createdDate}</td>
        <td>${recipient}</td>
        <td><span class="badge-status ${statusClass}">${statusLabel}</span></td>
        <td>
          ${item.status === 'pending_approval' ?
        `<button class="table-action-btn lime btn-approve" data-id="${item._id}">Approve</button>` :
        `<span class="table-id-snippet">${item._id.slice(-6)}</span>`}
        </td>
      </tr>
    `;
  }).join('');

  // Attach table approval listener
  tbody.querySelectorAll('.btn-approve').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-id');
      handleApproveClaim(id);
    });
  });
}

// 4. Update Metric Summary Cards
function updateMetrics() {
  const totalItems = donorListings.length;
  const totalKg = donorListings.reduce((sum, item) => sum + (item.quantityKg || 0), 0);
  const pendingCount = donorListings.filter(item => item.status === 'pending_approval').length;
  const completedCount = donorListings.filter(item => item.status === 'completed').length;

  document.getElementById('metric-total-items').innerText = totalItems;
  document.getElementById('metric-total-kg').innerText = `${totalKg.toFixed(1)} kg`;
  document.getElementById('metric-pending-claims').innerText = pendingCount;
  document.getElementById('metric-completed-claims').innerText = completedCount;
}

// 5. Approve Claim
async function handleApproveClaim(id) {
  try {
    const res = await fetch(`http://localhost:5000/api/donations/${id}/approve`, {
      method: 'PUT'
    });

    if (res.ok) {
      const updated = await res.json();
      const idx = donorListings.findIndex(i => i._id === id);
      if (idx !== -1) donorListings[idx] = updated;

      renderLiveMonitor();
      renderHistoryTable();
      updateMetrics();
      updateImpactChart();

      alert("✓ Claim Approved! The recipient can now generate their QR code to complete the handoff.");
    } else {
      const err = await res.json();
      alert(`Approval error: ${err.error}`);
    }
  } catch (error) {
    console.error('Error approving claim:', error);
  }
}

// 6. Reject Claim
async function handleRejectClaim(id) {
  if (!confirm("Are you sure you want to decline this claim request? The item will be returned to the live feed for other recipients.")) {
    return;
  }

  try {
    const res = await fetch(`http://localhost:5000/api/donations/${id}/reject`, {
      method: 'PUT'
    });

    if (res.ok) {
      const updated = await res.json();
      const idx = donorListings.findIndex(i => i._id === id);
      if (idx !== -1) donorListings[idx] = updated;

      renderLiveMonitor();
      renderHistoryTable();
      updateMetrics();

      alert("Claim request declined. The item is once again available in the rescue feed.");
    } else {
      const err = await res.json();
      alert(`Decline error: ${err.error}`);
    }
  } catch (error) {
    console.error('Error rejecting claim:', error);
  }
}

// Show Toast Banner
function showClaimToast(donation) {
  const toast = document.getElementById('claim-toast');
  const title = document.getElementById('toast-title');
  const msg = document.getElementById('toast-msg');
  if (!toast) return;

  const recipientName = donation.receiverId?.organizationName || donation.receiverId?.name || 'A Charity';
  title.innerText = `⚡ New Claim Request for "${donation.foodItem}"!`;
  msg.innerText = `${recipientName} requested to claim this item. Approval required.`;

  toast.classList.remove('hidden');

  setTimeout(() => {
    toast.classList.add('hidden');
  }, 10000);
}

// --- GPS LOCATION & PICKUP SCHEDULE LOGIC ---
let capturedGpsLocation = null;

const btnGetGps = document.getElementById('btn-get-gps');
const btnRetryGps = document.getElementById('btn-retry-gps');
const gpsStatusEl = document.getElementById('gps-status');
const gpsCoordsDisplay = document.getElementById('gps-coords-display');
const dispLat = document.getElementById('disp-lat');
const dispLng = document.getElementById('disp-lng');
const dispAccuracy = document.getElementById('disp-accuracy');
const pickupDateInput = document.getElementById('pickupDate');
const pickupDeadlineDateInput = document.getElementById('pickupDeadlineDate');
const pickupFromInput = document.getElementById('pickupFromTime');
const pickupUntilInput = document.getElementById('pickupUntilTime');
const pickupInstructionsInput = document.getElementById('pickupInstructions');
const pickupAddressInput = document.getElementById('pickupAddress');
const expiryTimeHidden = document.getElementById('expiryTime');

// Set sensible defaults for pickup schedule
const todayStr = new Date().toISOString().split('T')[0];
if (pickupDateInput) {
  pickupDateInput.value = todayStr;
  pickupDateInput.min = todayStr;
}
if (pickupDeadlineDateInput) {
  pickupDeadlineDateInput.value = todayStr;
  pickupDeadlineDateInput.min = todayStr;
}

// Update minimum selectable deadline date whenever pickup date changes
pickupDateInput?.addEventListener('change', () => {
  const chosenPickupDate = pickupDateInput.value;
  if (chosenPickupDate && pickupDeadlineDateInput) {
    pickupDeadlineDateInput.min = chosenPickupDate;
    if (pickupDeadlineDateInput.value && pickupDeadlineDateInput.value < chosenPickupDate) {
      pickupDeadlineDateInput.value = chosenPickupDate;
    }
  }
});

if (pickupFromInput && !pickupFromInput.value) {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 15);
  pickupFromInput.value = now.toTimeString().slice(0, 5);
}
if (pickupUntilInput && !pickupUntilInput.value) {
  const later = new Date();
  later.setHours(later.getHours() + 4);
  pickupUntilInput.value = later.toTimeString().slice(0, 5);
}

function updateGpsUI(state, text, lat = null, lng = null, accuracy = null) {
  if (!gpsStatusEl) return;
  gpsStatusEl.className = `gps-status-badge ${state}`;
  gpsStatusEl.innerText = text;

  if (state === 'captured' && lat !== null && lng !== null) {
    if (gpsCoordsDisplay) gpsCoordsDisplay.classList.remove('hidden');
    if (dispLat) dispLat.innerText = lat.toFixed(5);
    if (dispLng) dispLng.innerText = lng.toFixed(5);
    if (dispAccuracy && accuracy) dispAccuracy.innerText = `(±${accuracy}m)`;
    if (btnRetryGps) btnRetryGps.classList.remove('hidden');
    if (btnGetGps) btnGetGps.classList.add('hidden');
  } else if (state === 'unavailable') {
    if (btnRetryGps) btnRetryGps.classList.remove('hidden');
    if (btnGetGps) btnGetGps.classList.remove('hidden');
  } else if (state === 'loading') {
    if (btnGetGps) btnGetGps.disabled = true;
  }
  if (state !== 'loading' && btnGetGps) {
    btnGetGps.disabled = false;
  }
}

function captureGeolocation() {
  if (!navigator.geolocation) {
    updateGpsUI('unavailable', '⚠️ Geolocation Unsupported');
    alert('Geolocation is not supported by your browser. Please enter your pickup address manually in the fallback field.');
    return;
  }

  updateGpsUI('loading', '⏳ Acquiring GPS coordinates...');

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = Number(position.coords.latitude.toFixed(6));
      const lng = Number(position.coords.longitude.toFixed(6));
      const accuracy = Math.round(position.coords.accuracy);

      capturedGpsLocation = { lat, lng };
      updateGpsUI('captured', '✓ Location Added', lat, lng, accuracy);
    },
    (error) => {
      console.warn('Geolocation capture error:', error);
      let errorMsg = '⚠️ Location Unavailable';
      if (error.code === error.PERMISSION_DENIED) {
        errorMsg = '⚠️ GPS Permission Denied';
        alert('Location access was denied. You can still use the manual address fallback field below for recipient pickup directions.');
      } else if (error.code === error.TIMEOUT) {
        errorMsg = '⚠️ GPS Request Timed Out';
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        errorMsg = '⚠️ Position Unavailable';
      }
      updateGpsUI('unavailable', errorMsg);
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
  );
}

btnGetGps?.addEventListener('click', captureGeolocation);
btnRetryGps?.addEventListener('click', captureGeolocation);

// 7. Handle Form Submission (Add New Surplus)
document.getElementById('donation-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const submitBtn = document.getElementById('submit-donation-btn');
  let foodItem = document.getElementById('foodItem').value.trim();
  const quantityKg = parseFloat(document.getElementById('quantityKg').value);

  // Validate Pickup Schedule
  const pickupDate = pickupDateInput ? pickupDateInput.value : '';
  const pickupDeadlineDate = pickupDeadlineDateInput ? pickupDeadlineDateInput.value : '';
  const pickupFrom = pickupFromInput ? pickupFromInput.value : '';
  const pickupUntil = pickupUntilInput ? pickupUntilInput.value : '';
  const pickupInstructions = pickupInstructionsInput ? pickupInstructionsInput.value.trim() : '';
  const pickupAddress = pickupAddressInput ? pickupAddressInput.value.trim() : '';

  if (!pickupDate) {
    alert("Please select a Pickup Date.");
    pickupDateInput?.focus();
    return;
  }

  if (!pickupDeadlineDate) {
    alert("Please select a Deadline Date.");
    pickupDeadlineDateInput?.focus();
    return;
  }

  // 1. Deadline date must not be earlier than pickup date
  if (pickupDeadlineDate < pickupDate) {
    alert("Validation Notice: The Deadline Date cannot be earlier than the Pickup Date.");
    pickupDeadlineDateInput?.focus();
    return;
  }

  // 2. If both dates are the same, deadline time must be later than start time
  if (pickupDeadlineDate === pickupDate) {
    if (pickupFrom && pickupUntil && pickupFrom >= pickupUntil) {
      alert("Validation Notice: For same-day collection, the 'Available Until' deadline time must be later than the 'Available From' start time.");
      pickupUntilInput?.focus();
      return;
    }
  }
  // If pickupDeadlineDate > pickupDate, overnight and multi-day collection windows are valid!

  // Construct ISO expiry timestamp using the exact Deadline Date and Deadline Time
  let expiryTime = '';
  if (pickupDeadlineDate && pickupUntil) {
    expiryTime = `${pickupDeadlineDate}T${pickupUntil}`;
  } else if (pickupDate && pickupUntil) {
    expiryTime = `${pickupDate}T${pickupUntil}`;
  } else if (expiryTimeHidden && expiryTimeHidden.value) {
    expiryTime = expiryTimeHidden.value;
  } else {
    // Default 4 hours from now
    const d = new Date();
    d.setHours(d.getHours() + 4);
    expiryTime = d.toISOString().slice(0, 16);
  }

  // Enrich item title with pickup window note for clear receiver visibility
  if (pickupFrom && pickupUntil) {
    let formattedWindow = '';
    if (pickupDeadlineDate === pickupDate) {
      formattedWindow = `[Pickup: ${pickupDate} ${pickupFrom}–${pickupUntil}]`;
    } else {
      formattedWindow = `[Pickup: ${pickupDate} ${pickupFrom} to ${pickupDeadlineDate} ${pickupUntil}]`;
    }
    if (pickupInstructions) {
      formattedWindow += ` (Note: ${pickupInstructions})`;
    }
    if (!foodItem.includes('[Pickup:')) {
      foodItem = `${foodItem} ${formattedWindow}`;
    }
  }

  // Use captured GPS location if available, otherwise donor profile location or default Indian metro coordinates
  const locationPayload = capturedGpsLocation || userProfile?.location || { lat: 12.9716, lng: 77.5946 };

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = 'Exhibiting Item...';
  }

  try {
    const res = await fetch('http://localhost:5000/api/donations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        donorUid: userProfile.uid,
        foodItem,
        quantityKg,
        expiryTime,
        location: locationPayload
      })
    });

    if (res.ok) {
      const newDonation = await res.json();
      donorListings.unshift(newDonation);

      renderLiveMonitor();
      renderHistoryTable();
      updateMetrics();

      alert("✓ Surplus exhibited successfully on NourishLoop! It is now live on the rescue feed.");
      e.target.reset();

      // Reset GPS UI
      capturedGpsLocation = null;
      updateGpsUI('not-added', '⚪ Location Not Added');
      if (gpsCoordsDisplay) gpsCoordsDisplay.classList.add('hidden');
      if (btnRetryGps) btnRetryGps.classList.add('hidden');
      if (btnGetGps) btnGetGps.classList.remove('hidden');

      // Reset default schedule
      const freshToday = new Date().toISOString().split('T')[0];
      if (pickupDateInput) {
        pickupDateInput.value = freshToday;
        pickupDateInput.min = freshToday;
      }
      if (pickupDeadlineDateInput) {
        pickupDeadlineDateInput.value = freshToday;
        pickupDeadlineDateInput.min = freshToday;
      }
    } else {
      const err = await res.json();
      alert(`Error listing surplus: ${err.error || 'Server error'}`);
    }
  } catch (error) {
    console.error(error);
    alert('Failed to connect to backend server.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = 'Exhibit Surplus Item →';
    }
  }
});

// 8. Handle QR Scan Mock
document.getElementById('scan-btn')?.addEventListener('click', async () => {
  const claimId = document.getElementById('qr-data').value.trim();
  if (!claimId) return alert('Please enter Claim ID from QR code');

  try {
    const res = await fetch(`http://localhost:5000/api/donations/${claimId}/complete`, {
      method: 'PUT'
    });

    if (res.ok) {
      const completed = await res.json();
      alert("✓ Handoff completed successfully! The item is archived as rescued.");
      document.getElementById('qr-data').value = '';

      const idx = donorListings.findIndex(i => i._id === claimId);
      if (idx !== -1) donorListings[idx] = completed;

      renderLiveMonitor();
      renderHistoryTable();
      updateMetrics();
      updateImpactChart();
    } else {
      const err = await res.json();
      alert(`Error: ${err.error}`);
    }
  } catch (error) {
    console.error(error);
  }
});

// 9. Socket.io Real-Time Listeners
socket.on('claim_requested', (donation) => {
  // Check if this donation belongs to this donor
  const isMine = donation.donorId?._id === userProfile._id ||
    donation.donorId?.uid === userProfile.uid ||
    donation.donorId === userProfile._id;

  if (isMine) {
    showClaimToast(donation);
    const idx = donorListings.findIndex(i => i._id === donation._id);
    if (idx !== -1) {
      donorListings[idx] = donation;
    } else {
      donorListings.unshift(donation);
    }
    renderLiveMonitor();
    renderHistoryTable();
    updateMetrics();
  }
});

socket.on('claim_approved', (donation) => {
  const idx = donorListings.findIndex(i => i._id === donation._id);
  if (idx !== -1) {
    donorListings[idx] = donation;
    renderLiveMonitor();
    renderHistoryTable();
    updateMetrics();
    updateImpactChart();
  }
});

socket.on('donation_completed', (donation) => {
  const idx = donorListings.findIndex(i => i._id === donation._id);
  if (idx !== -1) {
    donorListings[idx] = donation;
    renderLiveMonitor();
    renderHistoryTable();
    updateMetrics();
    updateImpactChart();
  }
});

// Initial Load
fetchDonorListings();
