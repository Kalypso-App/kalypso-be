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
var winston = require('./config/winston');

require("./db/db");

const app = express();

app.use(cors());

app.use((req, res, next) => {
  bodyParser.json()(req, res, (err) => {
    if (err) {
      return res.sendStatus(400); // Bad request
    }

    next();
  });
});

app.use(express.json());
app.use(morgan('combined', { stream: winston.stream }));
app.use(userRouter);
app.use("/instagram", instagramRouter);
app.use("/campaigns", campaignRouter);
app.use("/stripe", stripeRouter);
app.use(gaReportRouter);
app.listen(port, () => {});
