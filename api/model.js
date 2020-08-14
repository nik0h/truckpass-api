'use strict';

var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var PaymentSchema = new Schema({
  type: {
    type: Boolean,
    required: true
  },
  code: {
    type: String,
    required: true
  },
  balance: {
    type: Schema.Types.Decimal128,
    required: true
  },
  obscure: {
    type: Boolean,
    default: false
  },
  checkId: String,
  currentProof: String
});

module.exports.Payment = mongoose.model('Payment', PaymentSchema);

var UserSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  activated: {
    type: Boolean,
    default: false
  },
  used: {
    type: Schema.Types.Decimal128,
    default: 0
  },
  auth: String,
  isAdmin: {
    type: Boolean,
    default: false
  },
  checks: [PaymentSchema],
  addDate: {
    type: Date,
    default: Date.now
  },
  actDate: Date
});

module.exports.User = mongoose.model('User', UserSchema);

var ReceiptSchema = new Schema({
  id: {
    type: String,
    required: true
  },
  marked: {
    type: Boolean,
    default: false
  },
  verified: {
    type: Boolean,
    default: false
  },
  addDate: {
    type: Date,
    default: Date.now
  }
});

module.exports.Receipt = mongoose.model('Receipt', ReceiptSchema);


var AssignSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  balance: {
    type: Schema.Types.Decimal128,
    required: true
  },
  receipts: [ReceiptSchema],
  marked: {
    type: Boolean,
    default: false
  },
  used: {
    type: Boolean,
    default: false
  },
  verified: {
    type: Boolean,
    default: false
  },
  reported: {
    type: Boolean,
    default: false
  },
  reportDate: Date,
});

module.exports.Assign = mongoose.model('Assign', AssignSchema);

var CheckSchema = new Schema({
  type: {
    type: Boolean,
    required: true
  },
  code: {
    type: String,
    required: true
  },
  originalBal: {
    type: Schema.Types.Decimal128,
    required: true
  },
  currentBal: Schema.Types.Decimal128,
  availableBal: Schema.Types.Decimal128,
  reported: {
    type: Boolean,
    default: false
  },
  assigned: [AssignSchema],
  addDate: {
    type: Date,
    default: Date.now
  }
});

module.exports.Check = mongoose.model('Check', CheckSchema);

var AuditSchema = new Schema({
  type: String,
  actor: String,
  subject: String,
  balance: Schema.Types.Decimal128,
  addDate: {
    type: Date,
    default: Date.now
  }
});

module.exports.Audit = mongoose.model('Audit', AuditSchema);

var ClientSchema = new Schema({
  clientName: {
    type: String,
    required: true
  },
  users: [UserSchema],
  checks: [CheckSchema],
  log: [AuditSchema],
  regDate: {
    type: Date,
    default: Date.now
  },
  endDate: Date
});

ClientSchema.pre('save', function (next) {
    var regDate = new Date(this.get('regDate'));
    var subMonths = 6;
    this.endDate = new Date(regDate.setTime( regDate.getTime() + subMonths * 30 * 86400000 ));
    next();
});

module.exports.Client = mongoose.model('Client', ClientSchema);
