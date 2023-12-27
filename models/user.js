const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const Joi = require("joi");
const crypto = require('crypto');
const passwordComplexity = require("joi-password-complexity");
const ObjectId = mongoose.Schema.Types.ObjectId;
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
  const userSchema = new mongoose.Schema({
	organizationName: { type: String, required: false },
	firstName: { type: String, required: true },
	lastName: { type: String, required: true },
	email: { type: String, required: true },
	password: { type: String, required: true },
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
			type: [{
			  title: String,
			  link: String,
			  content: String,
			  source: String
			}], // Disable _id for subdocument
		  }
		},
	  }],
	  status: String,
	  hygiene: String,
	  name: String,
	}],
	chatSessions: [{
        sessionId: String,
        messages: [{
            text: String,
            isBot: Boolean,
            timestamp: { type: Date, default: Date.now }
        }],
        responseNeeded: { type: Boolean, default: false } // New field
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
  

userSchema.methods.generateAuthToken = function () {
	const token = jwt.sign({ _id: this._id }, process.env.JWTPRIVATEKEY, {
		expiresIn: "7d",
	});
	return token;
};

userSchema.methods.generatePasswordResetToken = function() {
    const resetToken = crypto.randomBytes(20).toString('hex');
    this.resetToken = resetToken;
    this.resetTokenExpire = Date.now() + 3600000; // Token expires in 1 hour
    return resetToken;
};

const User = mongoose.model("user", userSchema);

const validate = (data) => {
	const schema = Joi.object({
		firstName: Joi.string().required().label("First Name"),
		lastName: Joi.string().required().label("Last Name"),
		email: Joi.string().email().required().label("Email"),
		password: passwordComplexity().required().label("Password"),
		organizationId: Joi.string().allow('', null).optional().label("Organization ID"),
		organizationName: Joi.string().allow('', null).optional().label("Organization Name")
	});
	return schema.validate(data);
};


module.exports = { User, validate };
