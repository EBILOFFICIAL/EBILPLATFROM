const CMSPage = require('../models/CMSPage');
const AppError = require('../utils/AppError');

async function getPublic(slug) {
  const page = await CMSPage.findOne({ slug, published: true }).lean();
  if (!page) throw AppError.notFound('Page not found');
  return page;
}

const listPublic = (type) => CMSPage.find({ published: true, ...(type ? { type } : {}) }).select('slug title type seo').lean();

async function upsert(slug, data, userId) {
  return CMSPage.findOneAndUpdate({ slug }, { ...data, slug, updatedBy: userId }, { upsert: true, new: true });
}

module.exports = { getPublic, listPublic, upsert };
