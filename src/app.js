require('dotenv').config()
const dotenv = require('dotenv');
const express = require("express");
const userRouter = require("./routers/user");
const instagramRouter = require("./routers/instagram");
const campaignRouter = require("./routers/campaigns");
const stripeRouter = require("./routers/stripe");
const gaReportRouter = require("./routers/gareport");

const port = process.env.PORT;
const bodyParser = require("body-parser");
const cors = require("cors");
var morgan = require('morgan');
//var winston = require('./config/winston');
var logger = require("./config/logger");

var cron = require('node-cron');

require("./db/db");

const app = express();

app.use(cors());

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    res.setHeader('Access-Control-Allow-Credentials', true);

  /*
    bodyParser.json()(req, res, (err) => {
    if (err) {
      return res.sendStatus(400); // Bad request
    }
  });
  */
    next();
});

app.use(bodyParser.urlencoded({
  limit: '50mb',
  extended: true
}));

app.use(bodyParser.json({
  limit: '50mb',
  verify: function(req,res,buf) {
    var url = req.originalUrl;
    if (url.startsWith('/stripe/stripe-webhook')) {
        req.rawBody = buf.toString()
    }
  }
}));

app.use(require('morgan')("combined", { "stream": logger.stream }));

//app.use(bodyParser.raw());
//app.use(express.json());
//app.use(morgan('combined', { stream: winston.stream }));
app.use(userRouter);
app.use("/instagram", instagramRouter);
app.use("/campaigns", campaignRouter);
app.use("/stripe", stripeRouter);
app.use(gaReportRouter);

app.listen(port, () => {});
