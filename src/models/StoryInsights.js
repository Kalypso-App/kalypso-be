const mongoose = require("mongoose");
const validator = require("validator");
const InstagramRepository = require("../models/repositories/InstagramRepository");

const storyInsightsSchema = mongoose.Schema({}, { strict: false });

const StoryInsights = mongoose.model("StoryInsights", storyInsightsSchema);

module.exports = StoryInsights;
