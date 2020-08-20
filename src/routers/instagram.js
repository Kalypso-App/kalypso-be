const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const InstagramGraphApiController = require("../controllers/InstagramGraphApiController");
const InstagramCtrl = new InstagramGraphApiController();

router.get("/accounts", auth, InstagramCtrl.getAccounts);
router.get("/posts", auth, InstagramCtrl.getPosts);
router.get("/stories", auth, InstagramCtrl.getStories);
router.get("/webhooks", InstagramCtrl.getwebhook);
router.post("/webhooks", InstagramCtrl.webhook);
router.post("/set-account/:id", auth, InstagramCtrl.setAccount);
router.get("/igposts", auth, InstagramCtrl.getIgPosts);

module.exports = router;
