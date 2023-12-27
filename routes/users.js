const router = require("express").Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { User, validate } = require("../models/user");
const { Organization } = require("../routes/orgusers");  // Make sure this path is correct

router.post("/", async (req, res) => {
  try {
    const { error } = validate(req.body);
    if (error) return res.status(400).send({ message: error.details[0].message });

    const existingUser = await User.findOne({ email: req.body.email });
    if (existingUser) return res.status(409).send({ message: "User with given email already exists!" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(req.body.password, salt);

    let organizationName = null;
    let organizationId = null;
    let admin = false;  // Set admin to false by default

    // Check if organizationId is provided
    if (req.body.organizationId) {
      const organization = await Organization.findOne({ organizationID: req.body.organizationId });
      if (!organization) return res.status(400).send({ message: "Invalid organization ID" });

      organizationId = req.body.organizationId;
      organizationName = organization.organizationName;

      organization.usernames.push({ email: req.body.email, admin: admin });  // Add the email and admin status to the usernames array
      await organization.save();  // Save the updated organization
    }

    const newUser = new User({
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email,
      password: hashedPassword,
      organizationId: organizationId, // Set organizationId explicitly
      organizationName: organizationName,  // Set organizationName explicitly
      admin: admin  // Set admin to false for regular users
    });

    await newUser.save();

    const token = jwt.sign({ _id: newUser._id }, process.env.JWTPRIVATEKEY, {
      expiresIn: "7d",
    });

    res.status(201).send({ message: "User created successfully", user: newUser, token });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

router.post('/fetch-user', async (req, res) => {
  try {
    const { userId } = req.body; // Change email to userId

    // Find the user by ID
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).send({ message: 'User not found' });
    }

    // Then, find the organization where this user's email is listed
    const organization = await Organization.findOne({ 
      'usernames.email': user.email
    });

    // Include organization details in the response
    const userData = {
      ...user.toObject(),
      organizationID: organization ? organization.organizationID : null,
      organizationName: organization ? organization.organizationName : null,
    };

    res.json(userData);
  } catch (error) {
    console.error('Error occurred:', error);
    res.status(500).send({ error: 'Internal Server Error' });
  }
});


router.post('/update-user', async (req, res) => {
  try {
    const { userId, organizationID, ...restOfUserData } = req.body;

    console.log('Received data:', { userId, organizationID, ...restOfUserData });

    // Find and update the user
    const user = await User.findById(userId);
    if (!user) {
      console.error('User not found with id:', userId);
      return res.status(404).send({ success: false, message: 'User not found.' });
    }

    console.log('Found user:', user);

    // Update user's data
    Object.assign(user, restOfUserData);
    
    if (organizationID) {
      console.log('Updating organization to:', organizationID);

      // Find the new organization
      const newOrganization = await Organization.findOne({ organizationID: organizationID });
      if (!newOrganization) {
        console.error('Organization not found with id:', organizationID);
        return res.status(404).send({ message: 'Organization not found' });
      }

      console.log('Found new organization:', newOrganization);

      // Update organization name in the user's document
      user.organizationName = newOrganization.organizationName;

      // Remove the user from any previous organization
      const updateResult = await Organization.updateMany(
        { 'usernames.email': user.email },
        { $pull: { usernames: { email: user.email } } }
      );

      console.log('Removed user from previous organizations:', updateResult);

      // Add the user to the new organization
      newOrganization.usernames.push({ email: user.email, admin: false });
      await newOrganization.save();

      console.log('Added user to new organization:', newOrganization);
    }

    // Save the updated user
    await user.save();
    console.log('User updated successfully:', user);

    res.json({ success: true, message: 'User updated successfully.' });
  } catch (error) {
    console.error('Error occurred:', error);
    res.status(500).send({ error: 'Internal Server Error' });
  }
});





router.post('/change-password', async (req, res) => {
  const { userId, oldPassword, newPassword } = req.body;
  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Old password is incorrect' });
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    user.password = hashedPassword;
    await user.save();
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error occurred:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/delete-user', async (req, res) => {
  const { userId } = req.body;
  try {
    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    // Remove user from any associated organization
    await Organization.updateMany(
      { 'usernames.email': user.email },
      { $pull: { usernames: { email: user.email } } }
    );

    // Delete the user
    await User.findByIdAndDelete(userId);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error occurred:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
