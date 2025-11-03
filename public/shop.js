// Toast Notification System for Shop
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1.25rem 1.75rem;
        border-radius: 12px;
        font-weight: 600;
        z-index: 10000;
        animation: slideInRight 0.3s ease;
        box-shadow: 0 10px 30px rgba(0,0,0,0.4);
        font-size: 1rem;
        max-width: 400px;
    `;
    
    if (type === 'success') {
        toast.style.background = 'linear-gradient(135deg, #00B894, #00d4aa)';
        toast.style.color = 'white';
    } else if (type === 'error') {
        toast.style.background = 'linear-gradient(135deg, #FF6B6B, #ff8787)';
        toast.style.color = 'white';
    } else if (type === 'info') {
        toast.style.background = 'linear-gradient(135deg, #6C5CE7, #8b7fff)';
        toast.style.color = 'white';
    }
    
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Add animation keyframes
if (!document.querySelector('#shopToastStyles')) {
    const style = document.createElement('style');
    style.id = 'shopToastStyles';
    style.textContent = `
        @keyframes slideInRight {
            from {
                transform: translateX(500px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        @keyframes slideOutRight {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(500px);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}


let currentUser = null;
let currentGame = 'agma.io';
let selectedItem = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    checkAuthStatus();
    loadShopData();
    setupEventListeners();
    checkAuthParams();
});

function setupEventListeners() {
    // Search bar
    document.getElementById('searchBar').addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        filterItems(query);
    });
    
    // Game selector
    document.querySelectorAll('.game-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.game-item').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            currentGame = e.currentTarget.dataset.game;
            loadShopData();
        });
    });
    
    // Modal controls
    document.querySelector('.close').addEventListener('click', closeModal);
    document.getElementById('cancelRedeem').addEventListener('click', closeModal);
    document.getElementById('confirmRedeem').addEventListener('click', confirmRedemption);
    
    // Quantity change
    document.getElementById('quantity').addEventListener('input', updateTotalCost);
    
    // Refresh history
    document.getElementById('refreshHistory').addEventListener('click', loadHistory);
    
    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', logout);
    
    // Close modal on outside click
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('redeemModal');
        if (e.target === modal) {
            closeModal();
        }
    });
}

async function checkAuthStatus() {
    try {
        const response = await fetch('/api/auth/user');
        const data = await response.json();
        
        if (data.authenticated) {
            currentUser = data;
            displayUserProfile(data);
            loadUserData();
        } else {
            displayLoginPrompt();
        }
    } catch (err) {
        console.error('Error checking auth status:', err);
        displayLoginPrompt();
    }
}

function displayUserProfile(user) {
    document.getElementById('loginPrompt').style.display = 'none';
    document.getElementById('userProfile').style.display = 'block';
    
    document.getElementById('userPicture').src = user.picture;
    document.getElementById('userName').textContent = user.displayName;
}

function displayLoginPrompt() {
    document.getElementById('userProfile').style.display = 'none';
    document.getElementById('loginPrompt').style.display = 'block';
}

function checkAuthParams() {
    const params = new URLSearchParams(window.location.search);
    const authStatus = params.get('auth');
    
    if (authStatus === 'success') {
        showAuthAlert('✅ Successfully logged in! Welcome!', 'success');
        window.history.replaceState({}, document.title, '/shop.html');
    } else if (authStatus === 'failed') {
        showAuthAlert('❌ Login failed. Please try again.', 'error');
        window.history.replaceState({}, document.title, '/shop.html');
    }
}

function showAuthAlert(message, type) {
    showToast(message, type);
}


async function loadUserData() {
    if (!currentUser) return;
    
    try {
        const response = await fetch(`/api/points/${currentUser.youtubeChannelId}`);
        
        if (response.status === 401) {
            checkAuthStatus();
            return;
        }
        
        const data = await response.json();
        
        if (data.error) {
            console.error('Error loading points:', data.error);
            return;
        }
        
        document.getElementById('userPoints').textContent = data.points || 0;
        
        // Show multiplier if active
        if (data.multiplier > 1 && data.multiplier_expires > Date.now()) {
            const remaining = Math.ceil((data.multiplier_expires - Date.now()) / 60000);
            document.querySelector('.points-label').textContent = `Points (${data.multiplier}x - ${remaining}m)`;
        } else {
            document.querySelector('.points-label').textContent = 'Your Points';
        }
        
        loadHistory();
    } catch (err) {
        console.error('Error loading user data:', err);
    }
}

async function loadShopData() {
    try {
        // Load Agma.io items
        const agmaRes = await fetch(`/api/items?game=agma.io`);
        const agma = await agmaRes.json();
        
        // Load Stream items (perks)
        const streamRes = await fetch(`/api/items?game=stream`);
        const stream = await streamRes.json();
        
        // Combine all items for featured
        const allItems = [...agma, ...stream];
        
        // Sort into categories
        const powerups = agma.filter(i => i.category === 'powerup');
        const currency = agma.filter(i => i.category === 'currency');
        const bots = agma.filter(i => i.category === 'bots');
        const membership = agma.filter(i => i.category === 'membership');
        const priority = stream.filter(i => i.category === 'priority');
        const boost = stream.filter(i => i.category === 'boost');
        
        // Featured = top trending from ALL items, sorted by trending_score
        const featured = allItems
            .sort((a, b) => b.trending_score - a.trending_score)
            .slice(0, 6);
        
        displayItems(featured, 'featuredItems');
        displayItems(powerups, 'powerupItems');
        displayItems(currency, 'currencyItems');
        displayItems(bots, 'botItems');
        displayItems(membership, 'membershipItems');
        displayItems(priority, 'priorityItems');
        displayItems(boost, 'boostItems');
        
    } catch (err) {
        console.error('Error loading shop data:', err);
    }
}

function displayItems(items, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!Array.isArray(items) || items.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">No items available</p>';
        return;
    }
    
    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'item-card';
        card.onclick = () => openRedeemModal(item);
        
        card.innerHTML = `
            <div class="item-image">
                <img src="${item.image_url}" alt="${item.name}" onerror="this.style.display='none'">
            </div>
            <div class="item-content">
                <h3 class="item-name">${item.name}</h3>
                <p class="item-description">${item.description}</p>
                <div class="item-footer">
                    <span class="item-cost">
                        ${item.cost} <small>points</small>
                    </span>
                    <button class="btn-redeem">Redeem</button>
                </div>
            </div>
        `;
        
        container.appendChild(card);
    });
}

function filterItems(query) {
    const allCards = document.querySelectorAll('.item-card');
    
    allCards.forEach(card => {
        const name = card.querySelector('.item-name').textContent.toLowerCase();
        const desc = card.querySelector('.item-description').textContent.toLowerCase();
        
        if (name.includes(query) || desc.includes(query)) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

function openRedeemModal(item) {
    if (!currentUser) {
        showAuthAlert('🔐 Please sign in to redeem items', 'error');
        return;
    }
    
    selectedItem = item;
    const modal = document.getElementById('redeemModal');
    
    document.getElementById('modalTitle').textContent = `Redeem: ${item.name}`;
    document.getElementById('modalItemPreview').innerHTML = `
        <h3>${item.name}</h3>
        <p style="color: var(--text-secondary); margin: 0.5rem 0;">${item.description}</p>
        <p style="color: var(--secondary-color); font-size: 1.5rem; font-weight: bold;">${item.cost} points</p>
    `;
    
    // Show/hide fields based on item type
    const agmaField = document.getElementById('agmaGroup');
    const quantityField = document.getElementById('quantityGroup');
    const priorityField = document.getElementById('priorityGroup');
    
    agmaField.style.display = item.game === 'agma.io' ? 'block' : 'none';
    quantityField.style.display = item.type !== 'perk' ? 'block' : 'none';
    priorityField.style.display = item.type === 'priority' ? 'block' : 'none';
    
    // Reset fields
    document.getElementById('quantity').value = 1;
    document.getElementById('agmaUsername').value = '';
    document.getElementById('redeemMessage').value = '';
    document.getElementById('priorityServer').value = '';
    document.getElementById('priorityAction').value = '';
    document.getElementById('priorityCustom').value = '';
    
    updateTotalCost();
    
    modal.style.display = 'block';
}

function closeModal() {
    document.getElementById('redeemModal').style.display = 'none';
    selectedItem = null;
}

function updateTotalCost() {
    if (!selectedItem) return;
    
    const quantity = parseInt(document.getElementById('quantity').value) || 1;
    const total = selectedItem.cost * quantity;
    document.getElementById('totalCost').textContent = total;
}

async function confirmRedemption() {
    if (!selectedItem || !currentUser) {
        showToast('🔐 Please sign in to redeem items', 'error');
        return;
    }
    
    const agmaUsername = document.getElementById('agmaUsername').value.trim();
    const quantity = parseInt(document.getElementById('quantity').value) || 1;
    const redeemMessage = document.getElementById('redeemMessage').value.trim();
    
    // Validate Agma username for Agma items
    if (selectedItem.game === 'agma.io' && !agmaUsername) {
        showToast('⚠️ Please enter your Agma.io username', 'error');
        return;
    }
    
    // Validate Priority Pick data
    if (selectedItem.type === 'priority') {
        const server = document.getElementById('priorityServer').value.trim();
        const action = document.getElementById('priorityAction').value.trim();
        
        if (!server) {
            showToast('⚠️ Please select a server', 'error');
            return;
        }
        if (!action) {
            showToast('⚠️ Please select an action', 'error');
            return;
        }
    }
    
    // Build priority data if it's a priority pick
    let priorityData = null;
    let message = redeemMessage;
    
    if (selectedItem.type === 'priority') {
        const custom = document.getElementById('priorityCustom').value.trim();
        priorityData = {
            server: document.getElementById('priorityServer').value,
            action: document.getElementById('priorityAction').value,
            custom: custom || ''
        };
    }
    
    try {
        const response = await fetch('/api/redeem', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agma_username: agmaUsername,
                item_id: selectedItem.id,
                quantity: quantity,
                message: message,
                priority_data: priorityData
            })
        });
        
        if (response.status === 401) {
            showToast('🔐 Session expired. Please sign in again.', 'error');
            checkAuthStatus();
            return;
        }
        
        const result = await response.json();
        
        if (result.success) {
            // Show success message with emoji based on item type
            let successMsg = '✅ Redemption submitted for approval!';
            if (result.instant) {
                successMsg = '⚡ Perk activated!';
            }
            showToast(successMsg, 'success');
            
            closeModal();
            loadUserData();
            loadShopData();
        } else {
            showToast(`❌ ${result.error || 'Redemption failed'}`, 'error');
        }
    } catch (err) {
        console.error('Error redeeming:', err);
        showToast('❌ Error processing redemption', 'error');
    }
}

async function loadHistory() {
    if (!currentUser) return;
    
    try {
        const response = await fetch(`/api/history/${currentUser.youtubeChannelId}`);
        
        if (response.status === 401) {
            checkAuthStatus();
            return;
        }
        
        const data = await response.json();
        const container = document.getElementById('historyContainer');
        
        // Check if response is an error object or an array
        if (!Array.isArray(data)) {
            console.error('History data is not an array:', data);
            container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">Error loading history</p>';
            return;
        }
        
        if (data.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">No redemption history yet</p>';
            return;
        }
        
        container.innerHTML = data.map(item => `
            <div class="history-item">
                <div class="history-info">
                    <h4>${item.item_name}</h4>
                    <p>${new Date(item.timestamp).toLocaleString()} • ${item.cost} points</p>
                </div>
                <span class="history-status status-${item.status}">${item.status.toUpperCase()}</span>
            </div>
        `).join('');
        
    } catch (err) {
        console.error('Error loading history:', err);
    }
}

async function logout() {
    try {
        await fetch('/auth/logout');
        currentUser = null;
        displayLoginPrompt();
        showAuthAlert('👋 Logged out successfully', 'success');
    } catch (err) {
        console.error('Error logging out:', err);
    }
}
