const mongoose = require("mongoose");

// Review Schema
const reviewSchema = new mongoose.Schema(
  {
    comment: {
      type: String,
      required: true
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "listing", // must match the Listing model name
      required: true
    }
  },
  { timestamps: true }
);

// Export the Review model
const Review = mongoose.model("Review", reviewSchema);
module.exports = { Review };
