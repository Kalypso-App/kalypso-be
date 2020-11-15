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

//---------------- 1st endoint for authenticating the user starts -----------------------------//
router.get("/auth/googleauth/ga/:userid", async (req, res) => {
  console.log(req.params.userid);
  //if (!authed) {
    // Generate an OAuth URL and redirect there
    const url = await oAuth2Client.generateAuthUrl({
      access_type: "offline",
      scope:
        "https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/analytics.readonly",
      state: req.params.userid + "|" + "ga", // passing user id as a state to redirect url
      prompt: "consent",
    });
    res.redirect(url);
  //}
});
//---------------- 1st endoint for authenticating the user ends -----------------------------//

//---------------- 1st endoint for authenticating the user starts -----------------------------//
router.get("/auth/googleauth/yt/:userid", async (req, res) => {
  console.log(req.params.userid);
  //if (!authed) {
    // Generate an OAuth URL and redirect there
    const url = await oAuth2Client.generateAuthUrl({
      access_type: "offline",
      scope:
        "https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly",
      state: req.params.userid + "|" + "yt", // passing user id as a state to redirect url
      prompt: "consent",
    });
    res.redirect(url);
  //}
});
//---------------- 1st endoint for authenticating the user ends -----------------------------//


//---------------- endoint for callback url for authenticating the user starts -----------------------------//
router.get("/auth/google/callback", function (req, res) {
  const code = req.query.code;
  const staterecieved = req.query.state; // getting the state (user id) from the url
  const state = staterecieved.split("|")[0];
  const mode = staterecieved.split("|")[1];
  var OAuth2 = google.auth.OAuth2;

  if (code) {
    // Get an access token based on our OAuth code
    oAuth2Client.getToken(code, async (err, tokens) => {
      if (err) {
        console.log(err);
        return res.status(403).send({ message: "Error authenticating." });
      } else {
        console.log("Successfully authenticated");
        oAuth2Client.setCredentials(tokens);
        let google_profile = {};
        var oauth2 = google.oauth2({
          auth: oAuth2Client,
          version: 'v2'
        });
        let profile = await oauth2.userinfo.v2.me.get();
        if(profile && profile.data){
          google_profile = profile.data;
        }

        //authed = true;
        console.log("STATE IS ", state);
        let user;
        // For youtube
        if(mode == "yt"){
            user = await User.updateOne(
            { _id: state },
            { 
              google_tokens: tokens, 
              new: true,
              google_detail: google_profile
            }
          );
        }
        else{
          user = await User.updateOne(
            { _id: state },
            { 
              google_ga_tokens: tokens, 
              new: true,
              google_ga_detail: google_profile
            }
          );
        }
        // finding the user based on id and updating the token for that user
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
  oAuth2Client.setCredentials(user.google_ga_tokens[0]); // setting the crdentials for old tokens to oAuth
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
router.get("/auth/gareport/:userid/:viewid/", async (req, res) => {
  const user = await User.findOne({ _id: req.params.userid }); // fetching the user data based onn id from the user model
  if (!user) {
    // if no user found with id then return the response
    return res.status(403).send({ error: "No user found." });
  }
  oAuth2Client.setCredentials(user.google_ga_tokens[0]); // setting the crdentials for old tokens to oAuth
  oAuth2Client.refreshAccessToken((err, tokens) => {
    // generating the new access token based on the previous generated
    if (err) {
      console.log(err);
      return res.status(403).send({ message: "Error while generating token." }); // if any error while generating token, return
    }
    const gareport = google.analytics({ version: "v3" });
    let data = {
      auth: oAuth2Client,
      ids: "ga:" + req.params.viewid,
      "start-date": "30daysAgo",
      "end-date": "today",
      metrics:
        "ga:newUsers,ga:percentNewSessions,ga:sessions,ga:bounceRate,ga:pageviews",
      dimensions: "ga:pagePath, ga:pageTitle",
      sort: "-ga:pageviews",
      "include-empty-rows": false,
      output: "json",
    };
    if(req.query.search){
      data.filters =  `ga:pagePath=@${req.query.search}`
    }

    gareport.data.ga.get(
      data,
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

    /*
    var youtubeAnalytics = google.youtubeAnalytics({
      version: 'v2', auth: oAuth2Client
   });

   let dss = youtubeAnalytics.reports.query({
      "ids": "channel==UC3_TRTLOcKaAKupEDh2Mlrg",
      "startDate": "2020-08-01",
      "endDate": "2020-10-31",
      "metrics": "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained",
      "dimensions": "day",
      "sort": "day"
    }, (err, result) => {
      if (err)
        return {};
        return result.data;          
    });
*/
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
        maxResults: 50
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
