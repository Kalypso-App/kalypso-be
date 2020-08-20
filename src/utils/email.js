const sgMail = require("@sendgrid/mail");

module.exports = {
  sendVerificationEmail: (to, id) => { // function for sending mail for email verification after register
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
	const msg = {
        to: to,
        from: 'piterjov@gmail.com',
        subject: 'Verify Your Email - Kalypso',
        text: 'Hey Katherine, please define generic text message for sign up confirmation',
        html: `<p>Your registration is completed. Please click the below link to verify your email.</p><p><a href="${process.env.BACKEND_API}/verify-email/${id}" target="_blank">Verify Your Email</a></p>`
    };

    try {
      sgMail
        .send(msg)
        .then(() => {})
        .catch(() => {});
    } catch (error) {
      throw new Error(error);
    }
  },

  sendForgotPasswordEmail: (to, str) => {
    // function for sending mail for forgot password
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    const msg = {
      to: to,
      from: "piterjov@gmail.com",
      subject: "Forgot Password - Kalypso",
      text:
        "Hey Katherine, please define generic text message for sign up confirmation",
      html:
        '<p>We received the request to reset your password. Please follow this link to create a new password for Kalypso</p><p><a href="https://app.kalypsoapp.co/#/forget/' +
        str +
        '" target="_blank">Reset Your Password</a></p>',
    };

    try {
      sgMail
        .send(msg)
        .then(() => {})
        .catch(() => {});
    } catch (error) {
      throw new Error(error);
    }

    try {
      sgMail
        .send(msg)
        .then(() => {})
        .catch(() => {});
    } catch (error) {
      throw new Error(error);
    }
  },
};
