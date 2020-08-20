const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const InstagramGraphApiController = require("../controllers/InstagramGraphApiController");
const InstagramCtrl = new InstagramGraphApiController();
var logger = require('../config/winston');

router.get("/accounts", auth, InstagramCtrl.getAccounts);
router.get("/posts", auth, InstagramCtrl.getPosts);
router.get("/stories", auth, InstagramCtrl.getStories);
router.get("/webhooks",  async (req, res) => {
     // Your verify token. Should be a random string.
     logger.info("inside webhook")
  let VERIFY_TOKEN = "WinterIsComingGOT2019";
  logger.info(req.query["hub.verify_token"]);
  // Parse the query params
  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];
    
  // Checks if a token and mode is in the query string of the request
  if (mode && token) {
  
    // Checks the mode and token sent is correct
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      
      // Responds with the challenge token from the request
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    
    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);      
    }
  }
});
    
router.post("/webhooks", InstagramCtrl.webhook);
router.post("/set-account/:id", auth, InstagramCtrl.setAccount);
router.get("/igposts", auth, InstagramCtrl.getIgPosts);

module.exports = router;
