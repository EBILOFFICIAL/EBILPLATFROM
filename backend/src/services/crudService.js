const mongoose = require('mongoose');
const AppError = require('../utils/AppError');
const { paginate } = require('../utils/pagination');

function crud(Model, { searchFields = [], defaultSort = { createdAt: -1 }, populate } = {}) {
  return {
    async list(query) {
      const filter = {};
      if (query.q && searchFields.length) filter.$or = searchFields.map((f) => ({ [f]: new RegExp(query.q, 'i') }));
      Object.entries(query).forEach(([k, v]) => { if (k.startsWith('f_') && v !== '') filter[k.slice(2)] = v; });
      return paginate(Model, filter, query, { sort: defaultSort, populate });
    },
    async get(id) {
      if (!mongoose.isValidObjectId(id)) throw AppError.badRequest('Invalid id');
      const doc = await Model.findById(id).lean();
      if (!doc) throw AppError.notFound();
      return doc;
    },
    create: (data) => Model.create(data),
    async update(id, data) {
      const doc = await Model.findById(id);
      if (!doc) throw AppError.notFound();
      const before = doc.toObject();
      Object.assign(doc, data);
      await doc.save();
      return { before, after: doc.toObject() };
    },
    async remove(id) {
      const doc = await Model.findByIdAndDelete(id);
      if (!doc) throw AppError.notFound();
      return doc;
    },
  };
}

module.exports = { crud };
