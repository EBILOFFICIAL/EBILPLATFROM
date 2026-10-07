const mongoose = require('mongoose');

const option = new mongoose.Schema({ label: { type: String, required: true }, points: { type: Number, min: 0, max: 100, required: true } }, { _id: false });

const schema = new mongoose.Schema({
  text: { type: String, required: true, maxlength: 300 },
  helpText: { type: String, maxlength: 500 },
  dimension: { type: String, enum: ['performance', 'professionalism', 'reliability', 'conduct'], required: true, index: true },
  type: { type: String, enum: ['rating', 'yes_no', 'mcq'], required: true },
  options: { type: [option], validate: (v) => v.length >= 2 },
  weight: { type: Number, min: 0.1, max: 10, default: 1 },
  active: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Question', schema);
