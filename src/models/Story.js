const mongoose = require("mongoose");

const storySchema = new mongoose.Schema({
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
  comments_count: {
    type: String,
    required: false
  },
  media_type: {
    type: String,
    required: false
  },
  permalink: {
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
  }
});

storySchema.methods.createStory = async (storyData) => {
  let story = new this();
  story = await story.save(storyData);

  return story;
};

const Story = mongoose.model("Story", storySchema);

module.exports = Story;
