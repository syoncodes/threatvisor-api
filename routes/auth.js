const router = require("express").Router();
const { User } = require("../models/user");
const mongoose = require('mongoose');
const { Organization } = require("../routes/orgusers"); // Assuming you have an Organization model
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const Joi = require("joi");
const sgMail = require('@sendgrid/mail');
const crypto = require('crypto');
sgMail.setApiKey('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');

User.generatePasswordResetToken = function() {
	const resetToken = crypto.randomBytes(20).toString('hex');
	// You can add fields to your user model to store this token and a token expiration date
	this.resetToken = resetToken;
	this.resetTokenExpire = Date.now() + 3600000; // Token expires in 1 hour
	return resetToken;
  };
  
  // Update the route
  router.post('/reset-password', async (req, res) => {
	try {
	  const { email } = req.body;
	  const user = await User.findOne({ email });
	  if (!user) {
		return res.status(404).json({ message: 'User not found' });
	  }
  
	  const resetToken = user.generatePasswordResetToken();
	  await user.save(); // Save the token and expiration to the user document
  
	  const resetLink = `https://yourwebsite.com/password-reset?token=${resetToken}`;
	  const msg = {
		to: email,
		from: 'support@threatvisor.org',
		subject: 'Password Reset',
		text: `Please click on the following link to reset your password: ${resetLink}`,
	  };
  
	  await sgMail.send(msg);
	  res.status(200).json({ message: 'Password reset email sent successfully' });
	} catch (error) {
	  console.error(error);
	  res.status(500).json({ error: 'Failed to send password reset email' });
	}
  });

// Define an endpoint to send verification emails
router.post('/verify', async (req, res) => {
  try {
    const { email, verificationCode } = req.body;

    const msg = {
      to: email,
      from: 'registration@threatvisor.org',
      subject: 'Verification Email',
      text: `Your verification code is: ${verificationCode}`,
    };

    await sgMail.send(msg);
    res.status(200).json({ message: 'Verification email sent successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to send verification email' });
  }
});

router.post('/submit-form', async (req, res) => {
	try {
	  const { name, email, subject, message, sendTo } = req.body;
  
	  const msg = {
		to: sendTo, // Use the fixed email address
		from: 'registration@threatvisor.org',
		subject,
		text: `Name: ${name}\nEmail: ${email}\nSubject: ${subject}\nMessage: ${message}`,
	  };
  
	  await sgMail.send(msg);
	  res.status(200).json({ message: 'Message sent successfully' });
	} catch (error) {
	  console.error(error);
	  res.status(500).json({ error: 'Failed to send message' });
	}
  });
  

router.post("/", async (req, res) => {
	try {
	  const { error } = validate(req.body);
	  if (error)
		return res.status(400).send({ message: error.details[0].message });
  
	  const user = await User.findOne({ email: req.body.email });
	  if (!user)
		return res.status(401).send({ message: "Invalid Email or Password" });
  
	  const validPassword = await bcrypt.compare(
		req.body.password,
		user.password
	  );
	  if (!validPassword)
		return res.status(401).send({ message: "Invalid Email or Password" });
  
	  const token = user.generateAuthToken();
  
	  let role = null;
	  if (user.organizationName) {
		const organization = await Organization.findOne({ organizationName: user.organizationName });
		if (organization) {
		  const orgUser = organization.usernames.find(u => u.email === user.email);
		  if (orgUser) {
			role = orgUser.admin ? 'Admin' : 'Regular';
		  }
		}
	  }
  
	  res.status(200).send({
		accessToken: token,
		user: user.toObject(),
		username: user.email,
		role,
		_id: user._id, // Sending the _id
		message: "logged in successfully"
	  });
		
	} catch (error) {
	  console.error("Error:", error.message);
	  console.error("Stack Trace:", error.stack);
	  res.status(500).send({ message: "Internal Server Error" });
	}
  });
  
  

router.get("/fetchOrgAndUserData", async (req, res) => {
	try {
	  const token = req.header("x-auth-token");
	  if (!token) return res.status(401).send("Access denied. No token provided.");
  
	  const decoded = jwt.verify(token, process.env.JWTPRIVATEKEY);
	  console.log("Decoded Token:", decoded);  // Debugging line
  
	  const user = await User.findById(decoded._id);
	  console.log("User:", user);  // Debugging line
	  if (!user) return res.status(400).send("User not found");
  
	  // Search for the organization by its name
	  const organization = await Organization.findOne({ organizationName: user.organizationName });
	  console.log("Organization:", organization);  // Debugging line
	  if (!organization) return res.status(400).send("Organization not found");
  
	  // Create a list of users and their roles for that organization
	  const formattedData = organization.usernames.map((u, index) => ({
		id: index,
		user: u.email,
		role: u.admin ? 'Admin' : 'Regular'
	  }));
  
	  console.log("Formatted Data:", formattedData);  // Debugging line
  
	  res.status(200).send(formattedData);
	} catch (error) {
	  console.error("Error:", error);  // Debugging line
	  res.status(500).send("Internal Server Error");
	}
  });
  
  
  router.post("/editUser", async (req, res) => {
	try {
	  const { userEmail, newPassword, newRole } = req.body;
	  console.log(`Received userEmail: ${userEmail}, newPassword: ${newPassword}, newRole: ${newRole}`);
  
	  // Hash the new password
	  const salt = await bcrypt.genSalt(10);
	  const hashedPassword = await bcrypt.hash(newPassword, salt);
  
	  // Update the password in the User collection
	  const updatedUser = await User.findOneAndUpdate({ email: userEmail }, { password: hashedPassword }, { new: true });
	  if (!updatedUser) {
		console.log("User not found or not updated");
		return res.status(400).send({ message: "User not found or not updated", userEmail });
	  }
  
	  // Update the role in the Organization collection
	  const organization = await Organization.findOne({ organizationName: updatedUser.organizationName });
	  if (organization) {
		const userInOrg = organization.usernames.find(u => u.email === userEmail);
		if (userInOrg) {
		  userInOrg.admin = (newRole === 'Admin');
		  await organization.save();
		}
	  }
  
	  console.log(`User updated: ${JSON.stringify(updatedUser)}`);
	  res.status(200).send({ message: "User updated successfully", updatedUser });
	} catch (error) {
	  console.error("Error:", error);
	  res.status(500).send("Internal Server Error");
	}
  });
  
  
  router.post("/removeUser", async (req, res) => {
	try {
	  const { userEmail } = req.body;
	  console.log(`Received userEmail: ${userEmail}`);
  
	  // Find the organization that the user belongs to
	  const organization = await Organization.findOne({ "usernames.email": userEmail });
	  if (!organization) {
		console.log("Organization not found");
		return res.status(400).send("Organization not found");
	  }
  
	  // Remove the user from the organization's usernames array
	  organization.usernames = organization.usernames.filter(u => u.email !== userEmail);
	  await organization.save();
  
	  console.log(`User removed from organization: ${userEmail}`);
	  res.status(200).send("User removed successfully");
	} catch (error) {
	  console.error("Error:", error);
	  res.status(500).send("Internal Server Error");
	}
  });
  
  
  router.get('/checkUserExists', async (req, res) => {
	try {
	  const { email } = req.query;
  
	  // Check if a user with the provided email exists in the "users" collection
	  const user = await User.findOne({ email });
  
	  if (user) {
		// User with the provided email exists
		return res.json({ exists: true });
	  } else {
		// User with the provided email does not exist
		return res.json({ exists: false });
	  }
	} catch (error) {
	  console.error('Error checking user existence:', error);
	  return res.status(500).json({ error: 'Internal server error' });
	}
  });
  
  
  


const validate = (data) => {
	const schema = Joi.object({
		email: Joi.string().email().required().label("Email"),
		password: Joi.string().required().label("Password"),
	});
	return schema.validate(data);
};

module.exports = router;
