const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const CampaignController = require("../controllers/CampaignController");
const CampaignCtrl = new CampaignController();
const multer = require("multer");
let AWS = require("aws-sdk");
var cron = require('node-cron');
const TikTokAPI = require('tiktok-api');
const { getRequestParams} = require('tiktok-api');
const TikTokScraper = require('tiktok-scraper');


let storage = multer.memoryStorage();
let upload = multer({ storage: storage });

 cron.schedule('0 3 * * *', () => {
     CampaignCtrl.runCron();
 }, {
   scheduled: true,
   timezone: 'America/New_York'
 });

/*
cron.schedule('* * * * *', () => {
       CampaignCtrl.runCron();
   }, {
     timezone: 'America/New_York'
   });
*/

router.post("/", auth, function(req,res){
   CampaignCtrl.create(req,res);
});
router.post("/edit-campaigns", auth, function(req,res){
  CampaignCtrl.edit(req,res);
});
router.get("/", auth, CampaignCtrl.list);
router.get("/:id", CampaignCtrl.get);
router.get("/sync/:id", auth, function(req,res){
  CampaignCtrl.sync(req, res);
});
router.get("/force-sync/:id", function(req,res){
  CampaignCtrl.forcesync(req, res);
});
router.get("/search/:text", auth, function(req,res){
  CampaignCtrl.search(req,res);
});
router.get("/delete/:id", auth, CampaignCtrl.delete);

router.post("/upload", auth, upload.single("file"), (req, res) => {
  const file = req.file;
  const s3FileURL = process.env.AWS_UPLOADED_FILE_URL_LINK;

  let s3Bucket = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
  });

  console.log({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
  });

  let params = {
    Bucket: process.env.AWS_BUCKET_NAME + "/campaigns/" + req.user._id,
    Key: file.originalname,
    Body: file.buffer,
    ContentType: file.mimetype,
    ACL: "public-read",
  };
  console.log(params);

  s3Bucket.upload(params, function (err, data) {
    if (err) {
      res.status(500).json({ error: true, Message: err });
    } else {
      res.send({ data });
      //   var newFileUploaded = {
      //     description: req.body.description,
      //     fileLink: s3FileURL + file.originalname,
      //     s3_key: params.Key,
      //   };
      //   var document = new DOCUMENT(newFileUploaded);
      //   document.save(function (error, newFile) {
      //     if (error) {
      //       throw error;
      //     }
      //   });
    }
  });
});

router.post("/add-story", auth,  upload.single("oldStoryFile"), function(req,res){
  CampaignCtrl.saveStory(req,res);
});

router.get("/delete-story/:id", auth,  function(req,res){
  CampaignCtrl.deleteStory(req,res);
});


router.post("/add-reel", auth,  upload.single("oldReelFile"), function(req,res){
  CampaignCtrl.saveReel(req,res);
});

router.get("/delete-reel/:id", auth,  function(req,res){
  CampaignCtrl.deleteReel(req,res);
});

router.get("/admin/get-all-campaigns",  function(req,res){
  CampaignCtrl.getAllCampaigns(req,res);
});


router.get("/tiktok/TikTokAPI/:name", async function(req,res){
 
  const signURL = async (url, ts, deviceId) => {
    const as = 'test_as_1234';
    const cp = 'test_cp_12345'
    const mas = 'test_mas_543`1';
    return `${url}&as=${as}&cp=${cp}&mas=${mas}`;
  };

  const params = getRequestParams({
    device_id: '83465nsakjdh72dslfkj'
  });
   
  const api = new TikTokAPI.default(params, {signURL});
   
  let data =  await api.searchUsers({
    keyword: req.params.name,
    count: 10,
    cursor: 0,
  });


  res.send(data.data);

});


router.get("/tiktok/tiktok-scraper/:name", async function(req,res){

  try{
  const users = await TikTokScraper.getUserProfileInfo(req.params.name);
  const posts = await TikTokScraper.user(req.params.name, { number: 100 });
   
  res.send(users);
  }
  catch(err){
    res.send(err);
  }
});

router.get("/tiktok/tiktok-scraper/posts/:name", async function(req,res){

  try{
  const posts = await TikTokScraper.user(req.params.name, { number: 100 });
   
  res.send(posts);
  }
  catch(err){
    res.send(err);
  }
});

 
module.exports = router;
