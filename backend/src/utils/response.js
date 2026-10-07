const ok = (res, data = null, message = 'OK', meta) => res.status(200).json({ success: true, message, data, ...(meta ? { meta } : {}) });
const created = (res, data = null, message = 'Created') => res.status(201).json({ success: true, message, data });
const fail = (res, status, message, errors) => res.status(status).json({ success: false, message, data: null, ...(errors ? { errors } : {}) });

module.exports = { ok, created, fail };
