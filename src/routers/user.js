const auth = require("../middleware/auth");
const express = require("express");
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const passport = require("passport");
const FacebookTokenStrategy = require("passport-facebook-token");
const router = express.Router();
const verification = require("../utils/email");
const InstagramRepository = require("../models/repositories/InstagramRepository");
const bcrypt = require("bcryptjs");
const queryString = require("query-string");
const axios = require("axios");
var logger = require('../config/winston');

passport.serializeUser(function (user, cb) {
  cb(null, user);
});
passport.deserializeUser(function (obj, cb) {
  cb(null, obj);
});
passport.use(
  "facebookToken",
  new FacebookTokenStrategy(
    {
      clientID: process.env.FB_APP_ID,
      clientSecret: process.env.FB_APP_SECRET,
      callbackURL: `${process.env.BACKEND_API}/return`,
      profileFields: ['id', 'displayName', 'photos', 'email']
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        refreshToken = await InstagramRepository.getRefreshToken(accessToken);
      } catch (error) {
        res.status(403).send(error.message);
      }

      try {
        let user = User.findOne({ facebook_id: profile.id }, async function (
          err,
          user
        ) {
          //See if a User already exists with the Facebook ID
          if (err) {
            console.log(err); // handle errors!
          }

          if (user) {
            console.log("user found!");
            user.fb_access_token = refreshToken;
            user.image = profile.photos[0] ? profile.photos[0].value : "",
            await user.save();
            return done(null, user);
          } else {
            let body = {
              isFacebookUser: true,
              confirmed: new Date(),
              email: profile.emails[0].value,
              name: profile.displayName,
              image: profile.photos[0] ? profile.photos[0].value : "",
              fb_access_token: { access_token: accessToken },
              facebook_id: profile.id, //pass in the id and displayName params from Facebook
            };
            let user = new User(body);
            user.save(function (err) {
              //Save User if there are no errors else redirect to login route
              if (err) {
                console.log(err); // handle errors!
              } else {
                console.log("saving user ...", done);
                return done(null, user);
              }
            });
          }
        });
      } catch (error) {
        console.log(error);
        done(error, false, error.message);
      }
    }
  )
);
// Initialize Passport and restore authentication state, if any, from the
// session.
router.use(passport.initialize());
router.use(passport.session());

router.post(
  "/facebook-login",
  passport.authenticate("facebookToken", { session: false }),
  async function (req, res) {
    if (req.user) {
      let token = await req.user.generateAuthToken();
      return res.status(201).send({ user: req.user, token });
    } else {
      return res.status(401).send({
        message:
          "Service not available! Please try later or contact our customer support!",
      });
    }
  }
);

router.post("/register", async (req, res) => {
  try {
    let user = await User.findOne({ email: req.body.email });
    if (user) {
      if (user.isFacebookUser) {
        if (user) {
          return res
            .status(401)
            .json({ error: "This email is associated with Facebook account!" });
        }
      }
      return res
        .status(401)
        .json({ error: "User with this email already exists!" });
    }
    user = new User(req.body);
    await user.save();
    const token = await user.generateAuthToken();
    verification.sendVerificationEmail(user.email, user._id);
    res.status(201).send({ user });
  } catch (error) {
    res.status(400).send({ message: error._message });
  }
});

router.post("/google-login", async (req, res) => {
  try {
    let user = await User.findOne({ email: req.body.email });
    if (user) {
      const token = await user.generateAuthToken();
      return res.status(201).send({ user, token });
    }
    req.body.is_google = true;
    user = new User(req.body);
    await user.save();
    const token = await user.generateAuthToken();
    // sendVerificationEmail(user.email, 'tokenasdfasdfasdfasdf')
    res.status(201).send({ user, token });
  } catch (error) {
    res.status(400).send({ message: error._message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    let user;
    try {
      console.log(email, password);

      user = await User.findByCredentials(email, password);
    } catch (e) {
      return res.status(401).send({ error: e.message });
    }

    if (!user) {
      return res
        .status(401)
        .send({ error: "Login failed! Check authentication credentials" });
    }
    if (!user.confirmed) {
      return res
        .status(401)
        .send({ error: "Login failed! Your email is not verified." });
    }

    const token = await user.generateAuthToken();
    res.send({ user, token });
  } catch (error) {
    res.status(401).json({ message: error.error });
  }
});

// =========================== verify email start ============================ //
router.get("/verify-email/:id", async (req, res) => {
  try {
    const user = await User.findOneAndUpdate(
      { _id: req.params.id },
      { confirmed: new Date() },
      { new: true }
    );
    if (!user) {
      // if no user found with id then return the response
      return res.status(401).send({ error: "No user found." });
    }
    return res.redirect(process.env.APP_FRONTEND_URL); // after updating, returning the new data
  } catch (error) {
    res.status(401).json({ message: error.error });
  }
});
// =========================== verify email end ============================ //

// =========================== forgot password start ============================ //
router.post("/forgot-password", async (req, res) => {
  try {
    // generating random string
    var randomstr = "";
    var characters =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    var charactersLength = characters.length;
    for (var i = 0; i < 21; i++) {
      randomstr += characters.charAt(
        Math.floor(Math.random() * charactersLength)
      );
    }
    const user = await User.findOneAndUpdate(
      { email: req.body.email },
      { forgotstring: randomstr },
      { new: true }
    ); // finding user by email and updating forgotstring for the user
    if (!user) {
      // if no user found with email then return the response
      return res.status(401).send({ error: "No user found." });
    }
    verification.sendForgotPasswordEmail(req.body.email, randomstr); // after updating, sending email to the user with random string
    return res.status(201).send({ message: "Email Sent" }); // returning the response on success
  } catch (error) {
    res.status(401).json({ message: error.error });
  }
});
// =========================== forgot password end ============================ //

// =========================== reset password start ============================ //
router.post("/reset-password", async (req, res) => {
  try {
    const newpass = await bcrypt.hash(req.body.password, 8); // encrypting new password to hash
    const newuser = await User.findOneAndUpdate(
      { forgotstring: req.body.forgotstring },
      { password: newpass },
      { new: true }
    ); // finding user with forgot string and updating new hashed password
    if (!newuser) {
      // if no user found with email then return the response
      return res.status(401).send({ error: "Error Occured." });
    }
    return res.status(201).send(newuser); // after updating, returning the new data
    // });
  } catch (error) {
    res.status(401).json({ message: error.error });
  }
});
// =========================== reset password end ============================ //

router.get("/authenticate/google", () => {});
router.get("/users/me", auth, async (req, res) => {
  // View logged in user profile
  res.send(req.user);
});

router.post("/users/me/logout", auth, async (req, res) => {
  // Log user out of the application

  try {
    req.user.tokens = req.user.tokens.filter((token) => {
      return token.token !== req.token;
    });

    await req.user.save();

    res.send();
  } catch (error) {
    res.status(500).send(error.message);
  }
});

router.post("/users/me/logoutall", auth, async (req, res) => {
  // Log user out of all devices
  try {
    req.user.tokens.splice(0, req.user.tokens.length);
    await req.user.save();
    res.send();
  } catch (error) {
    res.status(500).send(error);
  }
});

router.get("/test-email", (req, res) => {
  try {
    verification.sendVerificationEmail();
  } catch (error) {
    res.status(500).send(error.message);
  }
});
let createToken = function (auth) {
  return jwt.sign({ _id: auth.user._id }, process.env.JWT_KEY);
};

let generateToken = function (req, res, next) {
  req.token = createToken(req.auth);
  next();
};

let sendToken = function (req, res) {
  res.setHeader("x-auth-token", req.token);
  req.auth.token = req.token;
  res.status(200).send(req.auth);
};

router.get("/get-user", auth, async (req, res) => {
  
  return res.send(req.user);
});

router.get("/get-facebook-url", auth, async (req, res) => {
  const stringifiedParams = queryString.stringify({
    client_id: process.env.FB_APP_ID,
    redirect_uri: `${process.env.BACKEND_API}/authentication/facebook`,
    state: req.user._id,
    scope:
      "email,public_profile, instagram_basic, instagram_manage_insights, pages_show_list", // comma seperated string
    response_type: "code",
    auth_type: "rerequest",
    display: "popup",
  });
  const facebookLoginUrl = `https://www.facebook.com/v6.0/dialog/oauth?${stringifiedParams}`;

  res.send(facebookLoginUrl);
});


router.get("/get-instagram-url", auth, async (req, res) => {
  const stringifiedParams = queryString.stringify({
    client_id: process.env.IG_APP_ID,
    redirect_uri:`${process.env.BACKEND_API}/authentication/instagram/`,
    response_type: "code",
    scope: "user_profile,user_media",
    display: "popup",
    state: req.user._id
  });
  const instagramLoginUrl = `https://api.instagram.com/oauth/authorize?${stringifiedParams}`;

  res.send(instagramLoginUrl);
});

const formUrlEncoded = x =>
   Object.keys(x).reduce((p, c) => p + `&${c}=${encodeURIComponent(x[c])}`, '')

router.get("/authentication/instagram", async (req, res) => {
  let code = req.query.code;
  let userId = req.query.state;
  console.log(userId);
 
 const {data} = await axios({
    url: "https://api.instagram.com/oauth/access_token",
    method: "post",
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    data: formUrlEncoded({client_id: process.env.IG_APP_ID,
      client_secret: process.env.IG_APP_SECRET,
      grant_type: 'authorization_code',
      redirect_uri: `${process.env.BACKEND_API}/authentication/instagram/`,
      code: code
    })
  });


  console.log(data); // { access_token, token_type, expires_in }
       
    const user = await User.updateOne(
      { _id: userId },
      {
        fb_access_token: data,
        chosen_instagram_account: data.user_id,
      }
    );
    return res.redirect(`${process.env.APP_FRONTEND_URL}#/accounts`);
  

});

router.get("/get-google-url", auth, async (req, res) => {
  res.send(`${process.env.BACKEND_API}/auth/googleauth/${req.user._id}`);
});

router.get("/authentication/facebook", async (req, res) => {
  let code = req.query.code;
  let userId = req.query.state;
  //logger.info("Looger code: " + req.query.code);
  //logger.info("logger state : " + userId);
  try {
    const { data } = await axios({
      url: "https://graph.facebook.com/v6.0/oauth/access_token",
      method: "get",
      params: {
        client_id: process.env.FB_APP_ID,
        client_secret: process.env.FB_APP_SECRET,
        redirect_uri: `${process.env.BACKEND_API}/authentication/facebook`,
        code,
      },
    });
    //logger.info("data ");
   
    try {
      // finding the user based on id and updating the token for that user

      // SAVE INSTAGRAM ID
      let accessToken = data.access_token;
      let instagramAccountId = "";
      try {
        let facebookResponse = await InstagramRepository.getAccounts(
          accessToken
        );
        let response = facebookResponse.data.data;
        if (response[0] && response[0].id) {
          let instagramAccounts = await InstagramRepository.getInstagrabBusinessAccountId(
            response[0].id,
            accessToken
          );
          let instagramResponse = instagramAccounts.data;
          if (instagramResponse.data) {
            instagramResponse = instagramResponse.data;
          }
          if (
            instagramResponse.length > 0
          ) {
            let businessAcc = instagramResponse.find(x=>x.instagram_business_account);
            if(businessAcc){
              instagramAccountId = businessAcc.instagram_business_account.id;
            }
          } else if (instagramResponse.instagram_business_account) {
            instagramAccountId =
              instagramResponse.instagram_business_account.id;
          }
          //instagramAccountId = instagramResponse[0].id;
        }
        console.log("Instagram account ID: ", instagramAccountId);
        const user = await User.updateOne(
          { _id: userId },
          {
            fb_access_token: data,
            chosen_instagram_account: instagramAccountId,
          }
        );
        return res.redirect(`${process.env.APP_FRONTEND_URL}#/accounts`);
      } catch (error) {
        return res.status(403).json({ error: error.message });
      }
      if (!user) {
        // if no user found with id then return the response
        return res.redirect(`${process.env.APP_FRONTEND_URL}#/error`);
      }
      return res.redirect(`${process.env.APP_FRONTEND_URL}#/accounts`);
    } catch (e) {
      return res.status(403).json({ error: e.message });
    }
  } catch (e) {
    return res.status(403).json({ error: e.message });
  }

  // return data.access_token;
});

module.exports = router;
