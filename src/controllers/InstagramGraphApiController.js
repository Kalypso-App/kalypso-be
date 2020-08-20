const axios = require("axios");
const baseGraphApi = process.env.GRAPH_API;
const crypto = require("crypto");
const InstagramRepository = require("../models/repositories/InstagramRepository");
const StoryInsights = require("../models/StoryInsights");

class InstagramGraphApiController {
  constructor() {}

  async getAccounts(req, res) {
    let accessToken = req.user.fb_access_token.access_token;

    try {
      let response = await InstagramRepository.getAccounts(accessToken);
      res.send(response.data);
    } catch (error) {
      res.status(403).send(error.message);
    }
  }
  async setAccount(req, res) {
    let fbAccountId = req.params.id;
    let accessToken = req.user.fb_access_token.access_token;
    let user;

    try {
      let response = await InstagramRepository.getAccounts(accessToken);
      if (fbAccountId) {
        let instagramAccounts = await InstagramRepository.getInstagrabBusinessAccountIdV2(
          fbAccountId,
          accessToken
        );

        let instagramResponse = instagramAccounts.data;
        if (instagramResponse.data) {
          instagramResponse = instagramResponse.data;
        }
        console.log(instagramResponse);

        let instagramAccountId;
        if (
          instagramResponse[0] &&
          instagramResponse[0].instagram_business_account
        ) {
          instagramAccountId =
            instagramResponse[0].instagram_business_account.id;
        } else if (instagramResponse.instagram_business_account) {
          instagramAccountId = instagramResponse.instagram_business_account.id;
        } else if (
          instagramResponse[1] &&
          instagramResponse[1].instagram_business_account
        ) {
          instagramAccountId =
            instagramResponse[1].instagram_business_account.id;
        } else {
          return res.status(403).send({
            error:
              "That facebook page is not connected with your Instagram business page!",
          });
        }

        req.user.chosen_instagram_account = instagramAccountId;
        user = await req.user.save();
      }
      res.send(user);
    } catch (error) {
      console.log(error);
      res.status(403).send(error.message);
    }
  }

  getPosts(req, res) {
    let accessToken = req.user.fb_access_token.access_token;
    console.log("GETTING POSTS WITH ACCESS TOKEN: ", accessToken);
    let instagramAccountId = req.user.chosen_instagram_account;
    let hmac = crypto
      .createHmac("sha256", process.env.FB_APP_SECRET)
      .update(accessToken)
      .digest("hex");
    console.log(
      `${baseGraphApi}${instagramAccountId}/media?access_token=${accessToken}&fields=media_url&appsecret_proof=${hmac}`
    );
    let url = `${baseGraphApi}${instagramAccountId}/media?access_token=${accessToken}&fields=media_url&appsecret_proof=${hmac}`;

    axios
      .get(url)
      .then((response) => {
        res.send(response.data.data);
      })
      .catch((e) => {
        res
          .status(403)
          .send({ message: "Facebook token expired, please login again" });
      });
  }

  async getStories(req, res) {
    let accessToken = req.user.fb_access_token.access_token;

    try {
      let response = await InstagramRepository.getStories(
        accessToken,
        req.user.chosen_instagram_account
      );

      res.send(response.data);
    } catch (error) {
      res.status(403).send(error.message);
    }
  }

  async webhook(req, res) {
    if (req.query["hub.verify_token"] === "WinterIsComingGOT2019") {
      let storyInsight = new StoryInsights(req.body);
      storyInsight.save();
      res.status(200).send(req.query["hub.challenge"]);
    } else {
      res.status(401).send("that is not cool");
    }
  }

  
  getIgPosts(req, res) {
    let accessToken = req.user.fb_access_token.access_token;
    console.log("GETTING POSTS WITH ACCESS TOKEN: ", accessToken);
    let instagramAccountId = req.user.chosen_instagram_account;
    
    let url = `https://graph.facebook.com/${instagramAccountId}?fields=id,username&access_token=${accessToken}`
    axios
      .get(url)
      .then((response) => {
        res.send(response.data.data);
      })
      .catch((e) => {
        res
          .status(403)
          .send({ message: "Facebook token expired, please login again" });
      });
  }

}

module.exports = InstagramGraphApiController;
