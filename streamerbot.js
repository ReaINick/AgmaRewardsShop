require('dotenv').config();
const { StreamerbotClient } = require('@streamerbot/client');
const db = require('./database');

class StreamerbotManager {
  constructor() {
    this.client = null;
    this.connected = false;
    this.connect();
  }

  connect() {
    try {
      this.client = new StreamerbotClient({
        host: process.env.STREAMERBOT_HOST,
        port: parseInt(process.env.STREAMERBOT_PORT),
        password: process.env.STREAMERBOT_PASSWORD
      });

      this.setupListeners();
      console.log('Connecting to Streamer.bot...');
    } catch (err) {
      console.error('Failed to create Streamer.bot client:', err);
    }
  }

  setupListeners() {
    this.client.on('connect', () => {
      console.log('✓ Connected to Streamer.bot!');
      this.connected = true;
    });

    this.client.on('disconnect', () => {
      console.log('✗ Disconnected from Streamer.bot');
      this.connected = false;
    });

    // Listen for all events to see what the points system sends
    this.client.on('*', (event) => {
      console.log('Event received:', event);
      
      // Look for point-related events
      if (event.data && event.data.user && event.data.points !== undefined) {
        this.syncUserPoints(event.data.user, event.data.points);
      }
    });

// Don't crash if Streamer.bot isn't available (e.g., on hosted environments)
client.on('error', (err) => {
  console.error('⚠️ Streamer.bot connection error (this is expected on hosted servers):', err.message);
  isConnected = false;
});


  syncUserPoints(username, points) {
    db.run(`INSERT INTO users (username, points, total_earned) 
            VALUES (?, ?, ?)
            ON CONFLICT(username) 
            DO UPDATE SET points = ?, total_earned = MAX(total_earned, ?)`, 
      [username, points, points, points, points],
      (err) => {
        if (err) console.error('Error syncing points:', err);
        else console.log(`Synced points for ${username}: ${points}`);
      });
  }

  async getUserPoints(username) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
        if (err) reject(err);
        else resolve(row || { username, points: 0 });
      });
    });
  }

  async deductPoints(username, amount) {
    return new Promise((resolve, reject) => {
      db.run('UPDATE users SET points = points - ? WHERE username = ?', 
        [amount, username], 
        function(err) {
          if (err) reject(err);
          else resolve(this.changes > 0);
        });
    });
  }

  async refundPoints(username, amount) {
    return new Promise((resolve, reject) => {
      db.run('UPDATE users SET points = points + ? WHERE username = ?', 
        [amount, username], 
        function(err) {
          if (err) reject(err);
          else resolve(this.changes > 0);
        });
    });
  }

  async activateMultiplier(username, multiplier, durationMinutes) {
    const expiresAt = Date.now() + (durationMinutes * 60 * 1000);
    
    return new Promise((resolve, reject) => {
      db.run(`UPDATE users SET point_multiplier = ?, multiplier_expires = ? 
              WHERE username = ?`, 
        [multiplier, expiresAt, username], 
        function(err) {
          if (err) reject(err);
          else resolve(this.changes > 0);
        });
    });
  }

  async setNameColor(username, color) {
    return new Promise((resolve, reject) => {
      db.run('UPDATE users SET name_color = ? WHERE username = ?', 
        [color, username], 
        function(err) {
          if (err) reject(err);
          else resolve(this.changes > 0);
        });
    });
  }

  async enableSpecialIcon(username) {
    return new Promise((resolve, reject) => {
      db.run('UPDATE users SET has_special_icon = 1 WHERE username = ?', 
        [username], 
        function(err) {
          if (err) reject(err);
          else resolve(this.changes > 0);
        });
    });
  }
}

module.exports = new StreamerbotManager();

