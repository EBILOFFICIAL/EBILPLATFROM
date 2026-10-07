const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const cloud = require('../../config/cloudinary');

const LOCAL_DIR = path.resolve(__dirname, '../../../uploads');

const local = {
  name: 'local',
  async put(buffer, key) {
    await fs.mkdir(LOCAL_DIR, { recursive: true });
    await fs.writeFile(path.join(LOCAL_DIR, key), buffer);
    return { storageKey: key };
  },
  read: (key) => fs.readFile(path.join(LOCAL_DIR, path.basename(key))),
};

const cloudinary = {
  name: 'cloudinary',
  async put(buffer, key, mimeType) {
    const ts = Math.floor(Date.now() / 1000);
    const signature = crypto.createHash('sha1').update(`public_id=${key}&timestamp=${ts}&type=authenticated${cloud.apiSecret}`).digest('hex');
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: mimeType }));
    Object.entries({ api_key: cloud.apiKey, timestamp: ts, public_id: key, type: 'authenticated', signature }).forEach(([k, v]) => form.append(k, String(v)));
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud.cloudName}/auto/upload`, { method: 'POST', body: form });
    if (!res.ok) throw new Error(`Cloudinary ${res.status}`);
    const json = await res.json();
    return { storageKey: key, url: json.secure_url };
  },
  async read(key, url) { const r = await fetch(url); return Buffer.from(await r.arrayBuffer()); },
};

module.exports = { local, cloudinary };
