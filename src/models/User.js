const mongoose = require("mongoose");
const validator = require("validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const InstagramRepository = require("../models/repositories/InstagramRepository");
const { Timestamp } = require("mongodb");

const userSchema = mongoose.Schema({
  facebook_id: { type: Number },
  name: {
    type: String,
    required: false,
    trim: true,
  },
  email: {
    type: String,
    required: false,
    unique: true,
    lowercase: true,
    validate: (value) => {
      if (!validator.isEmail(value)) {
        throw new Error({ error: "Invalid Email address" });
      }
    },
  },
  image: {
    type: String,
    required: false,
  },
  is_google: {
    type: Boolean,
  },
  password: {
    type: String,
    required: false,
    maxLength: 100,
    minLength: 7,
  },
  confirmed: {
    type: Date,
  },
  //------------------- forgotstring field used for forgot password --------------//
  forgotstring: {
    type: String,
    required: false,
  },
  //------------------- google_tokens field used for saving refresh token --------------//
  google_tokens: {
    type: Array,
    required: false,
  },
  tokens: [
    {
      token: {
        type: String,
        required: true,
      },
    },
  ],
  isFacebookUser: {
    type: Boolean,
  },
  fb_access_token: {
    type: Object,
  },
  fb_refresh_token: {
    expires_in: Number,
    token: String,
  },
  chosen_instagram_account: {
    required: false,
    type: String,
  },

  campaigns: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
    },
  ],
  ig_detail: {
    required: false,
    type: Object
  }
});

userSchema.pre("save", async function (next) {
  // Hash the password before saving the user model
  const user = this;
  if (user.isModified("password")) {
    user.password = await bcrypt.hash(user.password, 8);
  }
  next();
});

userSchema.methods.generateAuthToken = async function () {
  // Generate an auth token for the user
  const user = this;
  const token = jwt.sign({ _id: user._id }, process.env.JWT_KEY);
  user.tokens = user.tokens = [{ token }];
  await user.save();
  return token;
};

userSchema.statics.findByCredentials = async (email, password) => {
  // Search for a user by email and password.

  const user = await User.findOne({ email });
  if (!user) {
    throw { message: "That user doesn't exist in our database!" };
  }
  if (user.isFacebookUser) {
    throw { message: "This email is associated with Facebook account!" };
  }
  const isPasswordMatch = await bcrypt.compare(password, user.password);
  if (!isPasswordMatch) {
    if (user.is_google) {
      throw { message: "This email is associated with google account" };
    }
    throw { message: "Invalid login credentials" };
  }

  return user;
};

const User = mongoose.model("User", userSchema);

module.exports = User;
