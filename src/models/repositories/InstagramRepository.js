const axios = require("axios");
const { generateInstagramGraphApiUrl } = require("../../utils/instagram");

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
}

module.exports = new InstagramRepository();
