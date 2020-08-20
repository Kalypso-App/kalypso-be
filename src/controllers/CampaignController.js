const campaignRepository = require("../models/repositories/CampaignRepository");
const InstagramRepository = require("../models/repositories/InstagramRepository");
const { formatInsightResponse } = require("../utils/instagram");

const Campaign = require("../models/Campaign");

class CampaignController {
  async create(req, res) {
    let campaign = req.body;
    campaign.owner = req.user._id;
    try {
      let newCampaign = await campaignRepository.create(campaign);
      req.user.campaigns.push(newCampaign._id);
      req.user.save();
      res.json(newCampaign);
    } catch (error) {
      res.status(500).json({
        error,
      });
    }
  }

  async list(req, res) {
    try {
      let campaignIds = req.user.campaigns;
      let campaigns = await Campaign.find({ _id: campaignIds });
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
      let campaignPosts = campaign.posts;
      let campaignStories = campaign.stories;
      
      let accessToken = req.user.fb_access_token.access_token;
      let insightsForAllCampaignPosts = {
        campaign: campaign,
        posts: [],
        stories: [],
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
            insightsForAllCampaignPosts.posts.push({
              stories: campaignStories[i],
              insights: formatInsightResponse(response.data.data),
            });
          }
        }
        catch(ex){
            insightsForAllCampaignPosts.posts.push({
              stories: campaignPosts[i],
              insights:[],
              error: ex.message
            });
        }
        }
      }

      res.status(201).json(insightsForAllCampaignPosts);
    } catch (error) {
      res.status(403).json({
        error,
      });
    }
  }
}

module.exports = CampaignController;
