const mongoose = require('mongoose');
const UserSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String,
    googleId: String,
    isAdmin: { type: Boolean, default: false },
    profileImage: { type: String, default: '' },
    college: { type: String, required: function() { return !this.googleId; } },
    course: { type: String, required: function() { return !this.googleId; } }
});
module.exports = mongoose.model('User', UserSchema);