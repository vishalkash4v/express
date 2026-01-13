const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",       // dummy SMTP host
  port: 465,                      // usually 587
  secure: true,                  // true for 465, false for 587
  auth: {
    user: "bestsmm4all@gmail.com",     // dummy email
    pass: "dhkv nzhg hspe tnex "        // dummy password
  }
});

async function sendMail({ subject, html }) {
  return transporter.sendMail({
    from: '"FynTools" <bestsmm4all@gmail.com>',
    to: "cqlsysvishal@gmail.com",      // where you want to receive mail
    subject,
    html
  });
}

module.exports = sendMail;
