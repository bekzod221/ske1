// mock-auth-server.js (handles multiple slashes)
const express = require('express');
const app = express();
const PORT = 3000;
const fs = require("fs/promises")
const path = require("path")

app.use(express.json());

// Helper function to parse date string "DD.MM.YYYY HH:MM:SS"
const parseDate = (dateStr) => {
    const [datePart, timePart] = dateStr.split(' ');
    const [day, month, year] = datePart.split('.');
    const [hours, minutes, seconds] = timePart.split(':');
    return new Date(year, month - 1, day, hours, minutes, seconds);
};

// Helper function to format date to "DD.MM.YYYY HH:MM:SS"
const formatDate = (date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
};

// Helper function to parse duration like "2d", "3h", etc.
const parseDuration = (durationStr) => {
    const match = durationStr.match(/^(\d+)([dhms])$/);
    if (!match) throw new Error('Invalid duration format (use: 1d, 2h, 30m, 60s)');
    
    const [, value, unit] = match;
    const amount = parseInt(value);
    
    switch(unit) {
        case 'd': return amount * 24 * 60 * 60 * 1000; // days to ms
        case 'h': return amount * 60 * 60 * 1000; // hours to ms
        case 'm': return amount * 60 * 1000; // minutes to ms
        case 's': return amount * 1000; // seconds to ms
        default: throw new Error('Invalid duration unit');
    }
};

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

app.post('/verifyformlbbcrack', () => {
    // Log incoming data for debugging
    console.log('Received validation request:');
    console.log('Body:', req.body); // requires urlencoded parser

    // Always return a successful response
    res.status(200).json({
        status: "secretsuccess",
        expires: "2027-12-31 23:59:59",   // yyyy-MM-dd HH:mm:ss format
        game: "MLBB",
        message: "OK"
    });
})

app.get("/showall", async (req, res)=> {
    const data = await fs.readFile('db/server.json', 'utf-8')
    const jsonData = JSON.parse(data)
    res.json(jsonData)
})

app.post("/verify", async (req, res) => { 
    const body = req.body;
    const data = await fs.readFile('db/server.json', 'utf-8')
    const db = JSON.parse(data)
    const {hwid, key} = req.body

    // Find the item with matching key
    const matchedItem = db.find(item => item.key == key);
    
    if (!matchedItem) {
        // Key not found
        return res.status(404).json({status: "error"});
    }
    
    // Check if key is expired
    const expiryDate = parseDate(matchedItem.expiresAt);
    if (new Date() > expiryDate) {
        return res.status(401).json({status: "error", message: "Key expired"});
    }
    
    // Key is matched, check if hwid is empty
    if (matchedItem.hwid === "" || matchedItem.hwid === null || matchedItem.hwid === undefined) {
        // hwid is empty, update it with req.body hwid
        matchedItem.hwid = hwid;
        // Write back to db
        await fs.writeFile('db/server.json', JSON.stringify(db, null, 2), 'utf-8');
        return res.status(200).json({status: "success"});
    } else {
        // hwid is not empty, compare with req.body hwid
        if (matchedItem.hwid === hwid) {
            // Both match
            return res.status(200).json({status: "success"});
        } else {
            // hwid doesn't match
            return res.status(404).json({status: "error"});
        }
    }
});

app.post("/create", async (req, res) => {
    try {
        const {key, duration} = req.body;
        
        if (!key || !duration) {
            return res.status(400).json({status: "error", message: "key and duration are required"});
        }
        
        const data = await fs.readFile('db/server.json', 'utf-8');
        const db = JSON.parse(data);
        
        // Check if key already exists
        if (db.find(item => item.key === key)) {
            return res.status(400).json({status: "error", message: "Key already exists"});
        }
        
        // Parse duration and calculate expiry date
        const durationMs = parseDuration(duration);
        const expiryDate = new Date(Date.now() + durationMs);
        const formattedDate = formatDate(expiryDate);
        
        // Create new item with unique id
        const id = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newItem = {
            id: id,
            key: key,
            hwid: "",
            expiresAt: formattedDate
        };
        
        db.push(newItem);
        await fs.writeFile('db/server.json', JSON.stringify(db, null, 2), 'utf-8');
        
        return res.status(201).json({
            status: "success",
            id: id,
            key: key,
            expiresAt: formattedDate
        });
    } catch (error) {
        return res.status(400).json({status: "error", message: error.message});
    }
});

app.post("/delete", async (req, res) => {
    try {
        const {id} = req.body;
        
        if (!id) {
            return res.status(400).json({status: "error", message: "id is required"});
        }
        
        const data = await fs.readFile('db/server.json', 'utf-8');
        const db = JSON.parse(data);
        
        // Find the item with matching id
        const itemIndex = db.findIndex(item => item.id === id);
        
        if (itemIndex === -1) {
            return res.status(404).json({status: "error", message: "Key not found"});
        }
        
        // Remove the item
        db.splice(itemIndex, 1);
        await fs.writeFile('db/server.json', JSON.stringify(db, null, 2), 'utf-8');
        
        return res.status(200).json({status: "success", message: "Key deleted"});
    } catch (error) {
        return res.status(400).json({status: "error", message: error.message});
    }
});

app.post("/update", async (req, res) => {
    try {
        const {id, duration} = req.body;
        
        if (!id || !duration) {
            return res.status(400).json({status: "error", message: "id and duration are required"});
        }
        
        const data = await fs.readFile('db/server.json', 'utf-8');
        const db = JSON.parse(data);
        
        // Find the item with matching id
        const matchedItem = db.find(item => item.id === id);
        
        if (!matchedItem) {
            return res.status(404).json({status: "error", message: "Key not found"});
        }
        
        // Parse duration and calculate new expiry date from current time
        const durationMs = parseDuration(duration);
        const expiryDate = new Date(Date.now() + durationMs);
        const formattedDate = formatDate(expiryDate);
        
        // Update the item
        matchedItem.expiresAt = formattedDate;
        await fs.writeFile('db/server.json', JSON.stringify(db, null, 2), 'utf-8');
        
        return res.status(200).json({
            status: "success",
            id: id,
            expiresAt: formattedDate
        });
    } catch (error) {
        return res.status(400).json({status: "error", message: error.message});
    }
});
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