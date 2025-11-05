const mongoose = require('mongoose');
const AssignmentSchema = new mongoose.Schema({
    name: String,
    title: String,
    subject: String,
    customSubject: String,
    deadline: Date,
    budget: Number,
    description: String,
    attachment: String,
    phone: String,
    comments: {
      type: String,
      default: ''
    },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
    notification: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  });
module.exports = mongoose.model('Assignment', AssignmentSchema);