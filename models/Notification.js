const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User' // Assuming you have a User model
    },
    message: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['info', 'error', 'STOP_WORK_WARNING'], // Add types relevant to your app
        default: 'info'
    },
    read: {
        type: Boolean,
        default: false
    },
    // Optional: Link to the specific item (e.g., WorkSession ID) that triggered the notification
    itemId: {
        type: mongoose.Schema.Types.ObjectId,
        required: false
    },
}, {
    timestamps: true // Adds createdAt and updatedAt fields automatically
});

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;