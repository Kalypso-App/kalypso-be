const request = require('request-promise')
const campaignRepository = require("../models/repositories/CampaignRepository");
const InstagramRepository = require("../models/repositories/InstagramRepository");
const GARepository = require("../models/repositories/GARepository");
const ogs = require('open-graph-scraper');
const multer = require("multer");
let AWS = require("aws-sdk");
const path = require('path')
const Url = require('url');
const email = require("../utils/email");
const TikTokScraper = require('tiktok-scraper');

let storage = multer.memoryStorage();
let upload = multer({ storage: storage });

const { formatInsightResponse } = require("../utils/instagram");

const Campaign = require("../models/Campaign");
const User = require("../models/User");
const Story = require("../models/Story");
const Reel = require("../models/Reel");

const logger = require("../config/logger");
const { post } = require('../routers/user');

class CampaignController {

  

  async create(req, res) {
    let campaign = req.body;
    campaign.owner = req.user._id;
    campaign.modified_date = new Date();
    let accessToken;
    try {
      let newCampaign = await campaignRepository.create(campaign);
      req.user.campaigns.push(newCampaign._id);
      req.user.save();
      if(req.user && req.user.fb_access_token && req.user.fb_access_token.access_token){
        accessToken = req.user.fb_access_token.access_token;
      }
      await this.saveInsights(accessToken, req.user.id, newCampaign.id);
      let updatedCampaign = await Campaign.findById(newCampaign.id);
      await this.sendEmailToAdmin(newCampaign.id);
      res.json(updatedCampaign);
    } catch (error) {
      res.status(500).json({
        error,
      });
    }
  }

  async edit(req, res) {
    let campaign = req.body;
    campaign.owner = req.user._id;
    campaign.modified_date = new Date();
    let accessToken;
    try {
      let existCampaign = await Campaign.findById(campaign._id);
      if(existCampaign){
        let updated = await Campaign.replaceOne({"_id": campaign._id}, campaign);
        
        if(req.user && req.user.fb_access_token && req.user.fb_access_token.access_token){
          accessToken = req.user.fb_access_token.access_token;
        }
        await this.saveInsights(accessToken, req.user.id, campaign._id);
        let updatedCampaign = await Campaign.findById(campaign._id);
      
        return res.status(200).json(updatedCampaign);
      }
      else{
        res.status(501).json('Something went wrong!');
      }
    } catch (error) {
      res.status(500).json({
        error,
      });
    }
  }

  // Save all insights.
  async saveInsights(fbAccessToken, userid, campaignId, autoUpdate = true){
    let campaign = await (await Campaign.findById(campaignId)).toObject();
    let user = await (await (await User.findById(userid)).toObject());
    if(campaign){
      if(campaign.posts && campaign.posts.length){
        for(var post of campaign.posts){
          let response = await this.getIgPosts(fbAccessToken, post.id);
          if(response && response.post){
            post.insights = response.insight;
            post.post_detail = response.post;
            post.account_detail = user.ig_detail.profile;
          }
        }
      }
      if(campaign.stories && campaign.stories.length){
        for(var story of campaign.stories){
          let response = await this.getIgStories(fbAccessToken, story.id);
          if(response && response.insight && Object.keys(response.insight).length){
            let swipe_ups = 0;
            if(story.insights){
              swipe_ups = story.insights.swipe_ups || 0;
            }
            story.insights = response.insight;
            story.insights.swipe_ups = swipe_ups;
          }
          if(response && response.post){
            story.post_detail = response.post;
            story.account_detail = user.ig_detail.profile;
          }
          else if(story.media_url){
            story.post_detail = {};
            story.post_detail.media_url = story.media_url;
            story.account_detail = user.ig_detail.profile;
          }
        }
      }
      if(campaign.yt_videos && campaign.yt_videos.length){
        for(var youtube of campaign.yt_videos){
          let acc_detail = await this.getYouTubeChannel(userid, youtube.snippet.channelId);
          let response = await this.getYoutubeStats(userid, youtube.contentDetails.videoId);
          let analytics = await this.getYouTubeAnalyticsData(userid,youtube);
          youtube.insights = response;
          youtube.analytics = analytics;
          youtube.account_detail = {...acc_detail, ...user.google_detail};
        }
      }
      if(campaign.blog_pages && campaign.blog_pages.length){
        
        for(var blog_page of campaign.blog_pages){
          let date = campaign.due_date;
          if(campaign.ga_blog_date){
            date = campaign.ga_blog_date;
          }
          let response = await this.getGoogleAnalyticsStatsByTitle(userid, blog_page.viewid, date, blog_page.insights["ga:pagePath"]);
          let responseMonthly = await this.getGoogleAnalyticsStatsMonthly(userid, campaign.blog_pages[0].viewid);
     
          if(response){
            blog_page.insight_detail = response;
            blog_page.account_detail = {...responseMonthly.totalsForAllResults, ...user.google_ga_detail};
         
            let index = response.columnHeaders.findIndex(x=>x.name == 'ga:pagePath');
            if(index != -1 && response.rows && response.rows.length){
              try{
                const options = { url: `${blog_page.websiteUrl}${response.rows[0][index]}` };
                let ogResult = await ogs(options);
                if(ogResult && ogResult.result){
                  blog_page.ogImage = ogResult.result.ogImage;
                }
              }
              catch(err){

              }
            } 
          }
        }

      }
      if(campaign.fbposts && campaign.fbposts.length){
        let page_access_token = user.fb_detail.access_token;
        for(var post of campaign.fbposts){
          let response = await this.getFbPosts(page_access_token, fbAccessToken, post.id);
          if(response && response.post){
            post.insights = response.insight;
            post.post_detail = response.post;
            post.comment_detail = response.comment;
            post.account_detail = user.fb_detail;
          }
        }
      }
      if(campaign.reels && campaign.reels.length){
        let acc_detail = user.ig_detail;
        for(var reel of campaign.reels){
          reel.account_detail = acc_detail.profile;
        }
      }
      if(campaign.tiktoks && campaign.tiktoks.length){
        let acc_detail = user.tiktok_detail;
        for(var tiktok of campaign.tiktoks){
          // Only save to AWS if not saved before
          if(!tiktok.awsurl){
            await this.saveTiktok(tiktok.covers.default, tiktok.id, userid, campaignId);
            let url =  process.env.AWS_UPLOADED_FILE_URL_LINK + userid + '/' + campaignId + '/' + tiktok.id + ".jpeg";
            tiktok.awsurl = url;
          }
          let top5_playCount = await this.getTiktokViralFactor(userid);
          let virality_factor = top5_playCount / (acc_detail.stats.followerCount * 100);
          tiktok.virality_factor = virality_factor;
          tiktok.account_detail = acc_detail;
          
        }
      }
    }
    if(!autoUpdate){
      return true;
    }
    return await Campaign.updateOne(
      { _id: campaignId },
      {
        posts: campaign.posts,
        yt_videos: campaign.yt_videos,
        blog_pages: campaign.blog_pages,
        stories: campaign.stories,
        fbposts: campaign.fbposts,
        reels: campaign.reels,
        tiktoks: campaign.tiktoks
      }
    );

  }

  async getIgPosts(fbAccessToken, id){
    try{
      let response = await InstagramRepository.getInsights(
        fbAccessToken,
        id
      );

      if (response) {
        let post = {
          insight: response.response.data.data,
          post: response.postDetail.data
        }
        return post;
      }
    }
    catch(ex){
      return null;
    }
  }

  async getIgStories(fbAccessToken, id){
    try{
      let response = await InstagramRepository.getInsights(
        fbAccessToken,
        id,
        false
      );
      let post = {
        insight: {},
        post: {}
        };
      if (response) {
       
          if(response && response.postDetail){
            post.post = response.postDetail.data;
          }   
          if(response.response && response.response.data && response.response.data.data){
            /*
              impressions
              reach
              taps_forward
              taps_back
              exits
              replies
            */
           let insightObj = {};
           ["impressions",
           "reach",
           "taps_forward",
           "taps_back",
           "exits",
           "replies"].forEach(name=>{
            let findInsight = response.response.data.data.find(x=>x.name == name);
              if(findInsight && findInsight.values && findInsight.values.length){
                insightObj[name] = findInsight.values[0].value;
              }
            });
            post.insight = insightObj;
          } 
        }
        return post;
    }
    catch(ex){
      return null;
    }
  }

  async getFbPosts(pageAccessToken, fbAccessToken, id){
    try{
      let response = await InstagramRepository.getFacebookInsights(
        pageAccessToken,
        fbAccessToken,
        id
      );

      if (response) {
        let post = {
          insight: response.response.data.data,
          comment: response.commentDetail.data,
          post: response.postDetail.data
        }
        return post;
      }
    }
    catch(ex){
      return null;
    }
  }


  async getYoutubeStats(userid, videoid){
    try{
      let response = await GARepository.getytinsights(userid, videoid);
      return response;
    }
    catch(ex){
      return [];
    }
  }

  async getYouTubeChannel(userid, channelid){
    try{
      let response = await GARepository.getytchannel(userid, channelid);
      return response;
    }
    catch(ex){
      return null;
    }
  }

  async getYouTubeAnalyticsData(userid, video){
    try{
      let response = await GARepository.getYoutubeAnalytics(userid, video);
      return response;
    }
    catch(ex){
      return null;
    }
  }

  async getGoogleAnalyticsStats(userid, viewid){
    try{
      let response = await GARepository.getGAInsights(userid, viewid);
      return response;
    }
    catch(ex){
      return [];
    }
  }
  async getGoogleAnalyticsStatsMonthly(userid, viewid){
    try{
      let response = await GARepository.getGAInsightsMonthly(userid, viewid);
      return response;
    }
    catch(ex){
      return [];
    }
  }

  async getGoogleAnalyticsStatsByTitle(userid, viewid, startDate, title){
    try{
      let response = await GARepository.getGAInsightsByTitle(userid, viewid, startDate, title);
      return response;
    }
    catch(ex){
      return [];
    }
  }

  async list(req, res) {
    try {
      let campaignIds = req.user.campaigns;
      let campaigns = await Campaign.find({ _id: campaignIds }).sort({modified_date: -1});
      res.json(campaigns);
    } catch (error) {
      res.status(500).json({
        error,
      });
    }
  }

  async get(req, res) {
    try {
      let campaignId = req.params.id;
      let campaign = await (await Campaign.findById(campaignId)).toObject();
      if(campaign.isProCampaign){
        let owner = await User.findById(campaign.owner.toString());
        campaign.account_logo = owner.account_logo;
      };
      res.status(201).json({campaign});
    } catch (error) {
      res.status(403).json({
        error,
      });
    }
  }

  async delete(req, res) {
    try {
      let campaignId = req.params.id;
      
      await Campaign.deleteOne({_id: campaignId})
      res.status(200).json();
    } catch (error) {
      res.status(403).json({
        error
      });
    }
  }

  async search(req, res){
    try {
      let search = req.params.text;
      let campaignIds = req.user.campaigns;
      let campaigns = await Campaign.find({ _id: campaignIds, name: new RegExp(search, "i") }).sort({modified_date: -1});
      res.json(campaigns);
    } catch (error) {
      res.status(500).json({
        error,
      });
    }
  }

  async sync(req, res){
    let campaignId = req.params.id;
    let accessToken;
    if(req.user && req.user.fb_access_token && req.user.fb_access_token.access_token){
      accessToken = req.user.fb_access_token.access_token;
    }
    await this.saveInsights(accessToken, req.user.id, campaignId);
    let updatedCampaign = await Campaign.findById(campaignId);
    res.json(updatedCampaign);   
  }

  async saveStory(req, res) {
    let story = {};
    story.owner = req.user._id;
    story.modified_date = new Date();
    story.insights = {};
    story.id = req.user._id.toString();

    // This is for manully uploaded Story
    if(req.body.isEditOlderStory == 'true'){

      story.insights.impressions = parseInt(req.body.impressions);
      story.insights.reach = parseInt(req.body.reach);
      story.insights.taps_back = parseInt(req.body.taps_back);
      story.insights.taps_forward = parseInt(req.body.taps_forward);
      story.insights.exits = parseInt(req.body.exits);
      story.insights.replies = parseInt(req.body.replies);
      story.insights.swipe_ups = parseInt(req.body.swipe_ups);
      
      story.isOlderStory = true;

      let Storykey = "";
      // Edit story if Older Story id present else create new one
      if(req.body.olderStoryId){
        let updateObj =  {
          insights: story.insights
        };
        if(req.body.oldStoryExtension && req.body.oldStoryExtension !== 'null'){
          updateObj.media_url = req.body.olderStoryId + '.' + req.body.oldStoryExtension;
          updateObj.awsMediaUrl = req.body.olderStoryId + '.' + req.body.oldStoryExtension;
        }
        Storykey = req.body.olderStoryId.toString();

        await Story.updateOne(
          { _id: req.body.olderStoryId },
          updateObj
        );  
      }
      else{
        let addedStory = await Story.create(story);
        let newStory = await (addedStory).toObject();
        Storykey = newStory._id.toString();
        await req.user.stories.push(addedStory._id);
        req.user.save();
        await Story.updateOne(
          { _id: addedStory._id },
          {
            media_url: newStory._id.toString() + '.' + req.body.oldStoryExtension,
            awsMediaUrl: newStory._id.toString() + '.' + req.body.oldStoryExtension,
            id: newStory._id.toString()
          }
        );  
      }


      if(req.file && req.file.buffer){
        let s3Bucket = new AWS.S3({
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          region: process.env.AWS_REGION,
        });
      
        
        let params = {
          Bucket: process.env.AWS_BUCKET_NAME + "/" + req.user._id.toString(),
          Key: Storykey + '.' + req.body.oldStoryExtension,
          Body: req.file.buffer,
          ContentType: req.file.mimetype,
          ACL: "public-read"
        };
      
        s3Bucket.upload(params, function (err, data) {
          if(err){

          }
          res.status(200).json();
        }); 
      }
      else{
        res.status(200).json();
      }
    }
    else{
      let st = await(await Story.findOne(
        { id: req.body.olderStoryId })).toObject();
        if(st){
          let insights = st.insights || {};
          insights.swipe_ups = parseInt(req.body.swipe_ups);

        await Story.updateOne(
          { id: req.body.olderStoryId },
          { insights : insights}
        );  
        }
        res.status(200).json();
    }
  }

  async deleteStory(req, res){
    try {
      let storyId = req.params.id;
      
      await Story.deleteOne({_id: storyId})
      res.status(200).json();
    } catch (error) {
      res.status(403).json({
        error
      });
    }
  }

  
  async saveReel(req, res) {
    let reel = {};
    reel.owner = req.user._id;
    reel.modified_date = new Date();
    reel.insights = {};
    reel.id = req.user._id.toString();

    reel.insights.reel_views = parseInt(req.body.reel_views);
    reel.insights.reel_likes = parseInt(req.body.reel_likes);
    reel.insights.reel_comments = parseInt(req.body.reel_comments);
    if(req.user && req.user.ig_detail){
      reel.account_detail = req.user.ig_detail.profile;
    }
  
    let Reelkey = "";
    // Edit story if Older Story id present else create new one
    if(req.body.olderReelId){
      let updateObj =  {
        insights: reel.insights
      };
      if(req.body.oldReelExtension && req.body.oldReelExtension !== 'null'){
        updateObj.media_url = req.body.olderReelId + '.' + req.body.oldReelExtension;
        updateObj.awsMediaUrl = req.body.olderReelId + '.' + req.body.oldReelExtension;
      }
      Reelkey = req.body.olderReelId.toString();

      await Reel.updateOne(
        { _id: req.body.olderReelId },
        updateObj
      );  
    }
    else{
      let addedReel = await Reel.create(reel);
      let newReel = await (addedReel).toObject();
      Reelkey = newReel._id.toString();
      await req.user.reels.push(addedReel._id);
      req.user.save();
      await Reel.updateOne(
        { _id: addedReel._id },
        {
          media_url: newReel._id.toString() + '.' + req.body.oldReelExtension,
          awsMediaUrl: newReel._id.toString() + '.' + req.body.oldReelExtension,
          id: newReel._id.toString()
        }
      );  
    }


    if(req.file && req.file.buffer){
      let s3Bucket = new AWS.S3({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION,
      });
    
      
      let params = {
        Bucket: process.env.AWS_BUCKET_NAME + "/" + req.user._id.toString() + "/reel",
        Key: Reelkey + '.' + req.body.oldReelExtension,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
        ACL: "public-read"
      };
    
      s3Bucket.upload(params, function (err, data) {
        if(err){

        }
        res.status(200).json();
      }); 
    }
    else{
      res.status(200).json();
    }
  }

  async deleteReel(req, res){
    try {
      let reelId = req.params.id;
      
      await Reel.deleteOne({_id: reelId})
      res.status(200).json();
    } catch (error) {
      res.status(403).json({
        error
      });
    }
  }

  async getAllCampaigns(req, res){
    try{
      let users = await User.find().sort();
      users = users.map(x=> ({ email: x.email, campaigns: x.campaigns}));
      return res.status(200).json(users);
    }
    catch(err){
      return res.status(200).json(err);
    }
  }

  
  // This cron job is for storing Instagram Story every day
  async runCron(){
    // Get list of users 
    let users = await User.find({});
    //users.forEach(async (userObj)=>{
    for(var userObj of users){
      let user = userObj.toObject();
      // See if User has linked Facebook account
      if(user && user.chosen_instagram_account && user.fb_access_token && user.fb_access_token.access_token){
        let response = null;
        try{
            response = await InstagramRepository.getStories(
            user.fb_access_token.access_token,
            user.chosen_instagram_account
          );
        }
        catch(e){
          logger.error(user._id.toString() + ' error :' + JSON.stringify(e));
        }
        //logger.info(JSON.stringify(response.data));
      
        if(response && response.data && response.data.length){
          for(var story of response.data){ 
            let isStoryAdded = await Story.find({id: story.id});
            if(isStoryAdded.length == 0){
              let urlPath = story.id + path.extname(Url.parse(story.media_url).pathname);
              story.awsMediaUrl = urlPath;
              story.owner = user._id;
              story.modified_date = new Date();
              let newStory = await (await Story.create(story)).toObject();
              await userObj.stories.push(newStory._id);
              await this.uploadFileToAWS(story.media_url, story.id, user._id.toString());
            }
          }
          await userObj.save();
        }
      }
    };
  }

  async uploadFileToAWS(url, storyId, userId){
    
    const options = {
      uri: url,
      encoding: null
    };

    const body = await request(options);

    let s3Bucket = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION,
    });
  
    let params = {
      Bucket: process.env.AWS_BUCKET_NAME + "/" + userId,
      Key: storyId + path.extname(Url.parse(url).pathname),
      Body: body,
      ContentType: 'application/octet-stream',
      ACL: "public-read"
    };
  
    s3Bucket.upload(params, function (err, data) {
      if(err){

      }
    });  
  }

  async forcesync(req, res){
    let campaignId = req.params.id;
    let accessToken;
    let userId = await (await Campaign.findById(campaignId)).toObject().owner.toString();
    let user = await (await (await User.findById(userId)).toObject());
    accessToken = user.fb_access_token.access_token;
    await this.saveInsights(accessToken, userId, campaignId, false);
    let updatedCampaign = await Campaign.findById(campaignId);
    res.json(updatedCampaign);   
  }

  async saveTiktok(url, id, userId, campaignId){
    try{
    const options = {
      uri: url,
      encoding: null
    };

    const body = await request(options);

    let s3Bucket = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION,
    });
  
    let params = {
      Bucket: process.env.AWS_BUCKET_NAME + "/" + userId + '/' + campaignId,
      Key: id + ".jpeg",
      Body: body,
      ContentType: 'application/octet-stream',
      ACL: "public-read"
    };
    s3Bucket.upload(params, function (err, data) {
      if(err){
        logger.error(JSON.stringify(err));
      }
    });  
    }
    catch(err){

    }
  }

  async getTiktokViralFactor(userId){

    let total = 0;
    const posts = await TikTokScraper.user(userId, { number: 5, by_user_id: true });
    if(posts && posts.collector.length){
      posts.collector.forEach((tiktok)=>{
        total += tiktok.playCount;
      });
    }
    return 0;
  }

  async runFBTokenDebugger(){
      // Get list of users 
      /*
      let users = await User.find({});
      //users.forEach(async (userObj)=>{
      for(var userObj of users){
        let user = userObj.toObject();
        // Check user is still paying

        // See if User has linked Facebook account
        if(user && user.chosen_instagram_account && user.fb_access_token && user.fb_access_token.access_token){
          //debug_token?input_token={input-token}"


        }

      }
      */       
  }

  async sendEmailToAdmin(campaignId){
    let subject;
    subject = "New Campaign Created by ";

    let userId = await (await Campaign.findById(campaignId)).toObject().owner.toString();
    let user = await (await User.findById(userId)).toObject();

    let campaigns = await Campaign.find({ owner: userId }).sort({modified_date: -1});

    subject += user.email + " (" + campaignId + ")";

    let shareUrlPrefix = `${process.env.APP_FRONTEND_URL}#/share/`;
    
    let otherCampaignsHtml = "";
    let otherCampaignsText = "";
    campaigns.forEach(x=>{
      otherCampaignsHtml += `<p> <a href="${shareUrlPrefix}${x._id.toString()}" target="_blank">${x._id.toString()}</a> </p>`;
      otherCampaignsText += `${shareUrlPrefix}${x._id.toString()}`;    
    });
   

    let html = `<p>Hi Admin</p>
    <p>New Campaign created by ${user.name} - ${user.email} as campaign id ${campaignId} on Kalypso Web App.</p>
    <p>You can find shared link for latest campaign <a href="${shareUrlPrefix}${campaignId}" target="_blank">here</a> .</p>
    <p>You can also find list of all campaigns share links as below list.</p>
    ${otherCampaignsHtml}`;

    let text = `Hi Admin,
    New Campaign created by ${user.name} - ${user.email} as campaign id ${campaignId} on Kalypso Web App.
    You can find shared link for latest campaign ${shareUrlPrefix}${campaignId}.
    You can also find list of all campaigns share links as below list.
    ${otherCampaignsText}`;
   
    email.sendCampaignCreatedEmail(subject, html, text);
  }

}

module.exports = CampaignController;
