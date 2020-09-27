const Campaign = require('../Campaign');
const { google } = require("googleapis");
const User = require("../User");

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URL = process.env.GOOGLE_REDIRECT_URL;
const VIEW_ID = process.env.GOOGLE_VIEW_ID;

const oAuth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URL
);

class GARepository {
    constructor(model) {
        this.model = model;
    }

  //---------------- Endpoint for getting list of playlist starts -----------------------------//
  async getytinsights(userid, videoid) {
    const user = await User.findOne({ _id: userid }); // fetching the user data based onn id from the user model
    if (!user) {
      // if no user found with id then return the response
      return {};
    }
    oAuth2Client.setCredentials(user.google_tokens[0]); // setting the crdentials for old tokens to oAuth
    //oAuth2Client.refreshAccessToken((err, tokens) => {
      
    const ytchannel = google.youtube({ version: "v3" });
    let response = await ytchannel.videos.list(
      {
        auth: oAuth2Client,
        part: "statistics",
        id: videoid
      });
      if(response && response.data.items && response.data.items.length){
        return response.data.items[0].statistics;
      }
      return [];
  };

  async getytchannel(userid, channelid) {
    const user = await User.findOne({ _id: userid }); // fetching the user data based onn id from the user model
    if (!user) {
      // if no user found with id then return the response
      return {};
    }
    oAuth2Client.setCredentials(user.google_tokens[0]); // setting the crdentials for old tokens to oAuth
    //oAuth2Client.refreshAccessToken((err, tokens) => {
      
    const ytchannel = google.youtube({ version: "v3" });
    let response = await ytchannel.channels.list(
      {
        auth: oAuth2Client,
        part: "statistics",
        id: channelid
      });
      if(response && response.data.items && response.data.items.length){
        return response.data.items[0].statistics;
      }
      return [];
  };

  async getGAInsights(userid, viewid) {
    const user = await User.findOne({ _id: userid }); // fetching the user data based onn id from the user model
    if (!user) {
      // if no user found with id then return the response
      return {};
    }
    oAuth2Client.setCredentials(user.google_ga_tokens[0]); // setting the crdentials for old tokens to oAuth
    //const gareport = google.analytics({ version: "v3" });    
    let response = await google.analytics({ version: "v3" }).data.ga.get(
      {
        // getting the analytics of a view based on view id passed
        auth: oAuth2Client,
        ids: "ga:" + viewid,
        "start-date": "30daysAgo",
        "end-date": "today",
        metrics:
          "ga:users,ga:newUsers,ga:percentNewSessions,ga:sessions,ga:bounceRate,ga:pageviews,ga:timeOnPage,ga:avgTimeOnPage,ga:organicSearches",
        dimensions: "ga:pageTitle",
        sort: "ga:pageviews",
        "include-empty-rows": false,
        output: "json",
      }).catch(err=>{

      })

      return response.data;
  };

  async getGAInsightsByTitle(userid, viewid,startDate, title) {
    const user = await User.findOne({ _id: userid }); // fetching the user data based onn id from the user model
    if (!user) {
      // if no user found with id then return the response
      return {};
    }
    oAuth2Client.setCredentials(user.google_ga_tokens[0]); // setting the crdentials for old tokens to oAuth
    //const gareport = google.analytics({ version: "v3" });    
    let response = await google.analytics({ version: "v3" }).data.ga.get(
      {
        // getting the analytics of a view based on view id passed
        auth: oAuth2Client,
        ids: "ga:" + viewid,
        "start-date": new Date(startDate).toISOString().substring(0, 10),
        "end-date": "today",
        metrics:
          "ga:users,ga:newUsers,ga:percentNewSessions,ga:sessions,ga:bounceRate,ga:pageviews,ga:timeOnPage,ga:avgTimeOnPage,ga:organicSearches",
        dimensions: "ga:date,ga:pageTitle,ga:pagePath",
        sort: "ga:pageviews",
        "include-empty-rows": false,
        filters: `ga:pagePath==${title}`,
        output: "json",
      }).catch(err=>{

      })

      return response.data;
  };

  async getGAInsightsMonthly(userid, viewid) {
    const user = await User.findOne({ _id: userid }); // fetching the user data based onn id from the user model
    if (!user) {
      // if no user found with id then return the response
      return {};
    }
    oAuth2Client.setCredentials(user.google_ga_tokens[0]); // setting the crdentials for old tokens to oAuth
    //const gareport = google.analytics({ version: "v3" });    
    let response = await google.analytics({ version: "v3" }).data.ga.get(
      {
        // getting the analytics of a view based on view id passed
        auth: oAuth2Client,
        ids: "ga:" + viewid,
        "start-date": "30daysAgo",
        "end-date": "today",
        metrics:
          "ga:users,ga:newUsers,ga:percentNewSessions,ga:sessions,ga:bounceRate,ga:pageviews,ga:timeOnPage,ga:avgTimeOnPage,ga:organicSearches",
        dimensions: "ga:pageTitle",
        sort: "ga:pageviews",
        "include-empty-rows": false,
        output: "json",
      }).catch(err=>{

      });
      return response.data;
  };

  async getYoutubeAnalytics(userid, youtube) {
    const user = await User.findOne({ _id: userid }); // fetching the user data based onn id from the user model
    if (!user) {
      // if no user found with id then return the response
      return {};
    }
    oAuth2Client.setCredentials(user.google_tokens[0]); // setting the crdentials for old tokens to oAuth
     
    let channelId =  youtube.snippet.channelId;
    let videoId =  youtube.contentDetails.videoId;
    let startDate = youtube.contentDetails.videoPublishedAt.substring(0, 10);
    let endDate = new Date();
    endDate.setDate(endDate.getDate() + 1);
    endDate = endDate.toISOString().substring(0, 10);

    try{
    let youtubeAnalytics = await google.youtubeAnalytics({
      version: 'v2', auth: oAuth2Client
    }).reports.query({
      "ids": `channel==${channelId}`,
      "startDate": startDate,
      "endDate": endDate,
      "metrics": "views,comments,likes,dislikes,shares,averageViewDuration,averageViewPercentage,estimatedMinutesWatched,annotationImpressions,cardClickRate",
      "dimensions": "day",
      "filters": `video==${videoId}`,
      "sort": "day"
    });
    return youtubeAnalytics.data;
    }
    catch(e){
      return null;
    }
  }


}

module.exports = new GARepository(Campaign);