const campaignRepository = require("../models/repositories/CampaignRepository");
const InstagramRepository = require("../models/repositories/InstagramRepository");
const GARepository = require("../models/repositories/GARepository");

const { formatInsightResponse } = require("../utils/instagram");

const Campaign = require("../models/Campaign");

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
      res.json(updatedCampaign);
    } catch (error) {
      res.status(500).json({
        error,
      });
    }
  }

  // Save all insights.
  async saveInsights(fbAccessToken, userid, campaignId){
    let campaign = await (await Campaign.findById(campaignId)).toObject();
    if(campaign){
      if(campaign.posts && campaign.posts.length){
        for(var post of campaign.posts){
          let response = await this.getIgPosts(fbAccessToken, post.id);
          post.insights = response;
        }
      }
      if(campaign.stories && campaign.stories.length){
        for(var story of campaign.stories){
          story.insights = [];
        }
      }
      if(campaign.yt_videos && campaign.yt_videos.length){
        for(var youtube of campaign.yt_videos){
          let response = await this.getYoutubeStats(userid, youtube.contentDetails.videoId);
          youtube.insights = response;
        }
      }
      if(campaign.blog_pages && campaign.blog_pages.length){
        let response = await this.getGoogleAnalyticsStats(userid, campaign.blog_pages[0].viewid);
        let allInsights = [];

        if (response && response.rows) {
           response.rows.forEach((item, i) => {
            let insights = {};
            Object.keys(item).forEach((key, index) => {
              if (response.columnHeaders[index]) {
                insights[response.columnHeaders[index].name] =
                  item[index];
              }
            });
            allInsights.push(insights);
          });

          for(var blog_page of campaign.blog_pages){
            let insight = allInsights.find(x=>x["ga:pageTitle"] == blog_page.insights["ga:pageTitle"])
            if(insight){
              blog_page.insights = insight;
            }
          }
        }
      }
    }
    return await Campaign.updateOne(
      { _id: campaignId },
      {
        posts: campaign.posts,
        stories: campaign.stories,
        yt_videos: campaign.yt_videos,
        blog_pages: campaign.blog_pages
      }
    );

  }

  async getIgPosts(fbAccessToken, id){
    try{
      let response = await InstagramRepository.getInsights(
        fbAccessToken,
        id
      );

      if (response.data) {
        return formatInsightResponse(response.data.data);
      }
    }
    catch(ex){
      return [];
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

  async getGoogleAnalyticsStats(userid, viewid){
    try{
      let response = await GARepository.getGAInsights(userid, viewid);
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
      let campaign = await Campaign.findById(campaignId);
      // let campaignPosts = campaign.posts;
      // let campaignStories = campaign.stories;
      let insightsForAllCampaignPosts = {
        campaign: campaign
      };
      /*
      if(req.user && req.user.fb_access_token && req.user.fb_access_token.access_token){
        accessToken = req.user.fb_access_token.access_token;
      }
      let insightsForAllCampaignPosts = {
        campaign: campaign,
        posts: [],
        stories: []
      };
      let response;

      if (campaign && campaignPosts && campaignPosts.length) {
        for (let i = 0; i < campaignPosts.length; i++) {
           try{
          response = await InstagramRepository.getInsights(
            accessToken,
            campaignPosts[i].id
          );

          if (response.data) {
            insightsForAllCampaignPosts.posts.push({
              post: campaignPosts[i],
              insights: formatInsightResponse(response.data.data),
            });
          }
        }
        catch(ex){
          insightsForAllCampaignPosts.posts.push({
            post: campaignPosts[i],
            insights:[],
            error: ex.message
          });
        }
        }
      }

      if (campaign && campaignStories && campaignStories.length) {
        for (let i = 0; i < campaignStories.length; i++) {
          try{
          response = await InstagramRepository.getInsights(
            accessToken,
            campaignStories[i].id,
            false
          );

          if (response.data) {
            insightsForAllCampaignPosts.stories.push({
              stories: campaignStories[i],
              insights: formatInsightResponse(response.data.data),
            });
          }
        }
        catch(ex){
            insightsForAllCampaignPosts.stories.push({
              stories: campaignStories[i],
              insights:[],
              error: ex.message
            });
        }
        }
      }
      */
      res.status(201).json(insightsForAllCampaignPosts);
    } catch (error) {
      res.status(403).json({
        error,
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
}

module.exports = CampaignController;
