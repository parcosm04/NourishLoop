import { io } from "socket.io-client";
import QRCode from 'qrcode';
import { initializeApp } from "firebase/app";
import { getAuth, signOut } from "firebase/auth";
import { initFeedbackModal, setupLogout } from "./feedbackHelper";
import breadImg from '../assets/bread_bakery.jpg';
import produceImg from '../assets/fresh_produce.jpg';
import cookedMealsImg from '../assets/indian_cooked_meals.jpg';
import dalStaplesImg from '../assets/indian_dal_staples.jpg';
import thaliImg from '../assets/indian_thali_hero.jpg';

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

// Data Types & Variables (Phase 3 Requirement)
const userProfile = JSON.parse(sessionStorage.getItem('user') || localStorage.getItem('user') || 'null');
let rescueFeed = [];
let isLoading = true;

const socket = io("http://localhost:5000");

// Check auth
if (!userProfile || userProfile.role !== 'receiver') {
  console.warn('Redirecting to login: current profile is', userProfile);
  window.location.href = '/';
}

const userInfoEl = document.getElementById('user-info');
if (userInfoEl && userProfile) {
  const orgName = userProfile.organizationName ? ` • ${userProfile.organizationName}` : '';
  userInfoEl.innerHTML = `<strong>${userProfile.name}</strong>${orgName} <span class="role-pill receiver">RECEIVER</span>`;
}

// Initialize Feedback Modal and Logout
initFeedbackModal(userProfile);
setupLogout(auth, signOut);

// Fetch Initial Data
async function fetchDonations() {
  try {
    const response = await fetch('http://localhost:5000/api/donations');
    const data = await response.json();

    // Geospatial proximity sorting
    const userLoc = userProfile?.location || { lat: 40.7128, lng: -74.0060 };

    rescueFeed = data.sort((a, b) => {
      if (!a.location || !b.location) return 0;
      const distA = Math.hypot(a.location.lat - userLoc.lat, a.location.lng - userLoc.lng);
      const distB = Math.hypot(b.location.lat - userLoc.lat, b.location.lng - userLoc.lng);
      return distA - distB;
    });

    renderFeed();
  } catch (error) {
    console.error('Error fetching donations:', error);
  }
}

// Helper to determine category & image based on Indian food description
function getFoodCategoryAndImage(foodItem = '') {
  const lower = foodItem.toLowerCase();
  if (lower.includes('dal') || lower.includes('rice') || lower.includes('khichdi') || lower.includes('lentil') || lower.includes('chawal') || lower.includes('rajma') || lower.includes('chole')) {
    return { category: 'Rice, Dal & Staples', img: dalStaplesImg };
  }
  if (lower.includes('bread') || lower.includes('bakery') || lower.includes('pav') || lower.includes('bun') || lower.includes('naan') || lower.includes('pastry') || lower.includes('roti') || lower.includes('paratha')) {
    return { category: 'Bakery Items', img: breadImg };
  }
  if (lower.includes('fruit') || lower.includes('veg') || lower.includes('salad') || lower.includes('produce') || lower.includes('tomato') || lower.includes('potato') || lower.includes('onion')) {
    return { category: 'Fresh Fruits & Vegetables', img: produceImg };
  }
  if (lower.includes('thali') || lower.includes('meal') || lower.includes('curry') || lower.includes('sabzi') || lower.includes('paneer') || lower.includes('biryani') || lower.includes('pulao')) {
    return { category: 'Cooked Meals', img: thaliImg };
  }
  return { category: 'Cooked Meals', img: cookedMealsImg };
}

// Helper to render verified GPS or address pickup location with Google Maps directions
function getLocationMarkup(item) {
  const hasCoords = item.location && 
    typeof item.location.lat === 'number' && 
    typeof item.location.lng === 'number' && 
    !isNaN(item.location.lat) && 
    !isNaN(item.location.lng) &&
    item.location.lat !== 0 &&
    item.location.lng !== 0;

  const address = item.donorId?.address || item.address || '';

  if (hasCoords) {
    const lat = item.location.lat.toFixed(4);
    const lng = item.location.lng.toFixed(4);
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${item.location.lat},${item.location.lng}`;
    return `
      <div class="card-location-row">
        <span class="card-location-text" title="Verified GPS: ${lat}, ${lng}">
          📍 <span>GPS: ${lat}, ${lng}</span>
        </span>
        <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" class="card-directions-link">
          Get Directions ↗
        </a>
      </div>
    `;
  } else if (address) {
    const encoded = encodeURIComponent(address);
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
    return `
      <div class="card-location-row">
        <span class="card-location-text" title="${address}">
          📍 <span>${address}</span>
        </span>
        <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" class="card-directions-link">
          Get Directions ↗
        </a>
      </div>
    `;
  } else {
    return `
      <div class="card-location-row" style="opacity: 0.65;">
        <span class="card-location-text" style="font-style: italic;">
          📍 Pickup location not provided
        </span>
      </div>
    `;
  }
}

// Search state
let searchQuery = '';
const searchInput = document.getElementById('feed-search');
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    renderFeed();
  });
}

// Render DOM (Phase 3 Loop Requirement)
function renderFeed() {
  const grid = document.getElementById('rescue-feed');
  if (!grid) return;
  grid.innerHTML = '';

  const activeDisplayFeed = rescueFeed.filter(item => {
    if (!searchQuery) return true;
    const food = (item.foodItem || '').toLowerCase();
    const donor = (item.donorId?.organizationName || item.donorId?.name || '').toLowerCase();
    return food.includes(searchQuery) || donor.includes(searchQuery);
  });

  if (activeDisplayFeed.length === 0) {
    grid.innerHTML = `<p class="empty-feed-msg">${searchQuery ? 'No surplus items match your search. Try different keywords.' : 'No surplus available currently. Check back soon!'}</p>`;
    return;
  }

  // Use .map() to dynamically construct the DOM
  const elements = activeDisplayFeed.map(item => {
    const card = document.createElement('article');
    card.className = `food-card card-${item.status}`;

    const expiry = new Date(item.expiryTime);
    const isExpired = expiry < new Date();
    const donorName = item.donorId?.organizationName || item.donorId?.name || 'Local Kitchen';
    const { category, img } = getFoodCategoryAndImage(item.foodItem);
    const locationMarkup = getLocationMarkup(item);

    let actionButton = '';
    let statusText = item.status.toUpperCase();

    if (item.status === 'available' && !isExpired) {
      actionButton = `<button class="neon-btn lime claim-btn" data-id="${item._id}">Request Claim</button>`;
    } else if (item.status === 'pending_approval') {
      statusText = 'AWAITING APPROVAL';
      actionButton = `<span class="pending-approval-pill">⏳ Awaiting Donor Approval</span>`;
    } else if (item.status === 'claimed') {
      actionButton = `<span class="claimed-pill">✓ Claim Approved</span>`;
    }

    card.innerHTML = `
      <div class="food-card-media">
        <img src="${img}" alt="${item.foodItem}" loading="lazy" />
        <span class="food-card-badge">${category}</span>
      </div>
      <div class="food-card-body">
        <div class="card-header">
          <div>
            <h3 class="card-title">${item.foodItem}</h3>
            <p class="card-meta">Donor: <strong>${donorName}</strong></p>
          </div>
          <span class="card-weight">${item.quantityKg} kg</span>
        </div>

        ${locationMarkup}

        <div class="card-footer">
          <div class="card-footer-info">
            <span class="status-badge status-${item.status}">${statusText}</span>
            <p class="card-meta" style="font-size: 0.8rem; margin-top: 0.25rem;">Expires: ${expiry.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
          <div>
            ${actionButton}
          </div>
        </div>
      </div>
    `;
    return card;
  });

  // Use forEach to append
  elements.forEach(el => grid.appendChild(el));

  // Attach listeners
  grid.querySelectorAll('.claim-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const itemId = e.target.getAttribute('data-id');
      const item = rescueFeed.find(i => i._id === itemId);
      handleClaim(itemId, item ? item.quantityKg : 1);
    });
  });
}

// Handle Claim Request (Phase 3 Functions & Strict Conditional Logic)
async function handleClaim(itemId, requestedAmount) {
  const item = rescueFeed.find(i => i._id === itemId);

  if (userProfile.role !== 'receiver') {
    alert("Unauthorized: Only receivers can claim surplus.");
    return;
  } else if (!item) {
    alert("Error: Item not found in current feed.");
    return;
  } else if (item.status !== 'available') {
    alert("Sorry, this item is already claimed or pending approval.");
    return;
  } else if (new Date(item.expiryTime) < new Date()) {
    alert("Cannot claim: This item has expired.");
    return;
  } else if (requestedAmount > item.quantityKg) {
    alert("Requested amount exceeds available quantity.");
    return;
  } else {
    // Proceed with claim request
    try {
      const res = await fetch(`http://localhost:5000/api/donations/${itemId}/claim`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverUid: userProfile.uid })
      });

      if (res.ok) {
        const updatedItem = await res.json();
        const idx = rescueFeed.findIndex(i => i._id === itemId);
        if (idx !== -1) {
          rescueFeed[idx] = updatedItem;
        }
        renderFeed();
        alert("✓ Claim request submitted! The donor has been notified in real time to approve your request. Once approved, your QR code will appear.");
      } else {
        const errorData = await res.json();
        alert(`Claim failed: ${errorData.error}`);
      }
    } catch (error) {
      console.error(error);
      alert('Failed to connect to server.');
    }
  }
}

function showQRModal(claimId, foodItem = '') {
  const modal = document.getElementById('qr-modal');
  const qrContainer = document.getElementById('qrcode');
  if (!modal || !qrContainer) return;

  qrContainer.innerHTML = '';

  QRCode.toCanvas(claimId, { errorCorrectionLevel: 'H' }, function (err, canvas) {
    if (err) throw err;
    qrContainer.appendChild(canvas);
  });

  const modalDesc = modal.querySelector('p');
  if (modalDesc && foodItem) {
    modalDesc.innerHTML = `Claim for <strong>${foodItem}</strong> approved! Present this QR code to the donor during pickup:`;
  }

  modal.classList.remove('hidden');

  const closeBtn = document.getElementById('close-modal');
  if (closeBtn) {
    closeBtn.onclick = () => {
      modal.classList.add('hidden');
    };
  }
}

// Socket.io Real-Time Listeners
socket.on('new_donation', (donation) => {
  rescueFeed.unshift(donation);
  renderFeed();
});

socket.on('claim_requested', (donation) => {
  const idx = rescueFeed.findIndex(i => i._id === donation._id);
  if (idx !== -1) {
    rescueFeed[idx] = donation;
  } else {
    rescueFeed.unshift(donation);
  }
  renderFeed();
});

socket.on('claim_approved', (donation) => {
  const idx = rescueFeed.findIndex(i => i._id === donation._id);
  if (idx !== -1) {
    rescueFeed[idx] = donation;
    renderFeed();
  }

  // If this receiver was the one approved, pop up QR Code!
  const isMe = donation.receiverId?.uid === userProfile.uid ||
    donation.receiverId?._id === userProfile._id ||
    donation.receiverId === userProfile._id;

  if (isMe) {
    showQRModal(donation._id, donation.foodItem);
  }
});

socket.on('claim_rejected', (data) => {
  if (data.receiverUid === userProfile.uid) {
    alert(`Notice: The donor was unable to approve the claim request for "${data.foodItem}". The item has returned to the archive.`);
  }
  fetchDonations();
});

socket.on('donation_restored', (donation) => {
  const idx = rescueFeed.findIndex(i => i._id === donation._id);
  if (idx !== -1) {
    rescueFeed[idx] = donation;
  } else {
    rescueFeed.unshift(donation);
  }
  renderFeed();
});

socket.on('donation_completed', (donation) => {
  const idx = rescueFeed.findIndex(i => i._id === donation._id);
  if (idx !== -1) {
    rescueFeed.splice(idx, 1); // remove from available feed
    renderFeed();
  }
});

// Init
fetchDonations();
