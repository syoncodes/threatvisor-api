const express = require('express');
const router = require("express").Router();
const mongoose = require('mongoose');

const { User } = require("../models/user");
const { Organization } = require("../routes/orgusers");

router.post('/save-endpoint/user', async (req, res) => {
  try {
      console.log('Endpoint hit: /save-endpoint/user');
      const { userId, name, endpointData } = req.body;

      console.log("Received request data:", JSON.stringify(req.body, null, 2));

      // Find user by email
      const user = await User.findOne({ email: userId });
      if (!user) {
          console.log('User not found for ID:', userId);
          return res.status(404).send({ error: 'User not found' });
      }

      // Add hygiene and Name fields to endpointData
      endpointData.hygiene = endpointData.hygiene || "";
      endpointData.name = name;

      // Save data to the organization if the user belongs to one
      if (user.organizationName) {
          const organization = await Organization.findOne({ organizationName: user.organizationName });
          if (!organization) {
              return res.status(404).send({ error: 'Organization not found' });
          }
          organization.endpoints = organization.endpoints || [];
          organization.endpoints.push(endpointData);
          await organization.save();
          console.log("Endpoint saved to organization:", user.organizationName);
      } else {
          // Save data to the user if they don't belong to an organization
          user.endpoints = user.endpoints || [];
          user.endpoints.push(endpointData);
          await user.save();
          console.log('Endpoint saved to user:', userId);
      }

      res.send({ success: true });
  } catch (error) {
      console.error('Error occurred:', error);
      res.status(500).send({ error: 'Internal Server Error' });
  }
});


router.post('/fetch-endpoints', async (req, res) => {
  try {
    console.log('Endpoint hit: /fetch-endpoints');
    const { userId } = req.body;  // Assuming userId is actually the user's email

    console.log("Fetching endpoints for user email:", userId);

    // Find user by email
    const user = await User.findOne({ email: userId });
    if (!user) {
      console.log('User not found for email:', userId);
      return res.status(404).send({ error: 'User not found' });
    }

    // Find organization by the name associated with the user
    if (user.organizationName) {
      const organization = await Organization.findOne({ organizationName: user.organizationName });
      if (organization && organization.endpoints) {
        console.log("Returning organization's endpoints:", JSON.stringify(organization.endpoints, null, 2));
        return res.status(200).send({ endpoints: organization.endpoints, source: 'organization' });
      } else {
        console.log('Organization not found or no endpoints for organization:', user.organizationName);
        return res.status(404).send({ error: 'Organization not found or no endpoints available' });
      }
    } else {
      console.log('User does not belong to any organization:', userId);
      // If user does not belong to any organization, return user's endpoints
      if (user && user.endpoints) {
        console.log("Returning user's endpoints:", JSON.stringify(user.endpoints, null, 2));
        return res.status(200).send({ endpoints: user.endpoints, source: 'user' });
      } else {
        console.log('No endpoints found for user:', userId);
        return res.status(404).send({ error: 'No endpoints found for user' });
      }
    }
  } catch (error) {
    console.error('Error occurred:', error);
    res.status(500).send({ error: 'Internal Server Error' });
  }
});




router.post('/regenerate-email', async (req, res) => {
  try {
    console.log("Received request for regeneration:", req.body); // Log the received request body

    const { userId, newTitle, newDescription } = req.body;

    // Define the query and update actions
    const query = { "usernames.email": userId, "endpoints.items.title": newTitle };
    console.log("Query for update:", query);

    const updateActions = {
      $set: { "endpoints.$[endpoint].items.$[item].description": newDescription },
      $unset: { "endpoints.$[endpoint].items.$[item].emailBody": "" }
    };
    console.log("Update actions:", updateActions);

    const updateOptions = {
      arrayFilters: [
        { "endpoint.items.title": newTitle },
        { "item.title": newTitle }
      ],
      new: true
    };

    // Try updating in Organization collection first
    let updateResult = await Organization.findOneAndUpdate(query, updateActions, updateOptions);
    console.log("Update result from Organization:", updateResult);

    // If not found in Organization, try updating in User collection
    if (!updateResult) {
      const userQuery = { "email": userId, "endpoints.items.title": newTitle };
      updateResult = await User.findOneAndUpdate(userQuery, updateActions, updateOptions);
      console.log("Update result from User:", updateResult);
    }

    if (updateResult) {
      res.json({ success: true, message: 'Email body regenerated successfully.' });
    } else {
      res.status(404).json({ success: false, message: 'User/Organization or Endpoint item not found.' });
    }
  } catch (error) {
    console.error('Error occurred:', error);
    res.status(500).send({ error: 'Internal Server Error' });
  }
});

router.post('/save-email', async (req, res) => {
  try {
    const { userId, title, senderEmail, recipientEmails, newDescription, newEmailBody } = req.body;

    // Define the query and update actions
    const query = { "usernames.email": userId, "endpoints.items.title": title };

    const updateActions = {
      $set: {
        "endpoints.$[endpoint].items.$[item].senderEmail": senderEmail,
        "endpoints.$[endpoint].items.$[item].recipientEmails": recipientEmails, // Update this field in the database
        "endpoints.$[endpoint].items.$[item].description": newDescription,
        "endpoints.$[endpoint].items.$[item].emailBody": newEmailBody
      }
    };

    const updateOptions = {
      arrayFilters: [
        { "endpoint.items.title": title },
        { "item.title": title }
      ],
      new: true
    };

    // Try updating in Organization collection first
    let updateResult = await Organization.findOneAndUpdate(query, updateActions, updateOptions);

    // If not found in Organization, try updating in User collection
    if (!updateResult) {
      const userQuery = { "email": userId, "endpoints.items.title": title };
      updateResult = await User.findOneAndUpdate(userQuery, updateActions, updateOptions);
    }

    if (updateResult) {
      res.json({ success: true, message: 'Email and description updated successfully.' });
    } else {
      res.status(404).json({ success: false, message: 'User/Organization or Endpoint item not found.' });
    }
  } catch (error) {
    console.error('Error occurred:', error);
    res.status(500).send({ error: 'Internal Server Error' });
  }
});

router.post('/fetch-clicks-total', async (req, res) => {
  try {
    const { userId } = req.body;

    // Aggregate data for all phishing endpoints
    let totalClicks = 0;
    let totalRecipients = 0;

    const organization = await Organization.findOne({ "usernames.email": userId });
    if (organization) {
      organization.endpoints.forEach(endpoint => {
        endpoint.items.forEach(item => {
          if (item.service === "Phishing") {
            totalClicks += item.uniqueClickCount || 0;
            totalRecipients += item.recipientCount || 0;
          }
        });
      });
    } else {
      const user = await User.findOne({ "email": userId });
      user?.endpoints.forEach(endpoint => {
        endpoint.items.forEach(item => {
          if (item.service === "Phishing") {
            totalClicks += item.uniqueClickCount || 0;
            totalRecipients += item.recipientCount || 0;
          }
        });
      });
    }

    res.json({ success: true, totalClicks, totalRecipients });
  } catch (error) {
    console.error('Error occurred:', error);
    res.status(500).send({ error: 'Internal Server Error' });
  }
});


router.post('/mark-as-sent', async (req, res) => {
  try {
    const { userId, endpointId, title } = req.body;

    // First, find the user
    const user = await User.findOne({ email: userId });
    if (!user) {
      console.log('User not found:', userId);
      return res.status(404).send({ error: 'User not found' });
    }

    let documentToUpdate; // This will hold either a User or Organization document
    let orgQuery;

    // Check if the user belongs to an organization
    if (user.organizationName) {
      // Define the query to find the specific organization
      orgQuery = {
        "organizationName": user.organizationName,
        "endpoints._id": endpointId
      };

      // Fetch the organization
      const org = await Organization.findOne(orgQuery);
      if (!org) {
        return res.status(404).json({ success: false, message: 'Organization not found or endpoint not found in organization.' });
      }
      documentToUpdate = org;
    } else {
      // If the user doesn't belong to an organization, use the user document
      documentToUpdate = user;
    }

    // Find the endpoint and item
    let endpoint = documentToUpdate.endpoints.find(ep => ep._id.toString() === endpointId);
    if (!endpoint) {
      return res.status(404).json({ success: false, message: 'Endpoint not found.' });
    }

    let item = endpoint.items.find(it => it.title === title);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Email item not found.' });
    }

    // Check if recipientEmails exists and split
    let recipientCount = item.recipientEmails ? item.recipientEmails.split(',').length : 0;

    // Define the update actions
    const updateActions = {
      $set: {
        "endpoints.$[endpoint].items.$[item].send": true,
        "endpoints.$[endpoint].items.$[item].recipientCount": recipientCount
      }
    };

    // Define the options with arrayFilters to target the specific item
    const updateOptions = {
      arrayFilters: [
        { "endpoint._id": endpointId },
        { "item.title": title }
      ],
      new: true
    };

    // Update the document (Organization or User)
    const updateResult = await documentToUpdate.constructor.findOneAndUpdate(orgQuery ? orgQuery : { email: userId }, updateActions, updateOptions);

    if (updateResult) {
      res.json({ success: true, message: 'Endpoint marked as sent with recipient count.', recipientCount });
    } else {
      res.status(404).json({ success: false, message: 'Update operation failed.' });
    }
  } catch (error) {
    console.error('Error occurred:', error);
    res.status(500).send({ error: 'Internal Server Error' });
  }
});




router.post('/fetch-clicks', async (req, res) => {
  try {
    console.log("Request received in /fetch-clicks:", req.body);
    const { userId, endpointId } = req.body;

    let endpoint, organization;

    organization = await Organization.findOne({ 
      "usernames.email": userId, 
      "endpoints._id": endpointId 
    });

    console.log("Organization found:", organization ? true : false);

    if (organization) {
      endpoint = organization.endpoints.find(ep => ep._id.toString() === endpointId);
      console.log("Endpoint in organization found:", endpoint ? true : false);
    } else {
      const user = await User.findOne({ 
        "email": userId, 
        "endpoints._id": endpointId 
      });

      console.log("User found:", user ? true : false);

      if (user) {
        endpoint = user.endpoints.find(ep => ep._id.toString() === endpointId);
        console.log("Endpoint in user found:", endpoint ? true : false);
      }
    }

    if (!endpoint) {
      console.log("Endpoint not found for userId:", userId, "and endpointId:", endpointId);
      return res.status(404).json({ success: false, message: 'Endpoint not found.' });
    }

    let totalClickCount = 0;
    let totalSendCount = 0;

    endpoint.items.forEach(item => {
      totalClickCount += item.uniqueClickCount || 0;
      totalSendCount += item.recipientCount || 0;
    });

    console.log("Total click count:", totalClickCount, "Total send count:", totalSendCount);

    res.json({ success: true, clickCount: totalClickCount, sendCount: totalSendCount });
  } catch (error) {
    console.error('Error occurred in /fetch-clicks:', error);
    res.status(500).send({ error: 'Internal Server Error' });
  }
});




router.post('/check-send-status', async (req, res) => {
  try {
    const { userId, endpointId } = req.body;

    // Find the organization or user that matches the userId
    const organization = await Organization.findOne({ "usernames.email": userId });
    let isSent = organization?.endpoints.some(ep => ep._id.toString() === endpointId && ep.send);

    if (!isSent) {
      // If not found in Organization, check in User
      const user = await User.findOne({ "email": userId });
      isSent = user?.endpoints.some(ep => ep._id.toString() === endpointId && ep.send);
    }

    res.json({ success: true, isSent });
  } catch (error) {
    console.error('Error occurred:', error);
    res.status(500).send({ error: 'Internal Server Error' });
  }
});

router.post('/get-send-status', async (req, res) => {
  try {
    const { userId, endpointId, title } = req.body;

    // First, find the user
    const user = await User.findOne({ email: userId });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    let documentToQuery; // This will hold either a User or Organization document
    let query;

    // Check if the user belongs to an organization
    if (user.organizationName) {
      // Query for the organization
      query = {
        "organizationName": user.organizationName,
        "endpoints._id": endpointId,
        "endpoints.items.title": title
      };
      documentToQuery = Organization;
    } else {
      // If the user doesn't belong to an organization, use the user document
      documentToQuery = User;
      query = {
        "email": userId,
        "endpoints._id": endpointId,
        "endpoints.items.title": title
      };
    }

    const result = await documentToQuery.findOne(query);
    if (!result) {
      return res.status(404).json({ success: false, message: 'Organization or endpoint not found.' });
    }

    const endpoint = result.endpoints.find(ep => ep._id.toString() === endpointId);
    if (!endpoint) {
      return res.status(404).json({ success: false, message: 'Endpoint not found.' });
    }

    const item = endpoint.items.find(it => it.title === title);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Email item not found.' });
    }

    res.json({ success: true, isSent: item.send });
  } catch (error) {
    console.error('Error occurred:', error);
    res.status(500).send({ error: 'Internal Server Error' });
  }
});



router.post('/fetch-phishing', async (req, res) => {
  try {
      console.log('Endpoint hit: /fetch-phishing');
      const { userId } = req.body;

      console.log("Fetching phishing endpoints for user ID:", userId);

      // Find user by email
      const user = await User.findOne({ email: userId });
      if (!user) {
          console.log('User not found for ID:', userId);
          return res.status(404).send({ error: 'User not found' });
      }

      let endpoints = [];

      // Fetch data from the organization if the user belongs to one
      if (user.organizationName) {
          const organization = await Organization.findOne({ organizationName: user.organizationName });
          if (organization && organization.endpoints) {
              endpoints = organization.endpoints.filter(endpoint => endpoint.items.some(item => item.service === 'Phishing'));
              console.log("Returning organization's phishing endpoints:", JSON.stringify(endpoints, null, 2));
              return res.status(200).send({ endpoints, source: 'organization' });
          }
      }

      // Fetch data from the user if they don't belong to an organization
      if (user.endpoints) {
          endpoints = user.endpoints.filter(endpoint => endpoint.items.some(item => item.service === 'Phishing'));
          console.log("Returning user's phishing endpoints:", JSON.stringify(endpoints, null, 2));
          return res.status(200).send({ endpoints, source: 'user' });
      }

      console.log('No phishing endpoints found for user.');
      return res.status(404).send({ error: 'No phishing endpoints found' });

  } catch (error) {
      console.error('Error occurred:', error);
      res.status(500).send({ error: 'Internal Server Error' });
  }
});



router.post("/fetch-org-id", async (req, res) => {
    try {
      const { userId } = req.body;
      console.log(`Fetching organization ID for user: ${userId}`);
  
      const user = await User.findOne({ email: userId });
      if (!user) {
        console.log('User not found');
        return res.status(404).send({ message: 'User not found' });
      }
  
      const organization = await Organization.findOne({ organizationName: user.organizationName });
      if (!organization) {
        console.log('Organization not found');
        return res.status(404).send({ message: 'Organization not found' });
      }
  
      console.log(`Organization ID for user ${userId}: ${organization.ID}`);
      res.status(200).send({ orgId: organization.organizationID });
    } catch (error) {
      console.error("Error fetching organization ID:", error);
      res.status(500).send({ message: 'Internal Server Error' });
    }
  });
  

  router.delete('/delete-endpoint/user', async (req, res) => {
    try {
        const { userId, domain, title, ip } = req.query;
        console.log('Received request to delete single endpoint with data:', req.query);

        // First, find the user
        const user = await User.findOne({ email: userId });
        if (!user) {
            console.log('User not found:', userId);
            return res.status(404).send({ error: 'User not found' });
        }

        let documentToUpdate; // This will hold either a User or Organization document

        // Check if the user belongs to an organization
        if (user.organizationName) {
            // Find the organization document
            const organization = await Organization.findOne({ organizationName: user.organizationName });
            if (!organization) {
                console.log('Organization not found:', user.organizationName);
                return res.status(404).send({ error: 'Organization not found' });
            }
            documentToUpdate = organization;
        } else {
            // Handle the user document directly
            documentToUpdate = user;
        }

        // Define the filter function to identify the endpoint to be deleted
        const filterEndpoint = (endpoint) => {
          return !endpoint.items.some(item => {
              if (domain && item.service === "Domain" && item.url === domain) {
                  return true;
              }
              if (title && item.service === "Phishing" && item.title === title) {
                  return true;
              }
              if (ip && item.service === "Network" && item.ipAddress === ip) {
                  return true;
              }
              // Add similar conditions for other services here
              return false;
          });
      };


        // Filter the endpoints
        const originalLength = documentToUpdate.endpoints.length;
        documentToUpdate.endpoints = documentToUpdate.endpoints.filter(filterEndpoint);

        if (documentToUpdate.endpoints.length !== originalLength) {
            await documentToUpdate.save();
            console.log('Endpoint deleted successfully:', documentToUpdate instanceof Organization ? documentToUpdate.organizationName : 'User ' + userId);
            res.send({ success: true });
        } else {
            console.log('No matching endpoint found for deletion.');
            res.status(404).send({ error: 'No matching endpoint found for deletion' });
        }
    } catch (error) {
        console.error('Error occurred:', error);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});


router.post('/fetch-endpoint-details', async (req, res) => {
  try {
      const { userId, domain, ip, title } = req.body;

      console.log('Received request to fetch endpoint details with data:', req.body);

      const user = await User.findOne({ email: userId });
      if (!user) {
          console.log('No user found associated with the email:', userId);
          return res.status(404).send({ error: 'User not found' });
      }

      let endpointToEdit = null;

      const findEndpoint = (endpoint) => {
      for (let item of endpoint.items) {
          if (domain && item.service === "Domain" && item.url === domain) {
              return true;
          }
          if (title && item.service === "Phishing" && item.title === title) {
              return true;
          }
          if (ip && item.service === "Network" && item.ipAddress === ip) {
              return true;
          }
      }
      return false;
  };


      if (user.organizationName) {
          const organization = await Organization.findOne({ organizationName: user.organizationName });
          if (organization && organization.endpoints) {
              endpointToEdit = organization.endpoints.find(findEndpoint);
          }
      } else if (user.endpoints) {
          endpointToEdit = user.endpoints.find(findEndpoint);
      }

      if (endpointToEdit) {
          console.log('Found endpoint:', endpointToEdit);
          return res.send(endpointToEdit);
      } else {
          res.status(404).send({ error: 'Endpoint not found' });
      }

  } catch (error) {
      console.error('Error occurred:', error);
      res.status(500).send({ error: 'Internal Server Error' });
  }
});

router.delete('/delete-endpoint/user', async (req, res) => {
  try {
      const { userId, ...identifier } = req.query; // Extract from req.query

      console.log('Received request to delete single endpoint with data:', req.query);

      const user = await User.findOne({ email: userId });
      if (!user) {
          console.log('No user found associated with the email:', userId);
          return res.status(404).send({ error: 'User not found' });
      }

      console.log('User found:', user);

      const filterEndpoint = (endpoint) => {
          const shouldKeep = !endpoint.items.some(item => {
              let matchFound = (identifier.domain && item.service === "Domain" && item.url === identifier.domain) ||
                               (identifier.ip && item.service === "Network" && item.ipAddress === identifier.ip) ||
                               (identifier.title && (item.service === "OSINT" || item.service === "Phishing") && item.title === identifier.title);
              console.log(`Checking item ${item.service}, Match found: ${matchFound}`);
              return matchFound;
          });
          console.log(`Endpoint ${endpoint._id} will be kept: ${shouldKeep}`);
          return shouldKeep;
      };

      let updated = false;

      if (user.organizationName) {
          const organization = await Organization.findOne({ name: user.organizationName });
          if (organization && organization.endpoints) {
              console.log('Original organization endpoints:', organization.endpoints);

              const originalLength = organization.endpoints.length;
              organization.endpoints = organization.endpoints.filter(filterEndpoint);

              if (organization.endpoints.length !== originalLength) {
                  await organization.save();
                  updated = true;
                  console.log('Updated organization endpoints:', organization.endpoints);
              } else {
                  console.log('No endpoints matched the criteria in the organization.');
              }
          } else {
              console.log('Organization not found or no endpoints in the organization.');
          }
      } else if (user.endpoints) {
          console.log('Original user endpoints:', user.endpoints);

          const originalLength = user.endpoints.length;
          user.endpoints = user.endpoints.filter(filterEndpoint);

          if (user.endpoints.length !== originalLength) {
              await user.save();
              updated = true;
              console.log('Updated user endpoints:', user.endpoints);
          } else {
              console.log('No endpoints matched the criteria in the user.');
          }
      } else {
          console.log('User has no endpoints.');
      }

      if (updated) {
          res.send({ success: true });
      } else {
          res.status(404).send({ error: 'Endpoint not found or no update needed' });
      }
  } catch (error) {
      console.error('Error occurred:', error);
      res.status(500).send({ error: 'Internal Server Error' });
  }
});

router.post('/edit-endpoint/user', async (req, res) => {
  try {
      const { userId, name, endpointData, editData } = req.body;

      console.log("Received request data:", JSON.stringify(req.body, null, 2));

      const user = await User.findOne({ email: userId });
      if (!user) {
          console.log('User not found for ID:', userId);
          return res.status(404).send({ error: 'User not found' });
      }

      const findEndpoint = (endpoint) => {
          // Similar logic as in the fetch-endpoint-details endpoint
          // Use editData to find the endpoint
          for (let item of endpoint.items) {
              if (item.service === "Network" && editData.ip && item.ipAddress === editData.ip) return true;
              if (item.service === "Domain" && editData.domain && item.url === editData.domain) return true;
              if ((item.service === "OSINT" || item.service === "Phishing") && editData.title && item.title === editData.title) return true;
          }
          return false;
      };

      let endpointToEdit = null;

      if (user.organizationName) {
          const organization = await Organization.findOne({ name: user.organizationName });
          if (organization && organization.endpoints) {
              const index = organization.endpoints.findIndex(findEndpoint);
              if (index !== -1) {
                  console.log("Updating organization:", organization.name); // Log the organization name
                  console.log("Current endpoint data:", organization.endpoints[index]); // Log the current state of the endpoint
                  console.log("New endpoint data:", endpointData); // Log the new data
                  
                  endpointData.name = name; // Ensure the name is set in the endpointData
                  organization.endpoints[index] = endpointData;
                  organization.markModified('endpoints'); // Mark the endpoints field as modified
                  await organization.save();
              }
          }
      } else if (user.endpoints) {
          const index = user.endpoints.findIndex(findEndpoint);
          if (index !== -1) {
              console.log("Updating user:", user.email); // Log the user email
              console.log("Current endpoint data:", user.endpoints[index]); // Log the current state of the endpoint
              console.log("New endpoint data:", endpointData); // Log the new data
              
              endpointData.name = name; // Ensure the name is set in the endpointData
              user.endpoints[index] = endpointData;
              user.markModified('endpoints'); // Mark the endpoints field as modified
              await user.save();
          }
      }
      
      

      if (endpointToEdit) {
          console.log('Endpoint updated:', endpointToEdit);
          res.send({ success: true });
      } else {
          res.status(404).send({ error: 'Endpoint not found' });
      }
  } catch (error) {
      console.error('Error occurred:', error);
      res.status(500).send({ error: 'Internal Server Error' });
  }
});

// Endpoint to delete multiple endpoints
router.delete('/delete-endpoints/user', async (req, res) => {
  try {
      console.log('Received request to delete multiple endpoints:', req.body);

      const { ids: endpointIds } = req.body;
      const objectIds = endpointIds.map(id => mongoose.Types.ObjectId(id));

      const user = await User.findOne({ "endpoints._id": { $in: objectIds } });
      if (!user) {
          console.log('No user found associated with the endpoint IDs:', endpointIds);
          return res.status(404).send({ error: 'User not found or endpoints not associated with user' });
      }

      if (user.organizationName) {
          const organization = await Organization.findOne({ name: user.organizationName });
          if (organization && organization.endpoints) {
              organization.endpoints = organization.endpoints.filter(endpoint => !objectIds.includes(endpoint._id));
              await organization.save();
              console.log('Endpoints deleted from organization:', user.organizationName);
          }
      } else if (user.endpoints) {
          user.endpoints = user.endpoints.filter(endpoint => !objectIds.includes(endpoint._id));
          await user.save();
          console.log('Endpoints deleted from user:', user.email);
      }

      res.send({ success: true });
  } catch (error) {
      console.error('Error occurred while deleting multiple endpoints:', error);
      res.status(500).send({ error: 'Internal Server Error' });
  }
});

router.post('/getVulnerabilities', async (req, res) => {
    const { email } = req.body;
  
    if (!email) {
      return res.status(400).send('Email is required');
    }
  
    const user = await User.findOne({ email });
  
    if (!user) {
      return res.status(404).send('User not found');
    }
  
    if (user.organizationName) {
      const organization = await Organization.findOne({ organizationName: user.organizationName });
  
      if (!organization) {
        return res.status(404).send('Organization not found');
      }
  
      return res.json(organization.vulnerability);
    } else {
      return res.json(user.vulnerability || {});
    }
  });

  router.post('/getVulnerabilityDetails', async (req, res) => {
  const { userEmail } = req.body;

  try {
    const user = await User.findOne({ email: userEmail });
    if (!user) {
      return res.status(404).send('User not found');
    }

    let vulnerabilities = [];

    if (user.organizationName) {
      const organization = await Organization.findOne({ organizationName: user.organizationName });
      if (organization) {
        vulnerabilities = extractVulnerabilities(organization);
      } else {
        // Handle the case where the organization is not found
        return res.status(404).send('Organization not found');
      }
    } else {
      // Extract vulnerabilities from the user document if the user is not part of an organization
      vulnerabilities = extractVulnerabilities(user);
    }

    res.json({ vulnerabilities });
  } catch (error) {
    console.error('Error fetching vulnerability details:', error);
    res.status(500).send('Internal Server Error');
  }
});

  
  function extractVulnerabilities(organization) {
    const vulnerabilities = {
      High: {},
      Medium: {},
      Low: {},
      Informational: {}
    };
  
    organization.endpoints.forEach(endpoint => {
      endpoint.items.forEach(item => {
        if (item.service === 'Domain') {
          // Assuming item.results is a Map
          item.results.forEach((details, issue) => {
            const threatLevel = details.ThreatLevel;
            if (threatLevel && vulnerabilities[threatLevel] !== undefined) {
              if (!vulnerabilities[threatLevel][issue]) {
                vulnerabilities[threatLevel][issue] = {
                  locations: new Set(),
                  dates: new Set()
                };
              }
  
              // Add the URL to the locations set
              vulnerabilities[threatLevel][issue].locations.add(item.url);
  
              // Add the scanned date to the dates set
              vulnerabilities[threatLevel][issue].dates.add(new Date(item.scanned).toISOString().split('T')[0]);
            }
          });
        }
      });
    });
  
    // Convert the sets to arrays for easier use
    Object.keys(vulnerabilities).forEach(severity => {
      Object.keys(vulnerabilities[severity]).forEach(issue => {
        vulnerabilities[severity][issue].locations = Array.from(vulnerabilities[severity][issue].locations);
        vulnerabilities[severity][issue].dates = Array.from(vulnerabilities[severity][issue].dates);
      });
    });
  
    return vulnerabilities;
  }


  router.post('/getVulnerabilityDetails2', async (req, res) => {
  const { userEmail } = req.body;

  try {
    const user = await User.findOne({ email: userEmail });
    if (!user) {
      return res.status(404).send('User not found');
    }

    let vulnerabilities = [];

    if (user.organizationName) {
      const organization = await Organization.findOne({ organizationName: user.organizationName });
      if (organization) {
        vulnerabilities = extractVulnerabilities2(organization);
      } else {
        // Handle the case where the organization is not found
        return res.status(404).send('Organization not found');
      }
    } else {
      // Extract vulnerabilities from the user document if the user is not part of an organization
      vulnerabilities = extractVulnerabilities2(user);
    }

    res.json({ vulnerabilities });
  } catch (error) {
    console.error('Error fetching vulnerability details:', error);
    res.status(500).send('Internal Server Error');
  }
});

  
function extractVulnerabilities2(organization) {
    const vulnerabilities = {
      High: {},
      Medium: {},
      Low: {},
      Informational: {}
    };

    organization.endpoints.forEach(endpoint => {
      endpoint.items.forEach(item => {
        if (item.service === 'Domain') {
          // Assuming item.results is a Map
          item.results.forEach((details, issue) => {
            const threatLevel = details.ThreatLevel;
            if (threatLevel && vulnerabilities[threatLevel] !== undefined) {
              if (!vulnerabilities[threatLevel][issue]) {
                vulnerabilities[threatLevel][issue] = {
                  locations: new Set(),
                  dates: new Set(),
                  paths: []  // Initialize an array to store paths
                };
              }
              if (vulnerabilities[threatLevel][issue]) {
                vulnerabilities[threatLevel][issue].description = details.Description || '';
                vulnerabilities[threatLevel][issue].solution = details.Solution || '';
                vulnerabilities[threatLevel][issue].paths.push(...details.Paths);  // Add paths from the current item
              }
              // Add the URL to the locations set
              vulnerabilities[threatLevel][issue].locations.add(item.url);

              // Add the scanned date to the dates set
              vulnerabilities[threatLevel][issue].dates.add(new Date(item.scanned).toISOString().split('T')[0]);
            }
          });
        }
      });
    });

    // Convert the sets to arrays and calculate occurrences
    Object.keys(vulnerabilities).forEach(severity => {
      Object.keys(vulnerabilities[severity]).forEach(issue => {
        vulnerabilities[severity][issue].locations = Array.from(vulnerabilities[severity][issue].locations);
        vulnerabilities[severity][issue].dates = Array.from(vulnerabilities[severity][issue].dates);
        vulnerabilities[severity][issue].occurrences = vulnerabilities[severity][issue].paths.length;  // Set occurrences as the length of paths array
      });
    });

    return vulnerabilities;
}

 router.post('/getExploitDetails', async (req, res) => {
    const { userEmail } = req.body;
  
    console.log("getExploitDetails called with userEmail:", userEmail);
  
    try {
      const user = await User.findOne({ email: userEmail });
      if (!user) {
        console.log("User not found for email:", userEmail);
        return res.status(404).send('User not found');
      }
  
      let exploits = [];
  
      console.log("User found. Organization name:", user.organizationName);
  
      if (user.organizationName) {
        const organization = await Organization.findOne({ organizationName: user.organizationName });
        console.log("Organization found:", organization);
  
        if (organization) {
          exploits = extractExploits(organization);
        } else {
          console.log("No organization found for name:", user.organizationName);
        }
      } else {
        console.log("User has no associated organization name:", user);
      }
  
      console.log("Sending exploits:", exploits);
      res.json({ exploits });
    } catch (error) {
      console.error('Error fetching exploit details:', error);
      res.status(500).send('Internal Server Error');
    }
  });
  
  function extractExploits(organization) {
    const exploits = {};

    organization.endpoints.forEach(endpoint => {
        endpoint.items.forEach(item => {
            if (item.service === 'Domain' && item.exploits) {
                item.exploits.forEach((exploitDetails, cveId) => {
                    if (!exploits[cveId]) {
                        exploits[cveId] = [];
                    }

                    exploitDetails.forEach(exploitDetail => {
                        let content = `
                          Content: ${exploitDetail.content || ''}\n
                          Description: ${exploitDetail.description || ''}\n
                          Extended Description: ${exploitDetail.extended_description || ''}\n
                          Examples: ${exploitDetail.examples || ''}\n
                          Observed Examples: ${exploitDetail.observed_examples || ''}\n
                          Detection Methods: ${exploitDetail.detection_methods || ''}\n
                          Demonstrative Examples: ${exploitDetail.demonstrative_examples || ''}\n
                        `;
                        exploits[cveId].push({
                            title: exploitDetail.title,
                            content: content,
                            source: exploitDetail.source,
                            link: exploitDetail.link,
                            location: item.url, // Location of the exploit
                            date: new Date(item.scanned).toISOString().split('T')[0] // Date when the exploit was scanned
                        });
                    });
                });
            }
        });
    });

    return exploits;
}

module.exports = router;
  
  router.post('/getVulnerabilityLog', async (req, res) => {
    const { userEmail } = req.body;
    console.log('Received request for vulnerability log with body:', req.body);
    if (!userEmail) {
      return res.status(400).send('User email is required');
    }
    try {
      const user = await User.findOne({ email: userEmail });
      if (!user) {
        return res.status(404).send('User not found');
      }
      if (user.organizationName) {
        const organization = await Organization.findOne({ organizationName: user.organizationName });
        if (!organization) {
          return res.status(404).send('Organization not found');
        }
        // Check if vulnerability_log exists
        if (organization.vulnerability_log) {
          // If vulnerability_log is an array, map over it, otherwise just print it
          if (Array.isArray(organization.vulnerability_log)) {
            const vulnerabilityLog = organization.vulnerability_log.map(log => ({
              date: log.timestamp,
              High: log.High,
              Medium: log.Medium,
              Low: log.Low,
              Informational: log.Informational
            }));
            console.log('Vulnerability Log:', vulnerabilityLog);
            return res.json({ vulnerabilityLog });
          } else {
            // vulnerability_log is not an array, just print whatever it is
            console.log('Error Vulnerability Log:', organization.vulnerability_log);
            return res.json({ vulnerabilityLog: organization.vulnerability_log });
          }
        } else {
          console.log('No vulnerability log found');
          return res.status(404).send('No vulnerability log found');
        }
      } else {
        return res.status(404).send('No organization associated with this user');
      }
    } catch (error) {
      console.error('Error fetching vulnerability log:', error);
      res.status(500).send('Internal Server Error');
    }
  });
  
  
  router.post('/getIDs', async (req, res) => {
    console.log('Received request at /getIDs with body:', req.body);
  
    const { userEmail } = req.body;
  
    if (!userEmail) {
      return res.status(400).send('User email is required');
    }
  
    try {
      const user = await User.findOne({ email: userEmail });

  
      if (!user) {
        return res.status(404).send('User not found');
      }
  
      let vulnerabilities = [];
  
      if (user.organizationName) {
        const organization = await Organization.findOne({ organizationName: user.organizationName });
        
  
        if (!organization) {
          return res.status(404).send('Organization not found');
        }
  
        vulnerabilities = getUniqueVulnerabilitiesWithHighestSeverity(organization.endpoints);
      } else {
        vulnerabilities = getUniqueVulnerabilitiesWithHighestSeverity(user.endpoints);
      }
  
      // Sort by severity level
      const finalVulnerabilities = Object.values(vulnerabilities).sort((a, b) => severityLevels[b.severity] - severityLevels[a.severity]);
  
      
      res.json({ vulnerabilities: finalVulnerabilities });
  
    } catch (error) {
      console.error('Error in /getIDs:', error);
      res.status(500).send('Internal Server Error');
    }
  });
  
  const severityLevels = {
    'Critical': 5,
    'High': 4,
    'Medium': 3,
    'Low': 2,
    'Informational': 1
  };
  
  function getUniqueVulnerabilitiesWithHighestSeverity(endpoints) {
    const vulnerabilities = {};
  
    endpoints.forEach(endpoint => {
      if (endpoint.items) {
        endpoint.items.forEach(item => {
          if (item.service === "Domain" && item.results) {
            // Since results is a Map, iterate through the entries
            item.results.forEach((vulnerabilityDetails, vulnerabilityName) => {
              // Skip non-object entries
              if (typeof vulnerabilityDetails !== 'object' || vulnerabilityDetails === null) {
                return;
              }
  
              const severityLevel = severityLevels[vulnerabilityDetails.ThreatLevel] || 0;
  
              // Process CWE IDs
              if (Array.isArray(vulnerabilityDetails.CWE)) {
                vulnerabilityDetails.CWE.forEach(cwe => {
                  const cweId = "CWE-" + cwe;
                  if (!vulnerabilities[cweId] || vulnerabilities[cweId].severityLevel < severityLevel) {
                    vulnerabilities[cweId] = { id: cweId, severity: vulnerabilityDetails.ThreatLevel, severityLevel };
                  }
                });
              }
  
              // Process WASC IDs
              if (Array.isArray(vulnerabilityDetails.WASC)) {
                vulnerabilityDetails.WASC.forEach(wasc => {
                  const wascId = "WASC-" + wasc;
                  if (!vulnerabilities[wascId] || vulnerabilities[wascId].severityLevel < severityLevel) {
                    vulnerabilities[wascId] = { id: wascId, severity: vulnerabilityDetails.ThreatLevel, severityLevel };
                  }
                });
              }
  
              // Process CVE IDs
              if (Array.isArray(vulnerabilityDetails.CVE)) {
                vulnerabilityDetails.CVE.forEach(cve => {
                  if (cve) {
                    const cveId = "CVE-" + cve;
                    if (!vulnerabilities[cveId] || vulnerabilities[cveId].severityLevel < severityLevel) {
                      vulnerabilities[cveId] = { id: cveId, severity: vulnerabilityDetails.ThreatLevel, severityLevel };
                    }
                  }
                });
              }
            });
          }
        });
      }
    });
  
    // Convert the vulnerabilities object to an array and sort by severity
    return Object.values(vulnerabilities).sort((a, b) => {
      return b.severityLevel - a.severityLevel;
    });
  }
  router.post('/getIDs2', async (req, res) => {
    console.log('Received request at /getIDs with body:', req.body);
  
    const { userEmail } = req.body;
  
    if (!userEmail) {
      return res.status(400).send('User email is required');
    }
  
    try {
      const user = await User.findOne({ email: userEmail });

  
      if (!user) {
        return res.status(404).send('User not found');
      }
  
      let vulnerabilities = [];
  
      if (user.organizationName) {
        const organization = await Organization.findOne({ organizationName: user.organizationName });
        
  
        if (!organization) {
          return res.status(404).send('Organization not found');
        }
  
        vulnerabilities = getUniqueVulnerabilitiesWithHighestSeverity(organization.endpoints);
      } else {
        vulnerabilities = getUniqueVulnerabilitiesWithHighestSeverity(user.endpoints);
      }
  
      // Sort by severity level
      const finalVulnerabilities = Object.values(vulnerabilities).sort((a, b) => severityLevels[b.severity] - severityLevels[a.severity]);
  
      
      res.json({ vulnerabilities: finalVulnerabilities });
  
    } catch (error) {
      console.error('Error in /getIDs:', error);
      res.status(500).send('Internal Server Error');
    }
  });
  

  
  function getUniqueVulnerabilitiesWithHighestSeverity(endpoints) {
    const vulnerabilities = {};
  
    endpoints.forEach(endpoint => {
      if (endpoint.items) {
        endpoint.items.forEach(item => {
          if (item.service === "Domain" && item.results) {
            item.results.forEach((vulnerabilityDetails, vulnerabilityName) => {
              if (typeof vulnerabilityDetails !== 'object' || vulnerabilityDetails === null) {
                return;
              }
  
              const severityLevel = severityLevels[vulnerabilityDetails.ThreatLevel] || 0;
  
              const processVulnerability = (id, severityLevel) => {
                if (!vulnerabilities[id] || vulnerabilities[id].severityLevel < severityLevel) {
                  vulnerabilities[id] = {
                    id: id,
                    severity: vulnerabilityDetails.ThreatLevel,
                    severityLevel,
                    locations: new Set(),
                    occurrences: 0
                  };
                }
                vulnerabilities[id].locations.add(item.url);
                vulnerabilities[id].occurrences++;
              };
  
              // Process CWE IDs
              if (Array.isArray(vulnerabilityDetails.CWE)) {
                vulnerabilityDetails.CWE.forEach(cwe => processVulnerability("CWE-" + cwe, severityLevel));
              }
  
              // Process WASC IDs
              if (Array.isArray(vulnerabilityDetails.WASC)) {
                vulnerabilityDetails.WASC.forEach(wasc => processVulnerability("WASC-" + wasc, severityLevel));
              }
  
              // Process CVE IDs
              if (Array.isArray(vulnerabilityDetails.CVE)) {
                vulnerabilityDetails.CVE.forEach(cve => {
                  if (cve) {
                    processVulnerability("CVE-" + cve, severityLevel);
                  }
                });
              }
            });
          }
        });
      }
    });
  
    return Object.values(vulnerabilities).map(vuln => ({
      ...vuln,
      locations: Array.from(vuln.locations)
    })).sort((a, b) => b.severityLevel - a.severityLevel);
  }
  
  router.post('/getPorts', async (req, res) => {
    const { email } = req.body;
  
    if (!email) {
      return res.status(400).send('Email is required');
    }
  
    try {
        const user = await User.findOne({ email });
  
        if (!user) {
          return res.status(404).send('User not found');
        }

        if (user.organizationName) {
            const organization = await Organization.findOne({ organizationName: user.organizationName });

            if (!organization) {
                return res.status(404).send('Organization not found');
            }

            // Send ports data along with weekly log data
            return res.json({
                ports: organization.ports,
                weeklyLog: organization.weekly_log
            });
        } else {
            return res.status(404).send('User is not associated with any organization');
        }
    } catch (error) {
        console.error(error);
        return res.status(500).send('Internal Server Error');
    }
});

router.post('/getVulnerabilityReport', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).send('Email is required');
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).send('User not found');
    }

    if (user.organizationName) {
      const organization = await Organization.findOne({ organizationName: user.organizationName });

      if (!organization) {
        return res.status(404).send('Organization not found');
      }

      // Access date and vulnerability report directly from the organization document
      const date = organization.date;
      const vulnerabilityReport = organization.vulnerability_report;

      return res.json({
        date: date,
        vulnerability_report: vulnerabilityReport,
      });
    } else {
      return res.status(404).send('User is not associated with any organization');
    }
  } catch (error) {
    console.error(error);
    return res.status(500).send('Internal Server Error');
  }
});



module.exports = router;
