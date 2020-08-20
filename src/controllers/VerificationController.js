const User = require('../models/User');

const VerificationController = async (req, res) => {
    let user = await User.findOne({'email': req.body.email});

    if (user.confirmed) {
        res.status(200).json('Email Already Verified');
    }
};

module.exports = VerificationController;