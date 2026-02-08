const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const express = require('express');
const axios = require('axios');

let mainWindow;
let authWindow;
let authServer;
let spotifyTokens = null;
const CLIENT_ID = 'YOUR_SPOTIFY_CLIENT_ID'; // Users need to replace this
const REDIRECT_URI = 'http://localhost:8888/callback';
const SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing'
].join(' ');

// Start local server for OAuth callback
function startAuthServer() {
  const serverApp = express();
  
  serverApp.get('/callback', async (req, res) => {
    const code = req.query.code;
    
    if (code) {
      try {
        // Exchange code for tokens
        const response = await axios.post('https://accounts.spotify.com/api/token', 
          new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: REDIRECT_URI,
            client_id: CLIENT_ID,
            client_secret: 'YOUR_SPOTIFY_CLIENT_SECRET' // Users need to replace this
          }), {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          }
        );
        
        spotifyTokens = response.data;
        res.send('<h1>Authentication successful! You can close this window.</h1>');
        
        if (authWindow) {
          authWindow.close();
        }
        
        mainWindow.webContents.send('auth-success', spotifyTokens);
      } catch (error) {
        console.error('Token exchange error:', error);
        res.send('<h1>Authentication failed!</h1>');
      }
    } else {
      res.send('<h1>No authorization code received!</h1>');
    }
  });
  
  authServer = serverApp.listen(8888, () => {
    console.log('Auth server running on port 8888');
  });
}

// Refresh token
async function refreshAccessToken() {
  if (!spotifyTokens || !spotifyTokens.refresh_token) {
    return null;
  }
  
  try {
    const response = await axios.post('https://accounts.spotify.com/api/token',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: spotifyTokens.refresh_token,
        client_id: CLIENT_ID,
        client_secret: 'YOUR_SPOTIFY_CLIENT_SECRET' // Users need to replace this
      }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    spotifyTokens.access_token = response.data.access_token;
    return spotifyTokens;
  } catch (error) {
    console.error('Token refresh error:', error);
    return null;
  }
}

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  
  mainWindow = new BrowserWindow({
    width: 300,
    height: 150,
    x: width - 320,
    y: height - 170,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  
  // Uncomment for debugging
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  startAuthServer();
  createWindow();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (authServer) {
    authServer.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers
ipcMain.handle('start-auth', () => {
  const authUrl = `https://accounts.spotify.com/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES)}`;
  
  authWindow = new BrowserWindow({
    width: 500,
    height: 700,
    webPreferences: {
      nodeIntegration: false
    }
  });
  
  authWindow.loadURL(authUrl);
});

ipcMain.handle('get-current-playback', async () => {
  if (!spotifyTokens) {
    return { error: 'Not authenticated' };
  }
  
  try {
    const response = await axios.get('https://api.spotify.com/v1/me/player', {
      headers: {
        'Authorization': `Bearer ${spotifyTokens.access_token}`
      }
    });
    
    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 401) {
      // Token expired, try to refresh
      const newTokens = await refreshAccessToken();
      if (newTokens) {
        return ipcMain.handle('get-current-playback');
      }
    }
    return { error: error.message };
  }
});

ipcMain.handle('next-track', async () => {
  if (!spotifyTokens) return { error: 'Not authenticated' };
  
  try {
    await axios.post('https://api.spotify.com/v1/me/player/next', {}, {
      headers: {
        'Authorization': `Bearer ${spotifyTokens.access_token}`
      }
    });
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
});

ipcMain.handle('previous-track', async () => {
  if (!spotifyTokens) return { error: 'Not authenticated' };
  
  try {
    await axios.post('https://api.spotify.com/v1/me/player/previous', {}, {
      headers: {
        'Authorization': `Bearer ${spotifyTokens.access_token}`
      }
    });
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
});

ipcMain.handle('toggle-play-pause', async () => {
  if (!spotifyTokens) return { error: 'Not authenticated' };
  
  try {
    // Get current state first
    const state = await axios.get('https://api.spotify.com/v1/me/player', {
      headers: {
        'Authorization': `Bearer ${spotifyTokens.access_token}`
      }
    });
    
    const isPlaying = state.data.is_playing;
    const endpoint = isPlaying ? 'pause' : 'play';
    
    await axios.put(`https://api.spotify.com/v1/me/player/${endpoint}`, {}, {
      headers: {
        'Authorization': `Bearer ${spotifyTokens.access_token}`
      }
    });
    
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
});

ipcMain.handle('get-lyrics', async (event, trackId) => {
  // Note: Spotify's lyrics API requires special access
  // This is a placeholder - users would need to implement their own solution
  return { error: 'Lyrics API not available in this version' };
});

ipcMain.handle('set-window-lock', (event, locked) => {
  if (mainWindow) {
    mainWindow.setIgnoreMouseEvents(locked, { forward: true });
  }
});

ipcMain.handle('set-window-size', (event, width, height) => {
  if (mainWindow) {
    mainWindow.setSize(width, height);
  }
});

ipcMain.handle('set-window-opacity', (event, opacity) => {
  if (mainWindow) {
    mainWindow.setOpacity(opacity);
  }
});