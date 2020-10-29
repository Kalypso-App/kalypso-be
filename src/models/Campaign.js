const mongoose = require("mongoose");

const campaignSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  brand_name: {
    type: String,
    required: true,
    trim: true,
  },
  brand_logo: {
    type: String,
    required: false,
  },
  due_date: {
    type: Date,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  modified_date: {
    type: Date,
    required: false,
  },
  isProCampaign: {
    type: Boolean,
    required: false,
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  posts: {
    type: Array,
    default: [],
  },
  ga_blog_date:{
    type: Date,
    required: false,
  },
  blog_pages: {
    type: Array,
    default: [],
  },
  stories: {
    type: Array,
    default: [],
  },
  yt_videos: {
    type: Array,
    default: [],
  },
  fbposts: {
    type: Array,
    default: [],
  },
  tiktoks: {
    type: Array,
    default: [],
  },
  reels: {
    type: Array,
    default: [],
  },
});

campaignSchema.methods.createCampaign = async (campaignData) => {
  let campaign = new this();
  campaign = await campaign.save(campaignData);

  return campaign;
};

const Campaign = mongoose.model("Campaign", campaignSchema);

module.exports = Campaign;
