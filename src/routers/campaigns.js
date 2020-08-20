const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const CampaignController = require("../controllers/CampaignController");
const CampaignCtrl = new CampaignController();
const multer = require("multer");
let AWS = require("aws-sdk");

let storage = multer.memoryStorage();
let upload = multer({ storage: storage });

router.post("/", auth, CampaignCtrl.create);
router.get("/", auth, CampaignCtrl.list);
router.get("/:id", auth, CampaignCtrl.get);

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

module.exports = router;
