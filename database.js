const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./rewards.db');

db.serialize(() => {
  // User points table (synced from Streamer.bot)
  db.run(`CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    points INTEGER DEFAULT 0,
    total_earned INTEGER DEFAULT 0,
    point_multiplier REAL DEFAULT 1.0,
    multiplier_expires INTEGER DEFAULT 0
  )`);

  // Redemption requests (pending approval)
  db.run(`CREATE TABLE IF NOT EXISTS redemptions (
    id TEXT PRIMARY KEY,
    username TEXT,
    agma_username TEXT,
    item_id TEXT,
    item_name TEXT,
    quantity INTEGER,
    cost INTEGER,
    message TEXT,
    status TEXT DEFAULT 'pending',
    created_at INTEGER,
    processed_at INTEGER
  )`);

  // Redemption history
  db.run(`CREATE TABLE IF NOT EXISTS history (
    id TEXT PRIMARY KEY,
    username TEXT,
    item_name TEXT,
    cost INTEGER,
    timestamp INTEGER,
    status TEXT
  )`);

  // Shop items configuration
  db.run(`CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    category TEXT,
    game TEXT,
    name TEXT,
    description TEXT,
    cost INTEGER,
    image_url TEXT,
    available BOOLEAN DEFAULT 1,
    trending_score INTEGER DEFAULT 0,
    limited_time BOOLEAN DEFAULT 0,
    expires_at INTEGER DEFAULT 0,
    type TEXT DEFAULT 'item'
  )`);
  
  // Seed initial items for Agma.io
  const seedItems = [
    // Agma.io - Powerups
    ['powerup-5', 'powerup', 'agma.io', '⚡ 5 Powerup Pack', '5 random powerups to boost your gameplay', 200, 'https://agma.io/img/store/5ofAll2.png', 1, 0, 0, 0, 'item'],
    ['powerup-15', 'powerup', 'agma.io', '⚡ 15 Powerup Pack', '15 assorted powerups for extended play', 550, 'https://agma.io/img/store/15ofAll2.png', 1, 0, 0, 0, 'item'],
    ['powerup-30', 'powerup', 'agma.io', '⚡ 30 Powerup Pack', '30 powerups including rare drops', 1000, 'https://agma.io/img/store/30ofAll2.png', 1, 0, 0, 0, 'item'],
    ['powerup-120-defensive', 'powerup', 'agma.io', '🛡️ 120 Defensive Pack', '120 defensive powerups for survival strategy', 4000, 'https://i.ibb.co/r8kfnmj/image.png', 1, 0, 0, 0, 'item'],
    
    // Agma.io - Coins (ONLY 200k and 500k and 1M)
    ['coins-200k', 'currency', 'agma.io', '💰 200k Coins', 'In-game currency for shop purchases', 130, 'https://agma.io/img/buycoins/coin.png', 1, 0, 0, 0, 'item'],
    ['coins-500k', 'currency', 'agma.io', '💰 500k Coins', 'Bulk coin bundle for serious upgrades', 300, 'https://agma.io/img/buycoins/handful.png', 1, 0, 0, 0, 'item'],
    ['coins-1m', 'currency', 'agma.io', '💰 1 Million Coins', 'Massive coin package for maximum value', 550, 'https://agma.io/img/buycoins/bag.png', 1, 0, 0, 0, 'item'],
    
    // Agma.io - Bot Packs (ONLY the 4 specific ones)
    ['bots-100xxl-1hr', 'bots', 'agma.io', '🤖 100 XXL Bots (1 Hour)', 'Massive bots for 1 hour of gameplay', 550, 'https://agma.io/skins/15_lo.png', 1, 0, 0, 0, 'item'],
    ['bots-300-24hr', 'bots', 'agma.io', '🤖 300 Bots (24 Hours)', '300 bots for a full day of grinding', 600, 'https://agma.io/skins/16_lo.png', 1, 0, 0, 0, 'item'],
    ['bots-100xxl-24hr', 'bots', 'agma.io', '🤖 100 XXL Bots (24 Hours)', 'Premium XXL bots for extended play', 1300, 'https://agma.io/skins/37_lo.png?u=1509213499', 1, 0, 0, 0, 'item'],
    ['bots-300-72hr', 'bots', 'agma.io', '🤖 300 Bots (72 Hours)', 'Three days of bot farming with 300 bots', 1700, 'https://agma.io/skins/55_lo.png?u=1509213499', 1, 0, 0, 0, 'item'],
    
    // Agma.io - Gold Membership
    ['gold-1m', 'membership', 'agma.io', '👑 Gold Member (1 Month)', 'Premium perks and exclusive features for 30 days', 340, 'https://i.ibb.co/fG0VGqD3/Agma-io-GMCrown1month.png', 1, 0, 0, 0, 'item'],
    ['gold-3m', 'membership', 'agma.io', '👑 Gold Member (3 Months)', 'Extended premium access for 90 days', 780, 'https://i.ibb.co/rGT6dbQc/Agma-io-GMCrown3months.png', 1, 0, 0, 0, 'item'],
    ['gold-6m', 'membership', 'agma.io', '👑 Gold Member (6 Months)', 'Half-year premium membership with full perks', 1300, 'https://i.ibb.co/j9srmVGp/Agma-io-GMCrown6months.png', 1, 0, 0, 0, 'item'],
    
    // Stream Perks - Priority Picks
    ['priority-pick', 'priority', 'stream', '👑 Priority Pick', 'Choose what I play: server, gamemode, and custom actions', 250, 'https://i.ibb.co/k2jvWT1f/Control.png', 1, 0, 0, 0, 'priority'],
    
    // Stream Perks - 2x Points Boost
    ['2x-points', 'boost', 'stream', '⚡ 2x Points Boost (1 Hour)', 'Double your point earning rate for 60 minutes', 40, 'https://i.ibb.co/k2jvWT1f/Control.png', 1, 0, 0, 0, 'perk']
  ];
  
  seedItems.forEach(item => {
    db.run(`INSERT OR IGNORE INTO items VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, item);
  });
});

module.exports = db;
