const mongoose = require('mongoose');
const { YEAR_LEVELS } = require('./Student');

// Every relationship in the academic collections uses the native MongoDB _id (ObjectId), never the
// human-readable student number ("2026-0001"), which an admin is allowed to edit.
const { ObjectId } = mongoose.Schema.Types;
const ref = (model, extra = {}) => ({ type: ObjectId, ref: model, ...extra });
const requiredRef = (model, extra = {}) => ref(model, { required: [true, `${model.toLowerCase()} is required`], ...extra });

const SEMESTERS = ['1st Semester', '2nd Semester', 'Summer'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/; // 24-hour "HH:MM"
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/; // "YYYY-MM-DD"

// Whole centavos only: money fields accept at most two decimal places.
const isMoney = (v) => Number.isFinite(v) && Math.abs(v * 100 - Math.round(v * 100)) < 1e-6;

const isRealDate = (v) => {
  if (!DATE_RE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v; // rejects 2026-02-31
};

// API output: expose `id`, hide Mongo internals.
const idTransform = (doc, ret) => {
  ret.id = ret._id.toString();
  delete ret._id;
  delete ret.__v;
  return ret;
};
const baseOptions = { timestamps: true, toJSON: { virtuals: false, transform: idTransform } };

module.exports = { ObjectId, ref, requiredRef, YEAR_LEVELS, SEMESTERS, DAYS, TIME_RE, DATE_RE, isMoney, isRealDate, idTransform, baseOptions };
