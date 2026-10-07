function getPagination(query = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

async function paginate(model, filter, query, { sort = { createdAt: -1 }, populate, select } = {}) {
  const { page, limit, skip } = getPagination(query);
  let q = model.find(filter).sort(sort).skip(skip).limit(limit);
  if (populate) q = q.populate(populate);
  if (select) q = q.select(select);
  const [items, total] = await Promise.all([q.lean(), model.countDocuments(filter)]);
  return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
}

module.exports = { getPagination, paginate };
