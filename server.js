require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');
const streamerbot = require('./streamerbot');

const app = express();
const PORT = process.env.PORT || 3000;

// Determine callback URL based on environment
const CALLBACK_URL = process.env.NODE_ENV === 'production' 
  ? 'https://agmarewardsshop.onrender.com/auth/google/callback'
  : 'http://localhost:3000/auth/google/callback';

// Middleware
app.use(bodyParser.json());
app.use(express.static('public'));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// Configure Google OAuth Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: CALLBACK_URL,
  scope: ['profile', 'email', 'https://www.googleapis.com/auth/youtube.readonly']
},
async (accessToken, refreshToken, profile, done) => {
  try {
    // Fetch YouTube channel info
    const youtubeResponse = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails&mine=true',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    const youtubeData = await youtubeResponse.json();
    
    // Get the first channel (primary channel)
    const channel = youtubeData.items && youtubeData.items[0];

    const user = {
      id: profile.id,
      googleId: profile.id,
      displayName: profile.displayName,
      email: profile.emails[0].value,
      picture: profile.photos[0].value,
      youtubeChannelId: channel ? channel.id : null,
      youtubeChannelName: channel ? channel.snippet.title : null,
      accessToken: accessToken,
      refreshToken: refreshToken
    };

    return done(null, user);
  } catch (err) {
    console.error('Error fetching YouTube channel:', err);
    // Still return user even if YouTube fetch fails
    const user = {
      id: profile.id,
      googleId: profile.id,
      displayName: profile.displayName,
      email: profile.emails[0].value,
      picture: profile.photos[0].value,
      youtubeChannelId: null,
      youtubeChannelName: null,
      accessToken: accessToken,
      refreshToken: refreshToken
    };
    return done(null, user);
  }
}));

// Serialize/Deserialize user for sessions
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    next();
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
};

// ============ AUTH ROUTES ============

// Start Google OAuth flow with YouTube scope
app.get('/auth/google',
  passport.authenticate('google', {
    scope: ['profile', 'email', 'https://www.googleapis.com/auth/youtube.readonly']
  })
);

// Google OAuth callback
app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/shop.html?auth=failed' }),
  (req, res) => {
    res.redirect('/shop.html?auth=success');
  }
);

// Get current user info
app.get('/api/auth/user', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({
      authenticated: true,
      id: req.user.id,
      googleId: req.user.googleId,
      displayName: req.user.displayName,
      email: req.user.email,
      picture: req.user.picture,
      youtubeChannelId: req.user.youtubeChannelId,
      youtubeChannelName: req.user.youtubeChannelName
    });
  } else {
    res.json({ authenticated: false });
  }
});

// Logout
app.get('/auth/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.redirect('/shop.html');
  });
});

// ============ STREAMER.BOT SYNC ROUTES ============

// Streamer.bot: Update user points (called by Streamer.bot locally)
app.post('/api/streamerbot/update-points', (req, res) => {
  const { username, points, action } = req.body;
  
  if (!username || points === undefined) {
    return res.status(400).json({ error: 'Missing username or points' });
  }
  
  console.log(`[Streamer.bot Sync] ${username}: ${points} points (${action})`);
  
  // Insert or update user in database
  db.run(`INSERT INTO users (username, points, total_earned) 
          VALUES (?, ?, ?)
          ON CONFLICT(username) DO UPDATE SET 
            points = excluded.points,
            total_earned = MAX(total_earned, excluded.total_earned)`,
    [username, points, points],
    (err) => {
      if (err) {
        console.error('Error updating points:', err);
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true, message: `Updated ${username}: ${points} points` });
    });
});

// ============ SHOP API ROUTES ============

// Get shop items by game
app.get('/api/items', (req, res) => {
  const { game, category } = req.query;
  let query = 'SELECT * FROM items WHERE available = 1';
  const params = [];

  if (game) {
    query += ' AND game = ?';
    params.push(game);
  }

  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }

  query += ' ORDER BY trending_score DESC, cost ASC';

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const now = Date.now();
    const items = rows.filter(item => {
      if (item.limited_time && item.expires_at < now) {
        return false;
      }
      return true;
    });
    
    res.json(items);
  });
});

// Get featured items
app.get('/api/items/featured', (req, res) => {
  db.all(`SELECT * FROM items
          WHERE available = 1
          ORDER BY trending_score DESC
          LIMIT 6`,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
});

// Get limited time items
app.get('/api/items/limited', (req, res) => {
  const now = Date.now();
  db.all(`SELECT * FROM items
          WHERE available = 1
          AND limited_time = 1
          AND expires_at > ?
          ORDER BY expires_at ASC`,
    [now],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
});

// Get user points - AUTHENTICATED
app.get('/api/points/:youtubeId', isAuthenticated, async (req, res) => {
  // Verify the YouTube ID matches the authenticated user
  if (req.params.youtubeId !== req.user.youtubeChannelId) {
    return res.status(403).json({ error: 'Cannot access other user points' });
  }

  try {
    const user = await streamerbot.getUserPoints(req.user.youtubeChannelId);
    res.json({
      points: user.points || 0,
      multiplier: user.point_multiplier || 1.0,
      multiplier_expires: user.multiplier_expires || 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit redemption - AUTHENTICATED
app.post('/api/redeem', isAuthenticated, async (req, res) => {
  const { agma_username, item_id, quantity, message, priority_data } = req.body;
  const username = req.user.youtubeChannelId;

  if (!item_id || !quantity) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const item = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM items WHERE id = ?', [item_id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    if (item.game === 'agma.io' && !agma_username) {
      return res.status(400).json({ error: 'Agma.io username required for this item' });
    }

    const totalCost = item.cost * quantity;

    const user = await streamerbot.getUserPoints(username);
    if (user.points < totalCost) {
      return res.status(400).json({ error: 'Insufficient points' });
    }

    await streamerbot.deductPoints(username, totalCost);

    if (item.type === 'perk') {
      if (item.id === '2x-points') {
        await streamerbot.activateMultiplier(username, 2.0, 60);
      }
    }

    const redemptionId = uuidv4();

    // Store the message and priority data
    let storedMessage = message || '';
    if (priority_data) {
      storedMessage = JSON.stringify(priority_data);
    }

    db.run(`INSERT INTO redemptions 
            (id, username, agma_username, item_id, item_name, quantity, cost, message, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [redemptionId, username, agma_username || '', item_id, item.name, quantity, totalCost, storedMessage, Date.now()],
      (err) => {
        if (err) {
          streamerbot.refundPoints(username, totalCost);
          return res.status(500).json({ error: err.message });
        }

        db.run('UPDATE items SET trending_score = trending_score + ? WHERE id = ?', [quantity, item_id]);

        db.run('INSERT INTO history (id, username, item_name, cost, timestamp, status) VALUES (?, ?, ?, ?, ?, ?)',
          [uuidv4(), username, item.name, totalCost, Date.now(), 'pending']);

        res.json({
          success: true,
          redemptionId,
          message: item.type === 'perk' ? 'Perk activated!' : 'Redemption submitted for approval',
          instant: item.type === 'perk'
        });
      });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get redemption history - AUTHENTICATED
app.get('/api/history/:youtubeId', isAuthenticated, (req, res) => {
  if (req.params.youtubeId !== req.user.youtubeChannelId) {
    return res.status(403).json({ error: 'Cannot access other user history' });
  }

  db.all(`SELECT * FROM history
          WHERE username = ?
          ORDER BY timestamp DESC
          LIMIT 50`,
    [req.params.youtubeId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
});

// ============ ADMIN ROUTES ============

// Admin: Get all redemptions
app.get('/api/admin/pending', (req, res) => {
  const { password } = req.query;

  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  db.all(`SELECT * FROM redemptions
          ORDER BY 
            CASE status 
              WHEN 'pending' THEN 1 
              WHEN 'approved' THEN 2 
              WHEN 'rejected' THEN 3 
            END,
            created_at DESC`,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
});

// Admin: Approve redemption
app.post('/api/admin/approve', async (req, res) => {
  const { password, redemptionId } = req.body;

  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const redemption = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM redemptions WHERE id = ?', [redemptionId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    db.run('UPDATE redemptions SET status = "approved", processed_at = ? WHERE id = ?',
      [Date.now(), redemptionId]);

    db.run('UPDATE history SET status = "approved" WHERE username = ? AND item_name = ? AND status = "pending"',
      [redemption.username, redemption.item_name]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Reject redemption
app.post('/api/admin/reject', async (req, res) => {
  const { password, redemptionId } = req.body;

  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const redemption = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM redemptions WHERE id = ?', [redemptionId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    await streamerbot.refundPoints(redemption.username, redemption.cost);

    db.run('UPDATE redemptions SET status = "rejected", processed_at = ? WHERE id = ?',
      [Date.now(), redemptionId]);

    db.run('UPDATE history SET status = "rejected" WHERE username = ? AND item_name = ? AND status = "pending"',
      [redemption.username, redemption.item_name]);

    res.json({ success: true, message: 'Points refunded' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ START SERVER ============

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🎮 Agma Rewards Shop running on port ${PORT}`);
  console.log(`📊 Admin panel available at /admin.html`);
  console.log(`🔐 OAuth ready with YouTube authentication`);
  console.log(`🤖 Streamer.bot sync endpoint: POST /api/streamerbot/update-points\n`);
});
