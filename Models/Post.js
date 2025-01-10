const mongoose = require('mongoose');

// Define the post schema
const postSchema = new mongoose.Schema({
  
    post: {
      type: String,
      required: true,
      trim: true,
    },
    user: {
      type: String,
      required: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
    likeCount: { type: Number, default: 0 },
    likedBy: { type: [String], default: [] }, // Array of user IDs
  });
  


// Middleware to update the updatedAt field on save
postSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Export the model
const Post = mongoose.model('Post', postSchema);

module.exports = Post;
