const mongoose = require("mongoose");

const reelSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  id: {
    type: String,
    required: true,
    trim: true,
  },
  media_url: {
    type: String,
    required: false
  },
  caption: {
    type: String,
    required: false
  },
  media_type: {
    type: String,
    required: false
  },
  modified_date: {
    type: Date,
    required: false,
  },
  insights: {
    type: Object,
    required: false
  },
  awsMediaUrl:{
    type: String,
    required: false
  }
});

reelSchema.methods.createReel = async (data) => {
  let reel = new this();
  reel = await reel.save(data);

  return reel;
};

const Reel = mongoose.model("Reel", reelSchema);

module.exports = Reel;
