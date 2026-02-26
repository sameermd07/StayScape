const mongoose =require('mongoose')
const listingSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },

  description: {
    type: String,
    required: true
  },

  image: {
    filename: {
      type: String,
      default: "listingimage"
    },
    url: {
      type: String,
      default:
        "https://i0.wp.com/picjumbo.com/wp-content/uploads/beautiful-fall-nature-scenery-free-image.jpeg?w=2210&quality=70"
    }
  },

  price: {
    type: Number,
    required: true,
    min: 0
  },

  location: {
    type: String,
    required: true
  },

  country: {
    type: String,
    required: true
  },
  reviews: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Review" // points to the Review model
    }
  ]
});
const listing = mongoose.model('listing',listingSchema);
module.exports = {listing};