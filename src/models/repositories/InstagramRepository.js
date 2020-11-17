const axios = require("axios");
const { generateInstagramGraphApiUrl } = require("../../utils/instagram");
const baseGraphApi = process.env.GRAPH_API;
const multer = require("multer");
let AWS = require("aws-sdk");
const path = require('path')
const Url = require('url');
const request = require('request-promise')

let storage = multer.memoryStorage();
let upload = multer({ storage: storage });

class InstagramRepository {
  constructor(model) {
    this.model = model;
  }

  getAccounts(accessToken) {
    let url = generateInstagramGraphApiUrl(
      accessToken,
      "me/accounts",
      "fields=about,description,picture,name,access_token"
    );
    return new Promise(function (resolve, reject) {
      axios
        .get(url)
        .then((response) => {
          return resolve(response);
        })
        .catch(() => {
          reject({ message: "Facebook token expired, please login again" });
        });
    });
  }

  async getInsights(accessToken, mediaObjectId, isPost = true) {
    let metric = "metric=engagement,impressions,reach,saved";
    
    if(!isPost){
      metric = "metric=exits,impressions,reach,replies,taps_forward,taps_back";
    }
    let url = generateInstagramGraphApiUrl(
      accessToken,
      `${mediaObjectId}/insights`,
      metric
      );
    //"metric=engagement,impressions,reach,saved"
     
    let urlDetail = generateInstagramGraphApiUrl(
      accessToken,
      `${mediaObjectId}`,
      "fields=caption,comments_count,like_count,media_url,permalink,thumbnail_url "
      );

    let postDetail = await axios.get(urlDetail);
  
    return new Promise(function (resolve, reject) {
      axios
        .get(url)
        .then((response) => {
          return resolve({response, postDetail});
        })
        .catch((e) => {
          return resolve({  postDetail });
        });
    });
  }

  getStories(accessToken, instagramAccountId) {
    let url = generateInstagramGraphApiUrl(
      accessToken,
      `${instagramAccountId}/stories`,
      "fields=media_url,caption,comments_count,media_type,permalink"
    );
    return new Promise(function (resolve, reject) {
      axios
        .get(url)
        .then((response) => {
          return resolve(response.data);
        })
        .catch((err) => {
          reject({ message: "Facebook token expired, please login again" });
        });
    });
  }

  getRefreshToken(accessToken) {
    console.log;
    let url = generateInstagramGraphApiUrl(
      accessToken,
      `oauth/access_token`,
      `grant_type=fb_exchange_token&fb_exchange_token=${accessToken}&client_id=${process.env.FB_APP_ID}&client_secret=${process.env.FB_APP_SECRET}`
    );
    console.log(url);
    return new Promise(function (resolve, reject) {
      axios
        .get(url)
        .then((response) => {
          return resolve(response.data);
        })
        .catch(() => {
          reject({ message: "Facebook token expired, please login again" });
        });
    });
  }

  getInstagrabBusinessAccountId(facebookPageAccountId, accessToken) {
    let url = generateInstagramGraphApiUrl(
      accessToken,
      "me/accounts",
      "fields=picture,name,instagram_business_account,access_token"
    );
    console.log(url);
    return new Promise(function (resolve, reject) {
      axios
        .get(url)
        .then((response) => {
          return resolve(response);
        })
        .catch(() => {
          reject({ message: "Facebook token expired, please login again" });
        });
    });
  }

  getInstagrabBusinessAccountIdV2(facebookPageAccountId, accessToken) {
    let url = generateInstagramGraphApiUrl(
      accessToken,
      `${facebookPageAccountId}`,
      "fields=instagram_business_account"
    );
    console.log(url);
    return new Promise(function (resolve, reject) {
      axios
        .get(url)
        .then((response) => {
          return resolve(response);
        })
        .catch(() => {
          reject({ message: "Facebook token expired, please login again" });
        });
    });
  }

  getIgAccountDetail(accId, accessToken){
    let url = generateInstagramGraphApiUrl(
      accessToken,
      `${accId}`,
      "fields=biography,followers_count,follows_count,name,profile_picture_url,username"
    );
    console.log(url);
    return new Promise(function (resolve, reject) {
      axios
        .get(url)
        .then((response) => {
          return resolve(response);
        })
        .catch((err) => {
          reject({ message: "Facebook token expired, please login again" });
        });
    });
  }

  getFbPageDetail(pageId, accessToken){
    let url = `${baseGraphApi}${pageId}?fields=name,cover,picture,fan_count&access_token=${accessToken}`;
   
    return new Promise(function (resolve, reject) {
      axios
        .get(url)
        .then((response) => {
          return resolve(response);
        })
        .catch((err) => {
          reject({ message: "Facebook token expired, please login again" });
        });
    });
  }

  async getFacebookInsights(pageAccessToken, accessToken, post_id){
    let fields = `post_reactions_like_total,post_reactions_love_total,post_reactions_wow_total,
    post_reactions_haha_total,post_reactions_sorry_total,post_reactions_anger_total,
    post_reactions_by_type_total,post_impressions,post_impressions_unique,post_engaged_users,post_clicks`;
  
    let url = `${baseGraphApi}${post_id}/insights?period=lifetime&metric=${fields}&access_token=${pageAccessToken}`;
   
    let urlDetail = `${baseGraphApi}${post_id}/comments?summary=total_count&access_token=${accessToken}`;

    let urlPost = `${baseGraphApi}${post_id}?fields=id,message,story,attachments,shares&access_token=${accessToken}`;
    
    let postDetail = await axios.get(urlPost);

    let commentDetail = await axios.get(urlDetail);

    return new Promise(function (resolve, reject) {
      axios
        .get(url)
        .then((response) => {
          return resolve({response, commentDetail, postDetail});
        })
        .catch((err) => {
          reject({ commentDetail, postDetail });
        });
    });
  }

  
  async uploadProfilePictureAWS(url, userId, isIg = true){
    
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
  
    let key = 'instagram/' + 'profile' + path.extname(Url.parse(url).pathname);
    if(!isIg){
      key = 'facebook/' + 'profile' + path.extname(Url.parse(url).pathname);
    }

    let params = {
      Bucket: process.env.AWS_BUCKET_NAME + "/" + userId,
      Key: key,
      Body: body,
      ContentType: 'application/octet-stream',
      ACL: "public-read"
    };
  
    s3Bucket.upload(params, function (err, data) {
      if(err){

      }
    });  
  }

}

module.exports = new InstagramRepository();
