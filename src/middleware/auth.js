const jwt = require("jsonwebtoken");
const User = require("../models/User");

const auth = async (req, res, next) => {
  const header = req.header("authorization");
  let token = "";

  if (header) {
    token = header.replace("Bearer ", "");
  }
  let data = {};
  if (!token) {
    return res.status(401).send({ error: "JWT token needed" });
  }
  
  try {
    data = await jwt.verify(token, process.env.JWT_KEY);
  } catch (error) {
    res.status(401).send({ error: error.message });
  }

  try {
    const user = await User.findOne({ _id: data._id });
    if (!user) {
      throw new Error();
    }
    req.user = user;
    next();
  } catch (error) {
    res.status(401).send({ error: "Not authorized to access this resource" });
  }
};

module.exports = auth;
