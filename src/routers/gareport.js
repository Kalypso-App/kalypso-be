const express = require("express");
const router = express.Router();
const { google } = require("googleapis");
const User = require("../models/User");
//const auth = require("../middleware/auth");
//const CampaignController = require("../controllers/CampaignController");
//const CampaignCtrl = new CampaignController();

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URL = process.env.GOOGLE_REDIRECT_URL;
const VIEW_ID = process.env.GOOGLE_VIEW_ID;

const oAuth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URL
);
let authed = false;

//---------------- 1st endoint for authenticating the user starts -----------------------------//
router.get("/auth/googleauth/:userid", async (req, res) => {
  console.log(req.params.userid);
  if (!authed) {
    // Generate an OAuth URL and redirect there
    const url = await oAuth2Client.generateAuthUrl({
      access_type: "offline",
      scope:
        "https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/youtube.readonly",
      state: req.params.userid, // passing user id as a state to redirect url
      prompt: "consent",
    });
    res.redirect(url);
  }
});
//---------------- 1st endoint for authenticating the user ends -----------------------------//

//---------------- endoint for callback url for authenticating the user starts -----------------------------//
router.get("/auth/google/callback", function (req, res) {
  const code = req.query.code;
  const state = req.query.state; // getting the state (user id) from the url
  if (code) {
    // Get an access token based on our OAuth code
    oAuth2Client.getToken(code, async (err, tokens) => {
      if (err) {
        console.log(err);
        return res.status(403).send({ message: "Error authenticating." });
      } else {
        console.log("Successfully authenticated");
        oAuth2Client.setCredentials(tokens);
        authed = true;
        console.log("STATE IS ", state);
        const user = await User.updateOne(
          { _id: state },
          { google_tokens: tokens, new: true }
        ); // finding the user based on id and updating the token for that user
        if (!user) {
          // if no user found with id then return the response
          return res.status(403).send({ error: "No user found." });
        }
        return res.redirect(process.env.APP_FRONTEND_URL + "/#/campaigns");
      }
    });
  }
});
//---------------- endoint for callback url for authenticating the user ends -----------------------------//

//---------------- 2nd endpoint for getting the list of views starts -----------------------------//
router.get("/auth/get-views/:userid", async (req, res) => {
  const user = await User.findOne({ _id: req.params.userid }); // fetching the user data based onn id from the user model
  if (!user) {
    // if no user found with id then return the response
    return res.status(403).send({ error: "No user found." });
  }
  oAuth2Client.setCredentials(user.google_tokens[0]); // setting the crdentials for old tokens to oAuth
  oAuth2Client.refreshAccessToken((err, tokens) => {
    // generating the new access token based on the previous generated refresh token
    if (err) {
      console.log(err);
      return res.status(403).send({ message: "Error while generating token." }); // if any error while generating token, return
    }
    const gareport = google.analytics({ version: "v3" });
    gareport.management.profiles.list(
      {
        // getting the list of views
        auth: oAuth2Client,
        accountId: "~all",
        webPropertyId: "~all",
      },
      (err, result) => {
        if (err)
          return res
            .status(403)
            .send({ message: "The API returned an error : " + err }); // if error fetching list, return
        return res.send({ message: "List of views", data: result.data }); // returning the list of the views
      }
    );
  });
});
//---------------- 2nd endpoint for getting the list of views ends -----------------------------//

//---------------- 3rd endpoint for getting the analytics of a view starts -----------------------------//
router.get("/auth/gareport/:userid/:viewid", async (req, res) => {
  const user = await User.findOne({ _id: req.params.userid }); // fetching the user data based onn id from the user model
  if (!user) {
    // if no user found with id then return the response
    return res.status(403).send({ error: "No user found." });
  }
  oAuth2Client.setCredentials(user.google_tokens[0]); // setting the crdentials for old tokens to oAuth
  oAuth2Client.refreshAccessToken((err, tokens) => {
    // generating the new access token based on the previous generated
    if (err) {
      console.log(err);
      return res.status(403).send({ message: "Error while generating token." }); // if any error while generating token, return
    }
    const gareport = google.analytics({ version: "v3" });
    gareport.data.ga.get(
      {
        // getting the analytics of a view based on view id passed
        auth: oAuth2Client,
        ids: "ga:" + req.params.viewid,
        "start-date": "30daysAgo",
        "end-date": "today",
        metrics:
          "ga:newUsers,ga:percentNewSessions,ga:sessions,ga:bounceRate,ga:pageviews",
        dimensions: "ga:pageTitle",
        sort: "ga:pageviews",
        "include-empty-rows": false,
        output: "json",
      },
      (err, result) => {
        if (err)
          return res
            .status(403)
            .send({ message: "The API returned an error : " + err }); // if error fetching analytics, return
        return res.send({ message: "Analytics of view", data: result.data }); // returning the analytics of the view
      }
    );
  });
});
//---------------- 3rd endpoint for getting the analytics of a view ends -----------------------------//

//======================================== Youtube apis =================================================//

//---------------- Endpoint for getting list of channels starts -----------------------------//
router.get("/auth/get-ytchannels/:userid", async (req, res) => {
  const user = await User.findOne({ _id: req.params.userid }); // fetching the user data based onn id from the user model
  if (!user) {
    // if no user found with id then return the response
    return res.status(403).send({ error: "No user found." });
  }
  oAuth2Client.setCredentials(user.google_tokens[0]); // setting the crdentials for old tokens to oAuth
  oAuth2Client.refreshAccessToken((err, tokens) => {
    // generating the new access token based on the previous generated
    if (err) {
      console.log(err);
      return res.status(403).send({ message: "Error while generating token." }); // if any error while generating token, return
    }
    const ytchannel = google.youtube({ version: "v3" });
    ytchannel.channels.list(
      {
        // getting the channnel list
        auth: oAuth2Client,
        part: "snippet,contentDetails,statistics",
        mine: true,
      },
      (err, result) => {
        if (err)
          return res
            .status(403)
            .send({ message: "The API returned an error : " + err }); // if error fetching channels, return
        return res.send({ message: "List of channels", data: result.data }); // returning the channel list
      }
    );
  });
});
//---------------- Endpoint for getting list of channels ends -----------------------------//

//---------------- Endpoint for getting list of playlist starts -----------------------------//
router.get("/auth/get-ytchannels/:userid/:channelid", async (req, res) => {
  const user = await User.findOne({ _id: req.params.userid }); // fetching the user data based onn id from the user model
  if (!user) {
    // if no user found with id then return the response
    return res.status(403).send({ error: "No user found." });
  }
  oAuth2Client.setCredentials(user.google_tokens[0]); // setting the crdentials for old tokens to oAuth
  oAuth2Client.refreshAccessToken((err, tokens) => {
    // generating the new access token based on the previous generated
    if (err) {
      console.log(err);
      return res.status(403).send({ message: "Error while generating token." }); // if any error while generating token, return
    }
    const ytchannel = google.youtube({ version: "v3" });
    ytchannel.playlists.list(
      {
        // getting the playlists based on channel id passed
        auth: oAuth2Client,
        part: "snippet",
        channelId: req.params.channelid,
      },
      (err, result) => {
        if (err) {
          console.log(err.message);
          return res
            .status(403)
            .send({ message: "The API returned an error : " + err }); // if error fetching playlists, return
        }

        return res.send({ message: "List of playlist", data: result.data }); // returning the playlists
      }
    );
  });
});
//---------------- Endpoint for getting list of playlist ends -----------------------------//

//---------------- Endpoint for getting list of playlist items starts -----------------------------//
router.get("/auth/get-ytvideos/:userid/:playlistid", async (req, res) => {
  const user = await User.findOne({ _id: req.params.userid }); // fetching the user data based onn id from the user model
  if (!user) {
    // if no user found with id then return the response
    return res.status(403).send({ error: "No user found." });
  }
  oAuth2Client.setCredentials(user.google_tokens[0]); // setting the crdentials for old tokens to oAuth
  oAuth2Client.refreshAccessToken((err, tokens) => {
    // generating the new access token based on the previous generated
    if (err) {
      console.log(err);
      return res.status(403).send({ message: "Error while generating token." }); // if any error while generating token, return
    }
    const ytchannel = google.youtube({ version: "v3" });
    ytchannel.playlistItems.list(
      {
        // getting the list of video based on playlist id passed
        auth: oAuth2Client,
        part: "snippet,contentDetails",
        playlistId: req.params.playlistid,
      },
      (err, result) => {
        if (err) {
          console.log(err);

          return res
            .status(403)
            .send({ message: "The API returned an error : " + err }); // if error fetching videos, return
        }

        return res.send({
          message: "List of playlist videos",
          data: result.data,
        }); // returning the playlist items
      }
    );
  });
});
//---------------- Endpoint for getting list of playlist items ends -----------------------------//

//---------------- Endpoint for getting video details starts -----------------------------//
router.get("/auth/get-ytvideodetail/:userid/:videoid", async (req, res) => {
  const user = await User.findOne({ _id: req.params.userid }); // fetching the user data based onn id from the user model
  if (!user) {
    // if no user found with id then return the response
    return res.status(403).send({ error: "No user found." });
  }
  oAuth2Client.setCredentials(user.google_tokens[0]); // setting the crdentials for old tokens to oAuth
  oAuth2Client.refreshAccessToken((err, tokens) => {
    // generating the new access token based on the previous generated
    if (err) {
      console.log(err);
      return res.status(403).send({ message: "Error while generating token." }); // if any error while generating token, return
    }
    const ytchannel = google.youtube({ version: "v3" });
    ytchannel.videos.list(
      {
        // getting the details of video based on video id passed
        auth: oAuth2Client,
        part: "snippet,contentDetails,statistics",
        id: req.params.videoid,
      },
      (err, result) => {
        if (err) {
          console.log(err);

          return res
            .status(403)
            .send({ message: "The API returned an error : " + err }); // if error fetching video details, return
        }

        return res.send({
          message: "Video Details",
          data: result.data,
        }); // returning the video details
      }
    );
  });
});
//---------------- Endpoint for getting video details ends -----------------------------//

module.exports = router;