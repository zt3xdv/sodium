import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { loadUsers, saveUsers, loadConfig } from '../db.js';
import { validateUsername, sanitizeText, generateUUID, generateToken } from '../utils/helpers.js';
import { JWT_SECRET, authenticateUser } from '../utils/auth.js';
import { rateLimit } from '../utils/rate-limiter.js';
import { logActivity, ACTIVITY_TYPES } from '../utils/activity.js';
import { sendVerificationEmail, send2FACode, sendPasswordReset, getTransporter } from '../utils/mail.js';

const router = express.Router();

// OAuth provider configurations
const OAUTH_CONFIGS = {
  discord: {
    authorize_url: 'https://discord.com/api/oauth2/authorize',
    token_url: 'https://discord.com/api/oauth2/token',
    userinfo_url: 'https://discord.com/api/users/@me',
    scopes: 'identify email'
  },
  google: {
    authorize_url: 'https://accounts.google.com/o/oauth2/v2/auth',
    token_url: 'https://oauth2.googleapis.com/token',
    userinfo_url: 'https://www.googleapis.com/oauth2/v2/userinfo',
    scopes: 'openid email profile'
  },
  github: {
    authorize_url: 'https://github.com/login/oauth/authorize',
    token_url: 'https://github.com/login/oauth/access_token',
    userinfo_url: 'https://api.github.com/user',
    scopes: 'read:user user:email'
  },
  gitlab: {
    authorize_url: 'https://gitlab.com/oauth/authorize',
    token_url: 'https://gitlab.com/oauth/token',
    userinfo_url: 'https://gitlab.com/api/v4/user',
    scopes: 'read_user'
  },
  microsoft: {
    authorize_url: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    token_url: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userinfo_url: 'https://graph.microsoft.com/v1.0/me',
    scopes: 'openid email profile User.Read'
  },
  twitter: {
    authorize_url: 'https://twitter.com/i/oauth2/authorize',
    token_url: 'https://api.twitter.com/2/oauth2/token',
    userinfo_url: 'https://api.twitter.com/2/users/me',
    scopes: 'users.read tweet.read'
  },
  facebook: {
    authorize_url: 'https://www.facebook.com/v18.0/dialog/oauth',
    token_url: 'https://graph.facebook.com/v18.0/oauth/access_token',
    userinfo_url: 'https://graph.facebook.com/v18.0/me?fields=id,name,email,picture',
    scopes: 'email public_profile'
  },
  apple: {
    authorize_url: 'https://appleid.apple.com/auth/authorize',
    token_url: 'https://appleid.apple.com/auth/token',
    userinfo_url: null,
    scopes: 'name email'
  },
  twitch: {
    authorize_url: 'https://id.twitch.tv/oauth2/authorize',
    token_url: 'https://id.twitch.tv/oauth2/token',
    userinfo_url: 'https://api.twitch.tv/helix/users',
    scopes: 'user:read:email'
  },
  slack: {
    authorize_url: 'https://slack.com/oauth/v2/authorize',
    token_url: 'https://slack.com/api/oauth.v2.access',
    userinfo_url: 'https://slack.com/api/users.identity',
    scopes: 'identity.basic identity.email identity.avatar'
  },
  linkedin: {
    authorize_url: 'https://www.linkedin.com/oauth/v2/authorization',
    token_url: 'https://www.linkedin.com/oauth/v2/accessToken',
    userinfo_url: 'https://api.linkedin.com/v2/userinfo',
    scopes: 'openid profile email'
  },
  spotify: {
    authorize_url: 'https://accounts.spotify.com/authorize',
    token_url: 'https://accounts.spotify.com/api/token',
    userinfo_url: 'https://api.spotify.com/v1/me',
    scopes: 'user-read-email user-read-private'
  },
  reddit: {
    authorize_url: 'https://www.reddit.com/api/v1/authorize',
    token_url: 'https://www.reddit.com/api/v1/access_token',
    userinfo_url: 'https://oauth.reddit.com/api/v1/me',
    scopes: 'identity'
  },
  bitbucket: {
    authorize_url: 'https://bitbucket.org/site/oauth2/authorize',
    token_url: 'https://bitbucket.org/site/oauth2/access_token',
    userinfo_url: 'https://api.bitbucket.org/2.0/user',
    scopes: 'account email'
  }
};

const authLimiter = rateLimit({ windowMs: 60000, max: 5, message: 'Too many attempts, try again later' });

function generate2FACode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

router.post('/register', authLimiter, async (req, res) => {
  const { username, password, email } = req.body;
  
  const config = loadConfig();
  if (!config.registration?.enabled) {
    return res.status(403).json({ error: 'Registration is currently disabled' });
  }
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  
  const requireEmail = config.registration?.emailVerification;
  if (requireEmail && !email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  
  if (!validateUsername(username)) {
    return res.status(400).json({ error: 'Username must be 3-20 characters (letters, numbers, underscore only)' });
  }
  
  if (typeof password !== 'string' || password.length < 6 || password.length > 128) {
    return res.status(400).json({ error: 'Password must be between 6 and 128 characters' });
  }
  
  const data = loadUsers();
  const existingUser = data.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  
  if (existingUser) {
    return res.status(400).json({ error: 'Username already exists' });
  }
  
  if (email) {
    const existingEmail = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (existingEmail) {
      return res.status(400).json({ error: 'Email already in use' });
    }
  }
  
  const hashedPassword = await bcrypt.hash(password, 10);
  const defaults = config.defaults || {};
  const isFirstUser = data.users.length === 0;
  
  const verificationToken = requireEmail ? generateToken() : null;
  const newUser = {
    id: generateUUID(),
    username: sanitizeText(username),
    email: email || null,
    password: hashedPassword,
    displayName: sanitizeText(username),
    bio: '',
    avatar: '',
    links: {},
    isAdmin: isFirstUser,
    emailVerified: !requireEmail || isFirstUser,
    verificationToken: verificationToken,
    verificationTokenExpires: verificationToken ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null,
    limits: {
      servers: defaults.servers,
      memory: defaults.memory,
      disk: defaults.disk,
      cpu: defaults.cpu,
      allocations: defaults.allocations,
    },
    createdAt: new Date().toISOString(),
    settings: {
      theme: 'dark',
      notifications: true,
      privacy: 'public'
    }
  };
  
  data.users.push(newUser);
  saveUsers(data);
  
  // Send verification email if required and mail is configured
  if (requireEmail && email && verificationToken && getTransporter()) {
    try {
      await sendVerificationEmail(email, newUser.username, verificationToken);
    } catch (e) {
      console.error('Failed to send verification email:', e.message);
    }
  }
  
  const { password: _, verificationToken: __, ...userWithoutPassword } = newUser;
  const token = jwt.sign(
    { id: newUser.id, username: newUser.username, isAdmin: newUser.isAdmin },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  
  logActivity(newUser.id, ACTIVITY_TYPES.LOGIN, { method: 'register' }, req.ip);
  
  res.json({ 
    success: true, 
    user: userWithoutPassword, 
    token,
    emailVerificationRequired: requireEmail && !newUser.emailVerified
  });
});

// Public registration config endpoint (no auth required)
router.get('/config', (req, res) => {
  const config = loadConfig();
  res.json({
    registration: {
      enabled: config.registration?.enabled || false,
      emailVerification: config.registration?.emailVerification || false
    },
    panel: {
      name: config.panel?.name || 'Sodium Panel'
    }
  });
});

router.post('/login', authLimiter, async (req, res) => {
  const { username, password, twoFactorCode } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  
  const data = loadUsers();
  const user = data.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const isValidPassword = await bcrypt.compare(password, user.password);
  
  if (!isValidPassword) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const config = loadConfig();
  const require2fa = config.security?.require2fa;
  const require2faAdmin = config.security?.require2faAdmin;
  
  // Check if 2FA is required for this user (global setting, admin setting, or user preference)
  const needs2FA = require2fa || (require2faAdmin && user.isAdmin) || user.twoFactorEnabled;
  
  if (needs2FA && user.email && user.emailVerified) {
    // If 2FA code provided, verify it
    if (twoFactorCode) {
      if (!user.twoFactorCode || !user.twoFactorExpires) {
        return res.status(400).json({ error: 'No verification code pending. Please request a new code.', codeExpired: true });
      }
      
      if (new Date(user.twoFactorExpires) < new Date()) {
        return res.status(400).json({ error: 'Verification code expired. Please request a new code.', codeExpired: true });
      }
      
      if (user.twoFactorCode !== twoFactorCode) {
        return res.status(400).json({ error: 'Invalid verification code' });
      }
      
      // Clear 2FA code after successful verification
      user.twoFactorCode = null;
      user.twoFactorExpires = null;
      saveUsers(data);
    } else {
      // No code provided, send one and return pending status
      const code = generate2FACode();
      user.twoFactorCode = code;
      user.twoFactorExpires = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      saveUsers(data);
      
      try {
        await send2FACode(user.email, user.username, code);
      } catch (e) {
        console.error('Failed to send 2FA code:', e.message);
        return res.status(500).json({ error: 'Failed to send verification code' });
      }
      
      return res.json({ 
        success: false, 
        requires2FA: true, 
        message: 'Verification code sent to your email'
      });
    }
  }
  
  const { password: _, twoFactorCode: __, twoFactorExpires: ___, ...userWithoutSensitive } = user;
  const token = jwt.sign(
    { id: user.id, username: user.username, isAdmin: user.isAdmin },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  
  logActivity(user.id, ACTIVITY_TYPES.LOGIN, { method: 'password' }, req.ip);
  
  res.json({ success: true, user: userWithoutSensitive, token });
});

router.post('/2fa/resend', authLimiter, async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  
  const data = loadUsers();
  const user = data.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const isValidPassword = await bcrypt.compare(password, user.password);
  
  if (!isValidPassword) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  if (!user.email || !user.emailVerified) {
    return res.status(400).json({ error: 'Email not verified' });
  }
  
  if (!getTransporter()) {
    return res.status(500).json({ error: 'Mail service not configured' });
  }
  
  const code = generate2FACode();
  user.twoFactorCode = code;
  user.twoFactorExpires = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  saveUsers(data);
  
  try {
    await send2FACode(user.email, user.username, code);
    res.json({ success: true, message: 'Verification code sent' });
  } catch (e) {
    console.error('Failed to send 2FA code:', e.message);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});

// ==================== OAUTH ====================

// Get enabled OAuth providers for login page
router.get('/oauth/providers', (req, res) => {
  const config = loadConfig();
  const providers = (config.oauth?.providers || []).filter(p => p.enabled);
  
  res.json({
    providers: providers.map(p => ({
      id: p.id,
      name: p.name,
      type: p.type
    }))
  });
});

// Initiate OAuth flow
router.get('/oauth/:providerId', (req, res) => {
  const config = loadConfig();
  const provider = (config.oauth?.providers || []).find(p => p.id === req.params.providerId && p.enabled);
  
  if (!provider) {
    return res.status(404).json({ error: 'OAuth provider not found or disabled' });
  }
  
  const oauthConfig = OAUTH_CONFIGS[provider.type] || {};
  const authorizeUrl = provider.authorize_url || oauthConfig.authorize_url;
  const scopes = provider.scopes || oauthConfig.scopes;
  
  if (!authorizeUrl || !provider.client_id) {
    return res.status(400).json({ error: 'OAuth provider not configured properly' });
  }
  
  const panelUrl = config.panel?.url || `${req.protocol}://${req.get('host')}`;
  const redirectUri = `${panelUrl}/api/auth/oauth/${provider.id}/callback`;
  const state = generateUUID();
  
  // Store state in session or temporary storage
  res.cookie('oauth_state', state, { httpOnly: true, maxAge: 600000 });
  
  const params = new URLSearchParams({
    client_id: provider.client_id,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes,
    state: state
  });
  
  res.redirect(`${authorizeUrl}?${params.toString()}`);
});

// OAuth callback
router.get('/oauth/:providerId/callback', async (req, res) => {
  const { code, state } = req.query;
  const storedState = req.cookies?.oauth_state;
  
  if (!code) {
    return res.redirect('/auth?error=oauth_failed');
  }
  
  if (state !== storedState) {
    return res.redirect('/auth?error=invalid_state');
  }
  
  const config = loadConfig();
  const provider = (config.oauth?.providers || []).find(p => p.id === req.params.providerId && p.enabled);
  
  if (!provider) {
    return res.redirect('/auth?error=provider_not_found');
  }
  
  const oauthConfig = OAUTH_CONFIGS[provider.type] || {};
  const tokenUrl = provider.token_url || oauthConfig.token_url;
  const userinfoUrl = provider.userinfo_url || oauthConfig.userinfo_url;
  const panelUrl = config.panel?.url || `${req.protocol}://${req.get('host')}`;
  const redirectUri = `${panelUrl}/api/auth/oauth/${provider.id}/callback`;
  
  try {
    // Exchange code for token
    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        client_id: provider.client_id,
        client_secret: provider.client_secret,
        code: code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });
    
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    
    if (!accessToken) {
      return res.redirect('/auth?error=token_failed');
    }
    
    // Get user info
    const userRes = await fetch(userinfoUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });
    
    const userData = await userRes.json();
    
    // Extract user info based on provider type
    let oauthId, email, username, displayName, avatar;
    
    switch (provider.type) {
      case 'discord':
        oauthId = userData.id;
        email = userData.email;
        username = userData.username;
        displayName = userData.global_name || userData.username;
        avatar = userData.avatar ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png` : null;
        break;
      case 'google':
        oauthId = userData.id;
        email = userData.email;
        username = userData.email?.split('@')[0];
        displayName = userData.name;
        avatar = userData.picture;
        break;
      case 'github':
        oauthId = String(userData.id);
        email = userData.email;
        username = userData.login;
        displayName = userData.name || userData.login;
        avatar = userData.avatar_url;
        break;
      case 'gitlab':
        oauthId = String(userData.id);
        email = userData.email;
        username = userData.username;
        displayName = userData.name;
        avatar = userData.avatar_url;
        break;
      case 'microsoft':
        oauthId = userData.id;
        email = userData.mail || userData.userPrincipalName;
        username = userData.userPrincipalName?.split('@')[0] || userData.displayName;
        displayName = userData.displayName;
        avatar = null;
        break;
      case 'twitter':
        oauthId = userData.data?.id;
        email = null;
        username = userData.data?.username;
        displayName = userData.data?.name;
        avatar = userData.data?.profile_image_url;
        break;
      case 'facebook':
        oauthId = userData.id;
        email = userData.email;
        username = userData.email?.split('@')[0] || `fb_${userData.id}`;
        displayName = userData.name;
        avatar = userData.picture?.data?.url;
        break;
      case 'apple':
        oauthId = userData.sub;
        email = userData.email;
        username = userData.email?.split('@')[0] || `apple_${userData.sub?.substring(0, 8)}`;
        displayName = userData.name ? `${userData.name.firstName} ${userData.name.lastName}` : username;
        avatar = null;
        break;
      case 'twitch':
        oauthId = userData.data?.[0]?.id;
        email = userData.data?.[0]?.email;
        username = userData.data?.[0]?.login;
        displayName = userData.data?.[0]?.display_name;
        avatar = userData.data?.[0]?.profile_image_url;
        break;
      case 'slack':
        oauthId = userData.user?.id;
        email = userData.user?.email;
        username = userData.user?.name;
        displayName = userData.user?.real_name || userData.user?.name;
        avatar = userData.user?.image_192;
        break;
      case 'linkedin':
        oauthId = userData.sub;
        email = userData.email;
        username = userData.email?.split('@')[0];
        displayName = userData.name;
        avatar = userData.picture;
        break;
      case 'spotify':
        oauthId = userData.id;
        email = userData.email;
        username = userData.id;
        displayName = userData.display_name;
        avatar = userData.images?.[0]?.url;
        break;
      case 'reddit':
        oauthId = userData.id;
        email = null;
        username = userData.name;
        displayName = userData.subreddit?.title || userData.name;
        avatar = userData.icon_img?.split('?')[0];
        break;
      case 'bitbucket':
        oauthId = userData.uuid;
        email = null;
        username = userData.username;
        displayName = userData.display_name;
        avatar = userData.links?.avatar?.href;
        break;
      default:
        oauthId = userData.id || userData.sub;
        email = userData.email;
        username = userData.username || userData.login || userData.preferred_username;
        displayName = userData.name || userData.display_name || username;
        avatar = userData.avatar || userData.picture || userData.avatar_url;
    }
    
    if (!oauthId) {
      return res.redirect('/auth?error=userinfo_failed');
    }
    
    const data = loadUsers();
    
    // Check if user exists with this OAuth connection
    let user = data.users.find(u => 
      u.oauth_connections?.some(c => c.provider_id === provider.id && c.oauth_id === oauthId)
    );
    
    if (!user && email) {
      // Check if user exists with this email (for linking)
      user = data.users.find(u => u.email === email);
    }
    
    if (user) {
      // Update OAuth connection if needed
      if (!user.oauth_connections) user.oauth_connections = [];
      const existingConnection = user.oauth_connections.find(c => c.provider_id === provider.id);
      if (!existingConnection) {
        user.oauth_connections.push({
          provider_id: provider.id,
          provider_type: provider.type,
          oauth_id: oauthId,
          connected_at: new Date().toISOString()
        });
        saveUsers(data);
      }
    } else {
      // Create new user
      const defaults = config.defaults || {};
      const safeUsername = sanitizeText(username || `user_${oauthId.substring(0, 8)}`);
      
      // Ensure unique username
      let finalUsername = safeUsername;
      let counter = 1;
      while (data.users.some(u => u.username.toLowerCase() === finalUsername.toLowerCase())) {
        finalUsername = `${safeUsername}${counter++}`;
      }
      
      user = {
        id: generateUUID(),
        username: finalUsername,
        password: null, // OAuth users don't have password
        email: email || null,
        displayName: sanitizeText(displayName || finalUsername),
        avatar: avatar || '',
        bio: '',
        links: {},
        isAdmin: data.users.length === 0,
        emailVerified: true, // OAuth emails are pre-verified by provider
        limits: {
          servers: defaults.servers || 2,
          memory: defaults.memory || 2048,
          disk: defaults.disk || 10240,
          cpu: defaults.cpu || 200
        },
        oauth_connections: [{
          provider_id: provider.id,
          provider_type: provider.type,
          oauth_id: oauthId,
          connected_at: new Date().toISOString()
        }],
        createdAt: new Date().toISOString(),
        settings: {
          theme: 'dark',
          notifications: true,
          privacy: 'public'
        }
      };
      
      data.users.push(user);
      saveUsers(data);
    }
    
    // Generate JWT
    const token = jwt.sign(
      { id: user.id, username: user.username, isAdmin: user.isAdmin },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    logActivity(user.id, ACTIVITY_TYPES.LOGIN, { method: 'oauth', provider: provider.name }, req.ip);
    
    // Clear oauth state cookie
    res.clearCookie('oauth_state');
    
    // Redirect to frontend with token
    res.redirect(`/auth/callback?token=${token}`);
    
  } catch (e) {
    console.error('OAuth error:', e);
    res.redirect('/auth?error=oauth_failed');
  }
});

// ==================== EMAIL VERIFICATION ====================

router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  
  if (!token) {
    return res.status(400).json({ error: 'Verification token required' });
  }
  
  const data = loadUsers();
  const user = data.users.find(u => u.verificationToken === token);
  
  if (!user) {
    return res.status(400).json({ error: 'Invalid verification token' });
  }
  
  if (user.emailVerified) {
    return res.json({ success: true, message: 'Email already verified' });
  }
  
  if (user.verificationTokenExpires && new Date(user.verificationTokenExpires) < new Date()) {
    return res.status(400).json({ error: 'Verification token expired' });
  }
  
  user.emailVerified = true;
  user.verificationToken = null;
  user.verificationTokenExpires = null;
  saveUsers(data);
  
  logActivity(user.id, ACTIVITY_TYPES.SETTINGS_CHANGE, { action: 'email_verified' }, req.ip);
  
  res.json({ success: true, message: 'Email verified successfully' });
});

router.post('/resend-verification', authenticateUser, async (req, res) => {
  const data = loadUsers();
  const user = data.users.find(u => u.id === req.user.id);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  if (user.emailVerified) {
    return res.status(400).json({ error: 'Email already verified' });
  }
  
  if (!user.email) {
    return res.status(400).json({ error: 'No email address on file' });
  }
  
  if (!getTransporter()) {
    return res.status(500).json({ error: 'Mail service not configured' });
  }
  
  // Generate new token
  const verificationToken = generateToken();
  user.verificationToken = verificationToken;
  user.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  saveUsers(data);
  
  try {
    await sendVerificationEmail(user.email, user.username, verificationToken);
    res.json({ success: true, message: 'Verification email sent' });
  } catch (e) {
    console.error('Failed to send verification email:', e.message);
    res.status(500).json({ error: 'Failed to send verification email' });
  }
});

router.get('/verification-status', authenticateUser, (req, res) => {
  const config = loadConfig();
  const data = loadUsers();
  const user = data.users.find(u => u.id === req.user.id);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  res.json({
    emailVerificationRequired: config.registration?.emailVerification || false,
    emailVerified: user.emailVerified || false,
    email: user.email || null
  });
});

// ==================== PASSWORD RESET ====================

const resetLimiter = rateLimit({ windowMs: 60000, max: 3, message: 'Too many reset attempts, try again later' });

router.post('/forgot-password', resetLimiter, async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  
  const data = loadUsers();
  const user = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
  
  // Always return success to prevent email enumeration
  if (!user) {
    return res.json({ success: true, message: 'If an account with that email exists, a reset link has been sent.' });
  }
  
  // OAuth users don't have passwords - return same message to prevent enumeration
  if (!user.password) {
    return res.json({ success: true, message: 'If an account with that email exists, a reset link has been sent.' });
  }
  
  if (!getTransporter()) {
    return res.status(500).json({ error: 'Mail service not configured' });
  }
  
  // Generate reset token
  const resetToken = generateToken();
  user.resetToken = resetToken;
  user.resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
  saveUsers(data);
  
  try {
    const config = loadConfig();
    const panelUrl = config.panel?.url || `${req.protocol}://${req.get('host')}`;
    await sendPasswordReset(user.email, user.username, resetToken, panelUrl);
    
    logActivity(user.id, ACTIVITY_TYPES.SETTINGS_CHANGE, { action: 'password_reset_requested' }, req.ip);
    
    res.json({ success: true, message: 'If an account with that email exists, a reset link has been sent.' });
  } catch (e) {
    console.error('Failed to send password reset email:', e.message);
    res.status(500).json({ error: 'Failed to send reset email' });
  }
});

router.get('/reset-password/validate', (req, res) => {
  const { token } = req.query;
  
  if (!token) {
    return res.status(400).json({ error: 'Reset token required' });
  }
  
  const data = loadUsers();
  const user = data.users.find(u => u.resetToken === token);
  
  if (!user) {
    return res.status(400).json({ error: 'Invalid reset token' });
  }
  
  if (user.resetTokenExpires && new Date(user.resetTokenExpires) < new Date()) {
    return res.status(400).json({ error: 'Reset token expired' });
  }
  
  res.json({ valid: true, username: user.username });
});

router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  
  if (!token || !password) {
    return res.status(400).json({ error: 'Token and password are required' });
  }
  
  if (typeof password !== 'string' || password.length < 6 || password.length > 128) {
    return res.status(400).json({ error: 'Password must be between 6 and 128 characters' });
  }
  
  const data = loadUsers();
  const user = data.users.find(u => u.resetToken === token);
  
  if (!user) {
    return res.status(400).json({ error: 'Invalid reset token' });
  }
  
  if (user.resetTokenExpires && new Date(user.resetTokenExpires) < new Date()) {
    return res.status(400).json({ error: 'Reset token expired' });
  }
  
  // Update password
  user.password = await bcrypt.hash(password, 10);
  user.resetToken = null;
  user.resetTokenExpires = null;
  saveUsers(data);
  
  logActivity(user.id, ACTIVITY_TYPES.SETTINGS_CHANGE, { action: 'password_reset_completed' }, req.ip);
  
  res.json({ success: true, message: 'Password reset successfully' });
});

export default router;
