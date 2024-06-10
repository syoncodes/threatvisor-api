const router = require("express").Router();
const mongoose = require("mongoose");
const { User, validate } = require("../models/user");
const bcrypt = require("bcrypt");

function generateRandomID(length) {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()";
  let randomID = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    randomID += charset[randomIndex];
  }
  return randomID;
}
const weeklyLogSchema = new mongoose.Schema({
  date: String,
  data: {
    total: Number,
    High: Number,
    Medium: Number,
    Low: Number,
    Informational: Number,
    total_endpoints: Number
  },
  percentage_change: {
    total: String,
    filtered: String,
    total_endpoints: String
  },
});
const exploitSchema = new mongoose.Schema({
  title: String,
  link: String,
  content: String,
  source: String,
  description: String,
  examples: String,
  references: [referenceSchema],
  observed_examples: String,
  detection_methods: String,
  demonstrative_examples: String,
  extended_description: String,
}, { _id: false });
const organizationSchema = new mongoose.Schema({
  organizationName: { type: String, required: true },
  organizationID: { type: String, required: true },
  usernames: [{
    email: { type: String, required: true },
    admin: { type: Boolean, required: true },
    _id: mongoose.Schema.Types.ObjectId
  }],
  endpoints: [{
    startDate: Date,
    items: [{
      description: String,
      ipAddress: String,
      service: String,
      emailBody: String,
      senderEmail: String,
      recipientEmails: String,
      send: Boolean,
      maskedLinkMask: String,
      uniqueClickCount: Number,
      recipientCount: Number,
      url: String,
      title: String,
      scan: String,
      results: {
        type: Map,
        of: new mongoose.Schema({
          CWE: [String],
          CVE: [String],
          WASC: [String],
          Description: String,
          Solution: String,
          ThreatLevel: String,
          Paths: Array,
        }, { _id: false }) // Disable _id for subdocument
      },
      ports: {
        type: Map,
        of: new mongoose.Schema({
          service: String,
          version: String,
          protocol: String,
        }),
      },
      scanned: Date,
      exploits: {
      type: Map,
      of: {
        type: [exploitSchema], // Use the updated exploit schema
      }
    },
    }],
    status: String,
    hygiene: String,
    name: String,
  }],
  vulnerability: {
    total: Number,
    High: Number,
    Medium: Number,
    Low: Number,
    Informational: Number
  },
  vulnerability_log: [{
    total: Number,
    High: Number,
    Medium: Number,
    Low: Number,
    Informational: Number,
    timestamp: String
  }],
  ports: {
    total: Number,
    open: Number,
    filtered: Number,
    total_endpoints: Number
  },
  weekly_log: [weeklyLogSchema],
  date: String,
  vulnerability_report: String,
  __v: { type: Number, select: false } // Hide __v in queries by default
});

const Organization = mongoose.model("Organization", organizationSchema);

router.post("/", async (req, res) => {
  try {
    const { error } = validate(req.body);
    if (error)
      return res.status(400).send({ message: error.details[0].message });

    const user = await User.findOne({ email: req.body.email });
    if (user)
      return res
        .status(409)
        .send({ message: "User with given email already exists!" });

    const salt = await bcrypt.genSalt(Number(process.env.SALT));
    const hashPassword = await bcrypt.hash(req.body.password, salt);

    const newUser = new User({ ...req.body, password: hashPassword, admin: true });
    await newUser.save();

    const randomID = generateRandomID(28);

    const newOrg = new Organization({
      organizationName: req.body.organizationName,
      organizationID: randomID,
      usernames: [{ email: newUser.email, admin: true }]
    });
    await newOrg.save();

    const accessToken = newUser.generateAuthToken();

    res.status(201).send({
      message: "User created successfully",
      accessToken: accessToken,
      user: {
        _id: newUser._id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        organizationName: newUser.organizationName,
        admin: newUser.admin,
      },
    });
  } catch (error) {
    console.error("Error:", error.message);
    console.error("Stack Trace:", error.stack);
    res.status(500).send({ message: "Internal Server Error" });
  }
});


module.exports = router;
module.exports.Organization = Organization;
