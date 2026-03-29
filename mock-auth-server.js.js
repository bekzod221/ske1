// mock-auth-server.js (improved)

const express = require('express');
const app = express();
const fs = require("fs/promises");
const TelegramBot = require('node-telegram-bot-api');
const cors = require("cors");

app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));

const bot = new TelegramBot("YOUR_BOT_TOKEN");

// ================= HELPERS =================

const parseDate = (str) => {
    const [d, t] = str.split(" ");
    const [day, month, year] = d.split(".");
    const [h, m, s] = t.split(":");
    return new Date(year, month - 1, day, h, m, s);
};

const formatDate = (date) => {
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(date.getDate())}.${pad(date.getMonth()+1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const parseDuration = (d) => {
    const match = d.match(/^(\d+)([dhms])$/);
    if (!match) throw new Error("Invalid duration");

    const val = parseInt(match[1]);
    const unit = match[2];

    return {
        d: val * 86400000,
        h: val * 3600000,
        m: val * 60000,
        s: val * 1000
    }[unit];
};

const readDB = async () => JSON.parse(await fs.readFile("db/server.json", "utf-8"));
const writeDB = async (db) => fs.writeFile("db/server.json", JSON.stringify(db, null, 2));

// ================= CREATE KEY =================

app.post("/create", async (req, res) => {
    try {
        const { key, duration, version = "1.0" } = req.body;

        if (!key || !duration) {
            return res.status(400).json({ status: "error", message: "key + duration required" });
        }

        const db = await readDB();

        if (db.find(x => x.key === key)) {
            return res.status(400).json({ status: "error", message: "Key exists" });
        }

        const expiry = new Date(Date.now() + parseDuration(duration));

        const newKey = {
            id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
            key,
            hwid: "",
            version, // 🔥 ADDED VERSION
            expiresAt: formatDate(expiry)
        };

        db.push(newKey);
        await writeDB(db);

        res.json({ status: "success", ...newKey });

    } catch (e) {
        res.status(400).json({ status: "error", message: e.message });
    }
});

// ================= VERIFY =================

app.post("/verify", async (req, res) => {
    const { key, hwid, version } = req.body;

    const db = await readDB();
    const item = db.find(x => x.key === key);

    if (!item) return res.status(404).json({ status: "error" });

    if (item.version && version && item.version !== version) {
        return res.status(400).json({ status: "error", message: "Wrong version" });
    }

    if (new Date() > parseDate(item.expiresAt)) {
        return res.status(401).json({ status: "error", message: "Expired" });
    }

    if (!item.hwid) {
        item.hwid = hwid;
        await writeDB(db);
    } else if (item.hwid !== hwid) {
        return res.status(400).json({ status: "error", message: "HWID mismatch" });
    }

    res.json({ status: "success" });
});

// ================= HWID RESET =================

app.post("/reset-hwid", async (req, res) => {
    try {
        const { key } = req.body;

        const db = await readDB();
        const item = db.find(x => x.key === key);

        if (!item) {
            return res.status(404).json({ status: "error", message: "Key not found" });
        }

        item.hwid = "";

        await writeDB(db);

        res.json({ status: "success", message: "HWID reset done" });

    } catch (e) {
        res.status(500).json({ status: "error", message: e.message });
    }
});

// ================= VERSION CHANGER =================

app.post("/change-version", async (req, res) => {
    try {
        const { key, version } = req.body;

        if (!version) {
            return res.status(400).json({ status: "error", message: "Version required" });
        }

        const db = await readDB();
        const item = db.find(x => x.key === key);

        if (!item) {
            return res.status(404).json({ status: "error", message: "Key not found" });
        }

        item.version = version;

        await writeDB(db);

        res.json({
            status: "success",
            message: "Version updated",
            version
        });

    } catch (e) {
        res.status(500).json({ status: "error", message: e.message });
    }
});

// ================= DELETE =================

app.post("/delete", async (req, res) => {
    const { id } = req.body;

    const db = await readDB();
    const index = db.findIndex(x => x.id === id);

    if (index === -1) return res.status(404).json({ status: "error" });

    db.splice(index, 1);
    await writeDB(db);

    res.json({ status: "success" });
});

// ================= UPDATE EXPIRY =================

app.post("/update", async (req, res) => {
    const { id, duration } = req.body;

    const db = await readDB();
    const item = db.find(x => x.id === id);

    if (!item) return res.status(404).json({ status: "error" });

    const expiry = new Date(Date.now() + parseDuration(duration));
    item.expiresAt = formatDate(expiry);

    await writeDB(db);

    res.json({ status: "success", expiresAt: item.expiresAt });
});

// ================= START =================

app.listen(3000, "0.0.0.0", () => {
    console.log("Server running on port 3000");
});