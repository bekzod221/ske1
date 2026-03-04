// mock-auth-server.js (handles multiple slashes)
const express = require('express');
const app = express();
const PORT = 3000;

app.use(express.json());

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    next();
});

// This will match /api/auth, /api/auth/, /api/auth////, etc.
app.post('/api/auh', (req, res) => {
    setTimeout(() => {
        res.status(200).json({
            status: "success",
            expiresAt: "31.12.2027 23:59:59"
        });
    }, 100);
});

app.post('/api/pin', (req, res) => {
    setTimeout(() => {
        res.status(200).json({
            status: "success",
            expiresAt: "31.12.2027 23:59:59",
            aDdmmyyyyHhmmss: "31.12.2027 23:59:59"
        });
    }, 100);
});

// Also match with regex pattern to catch any variations
app.post(/^\/api\/auth\/{0,}$/, (req, res) => {
    setTimeout(() => {
        res.status(200).json({
            status: "success",
            expiresAt: "31.12.2027 23:59:59"
        });
    }, 100);
});

app.get('/ping', (req, res) => {
    res.send("OK")
})

// Alternative: Use a middleware to normalize the path
app.use((req, res, next) => {
    // Normalize multiple slashes to a single slash
    req.url = req.url.replace(/\/+/g, '/');
    next();
});

// Catch-all route for unmatched paths
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});
const old = '192.168.100.90'
const deploy = '0.0.0.0'

app.listen(PORT, deploy, () => {
    console.log(`Mock auth server running on http://192.168.100.90:${PORT}`);
    console.log(`Listening for POST requests to /api/auth (with any number of slashes)`);
});