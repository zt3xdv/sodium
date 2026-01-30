window.sodiumOAuth = {
  google: function() {
    console.log('[OAuth] Google login initiated');
    const clientId = window.sodiumPluginSettings?.['example-plugin']?.google_client_id;
    if (!clientId) {
      alert('Google OAuth not configured. Please set Client ID in plugin settings.');
      return;
    }
    const redirectUri = encodeURIComponent(window.location.origin + '/auth/callback/google');
    const scope = encodeURIComponent('email profile');
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
  },
  
  discord: function() {
    console.log('[OAuth] Discord login initiated');
    const clientId = window.sodiumPluginSettings?.['example-plugin']?.discord_client_id;
    if (!clientId) {
      alert('Discord OAuth not configured. Please set Client ID in plugin settings.');
      return;
    }
    const redirectUri = encodeURIComponent(window.location.origin + '/auth/callback/discord');
    const scope = encodeURIComponent('identify email');
    window.location.href = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
  },
  
  github: function() {
    console.log('[OAuth] GitHub login initiated');
    const clientId = window.sodiumPluginSettings?.['example-plugin']?.github_client_id;
    if (!clientId) {
      alert('GitHub OAuth not configured. Please set Client ID in plugin settings.');
      return;
    }
    const redirectUri = encodeURIComponent(window.location.origin + '/auth/callback/github');
    const scope = encodeURIComponent('user:email');
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}`;
  }
};

console.log('[Example Plugin] OAuth handlers registered');
