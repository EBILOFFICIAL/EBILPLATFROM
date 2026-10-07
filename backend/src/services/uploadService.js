const env = require('../config/env');
const cloud = require('../config/cloudinary');
const { Document } = require('../models/misc');
const AppError = require('../utils/AppError');
const { sha256, hmac, randomToken } = require('../utils/crypto');
const providers = require('./providers/storageProviders');

const provider = () => (cloud.enabled ? providers.cloudinary : providers.local);

async function save(file, { ownerId, purpose }) {
  if (!file) throw AppError.badRequest('File is required');
  const p = provider();
  const key = `${Date.now()}-${randomToken(8)}${require('path').extname(file.originalname).toLowerCase()}`;
  const stored = await p.put(file.buffer, key, file.mimetype);
  return Document.create({ ownerId, purpose, name: file.originalname, mimeType: file.mimetype, size: file.size, sha256: sha256(file.buffer), provider: p.name, storageKey: stored.storageKey, url: stored.url });
}

function signedUrl(docId, ttlSec = 600) {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  return `/api/v1/files/${docId}?exp=${exp}&sig=${hmac(`${docId}:${exp}`, env.fileSigningSecret)}`;
}

async function readSigned(docId, exp, sig) {
  if (!exp || Number(exp) < Date.now() / 1000 || hmac(`${docId}:${exp}`, env.fileSigningSecret) !== sig) throw AppError.forbidden('Invalid or expired link');
  const doc = await Document.findById(docId).lean();
  if (!doc) throw AppError.notFound('File not found');
  const buffer = await providers[doc.provider].read(doc.storageKey, doc.url);
  return { doc, buffer };
}

module.exports = { save, signedUrl, readSigned };
