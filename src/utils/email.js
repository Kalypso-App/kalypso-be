const sgMail = require("@sendgrid/mail");

module.exports = {
  sendVerificationEmail: (to, id, name) => { // function for sending mail for email verification after register
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    let html = `<p>Welcome ${name}!</p>
    <p>We’re so excited for you to start reporting on your brand deals with Kalypso.</p>
    <p>Please verify your email by clicking <a href="${process.env.BACKEND_API}/verify-email/${id}" target="_blank">here</a> .</p>
    `;

    let text = `Welcome ${name}!.
    We’re so excited for you to start reporting on your brand deals with Kalypso.
    Please verify your email by clicking ${process.env.BACKEND_API}/verify-email/${id}.
    `;

 	const msg = {
        to: to,
        from: 'social@kalypsoapp.co',
        subject: 'Verify Your Email - Kalypso',
        text: text,
        html: html
       };

    try {
      sgMail
        .send(msg)
        .then((re) => {
        })
        .catch((e) => {
        });
    } catch (error) {
      logger.error(error);
      throw new Error(error);
    }
  },

  sendForgotPasswordEmail: (to, str) => {
    // function for sending mail for forgot password
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    let text = `Hey there - we see you forgot your password for Kalypso. Don’t worry, we do this all the time, too.
    Please reset your password at this ${process.env.BACKEND_API}/forget/${str} link`;

    let html = `<p>Hey there - we see you forgot your password for Kalypso. Don’t worry, we do this all the time, too.</p>
    <p>Please reset your password at this <a href="${process.env.BACKEND_API}/forget/${str}" target="_blank">link</a></p>`;


    const msg = {
      to: to,
      from: "social@kalypsoapp.co",
      subject: "Forgot Password - Kalypso",
      text: text,
      html: html
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
