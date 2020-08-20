const baseGraphApi = process.env.GRAPH_API;
const crypto = require('crypto');

function generateInstagramGraphApiUrl(accessToken, path, params) {
    let url = '';
    let hmac = crypto.createHmac('sha256', process.env.FB_APP_SECRET).update(accessToken).digest('hex');
    url = `${baseGraphApi}${path}?access_token=${accessToken}&${params}&appsecret_proof=${hmac}`;

    return url;


}

function formatInsightResponse(response) {
    let formattedResponse = response;

    // for (let i = 0; i < formattedResponse.length; i++) {
    //     if (formattedResponse[i].data && formattedResponse[i].data.values[0]) {
    //         formattedResponse[i].value = campaignPosts[i].value[0]
    //     }
    // }


    return response;


}

module.exports.generateInstagramGraphApiUrl = generateInstagramGraphApiUrl;
module.exports.formatInsightResponse = formatInsightResponse;