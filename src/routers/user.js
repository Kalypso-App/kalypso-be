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
var logger = require('../config/logger');
const TikTokScraper = require('tiktok-scraper');
let AWS = require("aws-sdk");
const multer = require("multer");
let storage = multer.memoryStorage();
let upload = multer({ storage: storage });
const baseGraphApi = process.env.GRAPH_API;
const path = require('path')
const Url = require('url');


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
    verification.sendVerificationEmail(user.email, user._id, user.name);
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

router.post("/update-user", auth,  upload.single("accountLogo"), async (req, res) => {
  let email = req.body.email;
  let user = await User.findOne({ email: email });
  if (user) {
    try{
      // If facebook login, only update name
      if(user.get('facebook_id')){
        let userObj = {
          name: req.body.name,
        };
        if(req.file && req.file.buffer){
          let url = process.env.AWS_UPLOADED_FILE_URL_LINK + req.user._id.toString() + "/account/";
          url +=  req.user._id.toString() + '.' + req.body.accountLogoExtension;
          userObj.account_logo = url;
        }
        //account_logo
        await User.updateOne(
          { _id: user.get('id') }, userObj );
      }
      else{
        // No need to update password
        let newpass = await bcrypt.hash(req.body.password, 8); // encrypting new password to hash
        if(req.body.password == user.get('password')){
          newpass =  user.get('password');
        }
       
        let userObj = {
          name: req.body.name,
          password: newpass
        };
        if(req.file && req.file.buffer){
          let url = process.env.AWS_UPLOADED_FILE_URL_LINK + req.user._id.toString() + "/account/";
          url +=  req.user._id.toString() + '.' + req.body.accountLogoExtension;
          userObj.account_logo = url;
        }

        await User.updateOne(
          { _id: user.get('id') },
          userObj);
      }

      
      if(req.file && req.file.buffer){
        let s3Bucket = new AWS.S3({
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          region: process.env.AWS_REGION,
        });
      
        
        let params = {
          Bucket: process.env.AWS_BUCKET_NAME + "/" + req.user._id.toString() + "/account",
          Key: req.user._id.toString() + '.' + req.body.accountLogoExtension,
          Body: req.file.buffer,
          ContentType: req.file.mimetype,
          ACL: "public-read"
        };
      
        await s3Bucket.upload(params, function (err, data) {
          if(err){

          }
        }); 
      }

      return res.send(req.user);
    }
    catch(error){
      return res.status(501).json(error.message);
    }
  }
  res.status(403).send({ error: "No user found." });  
});


router.get("/get-facebook-url", auth, async (req, res) => {
  const stringifiedParams = queryString.stringify({
    client_id: process.env.FB_APP_ID,
    redirect_uri: `${process.env.BACKEND_API}/authentication/facebook`,
    state: req.user._id,
    scope:
      "email,public_profile, instagram_basic, instagram_manage_insights, pages_show_list, pages_manage_metadata, pages_read_engagement, pages_read_user_content, read_insights", // comma seperated string
    response_type: "code",
    auth_type: "rerequest",
    display: "popup",
  });
  const facebookLoginUrl = `https://www.facebook.com/v6.0/dialog/oauth?${stringifiedParams}`;

  
  res.send(facebookLoginUrl);
});

router.get("/get-facebook-page-url", auth, async (req, res) => {
  const stringifiedParams = queryString.stringify({
    client_id: process.env.FB_APP_ID,
    redirect_uri: `${process.env.BACKEND_API}/authentication/facebookpage`,
    state: req.user._id,
    scope:
      "email,public_profile, pages_show_list, pages_manage_metadata, pages_read_engagement, pages_read_user_content, read_insights", // comma seperated string
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

    const user = await User.updateOne(
      { _id: userId },
      {
        fb_access_token: data,
        chosen_instagram_account: data.user_id,
      }
    );
    return res.redirect(`${process.env.APP_FRONTEND_URL}#/accounts`);
  

});

router.get("/get-google-ga-url", auth, async (req, res) => {
  res.send(`${process.env.BACKEND_API}/auth/googleauth/ga/${req.user._id}`);
});

router.get("/get-google-yt-url", auth, async (req, res) => {
  res.send(`${process.env.BACKEND_API}/auth/googleauth/yt/${req.user._id}`);
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
      let businessAcc = {};
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
            let businessAccount = instagramResponse.find(x=>x.instagram_business_account);
            if(businessAccount){
              instagramAccountId = businessAccount.instagram_business_account.id;
              businessAcc = businessAccount;
            }
          } else if (instagramResponse.instagram_business_account) {
            instagramAccountId =
              instagramResponse.instagram_business_account.id;
          }
          //instagramAccountId = instagramResponse[0].id;
        }
        let igAccDetail = await InstagramRepository.getIgAccountDetail(
          instagramAccountId,
          accessToken
        );

        let fbPageDetail = {};
        businessAcc.profile = {};
        if(igAccDetail && igAccDetail.data){
          businessAcc.profile = igAccDetail.data;
         
        }

        if(businessAcc && businessAcc.id && businessAcc.access_token){
          let fbRes = await InstagramRepository.getFbPageDetail(
            businessAcc.id,
            businessAcc.access_token
          );
          if(fbRes && fbRes.data){
            fbPageDetail = fbRes.data;
          }
        }
        businessAcc.fb_page_account = fbPageDetail;

        if(businessAcc && businessAcc.profile && businessAcc.profile.profile_picture_url){
          //let profile_url = `${baseGraphApi}${businessAcc.id}/picture?access_token=${accessToken}`;
          await InstagramRepository.uploadProfilePictureAWS(businessAcc.profile.profile_picture_url,userId, true);
          let profile_url_save =  process.env.AWS_UPLOADED_FILE_URL_LINK + userId + '/instagram/' + 'profile' + path.extname(Url.parse(businessAcc.profile.profile_picture_url).pathname);
          businessAcc.profile.profile_picture_url = profile_url_save;  
        }

        console.log("Instagram account ID: ", instagramAccountId);
        const user = await User.updateOne(
          { _id: userId },
          {
            fb_access_token: data,
            chosen_instagram_account: instagramAccountId,
            ig_detail: businessAcc
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


router.get("/authentication/facebookpage", async (req, res) => {
  let code = req.query.code;
  let userId = req.query.state;
  try {
    const { data } = await axios({
      url: "https://graph.facebook.com/v6.0/oauth/access_token",
      method: "get",
      params: {
        client_id: process.env.FB_APP_ID,
        client_secret: process.env.FB_APP_SECRET,
        redirect_uri: `${process.env.BACKEND_API}/authentication/facebookpage`,
        code,
      },
    });
    //logger.info("data ");
   
    try {
      // finding the user based on id and updating the token for that user

      // SAVE INSTAGRAM ID
      let accessToken = data.access_token;
      let account_detail = null;
      try {
        let facebookResponse = await InstagramRepository.getAccounts(
          accessToken
        );
        if(facebookResponse && facebookResponse.data && facebookResponse.data.data){
          account_detail = facebookResponse.data.data[0];
          
          let existing_user = await (await User.findOne({ _id: userId })).toObject();
          if(existing_user && existing_user.fb_detail){
            let existingPage = facebookResponse.data.data.find(x=>x.id == existing_user.fb_detail.id);
            if(existingPage){
              account_detail = existingPage;
            }
          }
        }
        if (account_detail) {
          let fbRes = await InstagramRepository.getFbPageDetail(
            account_detail.id,
            data.access_token
          );
          if(fbRes && fbRes.data){
            Object.assign(account_detail, fbRes.data);
          }
          if(account_detail && account_detail.picture && account_detail.picture.data){
            await InstagramRepository.uploadProfilePictureAWS(account_detail.picture.data.url, userId, false);
            let profile_url_save =  process.env.AWS_UPLOADED_FILE_URL_LINK + userId + '/facebook/' + 'profile' + path.extname(Url.parse(account_detail.picture.data.url).pathname);
            account_detail.picture.profile_picture_url = profile_url_save;  
          }
  
        
        const user = await User.updateOne(
          { _id: userId },
          {
            fb_detail: account_detail,
            fb_access_token: data,
          });
        }
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



router.get("/tiktok/user/:name", auth, async function(req,res){
  try{
    const user = await User.findOne({ _id: req.user._id }); // fetching the user data based onn id from the user model
    if (!user) {
      res.send();
    }
   
  let tiktok_user = await TikTokScraper.getUserProfileInfo(req.params.name); 
  if(tiktok_user && tiktok_user.user.uniqueId){

    await InstagramRepository.uploadProfilePictureAWS(tiktok_user.user.avatarThumb,  req.user._id.toString(), false, true);
    let profile_url_save =  process.env.AWS_UPLOADED_FILE_URL_LINK + userId + '/tiktok/' + 'profile' + path.extname(Url.parse(account_detail.picture.data.url).pathname);
    tiktok_user.user.avatarThumb = profile_url_save;  
  
    await User.findOneAndUpdate(
      { _id: req.user._id },
      { tiktok_detail: tiktok_user },
      { new: true }
    );
  }
  res.send(tiktok_user);
  }
  catch(err){
    res.send(err);
  }
});

router.get("/tiktok/posts", auth, async function(req,res){
  try{
    const user = await User.findOne({ _id: req.user._id }); // fetching the user data based onn id from the user model
    if (!user) {
      res.send();
    }
    let userObj = user.toObject();
    const posts = await TikTokScraper.user(userObj.tiktok_detail.user.id, { number: 100, by_user_id: true });
    res.send(posts);
  }
  catch(err){
    res.send(err);
  }
});


module.exports = router;
